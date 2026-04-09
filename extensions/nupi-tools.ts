/**
 * NuPI Tools Extension for Pi
 *
 * Provides access to NuPI (Nezha united with PI) via HTTP API.
 * Uses fetch() to call port 4099 - no external dependencies.
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

const API_BASE = 'http://127.0.0.1:4099';
const TIMEOUT = 5000;

async function apiRequest<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT),
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export default function nupiTools(pi: ExtensionAPI): void {

  pi.registerCommand('nupi-tasks', {
    description: 'List pending tasks (NuPI)',
    handler: async () => {
      try {
        const result = await apiRequest<{ rows: any[] }>('/tasks?status=PENDING&limit=10');
        if (!result.rows.length) return 'No pending tasks';
        return result.rows.map((t) => `[P${t.priority}] ${t.title}`).join('\n');
      } catch (error) {
        return `[NuPI] Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  pi.registerCommand('nupi-task-take', {
    description: 'Take a task by ID',
    handler: async (id?: string) => {
      try {
        await apiRequest<{ id: string }>(`/tasks/${(id || '').trim()}/status`, 'PUT', { status: 'RUNNING' });
        return `Task ${id} taken`;
      } catch (error) {
        return `[NuPI] Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  pi.registerCommand('nupi-task-done', {
    description: 'Complete a task by ID',
    handler: async (taskId?: string) => {
      try {
        await apiRequest<{ id: string }>(`/tasks/${(taskId || '').trim()}/status`, 'PUT', { status: 'COMPLETED' });
        return `Task ${taskId} completed`;
      } catch (error) {
        return `[NuPI] Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  pi.registerCommand('nupi-issues', {
    description: 'List open issues',
    handler: async () => {
      try {
        const result = await apiRequest<{ rows: any[] }>('/issues?limit=10');
        if (!result.rows.length) return 'No open issues';
        return result.rows.map((i) => `[${i.severity}] ${i.title}`).join('\n');
      } catch (error) {
        return `[NuPI] Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  pi.registerCommand('nupi-learn', {
    description: 'Save learning insight',
    handler: async (insight?: string) => {
      try {
        await apiRequest<{ id: string }>('/memory', 'POST', { content: insight || '', tags: ['learn', 'pi'] });
        return 'Saved!';
      } catch (error) {
        return `[NuPI] Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  pi.registerCommand('nupi-search', {
    description: 'Search memory',
    handler: async (queryStr?: string) => {
      try {
        const results = await apiRequest<{ rows: any[] }>(`/memory/search?q=${encodeURIComponent(queryStr || '')}&limit=5`);
        if (!results.rows.length) return 'No results';
        return results.rows.map((r) => `${r.created_at}: ${(r.content || '').substring(0, 80)}...`).join('\n');
      } catch (error) {
        return `[NuPI] Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  pi.registerCommand('nupi-status', {
    description: 'Get NuPI system status',
    handler: async () => {
      try {
        const status = await apiRequest<{ pendingTasks: number; openIssues: number; memoryCount: number }>('/status');
        return `Tasks: ${status.pendingTasks} | Issues: ${status.openIssues} | Memory: ${status.memoryCount}`;
      } catch (error) {
        return `[NuPI] Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  pi.registerCommand('nupi-work', {
    description: 'Start autonomous work mode',
    handler: async () => {
      try {
        const result = await apiRequest<{ rows: any[] }>('/tasks?status=PENDING&limit=3');
        if (!result.rows.length) return 'No tasks. Check issues instead.';
        const t = result.rows[0];
        return `Next task [P${t.priority}]: ${t.title}\nID: ${t.id}\n\nActions:\n1. nupi-task-take ${t.id}\n2. Do the work\n3. nupi-task-done ${t.id}`;
      } catch (error) {
        return `[NuPI] Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  console.log('[NuPI] Tools loaded (HTTP API mode): nupi-tasks, nupi-task-take, nupi-task-done, nupi-issues, nupi-learn, nupi-search, nupi-status, nupi-work');
}