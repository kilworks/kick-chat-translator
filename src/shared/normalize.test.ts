import { describe, expect, it } from 'vitest';
import { cacheKey, normalizeForKey } from './normalize';

describe('normalizeForKey', () => {
  // A run of three identical digits used to collapse like an elongated letter, so
  // "1000" shared a key with "100" and the in-tab cache, read before any network
  // call, showed the earlier line's translation with the wrong number in it.
  it('keeps numbers that differ only by a digit run apart', () => {
    const lines = ['100 subs', '1000 subs', '10000 subs', '100000 subs'];
    expect(new Set(lines.map((t) => cacheKey(t, 'fr'))).size).toBe(lines.length);
    expect(cacheKey('555', 'en')).not.toBe(cacheKey('55', 'en'));
    expect(cacheKey('gg 3000 viewers', 'de')).not.toBe(cacheKey('gg 300 viewers', 'de'));
  });

  it('still folds elongation, emoji runs and punctuation runs', () => {
    expect(normalizeForKey('goooood')).toBe(normalizeForKey('goood'));
    expect(normalizeForKey('LOOOOOL')).toBe(normalizeForKey('lool'));
    expect(normalizeForKey('wow 😂😂😂😂')).toBe(normalizeForKey('wow 😂😂😂'));
    expect(normalizeForKey('what???? no')).toBe(normalizeForKey('what??? no'));
  });
});
