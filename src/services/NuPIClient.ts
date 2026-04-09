import { logger } from 'nezha';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4099';
const REQUEST_TIMEOUT_MS = 10000;

export interface TaskData {
  id?: string;
  title: string;
  description?: string;
  type?: string;
  priority?: number;
  category?: string;
  status?: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  category: string | null;
  type: string | null;
  created_at: string;
}

export interface HealthResponse {
  status: string;
  service: string;
}

class NuPIClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: string
  ) {
    super(message);
    this.name = 'NuPIClientError';
  }
}

export class NuPIClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NUPI_URL || DEFAULT_BASE_URL;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new NuPIClientError(
        `NuPI ${method} ${path} failed: ${response.status} ${errorBody}`,
        response.status,
        errorBody
      );
    }

    return response.json() as Promise<T>;
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.health();
      return result.status === 'ok' || result.status === 'healthy';
    } catch {
      return false;
    }
  }

  async getTasks(options?: {
    status?: string;
    limit?: number;
  }): Promise<{ rows: TaskRow[] }> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ rows: TaskRow[] }>('GET', `/tasks${query}`);
  }

  async getPendingTask(limit?: number): Promise<TaskRow | null> {
    const result = await this.getTasks({ status: 'PENDING', limit: limit || 1 });
    return result.rows[0] || null;
  }

  async createTask(data: TaskData): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/tasks', data);
  }

  async getBroadcasts(limit?: number): Promise<unknown[]> {
    const path = limit ? `/broadcast/${limit}` : '/broadcast/20';
    const result = await this.request<{ rows?: unknown[] } | unknown[]>('GET', path);
    if (Array.isArray(result)) return result;
    return result.rows || [];
  }

  async sendBroadcast(message: string, options?: {
    to?: string;
    priority?: string;
  }): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/broadcast', {
      message,
      targetAgent: options?.to,
      priority: options?.priority || 'normal',
    });
  }

  async getIdentity(): Promise<unknown> {
    return this.request<unknown>('GET', '/identity');
  }

  async saveMemory(content: string, tags?: string[]): Promise<unknown> {
    return this.request<unknown>('POST', '/memory', { content, tags });
  }

  async recoverFailedTasks(options?: {
    maxRetries?: number;
    delayMs?: number;
  }): Promise<{ recovered: number; tasks: unknown[] }> {
    return this.request<{ recovered: number; tasks: unknown[] }>(
      'POST',
      '/admin/recovery/failed',
      options || {}
    );
  }

  async recoverStuckTasks(): Promise<{ recovered: number; tasks: unknown[] }> {
    return this.request<{ recovered: number; tasks: unknown[] }>(
      'POST',
      '/admin/recovery/stuck'
    );
  }

  async retryDLQ(options?: {
    maxRetries?: number;
    delayMs?: number;
  }): Promise<{ retried: number; total: number }> {
    return this.request<{ retried: number; total: number }>(
      'POST',
      '/admin/recovery/dlq-retry',
      options || {}
    );
  }

  async getRecoveryStats(): Promise<{
    failedTasksRecoverable: number;
    stuckTasks: number;
    dlqItemsPending: number;
  }> {
    return this.request<{
      failedTasksRecoverable: number;
      stuckTasks: number;
      dlqItemsPending: number;
    }>('GET', '/admin/recovery/stats');
  }

  async updateTaskStatus(taskId: string, status: string): Promise<{ id: string; status: string }> {
    return this.request<{ id: string; status: string }>(
      'PUT',
      `/tasks/${taskId}/status`,
      { status }
    );
  }

  async updateTaskResult(taskId: string, result: unknown): Promise<{ id: string }> {
    return this.request<{ id: string }>(
      'PUT',
      `/tasks/${taskId}/result`,
      { result }
    );
  }

  async updateTaskError(taskId: string, error: string): Promise<{ id: string }> {
    return this.request<{ id: string }>(
      'PUT',
      `/tasks/${taskId}/error`,
      { error }
    );
  }

  async getIssues(limit?: number): Promise<unknown[]> {
    const query = limit ? `?limit=${limit}` : '';
    const result = await this.request<{ rows?: unknown[] } | unknown[]>(
      'GET',
      `/issues${query}`
    );
    if (Array.isArray(result)) return result;
    return result.rows || [];
  }

  async searchMemory(query: string, limit?: number): Promise<unknown[]> {
    const q = `?q=${encodeURIComponent(query)}${limit ? `&limit=${limit}` : ''}`;
    const result = await this.request<{ rows?: unknown[] } | unknown[]>(
      'GET',
      `/memory/search${q}`
    );
    if (Array.isArray(result)) return result;
    return result.rows || [];
  }

  async getSystemStatus(): Promise<{
    pendingTasks: number;
    openIssues: number;
    memoryCount: number;
  }> {
    return this.request<{
      pendingTasks: number;
      openIssues: number;
      memoryCount: number;
    }>('GET', '/status');
  }

  async getReminderTemplate(name: string): Promise<unknown> {
    return this.request<unknown>('GET', `/reminder-template/${name}`);
  }

  async getAllReminderTemplates(): Promise<unknown[]> {
    const result = await this.request<{ rows?: unknown[] } | unknown[]>('GET', '/reminder-templates');
    if (Array.isArray(result)) return result;
    return result.rows || [];
  }

  async getBroadcastsDetailed(limit?: number): Promise<unknown> {
    const path = limit ? `/broadcast/${limit}` : '/broadcast/20';
    return this.request<unknown>('GET', path);
  }

  async getHealthStatus(): Promise<{
    status: string;
    services: Record<string, string>;
    timestamp: string;
  }> {
    return this.request<{
      status: string;
      services: Record<string, string>;
      timestamp: string;
    }>('GET', '/health/detailed');
  }

  async getTableDocumentation(tableName?: string): Promise<unknown> {
    const query = tableName ? `?table=${encodeURIComponent(tableName)}` : '';
    return this.request<unknown>('GET', '/table-documentation' + query);
  }

  async searchCodebase(query: string, limit?: number): Promise<unknown> {
    const q = `?q=${encodeURIComponent(query)}${limit ? `&limit=${limit}` : ''}`;
    return this.request<unknown>('GET', '/code-search' + q);
  }

  async getAgentSessions(): Promise<unknown> {
    return this.request<unknown>('GET', '/agent-sessions');
  }

  async triggerReminder(): Promise<{ triggered: boolean; message: string }> {
    return this.request<{ triggered: boolean; message: string }>('POST', '/reminder/trigger');
  }
}

let clientInstance: NuPIClient | null = null;

export function getNuPIClient(baseUrl?: string): NuPIClient {
  if (!clientInstance) {
    clientInstance = new NuPIClient(baseUrl);
  }
  return clientInstance;
}
