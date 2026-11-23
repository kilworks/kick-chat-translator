import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY_DEEPL_KEY, STORAGE_KEY_SETTINGS } from '~/shared/constants';
import type { RuntimeMessage, RuntimeResponse } from '~/shared/messages';
import type { Settings } from '~/shared/settings';

// The worker module wires listeners at import time. Its heavy neighbours (IndexedDB
// cache, alarms, usage counters) are not what these tests are about.
vi.mock('./cache', () => ({
  TranslationCache: class {
    setConfig(): void {}
    async warm(): Promise<void> {}
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
  ask: (m: RuntimeMessage, s: chrome.runtime.MessageSender) => Promise<RuntimeResponse>;
}> {
  const syncWrites: Record<string, unknown>[] = [];
  const alarms: string[] = [];
  let listener: Listener | undefined;
  const area = (store: Record<string, unknown>, writes?: Record<string, unknown>[], slow = false) => ({
    get: async (key: string) => {
      if (slow) await new Promise((r) => setTimeout(r, 5));
      return key in store ? { [key]: structuredClone(store[key]) } : {};
    },
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
      onChanged: { addListener: () => undefined, removeListener: () => undefined },
    },
    runtime: {
      id: 'abcdefghijklmnop',
      lastError: undefined,
      onMessage: { addListener: (l: Listener) => (listener = l) },
      onInstalled: { addListener: () => undefined },
      getManifest: () => ({ version: '3.6.2', content_scripts: [] }),
      getURL: (p = '') => EXT + p,
      openOptionsPage: async () => undefined,
    },
    alarms: { create: (name: string) => void alarms.push(name), get: async () => undefined, onAlarm: { addListener: () => undefined } },
    commands: { onCommand: { addListener: () => undefined } },
    tabs: { query: async () => [] },
    scripting: { executeScript: async () => [] },
  });
  vi.resetModules();
  await import('./index');
  const ask = (m: RuntimeMessage, s: chrome.runtime.MessageSender): Promise<RuntimeResponse> =>
    new Promise((resolve) => {
      listener!(m, s, resolve);
    });
  return { syncWrites, alarms, ask };
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
