import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setDbConfig, closePool } from '../src/db.js';

describe('db module', () => {
  beforeAll(() => {
    setDbConfig({
      host: process.env.NUPI_DB_HOST || '127.0.0.1',
      user: process.env.NUPI_DB_USER || 'postgres',
      database: process.env.NUPI_DB_NAME || 'nezha',
      port: parseInt(process.env.NUPI_DB_PORT || '5432'),
    });
  });

  afterAll(async () => {
    await closePool();
  });

  describe('resolveId', async () => {
    const { resolveId } = await import('../src/db.js');

    it('should query database for short ID prefix', async () => {
      const result = await resolveId('meetings', '6ea57e00');
      expect(result).not.toBeNull();
      expect(result?.startsWith('6ea57e00')).toBe(true);
    });

    it('should return null for nonexistent short ID', async () => {
      const result = await resolveId('meetings', 'nonexistent');
      expect(result).toBeNull();
    });
  });
});
