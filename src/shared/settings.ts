import { z } from 'zod';
import { FAVORITE_LANGS_MAX, MIN_TEXT_LENGTH, PAUSED_CHANNELS_MAX, STORAGE_KEY_DEEPL_KEY, STORAGE_KEY_SETTINGS } from './constants';
import { AUTO, isSupportedLang } from './languages';

// A language setting is either 'auto' or a supported ISO code; anything else
// (stale value from an older build, hand-edited storage) is coerced back to 'auto'.
const langSetting = z
  .string()
  .default(AUTO)
  .transform((v) => (v === AUTO || isSupportedLang(v) ? v : AUTO));

export const ProviderOrderSchema = z.array(
  z.enum(['google', 'deepl', 'mymemory', 'lingva']),
);

/** Cloud-chain providers (on-device 'local' runs in the content script, not here). */
export type CloudProviderId = z.infer<typeof ProviderOrderSchema>[number];

export const SettingsSchema = z.object({
  enabled: z.boolean().default(true),
  // Les chaines mises en pause depuis le bandeau, par slug. `enabled` reste
  // l'interrupteur general, celui du popup et des options ; celui du bandeau est
  // local, parce que c'est ce qu'un bouton pause sur un chat veut dire.
  pausedChannels: z.array(z.string()).max(PAUSED_CHANNELS_MAX).default([]),
  // 'auto' = read in the browser's own language (resolveBrowserLang). Works for any
  // user, anywhere, with no configuration. An explicit ISO code overrides it.
  targetLang: langSetting,
  // 'hover' = lazy mode: translation only fetched+shown on mouse hover (saves ~10x quota).
  displayStyle: z.enum(['below', 'inline', 'replace', 'hover']).default('below'),
  showOriginal: z.boolean().default(true),
  showSourceBadge: z.boolean().default(true),
  showProviderBadge: z.boolean().default(false),
  showFloatingBar: z.boolean().default(true),

  // Readability of the translated line itself. The three defaults are the
  // values the stylesheet already carried, so a reader who never opens this
  // section sees exactly what they saw before.
  //
  // The scale multiplies whatever size Kick gives the chat line, it does not
  // replace it: a reader who has already enlarged Kick's own chat keeps that
  // choice and this one compounds with it.
  translatedFontScale: z.number().min(0.8).max(1.4).default(1),
  translatedLineHeight: z.number().min(1.2).max(2).default(1.35),
  // 'inherit' is Kick's own face, and the default, because the translation
  // belongs to the line it sits under.
  //
  // 'readable' and not 'dyslexic': a genuine dyslexia face (OpenDyslexic,
  // Atkinson Hyperlegible) is a file, and this extension ships no font file
  // and fetches none, because a webfont on a page we do not own is a network
  // request per chat line. The stack asks for Atkinson first in case the
  // reader already has it, then falls back on Verdana, which really does
  // separate I from l from 1 better than the average UI face. Naming it after
  // a condition it cannot guarantee to serve would be a promise we do not keep.
  translatedFont: z.enum(['inherit', 'system', 'serif', 'mono', 'readable']).default('inherit'),
  // L'air autour du bloc traduit. 'normal' reproduit exactement les marges que
  // la feuille portait avant que ce reglage existe.
  translatedDensity: z.enum(['compact', 'normal', 'roomy']).default('normal'),

  // L'accent, ferme a quatre valeurs mesurees plutot qu'ouvert a une couleur
  // libre : voir l'en-tete des blocs d'accent dans theme.css. Un lecteur qui
  // choisit son bleu prefere ne sait pas que la verte de Kick tient 1.37:1 sur
  // du blanc.
  accent: z.enum(['kick', 'cyan', 'violet', 'amber']).default('kick'),
  // Le theme suit celui de Kick, mesure sur le fond reel du chat. 'dark' et
  // 'light' le figent pour qui prefere l'inverse de ce que la chaine affiche.
  chatScheme: z.enum(['auto', 'dark', 'light']).default('auto'),

  // Se souvenir de la langue de lecture par chaine.
  //
  // Optionnel et par defaut eteint : allumer ce reglage fait changer la langue
  // toute seule en changeant de chaine, ce qui est exactement ce qu'on veut
  // quand on l'a demande et une surprise desagreable sinon.
  //
  // La regle est volontairement courte : sur une chaine connue on restaure sa
  // langue, sur une chaine inconnue on ne touche a rien. Restaurer un defaut
  // global sur l'inconnue ferait perdre le choix qu'on vient de faire a chaque
  // clic sur une nouvelle chaine.
  rememberChannelLang: z.boolean().default(false),
  // La memoire elle-meme. Bornee a CHANNEL_LANG_MAX, en jetant la plus
  // ancienne : un objet qui ne se vide jamais finit par ne plus tenir dans le
  // quota de chrome.storage.sync, et c'est tout le reste des reglages qui
  // cesse alors de s'enregistrer.
  channelLangs: z.record(z.string(), z.string()).default({}),

  // Engine strategy.
  // local-first : on-device Chromium Translator when the model is downloaded, else cloud.
  // cloud-first : always cloud chain; on-device only if cloud fails. The default since
  // 2026-11-05: blind judges scored the on-device engine worse than Google on all six
  // languages it served, 1.38 penalty a line against 0.90 on 454 outputs.
  // local-only  : on-device only, never hit the network.
  engineMode: z.enum(['local-first', 'cloud-first', 'local-only']).default('cloud-first'),
  // Written once the old local-first default has been moved off, see loadSettings.
  engineModeMoved: z.boolean().default(true),
  localEnabled: z.boolean().default(true),

  providerOrder: ProviderOrderSchema.default(['google', 'mymemory', 'lingva']),
  deeplApiKey: z.string().default(''),
  deeplPlan: z.enum(['free', 'pro']).default('free'),
  // Stop using DeepL when monthly quota reaches this %, to spread it across the month.
  // 0 = no limit (use until exhausted). Useful for Free-tier users (1M chars/month).
  deeplBudgetPct: z.number().int().min(0).max(100).default(0),
  // Budget-aware routing: spend the limited DeepL quota only on the European pairs
  // where it measurably beats the free engines; for other targets (Asian/Indic/RTL,
  // where Google is as good) DeepL drops to a last resort. Stretches the Free tier.
  deeplSmartRouting: z.boolean().default(true),
  lingvaInstance: z.string().url().or(z.literal('')).default(''),
  // MyMemory: providing an email lifts the anonymous cap from 5k to 50k words/day.
  myMemoryEmail: z.string().email().or(z.literal('')).default(''),

  // Filters
  // Shorter messages are left untranslated. Defaults to the floor that used to be
  // hardcoded, so an existing install keeps its current behaviour.
  minTextLength: z.number().int().min(1).max(50).default(MIN_TEXT_LENGTH),
  ignoreEnglish: z.boolean().default(true),
  ignoreBots: z.boolean().default(true),
  // Bots a channel uses beyond the built-in Kick list (constants KICK_BOTS).
  extraBots: z.array(z.string()).default([]),
  blacklistUsers: z.array(z.string()).default([]),
  // A line containing one of these is hidden from chat, not just left untranslated.
  blockedKeywords: z.array(z.string()).default([]),
  blacklistChannels: z.array(z.string()).default([]),
  whitelistChannels: z.array(z.string()).default([]),
  sourceLangAllowlist: z.array(z.string()).default([]),

  // User glossary: custom find→replace applied after translation.
  // Each entry: "source→replacement" (e.g. "草→lol", "kusa→lol").
  glossary: z.array(z.string()).default([]),

  // Performance
  cacheMaxEntries: z.number().int().positive().max(50_000).default(15_000),
  cacheTtlHours: z.number().int().positive().max(720).default(72),
  concurrency: z.number().int().min(1).max(16).default(4),
  perChannelBudgetPerMin: z.number().int().min(10).max(2000).default(200),

  // Connection strategy
  connectionMode: z.enum(['auto', 'websocket', 'dom']).default('auto'),
  // Pause translating in tabs that aren't visible — stops background tabs from
  // burning provider quota (DeepL) while you're not watching.
  pauseWhenHidden: z.boolean().default(true),
  debug: z.boolean().default(false),

  // UI
  popupShowsStats: z.boolean().default(true),
  // Opt-in anonymous daily usage statistics (shared/usage.ts). Off until the
  // user says yes; the popup asks once (usageStatsAsked), the About tab can
  // change it any time. On Firefox the browser's own data consent decides.
  usageStats: z.boolean().default(false),
  usageStatsAsked: z.boolean().default(false),
  // Language of the extension's own UI (options + popup). 'auto' follows the browser.
  // Must list every entry of UI_LOCALES in src/shared/i18n.ts. This is the gate
  // that decides whether a pick can be SAVED, so a locale offered by the picker
  // but missing here is silently refused: the menu shows the new language while
  // the page keeps rendering the last one that was accepted. The list is repeated
  // rather than imported because importing i18n.ts here would pull the whole
  // translation catalogue into the content script bundle, which is deliberately
  // free of it. A test in i18n.test.ts fails if the two lists drift apart.
  uiLang: z
    .enum([
      'auto', 'en', 'fr', 'es', 'pt', 'pt-pt', 'de', 'it', 'nl', 'pl', 'sv', 'no', 'da', 'fi', 'cs', 'sk', 'sl', 'hu',
      'ro', 'ca', 'et', 'lt', 'lv', 'tr', 'vi', 'id', 'ms', 'tl', 'ru', 'uk', 'bg', 'el', 'ar', 'he', 'fa', 'hi', 'bn',
      'ta', 'th', 'ja', 'ko', 'zh', 'zh-tw', 'yue',
    ])
    .default('auto'),

  // Compose preview: translate what *you* type before you send it.
  // Source language is auto-detected; output goes to composeTargetLang.
  // Runs through the same DeepL-first cloud chain as incoming translation.
  composeEnabled: z.boolean().default(true),
  // 'auto' = write in the *channel's* language, detected from Kick's API
  // (livestream.lang_iso). No manual language picking. An explicit code overrides it.
  composeTargetLang: langSetting,
  // 'insert' drops the translation into the chat box (you press Enter); 'copy'
  // puts it on the clipboard instead (safe fallback if Kick's editor rejects writes).
  composeInsertMode: z.enum(['insert', 'copy']).default('insert'),
  // Which key swaps what you typed for its translation.
  //
  // Tab is the gesture people already have for "accept the suggestion", and it
  // is the one asked for. It is also the key that moves focus, so it is taken
  // ONLY while the preview is on screen, never on an empty box, and Shift+Tab
  // is always left alone so walking backwards out of the composer still works.
  // Escape hides the preview and hands Tab straight back.
  //
  // 'ctrl-enter' is for a reader who navigates by keyboard and wants Tab to
  // stay navigation whatever is on screen. Ctrl/Cmd+Enter keeps working in
  // both modes; this setting only decides whether Tab joins it.
  composeInsertKey: z.enum(['tab-and-enter', 'ctrl-enter']).default('tab-and-enter'),

  // Languages pinned on the chip that sits in Kick's message box, most recent
  // first. Empty by default: the chip then opens straight onto the full list,
  // and the first language picked becomes the first favourite. No configuration
  // step, and no list that reorders itself under the pointer between two clicks.
  favoriteLangs: z
    .array(z.string())
    .default([])
    .transform((v) => v.filter((c) => isSupportedLang(c)).slice(0, FAVORITE_LANGS_MAX)),
  // The chip is anchored in the message box on purpose: changing the language
  // you write in must never mean travelling to the top of the chat.
  showComposerChip: z.boolean().default(true),
});


export type Settings = z.infer<typeof SettingsSchema>;

const DEFAULTS: Settings = SettingsSchema.parse({});

export function defaultSettings(): Settings {
  return { ...DEFAULTS, providerOrder: [...DEFAULTS.providerOrder] };
}

/**
 * The synced blob never carries the DeepL key.
 *
 * Every reader takes the key off the Settings object, so it is put back on load
 * and taken off again on every write. Keeping the field in the schema means no
 * consumer, and no part of the options UI, has to know where it actually lives.
 */
function withoutKey(s: Settings): Settings {
  return { ...s, deeplApiKey: '' };
}

export async function loadSettings(): Promise<Settings> {
  const [synced, local] = await Promise.all([
    chrome.storage.sync.get(STORAGE_KEY_SETTINGS),
    chrome.storage.local.get(STORAGE_KEY_DEEPL_KEY),
  ]);
  const candidate = synced[STORAGE_KEY_SETTINGS];
  const parsed = candidate ? SettingsSchema.safeParse(candidate) : undefined;
  let base = parsed?.success ? parsed.data : defaultSettings();
  const held = (local[STORAGE_KEY_DEEPL_KEY] as string | undefined) ?? '';

  // local-first was the default until 2026-11-05 and saving any setting wrote it
  // down, so a stored value says nothing about whether the reader picked it. Moved
  // once, so picking it afterwards holds. A failed write retries on the next load.
  if (parsed?.success && (candidate as { engineModeMoved?: unknown }).engineModeMoved !== true) {
    if (base.engineMode === 'local-first') base = { ...base, engineMode: 'cloud-first' };
    await chrome.storage.sync.set({ [STORAGE_KEY_SETTINGS]: withoutKey(base) }).catch(() => undefined);
  }

  // Migration from a build that synced the key. Land it locally BEFORE clearing
  // it from sync: if the local write fails, sync still holds the only copy and
  // the next load retries; if the clear fails, the key is briefly in both places
  // and the next load finishes the job. Neither order of failure loses it.
  const stray = base.deeplApiKey;
  if (stray) {
    if (stray !== held) await chrome.storage.local.set({ [STORAGE_KEY_DEEPL_KEY]: stray });
    await chrome.storage.sync.set({ [STORAGE_KEY_SETTINGS]: withoutKey(base) });
    return { ...base, deeplApiKey: stray };
  }
  return { ...base, deeplApiKey: held };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next = SettingsSchema.parse({ ...current, ...patch });
  if (patch.deeplApiKey !== undefined) {
    await chrome.storage.local.set({ [STORAGE_KEY_DEEPL_KEY]: next.deeplApiKey });
  }
  await chrome.storage.sync.set({ [STORAGE_KEY_SETTINGS]: withoutKey(next) });
  return next;
}

/** Overwrite all settings with defaults (used by the "Reset" button). */
export async function resetSettings(): Promise<Settings> {
  const fresh = defaultSettings();
  // A reset that left the key behind would be a reset the user cannot see.
  await chrome.storage.local.remove(STORAGE_KEY_DEEPL_KEY);
  await chrome.storage.sync.set({ [STORAGE_KEY_SETTINGS]: fresh });
  return fresh;
}

/** Export all settings as a JSON string (for backup / transfer). */
export async function exportSettings(): Promise<string> {
  const s = await loadSettings();
  return JSON.stringify(s, null, 2);
}

/**
 * Parse + validate a settings backup. Throws when the payload is unusable.
 * Missing fields fall back to defaults and unknown ones are dropped, so a file
 * exported by an older or newer build still imports cleanly.
 */
export function parseSettingsJson(json: string): Settings {
  const raw: unknown = JSON.parse(json);
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid settings JSON');
  return parsed.data;
}

/** Import settings from a JSON string. Returns the imported settings. */
export async function importSettings(json: string): Promise<Settings> {
  const next = parseSettingsJson(json);
  // A backup written before the split still carries the key in its JSON, so it
  // is routed to local storage rather than silently dropped on import.
  await chrome.storage.local.set({ [STORAGE_KEY_DEEPL_KEY]: next.deeplApiKey });
  await chrome.storage.sync.set({ [STORAGE_KEY_SETTINGS]: withoutKey(next) });
  return next;
}

export function watchSettings(cb: (next: Settings) => void): () => void {
  /**
   * Settings now live in two areas, so the callback re-reads instead of parsing
   * the change payload. Handing over `change.newValue` would deliver a Settings
   * whose deeplApiKey is always empty, and DeepL would drop out of the chain on
   * the next unrelated setting change until the page was reloaded.
   */
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ): void => {
    const touched =
      (area === 'sync' && changes[STORAGE_KEY_SETTINGS] !== undefined) ||
      (area === 'local' && changes[STORAGE_KEY_DEEPL_KEY] !== undefined);
    if (!touched) return;
    void loadSettings().then(cb).catch(() => undefined);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
