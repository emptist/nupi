export type LLMProvider = 'glm' | 'anthropic' | 'openai' | 'google' | 'ollama' | 'custom';

export interface ProviderConfig {
  provider: LLMProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface MultiProviderConfig {
  defaultProvider: LLMProvider;
  providers: Record<LLMProvider, ProviderConfig>;
}

export const DEFAULT_PROVIDERS: Record<LLMProvider, ProviderConfig> = {
  glm: {
    provider: 'glm',
    model: 'glm-4.5-flash',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  anthropic: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  },
  openai: {
    provider: 'openai',
    model: 'gpt-4o',
  },
  google: {
    provider: 'google',
    model: 'gemini-2.0-flash',
  },
  ollama: {
    provider: 'ollama',
    model: 'llama3.2:3b',
    baseUrl: 'http://localhost:11434',
  },
  custom: {
    provider: 'custom',
    model: '',
  },
};

export function getProviderConfig(name: LLMProvider): ProviderConfig {
  return DEFAULT_PROVIDERS[name] || DEFAULT_PROVIDERS.glm;
}

export function createMultiProviderConfig(defaultProvider: LLMProvider = 'glm'): MultiProviderConfig {
  return {
    defaultProvider,
    providers: { ...DEFAULT_PROVIDERS },
  };
}