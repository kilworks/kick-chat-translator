import { describe, expect, it } from 'vitest';
import { shares } from './hanOriginEval';

describe('shares of answers over lines of known origin', () => {
  it('counts each answer as a percent of the lines, no answer as none', () => {
    const answer = (t: string) => (t === 'a' ? 'zh-tw' : undefined);
    expect(shares([{ t: 'a' }, { t: 'b' }, { t: 'c' }], answer)).toEqual({ n: 3, shares: { 'zh-tw': 33.33, none: 66.67 } });
  });

  it('counts an empty and a one-character line as none and does not throw', () => {
    const answer = (t: string) => (t.length >= 2 ? 'zh' : undefined);
    expect(shares([{ t: '' }, { t: 'x' }], answer)).toEqual({ n: 2, shares: { none: 100 } });
  });

  it('gives an empty set zero lines and no shares', () => {
    expect(shares([], () => 'zh')).toEqual({ n: 0, shares: {} });
  });
});
