import type { UiLocale } from './i18n';

/**
 * UI translation catalogs: English string (key) → translation, per non-English locale.
 * Anything missing falls back to the English key, so partial coverage is safe.
 * Per-language maps live in ./i18n/<locale>.ts (keys mirror src/shared/i18n/keys.json).
 *
 * One loader per locale, each its own chunk: the popup and the options page load
 * the language they show, not all of them (the 42 were 740 KB of every open).
 */
export type UiCatalog = Record<string, string>;

export const UI_LOADERS: Record<Exclude<UiLocale, 'en'>, () => Promise<UiCatalog>> = {
  fr: () => import('./i18n/fr').then((m) => m.fr),
  es: () => import('./i18n/es').then((m) => m.es),
  pt: () => import('./i18n/pt').then((m) => m.pt),
  'pt-pt': () => import('./i18n/pt-pt').then((m) => m.pt_pt),
  de: () => import('./i18n/de').then((m) => m.de),
  it: () => import('./i18n/it').then((m) => m.it),
  nl: () => import('./i18n/nl').then((m) => m.nl),
  pl: () => import('./i18n/pl').then((m) => m.pl),
  sv: () => import('./i18n/sv').then((m) => m.sv),
  no: () => import('./i18n/no').then((m) => m.no),
  da: () => import('./i18n/da').then((m) => m.da),
  fi: () => import('./i18n/fi').then((m) => m.fi),
  cs: () => import('./i18n/cs').then((m) => m.cs),
  sk: () => import('./i18n/sk').then((m) => m.sk),
  sl: () => import('./i18n/sl').then((m) => m.sl),
  hu: () => import('./i18n/hu').then((m) => m.hu),
  ro: () => import('./i18n/ro').then((m) => m.ro),
  ca: () => import('./i18n/ca').then((m) => m.ca),
  et: () => import('./i18n/et').then((m) => m.et),
  lt: () => import('./i18n/lt').then((m) => m.lt),
  lv: () => import('./i18n/lv').then((m) => m.lv),
  tr: () => import('./i18n/tr').then((m) => m.tr),
  vi: () => import('./i18n/vi').then((m) => m.vi),
  id: () => import('./i18n/id').then((m) => m.id),
  ms: () => import('./i18n/ms').then((m) => m.ms),
  tl: () => import('./i18n/tl').then((m) => m.tl),
  ru: () => import('./i18n/ru').then((m) => m.ru),
  uk: () => import('./i18n/uk').then((m) => m.uk),
  bg: () => import('./i18n/bg').then((m) => m.bg),
  el: () => import('./i18n/el').then((m) => m.el),
  ar: () => import('./i18n/ar').then((m) => m.ar),
  he: () => import('./i18n/he').then((m) => m.he),
  fa: () => import('./i18n/fa').then((m) => m.fa),
  hi: () => import('./i18n/hi').then((m) => m.hi),
  bn: () => import('./i18n/bn').then((m) => m.bn),
  ta: () => import('./i18n/ta').then((m) => m.ta),
  th: () => import('./i18n/th').then((m) => m.th),
  ja: () => import('./i18n/ja').then((m) => m.ja),
  ko: () => import('./i18n/ko').then((m) => m.ko),
  zh: () => import('./i18n/zh').then((m) => m.zh),
  'zh-tw': () => import('./i18n/zh-tw').then((m) => m.zh_tw),
  yue: () => import('./i18n/yue').then((m) => m.yue),
};
