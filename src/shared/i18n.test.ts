import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { UiLocale } from './i18n';
import { SettingsSchema } from './settings';
import { UI_LOCALES, UI_LOCALE_NAMES, isRtlLocale, detectUiLocale, resolveUiLocale, makeT, loadUiMessages } from './i18n';
import { UI_LOADERS } from './i18n.messages';

const here = dirname(fileURLToPath(import.meta.url));
const keys = JSON.parse(readFileSync(join(here, 'i18n/keys.json'), 'utf8')) as string[];
const nonEn = UI_LOCALES.filter((l): l is Exclude<UiLocale, 'en'> => l !== 'en');

describe('i18n', () => {
  it('English t() is the identity function', () => {
    const t = makeT('en');
    expect(t('Options')).toBe('Options');
    expect(t('unknown zzz key')).toBe('unknown zzz key');
  });

  // The popup used to load all 42 catalogues at open. One is loaded now, the
  // one being read; until it lands t() answers in English, never blank.
  it('a non-English t() is English until its catalogue loads, then translated', async () => {
    const t = makeT('ko');
    expect(t('saved')).toBe('saved');
    await loadUiMessages('ko');
    const saved = (await UI_LOADERS.ko())['saved'];
    expect(saved).toBeTruthy();
    expect(saved).not.toBe('saved');
    expect(t('saved')).toBe(saved);
    expect(makeT('ko')('saved')).toBe(saved);
    expect(t('unknown zzz key')).toBe('unknown zzz key');
  });

  it('marks Arabic, Hebrew and Persian as RTL, and nothing else', () => {
    const rtl = ['ar', 'he', 'fa'];
    for (const l of UI_LOCALES) expect(isRtlLocale(l), l).toBe(rtl.includes(l));
  });

  it.each([
    [['pt-BR'], 'pt'],
    [['pt-PT'], 'pt-pt'],
    [['zh-TW'], 'zh-tw'],
    [['zh-Hant-HK'], 'zh-tw'],
    [['zh-CN'], 'zh'],
    [['nb-NO'], 'no'],
    [['fil'], 'tl'],
    [['iw'], 'he'],
    [['xx', 'de-AT'], 'de'],
  ])('detects %j as %s', (languages, want) => {
    const nav = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', { value: { languages, language: languages[0] }, configurable: true });
    try {
      expect(detectUiLocale()).toBe(want);
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    }
  });

  it('resolves the uiLang setting (auto / explicit / invalid)', () => {
    expect(UI_LOCALES).toContain(resolveUiLocale('auto'));
    expect(UI_LOCALES).toContain(resolveUiLocale(undefined));
    expect(resolveUiLocale('fr')).toBe('fr');
    expect(resolveUiLocale('not-a-locale')).toBe('en');
  });

  it('detects a supported locale from the environment', () => {
    expect(UI_LOCALES).toContain(detectUiLocale());
  });

  it('has a native name for every locale', () => {
    for (const l of UI_LOCALES) expect(UI_LOCALE_NAMES[l]).toBeTruthy();
  });

  it('every non-English catalog covers exactly the canonical keys, with no empty values', async () => {
    const canonical = [...keys].sort();
    for (const loc of nonEn) {
      const map = await UI_LOADERS[loc]();
      expect(map, `missing catalog: ${loc}`).toBeTruthy();
      expect(Object.keys(map ?? {}).sort()).toEqual(canonical);
      for (const [k, v] of Object.entries(map ?? {})) {
        expect(typeof v === 'string' && v.length > 0, `${loc} -> "${k}"`).toBe(true);
      }
    }
  });
});

// Three locales shipped that the picker offered and the settings schema refused.
// Picking one sent a value zod would not accept, so nothing was saved and the page
// kept rendering the last accepted language while the menu showed the new one.
// Offering a language and being able to keep it are two different lists, and only
// one of them was updated.
describe('every offered locale can actually be saved', () => {
  it.each(UI_LOCALES)('accepts %s', (loc) => {
    expect(SettingsSchema.parse({ uiLang: loc }).uiLang).toBe(loc);
  });

  it('accepts auto', () => {
    expect(SettingsSchema.parse({ uiLang: 'auto' }).uiLang).toBe('auto');
  });

  // The other direction: a locale the schema takes but the picker never lists
  // would be unreachable, and a stale value nobody can select again.
  it('offers every locale the schema accepts', () => {
    const accepted = (SettingsSchema.shape.uiLang as unknown as { _def: { innerType: { options: string[] } } })._def
      .innerType.options;
    for (const loc of accepted) {
      if (loc === 'auto') continue;
      expect(UI_LOCALES as readonly string[]).toContain(loc);
    }
  });
});
