import { describe, expect, it } from 'vitest';
import { hasJaOnlyForm } from './hanJaForms';
import { confidentLanguage } from './langDetect';

// Invented fixtures. Escapes keep the intent readable: each comment says what the line is.
describe('characters only Japanese writes', () => {
  it('spots a form Japanese wrote and Chinese never did', () => {
    expect(hasJaOnlyForm('両手')).toBe(true); // both hands, Japanese new form
    expect(hasJaOnlyForm('两手')).toBe(false); // the same words, Simplified Chinese
  });

  it('names a Han-only line Japanese when the character lists say nothing', () => {
    expect(confidentLanguage('両手')).toBe('ja');
  });

  it('leaves the verdict to the Chinese lists when they name the line', () => {
    expect(confidentLanguage('両手這')).toBe('zh-tw'); // a Traditional character wins
  });

  it('is silent on empty and one-character input', () => {
    expect(hasJaOnlyForm('')).toBe(false);
    expect(confidentLanguage('両')).toBeUndefined();
  });

  it('keeps a Chinese line with an @mention in kana Chinese', () => {
    expect(confidentLanguage('@たろう 這個問題很難')).toBe('zh-tw');
  });
});
