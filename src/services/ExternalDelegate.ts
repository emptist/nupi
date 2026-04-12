import type {
  ExternalAgentConfig,
  AgentRegistry,
  DelegateOptions,
  DelegateResult,
  SingleResult,
  TokenUsage,
  NuPIConfig,
} from '../types/external.js';

export class ExternalDelegate {
  private agents: AgentRegistry;
  private defaultModel: string;
  private timeout: number;
  private autoFallback: boolean;

  constructor(config: NuPIConfig = {}) {
    this.agents = config.agents || {};
    this.defaultModel = config.defaultModel || 'glm-4.5-flash';
    this.timeout = config.timeout || 120000;
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
    const { mode = 'single', agent, task, tasks, chain } = options;

    try {
      switch (mode) {
        case 'single':
          return await this.singleDelegate(agent!, task!);
        case 'parallel':
          return await this.parallelDelegate(tasks!);
        case 'chain':
          return await this.chainDelegate(chain!);
        default:
          return { success: false, error: `Unknown mode: ${mode}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.autoFallback && mode === 'single') {
        return { success: false, error: `External failed: ${errorMessage}. Use standalone mode.` };
      }
      return { success: false, error: errorMessage };
    }
  }

  private async singleDelegate(agentName: string, task: string): Promise<DelegateResult> {
    const agent = this.getAgent(agentName);
    if (!agent) {
      return { success: false, error: `Unknown agent: ${agentName}` };
    }

    try {
      // Step 1: Create a new session
      const sessionResponse = await fetch(`${agent.url}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'NuPI Delegation' }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!sessionResponse.ok) {
        return { success: false, error: `Session creation failed: HTTP ${sessionResponse.status}` };
      }

      const session = await sessionResponse.json() as { id: string };
      const sessionId = session.id.startsWith('ses_') ? session.id : `ses_${session.id}`;

      // Step 2: Send the task to the session
      const taskPayload = {
        parts: [{ type: 'text', text: task }],
        model: { provider: 'openai', name: agent.model || this.defaultModel },
        tools: agent.tools ? {} : undefined,
      };
      const taskResponse = await fetch(`${agent.url}/session/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!taskResponse.ok) {
        return { success: false, error: `Task failed: HTTP ${taskResponse.status}: ${await taskResponse.text()}` };
      }

      const result = await taskResponse.json() as SingleResult;
      return {
        success: result.exitCode === 0,
        results: [result],
        output: this.extractOutput(result),
      };
    } catch (error) {
      return { success: false, error: `Request failed: ${error}` };
    }
  }

  private async parallelDelegate(
    tasks: Array<{ agent: string; task: string; cwd?: string }>
  ): Promise<DelegateResult> {
    const MAX_CONCURRENT = 4;
    const results: SingleResult[] = [];
    const executing: Promise<DelegateResult>[] = [];

    for (const t of tasks) {
      const promise = this.singleDelegate(t.agent, t.task);
      executing.push(promise);

      if (executing.length >= MAX_CONCURRENT || tasks.indexOf(t) === tasks.length - 1) {
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
      output: results.map((r) => this.extractOutput(r)).join('\n\n---\n\n'),
    };
  }

  private async chainDelegate(
    chain: Array<{ agent: string; task: string; cwd?: string }>
  ): Promise<DelegateResult> {
    const results: SingleResult[] = [];
    let previousOutput = '';

    for (let i = 0; i < chain.length; i++) {
      const step = chain[i];
      const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);

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
      previousOutput = result.output || '';
    }

    return { success: true, results, output: previousOutput };
  }

  private extractOutput(result: SingleResult): string {
    if (result.messages && result.messages.length > 0) {
      const lastMessage = result.messages[result.messages.length - 1];
      if (lastMessage && typeof lastMessage === 'object' && 'content' in (lastMessage as Record<string, unknown>)) {
        const content = (lastMessage as { content: unknown }).content;
        if (Array.isArray(content)) {
          return content
            .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
            .map((c) => c.text)
            .join('\n');
        }
      }
    }
    return result.stderr || '';
  }
}

export function createExternalDelegate(config: NuPIConfig): ExternalDelegate {
  return new ExternalDelegate(config);
}