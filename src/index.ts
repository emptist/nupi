/**
 * NuPI - Nezha united with PI
 *
 * Local unified AI collaboration system
 *
 * @package @nezha/nupi
 */

import { PiExecutor } from './services/PiExecutor.js';
import { PiSDKExecutor } from './services/PiSDKExecutor.js';
import { ExternalDelegate, createExternalDelegate } from './services/ExternalDelegate.js';
export { getNuPIClient, NuPIClient } from './services/NuPIClient.js';

export { PiExecutor, type PiTaskResult, type PiConfig } from './services/PiExecutor.js';
export { PiSDKExecutor } from './services/PiSDKExecutor.js';
export { ExternalDelegate, createExternalDelegate };

export type {
  WorkMode,
  ExternalAgentConfig,
  AgentRegistry,
  ChainStep,
  DelegateOptions,
  DelegateResult,
  SingleResult,
  TokenUsage,
} from './types/external.js';

export interface NuPIConfig {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  mode?: 'standalone' | 'external';
  agents?: import('./types/external.js').AgentRegistry;
}

export function createNuPI(config: NuPIConfig) {
  const externalDelegate = config.mode === 'external' && config.agents
    ? createExternalDelegate({ mode: config.mode, agents: config.agents })
    : null;

  return {
    config,
    PiExecutor,
    PiSDKExecutor,
    externalDelegate,
    async delegate(options: import('./types/external.js').DelegateOptions) {
      if (!externalDelegate) {
        return { success: false, error: 'External mode not configured' };
      }
      return externalDelegate.delegate(options);
    },
  };
}
