/**
 * NuPI - Nezha united with PI
 *
 * Extension that bridges Pi agent with Nezha data layer via hooks
 *
 * @package @nezha/nupi
 */

export { default as nupiExtension, setExternalThinker, setDelegateMode } from "./extension.js";

const LOCAL_TASK_WHITELIST = [
  'nupi-tasks',
  'nupi-issues',
  'nupi-status',
  'nupi-autonomous',
  'nezha_get_tasks',
  'nezha_create_task',
  'piano_think',
  'nupi-think',
  'git rev-parse',
  'pwd',
  'ls',
  'ls -la',
  'ls -a',
  'echo',
  'whoami',
  'date',
  'nupi-mode',
  'nupi-model',
];

export function isLocalTask(task: string): boolean {
  const taskLower = task.toLowerCase().trim();
  return LOCAL_TASK_WHITELIST.some((local) =>
    taskLower === local.toLowerCase() ||
    taskLower.startsWith(local.toLowerCase())
  );
}

export function shouldUseExternal(task: string): boolean {
  const forceLocal = process.env.NUPI_FORCE_LOCAL === 'true';
  if (forceLocal) return false;
  return !isLocalTask(task);
}

export { LOCAL_TASK_WHITELIST };
