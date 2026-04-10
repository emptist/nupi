import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NuPIClient, getNuPIClient, type TaskRow, type HealthResponse } from './NuPIClient.js';

declare global {
  function fetch(url: string | URL | Request, init?: RequestInit | undefined): Promise<Response>;
}

describe('NuPIClient', () => {
  let client: NuPIClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    client = new NuPIClient('http://127.0.0.1:5999');
  });

  describe('health', () => {
    it('should return health status', async () => {
      const mockResponse: HealthResponse = { status: 'ok', service: 'nezha' };
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.health();
      expect(result.status).toBe('ok');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:5999/health',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('isHealthy', () => {
    it('should return true when status is ok', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      });
      expect(await client.isHealthy()).toBe(true);
    });

    it('should return true when status is healthy', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });
      expect(await client.isHealthy()).toBe(true);
    });

    it('should return false on error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));
      expect(await client.isHealthy()).toBe(false);
    });
  });

  describe('getTasks', () => {
    it('should fetch tasks with status filter', async () => {
      const mockTasks: TaskRow[] = [
        { id: '1', title: 'Test Task', description: null, priority: 5, status: 'PENDING', category: null, type: null, created_at: '2026-04-10' },
      ];
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rows: mockTasks }),
      });

      const result = await client.getTasks({ status: 'PENDING', limit: 10 });
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe('Test Task');
    });

    it('should handle empty results', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rows: [] }),
      });

      const result = await client.getTasks({ status: 'PENDING' });
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('getPendingTask', () => {
    it('should return first pending task', async () => {
      const mockTask: TaskRow = { id: '123', title: 'Pending', description: null, priority: 8, status: 'PENDING', category: null, type: null, created_at: '2026-04-10' };
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rows: [mockTask] }),
      });

      const result = await client.getPendingTask();
      expect(result?.id).toBe('123');
      expect(result?.status).toBe('PENDING');
    });

    it('should return null when no pending tasks', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rows: [] }),
      });

      const result = await client.getPendingTask();
      expect(result).toBeNull();
    });
  });

  describe('createTask', () => {
    it('should create task and return id', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'new-task-id' }),
      });

      const result = await client.createTask({ title: 'New Task', priority: 8 });
      expect(result.id).toBe('new-task-id');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'task-1', status: 'RUNNING' }),
      });

      const result = await client.updateTaskStatus('task-1', 'RUNNING');
      expect(result.status).toBe('RUNNING');
    });
  });

  describe('getSystemStatus', () => {
    it('should return system stats', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ pendingTasks: 5, openIssues: 2, memoryCount: 100 }),
      });

      const result = await client.getSystemStatus();
      expect(result.pendingTasks).toBe(5);
      expect(result.openIssues).toBe(2);
    });
  });

  describe('sendBroadcast', () => {
    it('should send broadcast message', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'broadcast-id' }),
      });

      const result = await client.sendBroadcast('Test message', { priority: 'high' });
      expect(result.id).toBe('broadcast-id');
    });
  });

  describe('saveMemory', () => {
    it('should save memory with tags', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await client.saveMemory('Learned something', ['learn', 'test']);
      expect(result).toBeDefined();
    });
  });

  describe('searchMemory', () => {
    it('should search memory', async () => {
      const mockResults = [{ id: '1', content: 'Test memory', created_at: '2026-04-10' }];
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rows: mockResults }),
      });

      const result = await client.searchMemory('test', 5);
      expect(result).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should throw on non-ok response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(client.health()).rejects.toThrow('NuPI GET /health failed: 404 Not found');
    });
  });
});

describe('getNuPIClient', () => {
  it('should return singleton instance', () => {
    const client1 = getNuPIClient();
    const client2 = getNuPIClient();
    expect(client1).toBe(client2);
  });

  it('should accept custom base URL', () => {
    const client = getNuPIClient('http://localhost:5000');
    expect(client).toBeDefined();
  });
});
