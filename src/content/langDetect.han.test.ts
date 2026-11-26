import { describe, expect, it } from 'vitest';
import { confidentLanguage, detectLanguage } from './langDetect';

// Invented lines. Escapes keep the intent readable: each comment says what the line is.
describe('han script layer: what counts as Japanese writing', () => {
  it('ignores kana that sit inside an @mention', () => {
    // "@<kana name> this problem is hard", traditional Chinese
    expect(confidentLanguage('@\u305f\u308d\u3046 \u9019\u500b\u554f\u984c\u5f88\u96e3')).toBe('zh-tw');
    // full-width @ too
    expect(confidentLanguage('\uff20\u305f\u308d\u3046 \u9019\u500b\u554f\u984c\u5f88\u96e3')).toBe('zh-tw');
  });
  it('ignores kana that sit inside a link', () => {
    expect(confidentLanguage('https://example.com/\u3042\u3044 \u9019\u500b\u554f\u984c\u5f88\u96e3')).toBe('zh-tw');
  });
  it('does not call a Chinese line Japanese for a middle dot or a long-vowel mark alone', () => {
    expect(confidentLanguage('\u8fd9\u4e2a\u30fb\u95ee\u9898')).toBe('zh'); // U+30FB
    expect(confidentLanguage('\u8fd9\u4e2a\u30fc\u95ee\u9898')).toBe('zh'); // U+30FC
  });
  it('keeps a real kana line Japanese, a lone mark with one kana included', () => {
    expect(detectLanguage('\u3042\u30fc')).toBe('ja');
    expect(detectLanguage('\u30e9\u30fc')).toBe('ja');
    expect(detectLanguage('\u611f\u8b1d\u30ce\u4f1d\u8aac')).toBe('ja'); // ノ is a letter
  });
  it('still reads nothing from a single mark or a single kana', () => {
    expect(detectLanguage('\u30fc')).toBeUndefined();
    expect(detectLanguage('\u306f')).toBeUndefined();
  });
  it('reads half-width katakana as Japanese', () => {
    expect(detectLanguage('\uff76\uff85\uff9d')).toBe('ja');
  });
});

describe('marker lists chosen from lines of known origin', () => {
  it('names Traditional and Simplified lines the old 45-character lists missed', () => {
    expect(confidentLanguage('\u4ed6\u4eca\u5929\u6c92\u6709\u4f86\u4e0a\u73ed')).toBe('zh-tw');
    expect(confidentLanguage('\u8fd9\u4e2a\u4e3b\u64ad\u597d\u5389\u5bb3')).toBe('zh');
  });

  it('keeps words Japanese also writes out of the Chinese answer', () => {
    expect(confidentLanguage('\u958b\u59cb')).toBeUndefined();
    expect(confidentLanguage('\u58f0\u512a\u6700\u9ad8')).toBeUndefined();
    expect(confidentLanguage('\u6e7e\u5cb8')).toBeUndefined();
  });
});
