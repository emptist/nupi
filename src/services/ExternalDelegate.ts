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
    // Step 1: Create a new session
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

    // Step 2: Send the task to the session using prompt_async (non-blocking)
    const taskPayload = {
      parts: [{ type: "text", text: task }],
    };
    const asyncResponse = await fetch(
      `${agent.url}/session/${sessionId}/prompt_async`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskPayload),
        signal: AbortSignal.timeout(this.timeout),
      },
    );

    // prompt_async returns 204 No Content immediately
    if (!asyncResponse.ok) {
      // Handle both 204 (success) and other error codes
      if (asyncResponse.status !== 204) {
        return {
          success: false,
          error: `Async task failed: HTTP ${asyncResponse.status}: ${await asyncResponse.text()}`,
        };
      }
    }

    // Step 3: Poll for session completion
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds
    const maxPollTime = this.timeout - 10000; // Leave 10s buffer

    while (Date.now() - startTime < maxPollTime) {
      const statusResponse = await fetch(
        `${agent.url}/session/${sessionId}`,
        {
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!statusResponse.ok) {
        return {
          success: false,
          error: `Status check failed: HTTP ${statusResponse.status}`,
        };
      }

      const statusText = await statusResponse.text();
      let sessionData: {
        id?: string;
        time?: { created?: number; updated?: number; archived?: number };
        summary?: { additions?: number; deletions?: number; files?: number };
      } | null = null;

      try {
        sessionData = JSON.parse(statusText);
      } catch (e) {
        return {
          success: false,
          error: `Invalid session response: ${statusText.substring(0, 100)}`,
        };
      }

      const isArchived = sessionData?.time?.archived != null;
      if (isArchived) {
        const messageResponse = await fetch(
          `${agent.url}/session/${sessionId}/message`,
          {
            signal: AbortSignal.timeout(this.timeout),
          },
        );

        if (!messageResponse.ok) {
          return {
            success: false,
            error: `Failed to retrieve messages: HTTP ${messageResponse.status}`,
          };
        }

        const messageText = await messageResponse.text();
        let messages: Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }> = [];
        try {
          messages = JSON.parse(messageText) as typeof messages;
        } catch (e) {
          return {
            success: false,
            error: `Invalid message response: ${messageText.substring(0, 100)}`,
          };
        }

        const assistantMessages = messages
          .filter(m => m.info?.role === "assistant")
          .flatMap(m => (m.parts || []).filter(p => p.type === "text").map(p => p.text || ""))
          .join("\n");

        const summary = sessionData?.summary;
        return {
          success: true,
          results: [],
          output: assistantMessages || `Session completed. ${summary?.additions ?? 0} additions, ${summary?.deletions ?? 0} deletions in ${summary?.files ?? 0} files.`,
        };
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout reached
    return { success: false, error: "Task timed out after polling" };
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