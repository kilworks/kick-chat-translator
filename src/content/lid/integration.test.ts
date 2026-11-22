import { afterEach, describe, expect, it, vi } from 'vitest';
import master from './master-answers.fixture.json';

// master-answers.fixture.json: confidentLanguage and detectLanguage of master
// 47cb0ae (before the model) on 336 bench sentences and 12 chat tokens.

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('./weights.generated');
});

describe('language detection with the trained model', () => {
  it('without readable weights, answers exactly like master', async () => {
    vi.doMock('./weights.generated', () => ({ LID_WEIGHTS: 'broken' }));
    const { confidentLanguage, detectLanguage } = await import('../langDetect');
    const diffs = (master as Array<[string, string | null, string | null]>).filter(
      ([t, c, d]) => (confidentLanguage(t) ?? null) !== c || (detectLanguage(t) ?? null) !== d,
    );
    expect(diffs).toEqual([]);
  });

  it('never changes the looked-up answer (the source language sent to the cloud)', async () => {
    const { confidentLanguage } = await import('../langDetect');
    const diffs = (master as Array<[string, string | null, string | null]>).filter(
      ([t, c]) => (confidentLanguage(t) ?? null) !== c,
    );
    expect(diffs).toEqual([]);
  });

  it('answers where franc guessed, and stays silent under its threshold', async () => {
    const { detectLanguage, setLidThresholds } = await import('../langDetect');
    setLidThresholds({ det: 0.5, sl: Infinity, below: 'silence' });
    expect(detectLanguage('no se que esta haciendo amigo')).toBe('es');
    setLidThresholds({ det: 1.01, sl: Infinity, below: 'silence' });
    expect(detectLanguage('no se que esta haciendo amigo')).toBeUndefined();
  });
});
