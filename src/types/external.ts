export type WorkMode = 'standalone' | 'external';

export interface ExternalAgentConfig {
  name: string;
  url: string;
  tools?: string[];
  model?: string;
}

export interface AgentRegistry {
  [name: string]: ExternalAgentConfig;
}

export interface ChainStep {
  agent: string;
  task: string;
  cwd?: string;
}

export interface DelegateOptions {
  mode?: 'single' | 'parallel' | 'chain';
  agent?: string;
  task?: string;
  tasks?: Array<{ agent: string; task: string; cwd?: string }>;
  chain?: ChainStep[];
}

export interface DelegateResult {
  success: boolean;
  results?: SingleResult[];
  output?: string;
  error?: string;
}

export interface SingleResult {
  agent: string;
  agentSource: 'external' | 'local';
  task: string;
  exitCode: number;
  messages: unknown[];
  stderr: string;
  usage: TokenUsage;
  step?: number;
  model?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

export interface NuPIConfig {
  mode?: WorkMode;
  agents?: AgentRegistry;
  defaultModel?: string;
  timeout?: number;
  autoFallback?: boolean;
}