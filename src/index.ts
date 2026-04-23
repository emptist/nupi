/**
 * NuPI - Nezha united with PI
 *
 * Extension that bridges Pi agent with Nezha data layer via hooks
 *
 * @package @nezha/nupi
 */

export { default as nupiExtension, registerThinker, unregisterThinker } from "./extension.js";
export type { ExternalThinker } from "./extension.js";

export { querySafe, queryOne, execSafe, resolveId, closePool, setDbConfig, getPool, getNezhaContext, generateFingerprint, detectProjectType, registerProject } from "./db.js";
export type { ProjectInfo } from "./db.js";
