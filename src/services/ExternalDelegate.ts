import type {
  ExternalAgentConfig,
  AgentRegistry,
  DelegateOptions,
  DelegateResult,
  SingleResult,
  TokenUsage,
  NuPIConfig,
} from "../types/external.js";

export class ExternalDelegate {
  private agents: AgentRegistry;
  private defaultModel: string;
  private timeout: number;
  private autoFallback: boolean;

  constructor(config: NuPIConfig = {}) {
    this.agents = config.agents || {};
    this.defaultModel = config.defaultModel || "glm-4.5-flash";
    this.timeout = config.timeout || 300000; // 5 min default
    this.autoFallback = config.autoFallback ?? true;
  }

  registerAgent(name: string, config: ExternalAgentConfig): void {
    this.agents[name] = config;
  }

  getAgent(name: string): ExternalAgentConfig | undefined {
    return this.agents[name];
  }

  hasAgent(name: string): boolean {
    return name in this.agents;
  }

  getAgentNames(): string[] {
    return Object.keys(this.agents);
  }

  async delegate(options: DelegateOptions): Promise<DelegateResult> {
    const { mode = "single", agent, task, tasks, chain } = options;

    try {
      switch (mode) {
        case "single":
          return await this.singleDelegate(agent!, task!);
        case "parallel":
          return await this.parallelDelegate(tasks!);
        case "chain":
          return await this.chainDelegate(chain!);
        default:
          return { success: false, error: `Unknown mode: ${mode}` };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (this.autoFallback && mode === "single") {
        return {
          success: false,
          error: `External failed: ${errorMessage}. Use standalone mode.`,
        };
      }
      return { success: false, error: errorMessage };
    }
  }

  private async singleDelegate(
    agentName: string,
    task: string,
  ): Promise<DelegateResult> {
    const agent = this.getAgent(agentName);
    if (!agent) {
      return { success: false, error: `Unknown agent: ${agentName}` };
    }

    const maxRetries = 2;
    const baseDelay = 10000; // 10s

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.doSingleDelegate(agent, task);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const isTimeout =
          errorMessage.includes("timeout") || errorMessage.includes("aborted");

        if (attempt < maxRetries && isTimeout) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(
            `[ExternalDelegate] Timeout, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return { success: false, error: `Request failed: ${errorMessage}` };
      }
    }

    return { success: false, error: "Max retries exceeded" };
  }

  private async doSingleDelegate(
    agent: ExternalAgentConfig,
    task: string,
  ): Promise<DelegateResult> {
    const sessionResponse = await fetch(`${agent.url}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "NuPI Delegation" }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!sessionResponse.ok) {
      return {
        success: false,
        error: `Session creation failed: HTTP ${sessionResponse.status}`,
      };
    }

    const session = (await sessionResponse.json()) as { id: string };
    const sessionId = session.id.startsWith("ses_")
      ? session.id
      : `ses_${session.id}`;

    const asyncResponse = await fetch(
      `${agent.url}/session/${sessionId}/prompt_async`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts: [{ type: "text", text: task }] }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (asyncResponse.status !== 204) {
      return {
        success: false,
        error: `Async prompt failed: HTTP ${asyncResponse.status}`,
      };
    }

    const startTime = Date.now();
    const pollInterval = 3000;
    const maxPollTime = this.timeout - 5000;

    while (Date.now() - startTime < maxPollTime) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const statusResponse = await fetch(
        `${agent.url}/session/status`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (statusResponse.ok) {
        const statusData = (await statusResponse.json()) as Record<
          string,
          { type?: string; message?: string }
        >;
        const sessionStatus = statusData[sessionId];
        if (sessionStatus?.type === "retry" && sessionStatus.message?.includes("Free usage exceeded")) {
          return {
            success: false,
            error: `OpenCode: ${sessionStatus.message}`,
          };
        }
      }

      const sessionInfo = await fetch(`${agent.url}/session/${sessionId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!sessionInfo.ok) continue;

      const sessionData = (await sessionInfo.json()) as {
        time?: { archived?: number };
      };
      if (sessionData.time?.archived != null) {
        const msgResponse = await fetch(
          `${agent.url}/session/${sessionId}/message`,
          { signal: AbortSignal.timeout(this.timeout) },
        );
        if (!msgResponse.ok) {
          return {
            success: false,
            error: `Failed to get messages: HTTP ${msgResponse.status}`,
          };
        }

        const msgText = await msgResponse.text();
        let messages: Array<{
          info?: { role?: string; finish?: string; error?: { name?: string; data?: { message?: string } } };
          parts?: Array<{ type?: string; text?: string }>;
        }> = [];
        try {
          messages = JSON.parse(msgText) as typeof messages;
        } catch {
          return {
            success: false,
            error: `Invalid message response: ${msgText.substring(0, 200)}`,
          };
        }

        const assistantMsg = messages.find((m) => m.info?.role === "assistant");
        if (assistantMsg?.info?.error) {
          const errMsg = assistantMsg.info.error.data?.message || assistantMsg.info.error.name || "Unknown error";
          return { success: false, error: `OpenCode error: ${errMsg}` };
        }

        const textParts = (assistantMsg?.parts || [])
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text!);

        return {
          success: true,
          results: [],
          output: textParts.join("\n") || "Task completed (no text output)",
        };
      }
    }

    return { success: false, error: "Delegation timed out" };
  }

  private async parallelDelegate(
    tasks: Array<{ agent: string; task: string; cwd?: string }>,
  ): Promise<DelegateResult> {
    const MAX_CONCURRENT = 4;
    const results: SingleResult[] = [];
    const executing: Promise<DelegateResult>[] = [];

    for (const t of tasks) {
      const promise = this.singleDelegate(t.agent, t.task);
      executing.push(promise);

      if (
        executing.length >= MAX_CONCURRENT ||
        tasks.indexOf(t) === tasks.length - 1
      ) {
        const batchResults = await Promise.all(executing);
        const flatResults = batchResults
          .flatMap((r) => r.results || [])
          .filter((r): r is SingleResult => !!r);
        results.push(...flatResults);
        executing.length = 0;
      }
    }

    const allSuccess = results.every((r) => r.exitCode === 0);
    return {
      success: allSuccess,
      results,
      output: results.map((r) => this.extractOutput(r)).join("\n\n---\n\n"),
    };
  }

  private async chainDelegate(
    chain: Array<{ agent: string; task: string; cwd?: string }>,
  ): Promise<DelegateResult> {
    const results: SingleResult[] = [];
    let previousOutput = "";

    for (let i = 0; i < chain.length; i++) {
      const step = chain[i];
      const taskWithContext = step.task.replace(
        /\{previous\}/g,
        previousOutput,
      );

      const result = await this.singleDelegate(step.agent, taskWithContext);
      if (!result.success) {
        return {
          success: false,
          results,
          output: `Chain stopped at step ${i + 1} (${step.agent}): ${result.error}`,
          error: result.error,
        };
      }

      results.push(...(result.results || []));
      previousOutput = result.output || "";
    }

    return { success: true, results, output: previousOutput };
  }

  private extractOutput(result: SingleResult): string {
    // Try direct parts property
    const r = result as unknown as {
      parts?: Array<{ text?: string; type?: string }>;
    };
    if (r.parts) {
      const texts = r.parts
        .filter((p): p is { text: string } => !!p.text)
        .map((p) => p.text);
      if (texts.length > 0) return texts.join("\n");
    }
    // Fallback to old structure with info.parts
    const info = result as unknown as {
      info?: { parts?: Array<{ text?: string; type?: string }> };
    };
    if (info?.info?.parts) {
      const texts = info.info.parts
        .filter((p): p is { text: string } => !!p.text)
        .map((p) => p.text);
      if (texts.length > 0) return texts.join("\n");
    }
    return result.stderr || "";
  }
}

export function createExternalDelegate(config: NuPIConfig): ExternalDelegate {
  return new ExternalDelegate(config);
}