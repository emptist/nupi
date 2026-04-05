/**
 * NuPI - Nezha united with PI
 *
 * Local unified AI collaboration system
 *
 * @package @nezha/nupi
 */

import { PiExecutor } from './services/PiExecutor.js';
import { PiSDKExecutor } from './services/PiSDKExecutor.js';
export { getNuPIClient, NuPIClient } from './services/NuPIClient.js';

export { PiExecutor, type PiTaskResult, type PiConfig } from './services/PiExecutor.js';
export { PiSDKExecutor } from './services/PiSDKExecutor.js';

export interface NuPIConfig {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

export function createNuPI(config: NuPIConfig) {
  return {
    config,
    PiExecutor,
    PiSDKExecutor,
  };
}
