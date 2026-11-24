import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY_DEEPL_KEY, STORAGE_KEY_SETTINGS } from '~/shared/constants';
import type { RuntimeMessage, RuntimeResponse } from '~/shared/messages';
import type { Settings } from '~/shared/settings';

// The worker module wires listeners at import time. Its heavy neighbours (IndexedDB
// cache, alarms, usage counters) are not what these tests are about.
vi.mock('./cache', () => ({
  TranslationCache: class {
    setConfig(): void {}
    key(text: string, lang: string): string {
      return `${lang}::${text}`;
    }
    async warm(): Promise<void> {}
    async setMany(): Promise<void> {}
    async clear(): Promise<void> {}
    async stats(): Promise<{ entries: number }> {
      return { entries: 0 };
    }
    async prune(): Promise<void> {}
  },
  warmTargets: () => [],
}));
vi.mock('./keepalive', () => ({
  listenKeepalive: () => undefined,
  armKeepalive: () => undefined,
  installKeepalive: async () => undefined,
}));
vi.mock('./updateChecker', () => ({
  installUpdateCheck: () => undefined,
  getUpdateStatus: async () => ({}),
}));
vi.mock('./usage', () => ({
  installUsage: () => undefined,
  addUsage: async () => undefined,
  dropUsage: async () => undefined,
  recordProviderError: async () => undefined,
  recordTranslation: async () => undefined,
}));
vi.mock('./stats', () => ({
  StatsTracker: class {
    async load(): Promise<void> {}
    current(): { byLang: Record<string, number> } {
      return { byLang: {} };
    }
    recordRequest(): void {}
    recordThrottled(): void {}
    recordError(): void {}
    async reset(): Promise<object> {
      return {};
    }
  },
}));

type Listener = (msg: RuntimeMessage, sender: chrome.runtime.MessageSender, reply: (r: RuntimeResponse) => void) => unknown;

const EXT = 'chrome-extension://abcdefghijklmnop/';
const KICK_TAB: chrome.runtime.MessageSender = { tab: { id: 1 } as chrome.tabs.Tab, url: 'https://kick.com/somechannel' };
const OPTIONS_PAGE: chrome.runtime.MessageSender = { url: `${EXT}src/options/index.html` };

async function loadWorker(
  sync: Record<string, unknown>,
  local: Record<string, unknown>,
  { slowSync = false } = {},
): Promise<{
  syncWrites: Record<string, unknown>[];
  alarms: string[];
  levels: string[];
  told: { tab: number; msg: unknown }[];
  changed: (area: string, changes: Record<string, unknown>) => void;
  ask: (m: RuntimeMessage, s: chrome.runtime.MessageSender) => Promise<RuntimeResponse>;
}> {
  const syncWrites: Record<string, unknown>[] = [];
  const alarms: string[] = [];
  const levels: string[] = [];
  const told: { tab: number; msg: unknown }[] = [];
  let onChanged: ((changes: Record<string, unknown>, area: string) => void) | undefined;
  let listener: Listener | undefined;
  const area = (store: Record<string, unknown>, writes?: Record<string, unknown>[], slow = false) => ({
    get: async (keys: string | string[]) => {
      if (slow) await new Promise((r) => setTimeout(r, 5));
      return Object.fromEntries([keys].flat().filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
    },
    setAccessLevel: async ({ accessLevel }: { accessLevel: string }) => void levels.push(accessLevel),
    set: async (obj: Record<string, unknown>) => {
      writes?.push(structuredClone(obj));
      Object.assign(store, structuredClone(obj));
    },
    remove: async (key: string) => {
      delete store[key];
    },
  });
  // init() asks DeepL for its usage when a key is set: nothing leaves the test.
  vi.stubGlobal('fetch', async () => ({ ok: false }));
  vi.stubGlobal('chrome', {
    storage: {
      sync: area(structuredClone(sync), syncWrites, slowSync),
      local: area(structuredClone(local)),
      session: area({}),
      onChanged: { addListener: (l: typeof onChanged) => (onChanged = l), removeListener: () => undefined },
    },
    runtime: {
      id: 'abcdefghijklmnop',
      lastError: undefined,
      onMessage: { addListener: (l: Listener) => (listener = l) },
      onInstalled: { addListener: () => undefined },
      getManifest: () => ({ version: '3.6.2', content_scripts: [{ matches: ['https://kick.com/*'] }] }),
      getURL: (p = '') => EXT + p,
      openOptionsPage: async () => undefined,
    },
    alarms: { create: (name: string) => void alarms.push(name), get: async () => undefined, onAlarm: { addListener: () => undefined } },
    commands: { onCommand: { addListener: () => undefined } },
    tabs: {
      query: async () => [{ id: 7 }],
      sendMessage: async (tab: number, msg: unknown) => void told.push({ tab, msg }),
    },
    scripting: { executeScript: async () => [] },
  });
  vi.resetModules();
  await import('./index');
  const ask = (m: RuntimeMessage, s: chrome.runtime.MessageSender): Promise<RuntimeResponse> =>
    new Promise((resolve) => {
      listener!(m, s, resolve);
    });
  return { syncWrites, alarms, levels, told, changed: (area, changes) => onChanged?.(changes, area), ask };
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('worker start with a DeepL key on the device', () => {
  // Removing DeepL from the chain is a choice. The worker used to put it back
  // first, and wrote the whole settings object, key included, into browser sync.
  it('neither syncs the key nor puts DeepL back into the chain', async () => {
    const { syncWrites } = await loadWorker(
      { [STORAGE_KEY_SETTINGS]: { providerOrder: ['google', 'mymemory'], engineModeMoved: true } },
      { [STORAGE_KEY_DEEPL_KEY]: 'secret-key:fx' },
    );
    await settle();
    for (const w of syncWrites) {
      const s = w[STORAGE_KEY_SETTINGS] as Partial<Settings>;
      expect(s.deeplApiKey ?? '').toBe('');
      expect(s.providerOrder).not.toContain('deepl');
    }
  });
});

describe('cache housekeeping', () => {
  it('schedules the daily prune at start', async () => {
    const { alarms } = await loadWorker({}, {});
    await settle();
    expect(alarms).toContain('kt.cachePrune');
  });
});

/**
 * A Kick tab is the least trusted place that can reach the worker: a renderer
 * compromised through the page can send anything the content script can. It
 * used to get the DeepL key with every settings answer, and could reset
 * everything, clear the cache or point the chat at another server.
 */
describe('what a Kick tab may ask the worker', () => {
  const stored = { [STORAGE_KEY_SETTINGS]: { providerOrder: ['deepl', 'google'], engineModeMoved: true } };
  const key = { [STORAGE_KEY_DEEPL_KEY]: 'secret-key:fx' };

  it('gets settings without the DeepL key', async () => {
    const { ask } = await loadWorker(stored, key);
    await settle();
    const res = await ask({ type: 'settings.get' }, KICK_TAB);
    expect(res.type).toBe('settings');
    expect((res as { payload: Settings }).payload.deeplApiKey).toBe('');
  });

  it('cannot reset the settings or clear the cache', async () => {
    const { ask } = await loadWorker(stored, key);
    await settle();
    expect((await ask({ type: 'settings.reset' }, KICK_TAB)).type).toBe('error');
    expect((await ask({ type: 'cache.clear' }, KICK_TAB)).type).toBe('error');
  });

  it('cannot write the key, the engines or the Lingva server', async () => {
    const { ask, syncWrites } = await loadWorker(stored, key);
    await settle();
    syncWrites.length = 0;
    for (const payload of [{ deeplApiKey: 'x' }, { providerOrder: ['lingva'] as Settings['providerOrder'] }, { lingvaInstance: 'https://evil.example' }]) {
      expect((await ask({ type: 'settings.set', payload }, KICK_TAB)).type).toBe('error');
    }
    expect(syncWrites).toEqual([]);
  });

  it('can still write what the chat bar and the composer write', async () => {
    const { ask } = await loadWorker(stored, key);
    await settle();
    const res = await ask({ type: 'settings.set', payload: { targetLang: 'de', pausedChannels: ['x'] } }, KICK_TAB);
    expect(res.type).toBe('settings');
    expect((res as { payload: Settings }).payload.deeplApiKey).toBe('');
  });

  it('leaves the options page every right, the key included', async () => {
    const { ask } = await loadWorker(stored, key);
    await settle();
    const res = await ask({ type: 'settings.get' }, OPTIONS_PAGE);
    expect((res as { payload: Settings }).payload.deeplApiKey).toBe('secret-key:fx');
    expect((await ask({ type: 'cache.clear' }, OPTIONS_PAGE)).type).toBe('ack');
  });
});

// A message can wake the worker and arrive before init() has read storage:
// it used to be answered with the defaults, not the reader's settings.
describe('a message that wakes the worker', () => {
  it('is answered with the stored settings, not the defaults', async () => {
    const { ask } = await loadWorker({ [STORAGE_KEY_SETTINGS]: { targetLang: 'ja', engineModeMoved: true } }, {}, { slowSync: true });
    const res = await ask({ type: 'settings.get' }, OPTIONS_PAGE);
    expect((res as { payload: Settings }).payload.targetLang).toBe('ja');
  });
});

/**
 * A content script reads storage itself unless the worker shuts it. It could take
 * the DeepL key from storage.local and write the settings blob in storage.sync,
 * which made every gate above decoration.
 */
describe('storage is shut to content scripts', () => {
  const key = { [STORAGE_KEY_DEEPL_KEY]: 'secret-key:fx' };
  const stored = { [STORAGE_KEY_SETTINGS]: { targetLang: 'ja', engineModeMoved: true } };

  it('limits both areas to trusted contexts when the worker starts', async () => {
    const { levels } = await loadWorker(stored, key);
    await settle();
    expect(levels).toEqual(['TRUSTED_CONTEXTS', 'TRUSTED_CONTEXTS']);
  });

  it("keeps an existing reader's key and settings for the extension's own pages", async () => {
    const { ask } = await loadWorker(stored, key);
    await settle();
    const res = (await ask({ type: 'settings.get' }, OPTIONS_PAGE)) as { payload: Settings };
    expect(res.payload.deeplApiKey).toBe('secret-key:fx');
    expect(res.payload.targetLang).toBe('ja');
  });

  it('tells open Kick tabs to ask again, without sending any value', async () => {
    const { changed, told } = await loadWorker(stored, key);
    await settle();
    changed('local', { [STORAGE_KEY_DEEPL_KEY]: { newValue: 'new-secret:fx' } });
    await settle();
    expect(told).toEqual([{ tab: 7, msg: { type: 'settings.changed' } }]);
    expect(JSON.stringify(told)).not.toContain('secret');
  });

  it('remembers a channel language and the compose hint for a tab, and refuses junk', async () => {
    const { ask } = await loadWorker(stored, key);
    await settle();
    expect((await ask({ type: 'lastlang.set', slug: 'chan_1', lang: 'ja' }, KICK_TAB)).type).toBe('ack');
    expect(await ask({ type: 'lastlang.get', slug: 'chan_1' }, KICK_TAB)).toEqual({ type: 'value', payload: 'ja' });
    expect((await ask({ type: 'lastlang.set', slug: '../x', lang: 'ja' }, KICK_TAB)).type).toBe('error');
    expect((await ask({ type: 'hint.set', value: true }, KICK_TAB)).type).toBe('ack');
    expect(await ask({ type: 'hint.get' }, KICK_TAB)).toEqual({ type: 'value', payload: true });
    expect((await ask({ type: 'hint.set', value: 'x' as unknown as boolean }, KICK_TAB)).type).toBe('error');
  });
});

/** What a page sends is data, checked before the worker spends a quota or a map slot on it. */
describe('malformed requests from a Kick tab', () => {
  const stored = { [STORAGE_KEY_SETTINGS]: { engineModeMoved: true, perChannelBudgetPerMin: 10 } };
  const ask = async (m: RuntimeMessage) => {
    const w = await loadWorker(stored, {});
    await settle();
    return w.ask(m, KICK_TAB);
  };

  it('refuses a translate request with the wrong shape', async () => {
    const bad = [
      { messageId: 'm', text: 'x'.repeat(801), targetLang: 'fr' },
      { messageId: 'm', text: 'hello', targetLang: 'fr', channel: '../../x' },
      { messageId: 'm', text: 5, targetLang: 'fr' },
    ];
    for (const payload of bad) {
      const res = (await ask({ type: 'translate', payload } as unknown as RuntimeMessage)) as { payload: { ok: boolean; error?: { code: string } } };
      expect(res.payload).toMatchObject({ ok: false, error: { code: 'bad_request' } });
    }
  });

  it('answers no catalogue for a locale that is a prototype key', async () => {
    const res = await ask({ type: 'i18n.chat', locale: 'constructor' });
    expect(res).toEqual({ type: 'i18n.chat', payload: undefined });
    const real = await ask({ type: 'i18n.chat', locale: 'fr' });
    expect((real as { payload?: object }).payload).toBeTypeOf('object');
  });

  it('forgets the oldest channel rather than growing the map without bound', async () => {
    const w = await loadWorker(stored, {});
    await settle();
    const tr = async (channel: string) =>
      JSON.stringify(await w.ask({ type: 'translate', payload: { messageId: 'm', text: 'hello there', targetLang: 'fr', channel, noCache: true } }, KICK_TAB));
    // Together: the bucket is taken before anything waits, so the 11th is refused
    // and nothing sits through a batching window per call.
    const burst = await Promise.all(Array.from({ length: 11 }, () => tr('first')));
    expect(burst.at(-1)).toContain('channel_budget');
    await Promise.all(Array.from({ length: 200 }, (_, i) => tr(`other-${i}`)));
    expect(await tr('first')).not.toContain('channel_budget');
  });
});
