import { DEFAULT_PROVIDERS, type LLMProvider, type MultiProviderConfig, type ProviderConfig } from '../types/providers.js';

export class MultiProviderExecutor {
  private config: MultiProviderConfig;
  private currentProvider: LLMProvider;

  constructor(config?: Partial<MultiProviderConfig>) {
    this.config = {
      defaultProvider: config?.defaultProvider || 'glm',
      providers: { ...DEFAULT_PROVIDERS, ...config?.providers },
    };
    this.currentProvider = this.config.defaultProvider;
  }

  getProvider(): LLMProvider {
    return this.currentProvider;
  }

  setProvider(provider: LLMProvider): void {
    if (this.config.providers[provider]) {
      this.currentProvider = provider;
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
  }

  getProviderConfig(): ProviderConfig {
    return this.config.providers[this.currentProvider];
  }

  async execute(prompt: string, options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const provider = this.getProviderConfig();
    
    switch (provider.provider) {
      case 'glm':
        return this.executeGlm(prompt, provider, options);
      case 'anthropic':
        return this.executeAnthropic(prompt, provider, options);
      case 'openai':
        return this.executeOpenAI(prompt, provider, options);
      case 'google':
        return this.executeGoogle(prompt, provider, options);
      case 'ollama':
        return this.executeOllama(prompt, provider, options);
      default:
        throw new Error(`Provider not implemented: ${provider.provider}`);
    }
  }

  private async executeGlm(prompt: string, config: ProviderConfig, options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey || process.env.GL_M_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.model || 'glm-4.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? config.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`GLM API error: ${response.status}`);
    }

    const data = await response.json() as { choices?: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content || '';
  }

  private async executeAnthropic(prompt: string, config: ProviderConfig, options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? config.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json() as { content?: { text: string }[] };
    return data.content?.[0]?.text || '';
  }

  private async executeOpenAI(prompt: string, config: ProviderConfig, options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? config.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as { choices?: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content || '';
  }

  private async executeGoogle(prompt: string, config: ProviderConfig, options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY not set');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? config.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? config.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json() as { candidates?: { content: { parts: { text: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private async executeOllama(prompt: string, config: ProviderConfig, options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'llama3.2:3b',
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? config.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? config.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json() as { response: string };
    return data.response || '';
  }

  getAvailableProviders(): LLMProvider[] {
    return Object.keys(this.config.providers) as LLMProvider[];
  }
}

export function createMultiProviderExecutor(config?: Partial<MultiProviderConfig>): MultiProviderExecutor {
  return new MultiProviderExecutor(config);
}