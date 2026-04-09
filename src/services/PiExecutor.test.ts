import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PiExecutor, getPiExecutor, type PiConfig } from './PiExecutor.js';

vi.mock('nezha', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  Config: {
    get: vi.fn(),
  },
}));

vi.mock('./NuPIClient.js', () => ({
  getNuPIClient: vi.fn(() => ({
    getPendingTask: vi.fn(),
    getSystemStatus: vi.fn(),
    getIssues: vi.fn(),
    getBroadcasts: vi.fn(),
  })),
}));

describe('PiExecutor', () => {
  let executor: PiExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new PiExecutor({
      piPath: 'pi',
      model: 'test-model',
    });
  });

  describe('constructor', () => {
    it('should use default values when no config provided', () => {
      const defaultExecutor = new PiExecutor();
      expect(defaultExecutor).toBeDefined();
    });

    it('should use custom config when provided', () => {
      const config: PiConfig = {
        piPath: '/custom/pi',
        model: 'custom-model',
        env: { TEST: 'value' },
      };
      const customExecutor = new PiExecutor(config);
      expect(customExecutor).toBeDefined();
    });
  });

  describe('mergeEnv', () => {
    it('should merge process env with custom env', () => {
      const executor = new PiExecutor({ env: { CUSTOM_VAR: 'value' } });
      const merged = executor['mergeEnv']();
      expect(merged).toHaveProperty('CUSTOM_VAR', 'value');
    });

    it('should filter out undefined values', () => {
      const executor = new PiExecutor({ env: { UNDEFINED_VAR: undefined as unknown as string } });
      const merged = executor['mergeEnv']();
      expect(merged).not.toHaveProperty('UNDEFINED_VAR');
    });
  });

  describe('extractToolsCreated', () => {
    it('should extract tools from output', () => {
      const tools = executor['extractToolsCreated']('created myTool\nregistered newTool');
      expect(tools).toContain('myTool');
      expect(tools).toContain('newTool');
    });

    it('should return empty array when no tools found', () => {
      const tools = executor['extractToolsCreated']('no tools here');
      expect(tools).toHaveLength(0);
    });
  });
});

describe('getPiExecutor', () => {
  it('should return singleton instance', () => {
    const executor1 = getPiExecutor();
    const executor2 = getPiExecutor();
    expect(executor1).toBe(executor2);
  });

  it('should accept custom config', () => {
    const executor = getPiExecutor({ model: 'custom-model' });
    expect(executor).toBeDefined();
  });
});
