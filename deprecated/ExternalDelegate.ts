import { execSync } from 'child_process';

export interface ExternalTask { title: string; description?: string; priority?: number }

/**
 * Deprecated: do not call OpenCode/HTTP. Instead create a task in Nezha DB via CLI.
 * This helper will run `nezha task-add` to create the task and return the new task id.
 */
export function createExternalTask(task: ExternalTask): string | null {
  const title = (task.title || 'external-task').replace(/"/g, '\\"');
  const desc = (task.description || '').replace(/"/g, '\\"');
  const priority = task.priority || 5;

  const cmd = `nezha task-add "${title}" "${desc}" --priority ${priority}`;
  try {
    const out = execSync(cmd, { encoding: 'utf8' });
    // The CLI prints the created task ID. Try to extract a UUID-like string.
    const m = out.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    if (m) return m[0];
    return null;
  } catch (err) {
    // If CLI not available, instruct caller to create task manually.
    console.error('Failed to create Nezha task via CLI:', err?.message || err);
    return null;
  }
}
