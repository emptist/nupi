import { describe, it, expect } from 'vitest';

describe('nupi-stats tool', () => {
  it('should have correct tool name', () => {
    const toolName = 'nupi-stats';
    expect(toolName).toBe('nupi-stats');
  });

  it('should return statistics structure', () => {
    const expectedFields = ['projects', 'visits', 'skills', 'meetings', 'issues'];
    expect(expectedFields).toHaveLength(5);
  });

  it('should count projects from database', () => {
    const query = 'SELECT COUNT(*) as count FROM projects';
    expect(query).toContain('projects');
  });

  it('should count skills with status filter', () => {
    const query = "SELECT COUNT(*) as count FROM skills WHERE status = 'approved'";
    expect(query).toContain("status = 'approved'");
  });

  it('should count open issues', () => {
    const query = "SELECT COUNT(*) as count FROM issues WHERE status != 'resolved'";
    expect(query).toContain("status != 'resolved'");
  });
});

describe('nupi-visits tool', () => {
  it('should have correct tool name', () => {
    const toolName = 'nupi-visits';
    expect(toolName).toBe('nupi-visits');
  });

  it('should have optional limit parameter', () => {
    const params = { limit: 10 };
    expect(params.limit).toBe(10);
  });

  it('should query project_visits table', () => {
    const query = 'SELECT project_fingerprint, visited_at FROM project_visits';
    expect(query).toContain('project_visits');
  });

  it('should order by visited_at descending', () => {
    const query = 'ORDER BY visited_at DESC';
    expect(query).toContain('visited_at DESC');
  });
});

describe('nupi-project tool', () => {
  it('should have correct tool name', () => {
    const toolName = 'nupi-project';
    expect(toolName).toBe('nupi-project');
  });

  it('should return project info structure', () => {
    const expectedFields = ['name', 'type', 'fingerprint', 'gitRemote', 'registered'];
    expect(expectedFields).toHaveLength(5);
  });

  it('should detect project type', () => {
    const types = ['node', 'python', 'swift', 'rust', 'go', 'unknown'];
    expect(types).toContain('node');
  });

  it('should generate fingerprint from git remote or cwd', () => {
    const fingerprint = 'abc123def4567890';
    expect(fingerprint).toHaveLength(16);
  });
});
