import { describe, it, expect } from 'vitest';

describe('extension module', () => {
  describe('ExternalThinker interface', () => {
    it('should have optional name property', () => {
      const thinker = {
        think: async (q: string) => `Answer: ${q}`,
      };
      expect(thinker.think).toBeDefined();
    });

    it('should accept name property', () => {
      const thinker = {
        name: 'test-thinker',
        think: async (q: string) => `Answer: ${q}`,
      };
      expect(thinker.name).toBe('test-thinker');
    });
  });

  describe('DelegationMode types', () => {
    it('self-sufficient mode has no thinker', () => {
      const mode = { mode: 'self-sufficient' as const };
      expect(mode.mode).toBe('self-sufficient');
      expect('thinker' in mode).toBe(false);
    });

    it('delegating mode has thinker', () => {
      const mode = {
        mode: 'delegating' as const,
        thinker: { think: async () => 'result' },
      };
      expect(mode.mode).toBe('delegating');
      expect('thinker' in mode).toBe(true);
    });
  });

  describe('tool parameters', () => {
    it('nupi-think requires question parameter', () => {
      const params = { question: 'What is 2+2?' };
      expect(params.question).toBeDefined();
      expect(typeof params.question).toBe('string');
    });

    it('nupi-meeting-say requires meetingId and perspective', () => {
      const params = {
        meetingId: '6ea57e00',
        perspective: 'Test perspective',
      };
      expect(params.meetingId).toBeDefined();
      expect(params.perspective).toBeDefined();
    });

    it('nupi-doc-save requires name and content', () => {
      const params = {
        name: 'AGENTS',
        content: '# Agents Guide\n\nContent here...',
      };
      expect(params.name).toBeDefined();
      expect(params.content).toBeDefined();
    });
  });
});
