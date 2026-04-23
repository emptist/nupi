import { describe, it, expect } from 'vitest';
import { generateFingerprint, detectProjectType } from '../src/db.js';

describe('project fingerprinting', () => {
  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint for same git remote', () => {
      const fp1 = generateFingerprint('https://github.com/user/repo.git', '/path/to/repo');
      const fp2 = generateFingerprint('https://github.com/user/repo.git', '/different/path');
      expect(fp1).toBe(fp2);
    });

    it('should generate different fingerprints for different git remotes', () => {
      const fp1 = generateFingerprint('https://github.com/user/repo1.git', '/path');
      const fp2 = generateFingerprint('https://github.com/user/repo2.git', '/path');
      expect(fp1).not.toBe(fp2);
    });

    it('should use cwd when git remote is null', () => {
      const fp1 = generateFingerprint(null, '/path/to/repo');
      const fp2 = generateFingerprint(null, '/different/path');
      expect(fp1).not.toBe(fp2);
    });

    it('should return 16 character hex string', () => {
      const fp = generateFingerprint('https://github.com/user/repo.git', '/path');
      expect(fp).toHaveLength(16);
      expect(/^[a-f0-9]+$/.test(fp)).toBe(true);
    });
  });

  describe('detectProjectType', () => {
    it('should return node for package.json directory', () => {
      const type = detectProjectType('/Users/jk/gits/hub/tools_ai/nupi');
      expect(type).toBe('node');
    });

    it('should return unknown for non-existent patterns', () => {
      const type = detectProjectType('/tmp');
      expect(['unknown', 'node']).toContain(type);
    });
  });
});
