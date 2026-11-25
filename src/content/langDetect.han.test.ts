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
