import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExternalDelegate, createExternalDelegate } from './ExternalDelegate.js';
import type { DelegateOptions } from '../types/external.js';

describe('ExternalDelegate', () => {
  let delegate: ExternalDelegate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    delegate = createExternalDelegate({
      agents: {
        scout: { name: 'scout', url: 'http://piano:8080/scout', tools: ['read', 'grep'] },
        planner: { name: 'planner', url: 'http://piano:8080/planner' },
        worker: { name: 'worker', url: 'http://piano:8080/worker' },
      },
      defaultModel: 'claude-sonnet',
      timeout: 10000,
    });
  });

  describe('constructor', () => {
    it('should create delegate with config', () => {
      expect(delegate).toBeDefined();
    });

    it('should use default values when not provided', () => {
      const defaultDelegate = createExternalDelegate({});
      expect(defaultDelegate).toBeDefined();
    });
  });

  describe('registerAgent', () => {
    it('should register new agent', () => {
      delegate.registerAgent('new-agent', { name: 'new', url: 'http://test:8080' });
      expect(delegate.getAgent('new-agent')).toBeDefined();
    });
  });

  describe('getAgent', () => {
    it('should return agent config', () => {
      const agent = delegate.getAgent('scout');
      expect(agent?.url).toBe('http://piano:8080/scout');
    });

    it('should return undefined for unknown agent', () => {
      expect(delegate.getAgent('unknown')).toBeUndefined();
    });
  });

  describe('hasAgent', () => {
    it('should return true for existing agent', () => {
      expect(delegate.hasAgent('scout')).toBe(true);
    });

    it('should return false for unknown agent', () => {
      expect(delegate.hasAgent('unknown')).toBe(false);
    });
  });

  describe('getAgentNames', () => {
    it('should return all registered agent names', () => {
      const names = delegate.getAgentNames();
      expect(names).toContain('scout');
      expect(names).toContain('planner');
      expect(names).toContain('worker');
    });
  });

  describe('delegate', () => {
    it('should execute single delegate', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          agent: 'scout',
          agentSource: 'external',
          task: 'test',
          exitCode: 0,
          messages: [{ content: [{ type: 'text', text: 'result' }] }],
          stderr: '',
          usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.001, contextTokens: 1000, turns: 1 },
        }),
      });

      const result = await delegate.delegate({ mode: 'single', agent: 'scout', task: 'test task' });
      expect(result.success).toBe(true);
    });

    it('should return error for unknown agent', async () => {
      const result = await delegate.delegate({ mode: 'single', agent: 'unknown', task: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown agent');
    });

    it('should return error for HTTP failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await delegate.delegate({ mode: 'single', agent: 'scout', task: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should execute chain delegate', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          agent: 'scout',
          agentSource: 'external',
          task: 'scout task',
          exitCode: 0,
          messages: [{ content: [{ type: 'text', text: 'scout result' }] }],
          stderr: '',
          usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.001, contextTokens: 1000, turns: 1 },
        }),
      }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          agent: 'planner',
          agentSource: 'external',
          task: 'planner task',
          exitCode: 0,
          messages: [{ content: [{ type: 'text', text: 'planner result' }] }],
          stderr: '',
          usage: { input: 200, output: 100, cacheRead: 0, cacheWrite: 0, cost: 0.002, contextTokens: 2000, turns: 1 },
        }),
      });

      const result = await delegate.delegate({
        mode: 'chain',
        chain: [
          { agent: 'scout', task: 'Find auth code' },
          { agent: 'planner', task: 'Plan improvements {previous}' },
        ],
      });

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should stop chain on error', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          agent: 'scout',
          agentSource: 'external',
          task: 'scout task',
          exitCode: 1,
          messages: [],
          stderr: 'error',
          usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.001, contextTokens: 1000, turns: 1 },
        }),
      });

      const result = await delegate.delegate({
        mode: 'chain',
        chain: [
          { agent: 'scout', task: 'Find auth code' },
          { agent: 'planner', task: 'Plan improvements {previous}' },
        ],
      });

      expect(result.success).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('parallel delegate', () => {
    it('should execute multiple tasks in parallel', async () => {
      fetchMock.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          agent: 'worker',
          agentSource: 'external',
          task: 'task',
          exitCode: 0,
          messages: [{ content: [{ type: 'text', text: 'result' }] }],
          stderr: '',
          usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0.001, contextTokens: 1000, turns: 1 },
        }),
      }));

      const result = await delegate.delegate({
        mode: 'parallel',
        tasks: [
          { agent: 'worker', task: 'task 1' },
          { agent: 'worker', task: 'task 2' },
        ],
      });

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});

describe('createExternalDelegate', () => {
  it('should return new instance each time', () => {
    const d1 = createExternalDelegate({});
    const d2 = createExternalDelegate({});
    expect(d1).not.toBe(d2);
  });
});
