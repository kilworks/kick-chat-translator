import { describe, expect, it } from 'vitest';
import cases from '../../../tools/lid/cost-cases.json';
import { hasNonEnglishLetter, isSameLanguageAsTarget, shouldDropBySourceLang } from '../filters';
import { defaultSettings } from '~/shared/settings';

// tools/lid/cost.py re-implements the pipeline's three deletion rules
// (pipeline.ts prepare: ignoreEnglish, skipSameLang, source allowlist) to price
// detection errors. Both sides read cost-cases.json; this side asserts the real
// predicates, tools/lid/test_cost.py asserts the Python copy.
describe('cost bench deletion rules match the pipeline predicates', () => {
  for (const c of cases as Array<{ text: string; conf: string | null; det: string | null; target: string; allow?: string[]; deleted: boolean }>) {
    it(`${c.text} -> ${c.target}${c.allow ? ' allow' : ''}`, () => {
      const settings = { ...defaultSettings(), sourceLangAllowlist: c.allow ?? [] };
      const det = c.det ?? undefined;
      const deleted =
        (settings.ignoreEnglish && c.target === 'en' && det === 'en' && !hasNonEnglishLetter(c.text)) ||
        isSameLanguageAsTarget(c.conf ?? undefined, c.target) ||
        shouldDropBySourceLang(det, settings) !== undefined;
      expect(deleted).toBe(c.deleted);
    });
  }
});
