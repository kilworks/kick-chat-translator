import { describe, expect, it } from 'vitest';
import { confidentLanguage, detectLanguage } from './langDetect';

// Invented lines. Escapes keep the intent readable: each comment says what the line is.
describe('han script layer: what counts as Japanese writing', () => {
  it('ignores kana that sit inside an @mention', () => {
    // "@<kana name> this problem is hard", traditional Chinese
    expect(confidentLanguage('@\u305f\u308d\u3046 \u7576\u7136\u554f\u984c\u5f88\u96e3')).toBe('zh-tw');
    // full-width @ too
    expect(confidentLanguage('\uff20\u305f\u308d\u3046 \u7576\u7136\u554f\u984c\u5f88\u96e3')).toBe('zh-tw');
  });
  it('ignores kana that sit inside a link', () => {
    expect(confidentLanguage('https://example.com/\u3042\u3044 \u7576\u7136\u554f\u984c\u5f88\u96e3')).toBe('zh-tw');
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

describe('han script layer: simplified and traditional tables', () => {
  it('reads a line of common traditional characters as zh-tw', () => {
    // "of course, it is fine", the first character is newly in the traditional table
    expect(confidentLanguage('當然可以')).toBe('zh-tw');
  });
  it('says nothing about a line whose only marker is a character both writings use', () => {
    expect(confidentLanguage('東京湾')).toBeUndefined(); // Tokyo Bay, bay in the simplified form
    expect(confidentLanguage('声优')).toBeUndefined(); // voice actor, simplified
    expect(confidentLanguage('公開')).toBeUndefined(); // public opening, traditional open
  });
  it('does not read U+5B32 as Cantonese', () => {
    expect(confidentLanguage('你別嬲了')).toBe('zh'); // no longer yue: the pronoun now reads as Chinese
  });
});

describe('han script layer: bopomofo', () => {
  it('reads bopomofo letters as traditional Chinese', () => {
    expect(confidentLanguage('\u310f\u310f')).toBe('zh-tw'); // two phonetic letters, nothing else
    expect(confidentLanguage('\u4f60\u597d\u3105')).toBe('zh-tw'); // a phonetic letter among han with no marker
    expect(confidentLanguage('\u31a0\u31a1')).toBe('zh-tw'); // extended block U+31A0
  });
  it('keeps a Cantonese marker ahead of bopomofo', () => {
    expect(confidentLanguage('\u5514\u3105\u3105')).toBe('yue');
  });
  it('does not take bopomofo for Japanese or Korean writing', () => {
    expect(confidentLanguage('\u3042\u3044\u3105')).toBe('ja'); // kana wins
    expect(confidentLanguage('\uac00\uac01\uac02\u3105')).toBe('ko'); // hangul wins
  });
});

describe('han script layer: Chinese function characters', () => {
  it('reads a han-only line with a Chinese function character as zh', () => {
    expect(confidentLanguage('你好')).toBe('zh'); // you, good
    expect(confidentLanguage('好吧')).toBe('zh'); // sentence-final particle
  });
  it('lets a traditional or simplified marker, or a Cantonese one, keep deciding', () => {
    expect(confidentLanguage('你當然')).toBe('zh-tw');
    expect(confidentLanguage('你这')).toBe('zh');
    expect(confidentLanguage('你唔')).toBe('yue');
  });
  it('stays silent when both families are present', () => {
    expect(confidentLanguage('你當这')).toBeUndefined();
  });
  it('says nothing about a line without such a character', () => {
    expect(confidentLanguage('天地')).toBeUndefined();
  });
  it('does not touch Japanese lines', () => {
    expect(confidentLanguage('你は')).toBe('ja');
  });
});
