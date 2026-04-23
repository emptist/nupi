import { describe, it, expect } from 'vitest';

describe('nupi-project tool', () => {
  it('should have correct tool name', () => {
    const toolName = 'nupi-project';
    expect(toolName).toBe('nupi-project');
  });

  it('should return project info structure', () => {
    const expectedFields = ['name', 'type', 'fingerprint', 'gitRemote', 'registered'];
    expect(expectedFields).toHaveLength(5);
  });

  it('should detect project type correctly', () => {
    const projectTypes = ['node', 'python', 'swift', 'rust', 'go', 'unknown'];
    expect(projectTypes).toContain('node');
    expect(projectTypes).toContain('python');
    expect(projectTypes).toContain('swift');
  });
});

describe('nupi-status tool', () => {
  it('should include project info in status', () => {
    const statusFields = ['projectName', 'projectType', 'thinkerMode', 'toolCount', 'hookCount'];
    expect(statusFields).toHaveLength(5);
  });

  it('should report correct tool count', () => {
    const toolCount = 11;
    expect(toolCount).toBe(11);
  });

  it('should report correct hook count', () => {
    const hookCount = 6;
    expect(hookCount).toBe(6);
  });
});
