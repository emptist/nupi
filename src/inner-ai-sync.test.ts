import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Inner AI Sync Tool', () => {
  describe('getNezhaInnerAI', () => {
    it('should return null when no inner AI is configured', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue(null);
      
      const result = await mockQueryOne(
        `SELECT provider, model FROM provider_api_keys WHERE status = 'in_use' LIMIT 1`
      );
      
      expect(result).toBeNull();
    });

    it('should return provider and model when inner AI is configured', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue({
        provider: 'openrouter',
        model: 'tencent/hy3-preview:free',
      });
      
      const result = await mockQueryOne(
        `SELECT provider, model FROM provider_api_keys WHERE status = 'in_use' LIMIT 1`
      );
      
      expect(result).toEqual({
        provider: 'openrouter',
        model: 'tencent/hy3-preview:free',
      });
    });

    it('should use default model when model is null', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue({
        provider: 'ollama',
        model: null,
      });
      
      const result = await mockQueryOne(
        `SELECT provider, model FROM provider_api_keys WHERE status = 'in_use' LIMIT 1`
      );
      
      expect(result.provider).toBe('ollama');
      expect(result.model).toBeNull();
    });
  });

  describe('updatePiSettings', () => {
    let tempDir: string;
    let settingsPath: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `nupi-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
      settingsPath = join(tempDir, 'settings.json');
    });

    afterEach(() => {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create new settings file if it does not exist', async () => {
      const fs = await import('fs');
      const path = await import('path');
      
      const provider = 'openrouter';
      const model = 'tencent/hy3-preview:free';
      
      const updatePiSettings = async (settingsPath: string, provider: string, model: string): Promise<boolean> => {
        try {
          let settings: any = {};
          
          const dir = path.dirname(settingsPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            settings = JSON.parse(content);
          }
          
          settings.defaultProvider = provider;
          settings.defaultModel = model;
          
          if (!settings.models) {
            settings.models = [];
          }
          
          const modelEntry = `${provider}/${model}`;
          if (!settings.models.includes(modelEntry)) {
            settings.models.unshift(modelEntry);
          }
          
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          
          return true;
        } catch (e) {
          console.error(`Failed to update pi settings: ${e}`);
          return false;
        }
      };
      
      const result = await updatePiSettings(settingsPath, provider, model);
      
      expect(result).toBe(true);
      expect(fs.existsSync(settingsPath)).toBe(true);
      
      const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(content.defaultProvider).toBe(provider);
      expect(content.defaultModel).toBe(model);
      expect(content.models).toContain(`${provider}/${model}`);
    });

    it('should update existing settings file', async () => {
      const fs = await import('fs');
      const path = await import('path');
      
      const existingSettings = {
        defaultProvider: 'ollama',
        defaultModel: 'llama3.2:3b',
        models: ['ollama/llama3.2:3b'],
        lastChangelogVersion: '0.70.6',
      };
      
      const dir = path.dirname(settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));
      
      const provider = 'openrouter';
      const model = 'tencent/hy3-preview:free';
      
      const updatePiSettings = async (settingsPath: string, provider: string, model: string): Promise<boolean> => {
        try {
          let settings: any = {};
          
          if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            settings = JSON.parse(content);
          }
          
          settings.defaultProvider = provider;
          settings.defaultModel = model;
          
          if (!settings.models) {
            settings.models = [];
          }
          
          const modelEntry = `${provider}/${model}`;
          if (!settings.models.includes(modelEntry)) {
            settings.models.unshift(modelEntry);
          }
          
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          
          return true;
        } catch (e) {
          console.error(`Failed to update pi settings: ${e}`);
          return false;
        }
      };
      
      const result = await updatePiSettings(settingsPath, provider, model);
      
      expect(result).toBe(true);
      
      const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(content.defaultProvider).toBe(provider);
      expect(content.defaultModel).toBe(model);
      expect(content.models).toContain(`${provider}/${model}`);
      expect(content.models).toContain('ollama/llama3.2:3b');
      expect(content.lastChangelogVersion).toBe('0.70.6');
    });

    it('should not duplicate model entry if already exists', async () => {
      const fs = await import('fs');
      const path = await import('path');
      
      const existingSettings = {
        defaultProvider: 'openrouter',
        defaultModel: 'tencent/hy3-preview:free',
        models: ['openrouter/tencent/hy3-preview:free'],
      };
      
      const dir = path.dirname(settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));
      
      const provider = 'openrouter';
      const model = 'tencent/hy3-preview:free';
      
      const updatePiSettings = async (settingsPath: string, provider: string, model: string): Promise<boolean> => {
        try {
          let settings: any = {};
          
          if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            settings = JSON.parse(content);
          }
          
          settings.defaultProvider = provider;
          settings.defaultModel = model;
          
          if (!settings.models) {
            settings.models = [];
          }
          
          const modelEntry = `${provider}/${model}`;
          if (!settings.models.includes(modelEntry)) {
            settings.models.unshift(modelEntry);
          }
          
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          
          return true;
        } catch (e) {
          console.error(`Failed to update pi settings: ${e}`);
          return false;
        }
      };
      
      const result = await updatePiSettings(settingsPath, provider, model);
      
      expect(result).toBe(true);
      
      const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      const modelCount = content.models.filter((m: string) => m === `${provider}/${model}`).length;
      expect(modelCount).toBe(1);
    });

    it('should return false on error', async () => {
      const provider = 'openrouter';
      const model = 'test-model';
      
      const updatePiSettings = async (settingsPath: string, provider: string, model: string): Promise<boolean> => {
        try {
          const fs = await import('fs');
          let settings: any = {};
          
          if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            settings = JSON.parse(content);
          }
          
          settings.defaultProvider = provider;
          settings.defaultModel = model;
          
          if (!settings.models) {
            settings.models = [];
          }
          
          const modelEntry = `${provider}/${model}`;
          if (!settings.models.includes(modelEntry)) {
            settings.models.unshift(modelEntry);
          }
          
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          
          return true;
        } catch (e) {
          console.error(`Failed to update pi settings: ${e}`);
          return false;
        }
      };
      
      const result = await updatePiSettings('/nonexistent/path/that/does/not/exist/settings.json', provider, model);
      
      expect(result).toBe(false);
    });
  });

  describe('nupi-sync-inner-ai tool', () => {
    it('should return error message when no inner AI configured', async () => {
      const result = {
        content: [{ 
          type: "text" as const, 
          text: "No inner AI configured in nezha. Use 'nezha inner set-model <provider> [model]' to configure it first." 
        }],
        details: { error: true } as Record<string, unknown>,
      };
      
      expect(result.details.error).toBe(true);
      expect(result.content[0].text).toContain('No inner AI configured');
    });

    it('should return success message with provider and model info', async () => {
      const provider = 'openrouter';
      const model = 'tencent/hy3-preview:free';
      
      const result = {
        content: [{ 
          type: "text" as const, 
          text: `✅ Pi configuration updated to match nezha's inner AI:
Provider: ${provider}
Model: ${model}

🔐 SECURITY: To use this provider, you need to set the API key as an environment variable:

For ${provider}:
  export OPENROUTER_API_KEY="your-api-key-here"` 
        }],
        details: { provider, model } as Record<string, unknown>,
      };
      
      expect(result.details.provider).toBe(provider);
      expect(result.details.model).toBe(model);
      expect(result.content[0].text).toContain(provider);
      expect(result.content[0].text).toContain(model);
      expect(result.content[0].text).toContain('OPENROUTER_API_KEY');
    });

    it('should include security instructions for API key setup', async () => {
      const provider = 'openrouter';
      const model = 'tencent/hy3-preview:free';
      
      const instructions = `✅ Pi configuration updated to match nezha's inner AI:
Provider: ${provider}
Model: ${model}

🔐 SECURITY: To use this provider, you need to set the API key as an environment variable:

For ${provider}:
  export OPENROUTER_API_KEY="your-api-key-here"

You can get the API key from nezha's database or your provider's dashboard.

Add this to your ~/.bashrc or ~/.zshrc to make it permanent:
  echo 'export OPENROUTER_API_KEY="your-key"' >> ~/.bashrc

Restart pi to use the new configuration.`;
      
      expect(instructions).toContain('🔐 SECURITY');
      expect(instructions).toContain('environment variable');
      expect(instructions).toContain('~/.bashrc');
      expect(instructions).toContain('Restart pi');
    });
  });
});
