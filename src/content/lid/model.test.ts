import { describe, expect, it } from 'vitest';
import fixture from './parity.fixture.json';
import { LID_WEIGHTS } from './weights.generated';
import { decodeModel, lidFeatures, lidNormalize, lidPredict, lidProbabilities, lidReady } from './model';

describe('lid model', () => {
  it('loads the shipped weights', () => {
    expect(lidReady()).toBe(true);
  });

  it('matches the numpy probabilities of tools/lid/train.py (parity fixture)', () => {
    let worst = 0;
    for (const row of fixture as Array<{ text: string; probs: Record<string, number> }>) {
      const got = lidProbabilities(row.text)!;
      for (const [lang, p] of Object.entries(row.probs)) worst = Math.max(worst, Math.abs(got.get(lang)! - p));
    }
    expect(worst).toBeLessThan(1e-4);
  });

  it('has no answer for empty or blank text', () => {
    expect(lidPredict('')).toBeUndefined();
    expect(lidPredict('   \n ')).toBeUndefined();
  });

  it('is not confident on a script it never saw', () => {
    expect(lidPredict('გამარჯობა მეგობარო')!.p).toBeLessThan(0.5);
    expect(lidPredict('🔥🔥🔥 💀')!.p).toBeLessThan(0.5);
  });

  it('names clear sentences', () => {
    expect(lidPredict('je ne sais pas ce qu il fait')!.lang).toBe('fr');
    expect(lidPredict('no sé qué está haciendo')!.lang).toBe('es');
    expect(lidPredict('я не знаю что он делает')!.lang).toBe('ru');
  });

  it('caps the cost of a very long paste', () => {
    const long = 'lorem ipsum dolor sit amet '.repeat(200);
    lidPredict(long);
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) lidPredict(long + i);
    expect((performance.now() - t0) / 20).toBeLessThan(2);
  });

  it('hashes non-BMP characters by code point', () => {
    expect(lidFeatures(lidNormalize('𠀋'), 1 << 20)).toHaveLength(3 + 2 + 1 + 1);
  });

  it('refuses corrupt or truncated weights', () => {
    expect(decodeModel('not base64 !!')).toBeUndefined();
    expect(decodeModel(LID_WEIGHTS.slice(0, 4000))).toBeUndefined();
    const flipped = (LID_WEIGHTS[100] === 'A' ? 'B' : 'A');
    expect(decodeModel(LID_WEIGHTS.slice(0, 100) + flipped + LID_WEIGHTS.slice(101))).toBeUndefined();
  });
});
