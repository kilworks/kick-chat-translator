import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY_DEEPL_KEY, STORAGE_KEY_SETTINGS } from './constants';
import { loadSettings } from './settings';

/**
 * What a 3.6.2 reader has in storage when the update lands. Frozen on purpose:
 * this is the blob 3.6.2 wrote, and it must not follow later schema changes.
 * Every key holds a value that is not its default, so a reset of any one of
 * them shows. It still carries connectionMode, removed in 3.6.3, and a DeepL
 * key left in sync, as for a reader caught by the 3.6.2 auto-promote.
 *
 * engineModeMoved stays true: 3.6.2 always wrote it, and false would trigger
 * the one-time move off local-first, which is tested on its own.
 */
const BLOB_362 = {
  enabled: false,
  pausedChannels: ['chan-a'],
  targetLang: 'ja',
  displayStyle: 'inline',
  showOriginal: false,
  showSourceBadge: false,
  showProviderBadge: true,
  showFloatingBar: false,
  translatedFontScale: 1.2,
  translatedLineHeight: 1.6,
  translatedFont: 'serif',
  translatedDensity: 'roomy',
  accent: 'violet',
  chatScheme: 'light',
  rememberChannelLang: true,
  channelLangs: { 'chan-b': 'de' },
  engineMode: 'local-first',
  engineModeMoved: true,
  localEnabled: false,
  providerOrder: ['deepl', 'lingva'],
  deeplApiKey: 'stuck-in-sync:fx',
  deeplPlan: 'pro',
  deeplBudgetPct: 40,
  deeplSmartRouting: false,
  lingvaInstance: 'https://lingva.example',
  myMemoryEmail: 'reader@example.com',
  minTextLength: 5,
  ignoreEnglish: false,
  ignoreBots: false,
  extraBots: ['somebot'],
  blacklistUsers: ['someone'],
  blockedKeywords: ['spoiler'],
  blacklistChannels: ['chan-c'],
  whitelistChannels: ['chan-d'],
  sourceLangAllowlist: ['ko'],
  glossary: ['KEKW'],
  cacheMaxEntries: 20000,
  cacheTtlHours: 24,
  concurrency: 8,
  perChannelBudgetPerMin: 500,
  connectionMode: 'dom',
  pauseWhenHidden: false,
  debug: true,
  popupShowsStats: false,
  usageStats: true,
  usageStatsAsked: true,
  uiLang: 'fr',
  composeEnabled: false,
  composeTargetLang: 'es',
  composeInsertMode: 'copy',
  composeInsertKey: 'ctrl-enter',
  favoriteLangs: ['ja', 'ko'],
  showComposerChip: false,
};

let sync: Map<string, unknown>;
let local: Map<string, unknown>;
const area = (m: Map<string, unknown>) => ({
  get: (k: string) => Promise.resolve(m.has(k) ? { [k]: structuredClone(m.get(k)) } : {}),
  set: (o: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v));
    return Promise.resolve();
  },
  remove: (k: string) => {
    m.delete(k);
    return Promise.resolve();
  },
});

beforeEach(() => {
  sync = new Map([[STORAGE_KEY_SETTINGS, structuredClone(BLOB_362)]]);
  local = new Map();
  vi.stubGlobal('chrome', { storage: { sync: area(sync), local: area(local) } });
});
afterEach(() => vi.unstubAllGlobals());

describe('updating from 3.6.2', () => {
  it('keeps every setting the reader had', async () => {
    const s = (await loadSettings()) as unknown as Record<string, unknown>;
    const { connectionMode: _gone, ...kept } = BLOB_362;
    for (const [k, v] of Object.entries(kept)) expect(s[k], k).toEqual(v);
  });

  it('drops connectionMode', async () => {
    const s = (await loadSettings()) as unknown as Record<string, unknown>;
    expect('connectionMode' in s).toBe(false);
  });

  it('moves the DeepL key out of sync and keeps serving it', async () => {
    const s = await loadSettings();
    expect(s.deeplApiKey).toBe('stuck-in-sync:fx');
    expect(local.get(STORAGE_KEY_DEEPL_KEY)).toBe('stuck-in-sync:fx');
    expect((sync.get(STORAGE_KEY_SETTINGS) as Record<string, unknown>).deeplApiKey).toBe('');
  });
});
