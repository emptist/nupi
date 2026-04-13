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
        `${agent.url}/session/${sessionId}/status`,
        {
          signal: AbortSignal.timeout(5000), // 5s timeout for status check
        },
      );

      if (!statusResponse.ok) {
        return {
          success: false,
          error: `Status check failed: HTTP ${statusResponse.status}`,
        };
      }

      let statusData: {
        type?: string;
        retry?: { message?: string };
        info?: { status?: string; finish?: string };
      } | null = null;

      const statusText = await statusResponse.text();
      try {
        statusData = JSON.parse(statusText) as {
          type?: string;
          retry?: { message?: string };
          info?: { status?: string; finish?: string };
        } | null;
      } catch (e) {
        if (statusText.includes("Free usage exceeded")) {
          return {
            success: false,
            error: "OpenCode free usage exceeded. Please check your subscription or usage limits.",
          };
        }
        return {
          success: false,
          error: `Invalid status response: ${statusText.substring(0, 100)}`,
        };
      }
      
      // Check if session is no longer running
      // Based on issue: {"type": "retry", "attempt": 1, "message": "Free usage exceeded..."}
      if (statusData && statusData.type !== "retry" && statusData.info?.status !== "running") {
        // Session completed, retrieve the result
        const messageResponse = await fetch(
          `${agent.url}/session/${sessionId}/message`,
          {
            signal: AbortSignal.timeout(this.timeout),
          },
        );

        if (!messageResponse.ok) {
          return {
            success: false,
            error: `Failed to retrieve result: HTTP ${messageResponse.status}: ${await messageResponse.text()}`,
          };
        }

          let result: SingleResult | null = null;
        const messageText = await messageResponse.text();
        try {
          result = JSON.parse(messageText) as SingleResult;
        } catch (e) {
          if (messageText.includes("Free usage exceeded")) {
            return {
              success: false,
              error: "OpenCode free usage exceeded. Please check your subscription or usage limits.",
            };
          }
          return {
            success: false,
            error: `Invalid result response: ${messageText.substring(0, 100)}`,
          };
        }
        
        if (!result) {
          return {
            success: false,
            error: "Failed to parse result response",
          };
        }
        
        if (!result) {
          return {
            success: false,
            error: "Failed to parse result response",
          };
        }
        
        // Handle both exitCode and finish status
        const info = result as unknown as { info?: { finish?: string } };
        const success = result.exitCode === 0 || info?.info?.finish === "stop";
        return {
          success,
          results: [result],
          output: this.extractOutput(result),
        };
      }

      // Still running, wait before polling again
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