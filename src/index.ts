/**
 * NuPI - Nezha united with PI
 *
 * Local unified AI collaboration system
 *
 * @package @nezha/nupi
 */

import { PiExecutor } from "./services/PiExecutor.js";
import { PiSDKExecutor } from "./services/PiSDKExecutor.js";
export { getNuPIClient, NuPIClient } from "./services/NuPIClient.js";

export {
  PiExecutor,
  type PiTaskResult,
  type PiConfig,
} from "./services/PiExecutor.js";
export { PiSDKExecutor } from "./services/PiSDKExecutor.js";

export { default as nupiExtension } from "./services/extension.js";
export { nupiTools } from "./services/tools.js";

export type { WorkMode } from "./types/external.js";

export interface NuPIConfig {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  mode?: "standalone" | "external";
}

const LOCAL_TASK_WHITELIST: string[] = [];

const STRONG_MODEL_WHITELIST = ["pwd", "echo", "whoami", "date"];

const RETRYABLE_ERRORS = [
  "must have required property",
  "must be array",
  'must have required property "content"',
  "Validation failed",
];

export function isLocalTask(task: string): boolean {
  const taskLower = task.toLowerCase().trim();
  const whitelist = isSelfModelStrong()
    ? STRONG_MODEL_WHITELIST
    : LOCAL_TASK_WHITELIST;
  return whitelist.some((local) => taskLower === local.toLowerCase());
}

export function isRetryableError(error: string): boolean {
  const errorLower = error.toLowerCase();
  return RETRYABLE_ERRORS.some((e) => errorLower.includes(e.toLowerCase()));
}

export function isSelfModelStrong(): boolean {
  return process.env.NUPI_SELF_MODEL_STRONG === "true";
}

export function getNuPIStatus(): {
  mode: string;
  selfModelStrong: boolean;
} {
  return {
    mode: process.env.NUPI_MODE || "standalone",
    selfModelStrong: isSelfModelStrong(),
  };
}

export function createNuPI(config: NuPIConfig) {
  return {
    config,
    PiExecutor,
    PiSDKExecutor,
  };
}
