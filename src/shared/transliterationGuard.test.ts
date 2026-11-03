import { describe, expect, it } from 'vitest';
import {
  isTransliteration,
  getSemanticOverride,
  enhanceContextForShortInput,
} from './transliterationGuard';

// ─── isTransliteration ──────────────────────────────────────────────────────

describe('isTransliteration', () => {
  it('detects pure katakana output as transliteration for JA target', () => {
    expect(isTransliteration('bonjour', 'ボンジュール', 'ja')).toBe(true);
    expect(isTransliteration('hello', 'ハロー', 'ja')).toBe(true);
    expect(isTransliteration('merci', 'メルシー', 'ja')).toBe(true);
    expect(isTransliteration('ciao', 'チャオ', 'ja')).toBe(true);
  });

  it('accepts kanji/hiragana output as real translation', () => {
    expect(isTransliteration('bonjour', 'こんにちは', 'ja')).toBe(false);
    expect(isTransliteration('thank you', 'ありがとうございます', 'ja')).toBe(false);
    expect(isTransliteration('goodbye', 'さようなら', 'ja')).toBe(false);
  });

  it('accepts mixed katakana+kanji (legitimate loanword in sentence)', () => {
    expect(isTransliteration('the computer is broken', 'コンピューターが壊れました', 'ja')).toBe(false);
  });

  it('ignores non-Latin input', () => {
    expect(isTransliteration('こんにちは', 'ボンジュール', 'ja')).toBe(false);
    expect(isTransliteration('привет', 'ハロー', 'ja')).toBe(false);
  });

  it('ignores Latin target languages', () => {
    expect(isTransliteration('bonjour', 'hello', 'en')).toBe(false);
    expect(isTransliteration('hola', 'bonjour', 'fr')).toBe(false);
  });

  it('ignores long inputs (> 4 words) to avoid false positives', () => {
    expect(isTransliteration(
      'this is a longer sentence that should not trigger',
      'ディスイズアロンガーセンテンス',
      'ja',
    )).toBe(false);
  });

  it('handles empty/whitespace output gracefully', () => {
    expect(isTransliteration('bonjour', '', 'ja')).toBe(false);
    expect(isTransliteration('bonjour', '   ', 'ja')).toBe(false);
  });
});

// ─── getSemanticOverride ────────────────────────────────────────────────────

describe('getSemanticOverride', () => {
  it('returns correct JA translation for common greetings', () => {
    expect(getSemanticOverride('bonjour', 'ja')).toBe('こんにちは');
    expect(getSemanticOverride('merci', 'ja')).toBe('ありがとう');
    expect(getSemanticOverride('hola', 'ja')).toBe('こんにちは');
    expect(getSemanticOverride('ciao', 'ja')).toBe('こんにちは');
    expect(getSemanticOverride('danke', 'ja')).toBe('ありがとう');
  });

  it('returns correct ZH translation', () => {
    expect(getSemanticOverride('bonjour', 'zh')).toBe('你好');
    expect(getSemanticOverride('goodbye', 'zh')).toBe('再见');
  });

  it('returns correct KO translation', () => {
    expect(getSemanticOverride('hello', 'ko')).toBe('안녕하세요');
    expect(getSemanticOverride('thanks', 'ko')).toBe('고마워');
  });

  it('returns correct AR translation', () => {
    expect(getSemanticOverride('bonjour', 'ar')).toBe('مرحبا');
  });

  it('returns correct RU translation', () => {
    expect(getSemanticOverride('bonjour', 'ru')).toBe('Привет');
    expect(getSemanticOverride('danke', 'ru')).toBe('Спасибо');
  });

  it('returns correct TH translation', () => {
    expect(getSemanticOverride('hello', 'th')).toBe('สวัสดี');
  });

  it('returns correct HI translation', () => {
    expect(getSemanticOverride('hello', 'hi')).toBe('नमस्ते');
  });

  it('is case-insensitive', () => {
    expect(getSemanticOverride('Bonjour', 'ja')).toBe('こんにちは');
    expect(getSemanticOverride('MERCI', 'ja')).toBe('ありがとう');
    expect(getSemanticOverride('Hello', 'ko')).toBe('안녕하세요');
  });

  it('handles accented variants via normalization', () => {
    // "merci" with an accent should still match
    expect(getSemanticOverride('Bonjour', 'ja')).toBe('こんにちは');
  });

  it('answers zh-tw in Traditional characters, not from the Simplified column', () => {
    expect(getSemanticOverride('bonjour', 'zh-tw')).toBe('你好');
    expect(getSemanticOverride('merci', 'zh-tw')).toBe('謝謝');
    expect(getSemanticOverride('good luck', 'zh-tw')).toBe('祝你好運');
  });

  // Measured on the free Google endpoint, each of these came back wrong alone:
  // valeu as "it cost" in all nine, merci as "mercy" in Greek, Bengali and
  // Tamil, gracias as "grace" in Persian, bonjour as "good luck" in Cantonese,
  // konnichiwa and arigatou spelled out phonetically.
  it('covers the nine non-Latin targets the first table left out', () => {
    expect(getSemanticOverride('valeu', 'he')).toBe('תודה');
    expect(getSemanticOverride('gracias', 'fa')).toBe('ممنون');
    expect(getSemanticOverride('merci', 'el')).toBe('Ευχαριστώ');
    expect(getSemanticOverride('konnichiwa', 'uk')).toBe('Привіт');
    expect(getSemanticOverride('arigatou', 'bg')).toBe('Благодаря');
    expect(getSemanticOverride('merci', 'bn')).toBe('ধন্যবাদ');
    expect(getSemanticOverride('merci', 'ta')).toBe('நன்றி');
    expect(getSemanticOverride('bonjour', 'yue')).toBe('你好');
    for (const key of ['hola', 'au revoir', 'gg wp', 'kawaii', "let's go", 'iyi geceler']) {
      for (const lang of ['he', 'fa', 'el', 'uk', 'bg', 'bn', 'ta', 'zh-tw', 'yue']) {
        expect(getSemanticOverride(key, lang), `${key} -> ${lang}`).toBeTruthy();
      }
    }
  });

  // Chat rarely types the bare key. Before, every one of these missed the table
  // and went to the provider that mistranslates the bare form.
  it('looks up through edge punctuation and elongation, and puts the punctuation back', () => {
    expect(getSemanticOverride('merci!', 'ja')).toBe('ありがとう!');
    expect(getSemanticOverride('gracias!!', 'ja')).toBe(getSemanticOverride('gracias', 'ja') + '!!');
    expect(getSemanticOverride('¡hola!', 'ja')).toBe('こんにちは!');
    expect(getSemanticOverride('holaaa', 'ja')).toBe('こんにちは');
    expect(getSemanticOverride('merciii', 'ja')).toBe('ありがとう');
    expect(getSemanticOverride('arigatou!', 'bg')).toBe('Благодаря!');
    expect(getSemanticOverride('thanks!', 'ko')).toBe('고마워!');
    // Two letters first: these keys hold a real double letter.
    expect(getSemanticOverride('goooood luck', 'zh-tw')).toBe('祝你好運');
    expect(getSemanticOverride('kawaiiii', 'ja')).toBe(getSemanticOverride('kawaii', 'ja'));
    // Nothing that missed as a bare form hits because of the new steps.
    expect(getSemanticOverride('abcdef!!!', 'ja')).toBeUndefined();
    expect(getSemanticOverride('!!!', 'ja')).toBeUndefined();
  });

  it('returns undefined for unknown expressions', () => {
    expect(getSemanticOverride('supercalifragilisticexpialidocious', 'ja')).toBeUndefined();
    expect(getSemanticOverride('abcdef', 'ja')).toBeUndefined();
  });

  it('returns undefined for Latin target languages', () => {
    // No overrides for en/fr/es/etc. — providers handle those fine
    expect(getSemanticOverride('bonjour', 'en')).toBeUndefined();
    expect(getSemanticOverride('hello', 'fr')).toBeUndefined();
  });

  // Google, measured: valeu "it cost", fala "he speaks", yatta "on the yacht",
  // coucou "cuckoo", and the romaji left as they were.
  it('covers the few words Google gets wrong into Latin targets too', () => {
    expect(getSemanticOverride('valeu', 'en')).toBe('thanks');
    expect(getSemanticOverride('valeu', 'fr')).toBe('merci');
    expect(getSemanticOverride('fala', 'es')).toBe('hola');
    expect(getSemanticOverride('yatta', 'de')).toBe('geschafft');
    expect(getSemanticOverride('coucou', 'en')).toBe('hi');
    expect(getSemanticOverride('kawaii', 'tl')).toBe('cute');
    expect(getSemanticOverride('arigatou', 'pt-br')).toBe('obrigado');
  });

  it('never overrides a word into its own language', () => {
    expect(getSemanticOverride('valeu', 'pt')).toBeUndefined();
    expect(getSemanticOverride('valeu', 'pt-br')).toBeUndefined();
    expect(getSemanticOverride('coucou', 'fr')).toBeUndefined();
    expect(getSemanticOverride('forza', 'it')).toBeUndefined();
  });

  it('covers romanized Japanese expressions', () => {
    expect(getSemanticOverride('konnichiwa', 'zh')).toBe('你好');
    expect(getSemanticOverride('arigatou', 'ko')).toBe('감사합니다');
    expect(getSemanticOverride('kawaii', 'ja')).toBe('かわいい');
    expect(getSemanticOverride('sugoi', 'ja')).toBe('すごい');
  });

  it('covers gaming/chat expressions', () => {
    expect(getSemanticOverride('good game', 'ja')).toBe('いい試合だった');
    expect(getSemanticOverride('well played', 'ja')).toBe('お見事');
    expect(getSemanticOverride('well done', 'ko')).toBe('잘했어');
  });
});

// ─── enhanceContextForShortInput ────────────────────────────────────────────

describe('enhanceContextForShortInput', () => {
  it('adds hint for short input targeting JA', () => {
    const result = enhanceContextForShortInput('bonjour', 'ja');
    expect(result).toContain('Do not transliterate');
    expect(result).toContain('chat message');
  });

  it('appends hint to existing context', () => {
    const result = enhanceContextForShortInput('merci', 'ja', 'some chat context');
    expect(result).toContain('some chat context');
    expect(result).toContain('Do not transliterate');
  });

  it('does NOT add hint for Latin-script targets', () => {
    expect(enhanceContextForShortInput('bonjour', 'en')).toBeUndefined();
    expect(enhanceContextForShortInput('hello', 'fr', 'context')).toBe('context');
  });

  it('does NOT add hint for long inputs (> 3 words)', () => {
    const existing = 'chat context';
    expect(enhanceContextForShortInput('this is a long sentence here', 'ja', existing)).toBe(existing);
  });

  it('adds hint for 1-3 word inputs to all non-Latin targets', () => {
    for (const lang of ['ja', 'zh', 'ko', 'ar', 'ru', 'th', 'hi']) {
      const result = enhanceContextForShortInput('salut', lang);
      expect(result).toContain('Do not transliterate');
    }
  });
});
