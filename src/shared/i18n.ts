/**
 * UI internationalization for the popup + options page.
 *
 * Strategy: the English string IS the lookup key (gettext-style). Components keep
 * readable English in the JSX via `t('Cloud engines')`; the catalog in
 * `i18n.messages.ts` maps that English string to each non-English locale. English
 * needs no catalog (the key is the message), and any missing translation falls back
 * to the English key — so the UI is never blank.
 */
import { UI_MESSAGES } from './i18n.messages';
import { matchUiLocale } from './uiLocaleMatch';

/**
 * Every language the extension translates into is also an interface language.
 * `pt` is Brazilian Portuguese (it was the only Portuguese for years, and a
 * saved `uiLang: 'pt'` keeps meaning it); `pt-pt` is European.
 */
export const UI_LOCALES = [
  'en', 'fr', 'es', 'pt', 'pt-pt', 'de', 'it', 'nl', 'pl', 'sv', 'no', 'da', 'fi', 'cs', 'sk', 'sl', 'hu', 'ro',
  'ca', 'et', 'lt', 'lv', 'tr', 'vi', 'id', 'ms', 'tl', 'ru', 'uk', 'bg', 'el', 'ar', 'he', 'fa', 'hi', 'bn',
  'ta', 'th', 'ja', 'ko', 'zh', 'zh-tw', 'yue',
] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

/** Native names for the language picker. */
export const UI_LOCALE_NAMES: Record<UiLocale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português (Brasil)',
  'pt-pt': 'Português (Portugal)',
  de: 'Deutsch',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  sv: 'Svenska',
  no: 'Norsk',
  da: 'Dansk',
  fi: 'Suomi',
  cs: 'Čeština',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  hu: 'Magyar',
  ro: 'Română',
  ca: 'Català',
  et: 'Eesti',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  tl: 'Filipino',
  ru: 'Русский',
  uk: 'Українська',
  bg: 'Български',
  el: 'Ελληνικά',
  ar: 'العربية',
  he: 'עברית',
  fa: 'فارسی',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  th: 'ไทย',
  ja: '日本語',
  ko: '한국어',
  zh: '简体中文',
  'zh-tw': '繁體中文',
  yue: '粵語',
};

const RTL_LOCALES = new Set<UiLocale>(['ar', 'he', 'fa']);
export function isRtlLocale(locale: UiLocale): boolean {
  return RTL_LOCALES.has(locale);
}

function isUiLocale(v: string): v is UiLocale {
  return (UI_LOCALES as readonly string[]).includes(v);
}

/**
 * Pick the closest supported UI locale from the browser's language list.
 * Reliable + standard (navigator.language); falls back to English.
 */
export function detectUiLocale(): UiLocale {
  const list =
    typeof navigator !== 'undefined'
      ? (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])
      : [];
  return (matchUiLocale(list, isUiLocale) as UiLocale | undefined) ?? 'en';
}

/** Resolve the `uiLang` setting ('auto' or an explicit locale) to a concrete locale. */
export function resolveUiLocale(setting: string | undefined): UiLocale {
  if (!setting || setting === 'auto') return detectUiLocale();
  return isUiLocale(setting) ? setting : 'en';
}

export type TFunc = (key: string) => string;

/** Build a translate function bound to one locale. English returns the key verbatim. */
export function makeT(locale: UiLocale): TFunc {
  if (locale === 'en') return (key) => key;
  const table = UI_MESSAGES[locale];
  return (key) => table?.[key] ?? key;
}
