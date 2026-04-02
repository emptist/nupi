/**
 * NuPI - Nezha united with PI (牛派)
 *
 * 本地二合一 AI 协作系统
 *
 * @package @nezha/nupi
 */

import { PiExecutor } from './services/PiExecutor.js';
import { PiSDKExecutor } from './services/PiSDKExecutor.js';

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
