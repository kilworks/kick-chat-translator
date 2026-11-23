import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY_DEEPL_KEY, STORAGE_KEY_SETTINGS } from './constants';
import { defaultSettings, exportSettings, importSettings, loadSettings, resetSettings, saveSettings } from './settings';

/**
 * Where the DeepL key is stored, asserted against the storage areas themselves.
 *
 * The schema keeps `deeplApiKey` on the Settings object, so every consumer and
 * every assertion about behaviour still passes whether the key is synced or not.
 * Only the areas can tell the difference, which is why these tests read them
 * directly instead of going through loadSettings.
 */

function fakeChrome() {
  const sync = new Map<string, unknown>();
  const local = new Map<string, unknown>();
  const fail = { syncSet: false };
  const area = (m: Map<string, unknown>, isSync: boolean) => ({
    get: (k: string) => Promise.resolve(m.has(k) ? { [k]: m.get(k) } : {}),
    set: (o: Record<string, unknown>) => {
      if (isSync && fail.syncSet) return Promise.reject(new Error('sync write failed'));
      for (const [k, v] of Object.entries(o)) m.set(k, v);
      return Promise.resolve();
    },
    remove: (k: string) => {
      m.delete(k);
      return Promise.resolve();
    },
  });
  return { sync, local, fail, api: { storage: { sync: area(sync, true), local: area(local, false) } } };
}

let env: ReturnType<typeof fakeChrome>;
const syncedBlob = () => env.sync.get(STORAGE_KEY_SETTINGS) as Record<string, unknown> | undefined;
const heldKey = () => env.local.get(STORAGE_KEY_DEEPL_KEY) as string | undefined;

beforeEach(() => {
  env = fakeChrome();
  vi.stubGlobal('chrome', env.api);
});
afterEach(() => vi.unstubAllGlobals());

describe('the DeepL key never reaches synced storage', () => {
  it('keeps it out of the blob when it is saved', async () => {
    await saveSettings({ deeplApiKey: 'secret-abc', targetLang: 'fr' });
    expect(heldKey()).toBe('secret-abc');
    expect(syncedBlob()?.deeplApiKey).toBe('');
    // Control: the same call must still sync everything that is not the key, or
    // the assertion above would pass on a write that simply did nothing.
    expect(syncedBlob()?.targetLang).toBe('fr');
  });

  it('keeps it out on an unrelated later save', async () => {
    await saveSettings({ deeplApiKey: 'secret-abc' });
    await saveSettings({ targetLang: 'de' });
    expect(syncedBlob()?.deeplApiKey).toBe('');
    expect(heldKey()).toBe('secret-abc');
  });

  it('hands the key back on the Settings object so consumers see no change', async () => {
    await saveSettings({ deeplApiKey: 'secret-abc' });
    expect((await loadSettings()).deeplApiKey).toBe('secret-abc');
  });
});

describe('migration from a build that synced the key', () => {
  it('moves a stray key out of the blob and keeps serving it', async () => {
    env.sync.set(STORAGE_KEY_SETTINGS, { ...defaultSettings(), deeplApiKey: 'legacy-xyz' });
    const s = await loadSettings();
    expect(s.deeplApiKey).toBe('legacy-xyz');
    expect(heldKey()).toBe('legacy-xyz');
    expect(syncedBlob()?.deeplApiKey).toBe('');
  });

  it('is idempotent', async () => {
    env.sync.set(STORAGE_KEY_SETTINGS, { ...defaultSettings(), deeplApiKey: 'legacy-xyz' });
    await loadSettings();
    const second = await loadSettings();
    expect(second.deeplApiKey).toBe('legacy-xyz');
    expect(syncedBlob()?.deeplApiKey).toBe('');
  });

  it('does not lose the key when clearing sync fails', async () => {
    // The ordering is the point: local is written first, so a failure on the
    // clear leaves the key in both places rather than in neither.
    env.sync.set(STORAGE_KEY_SETTINGS, { ...defaultSettings(), deeplApiKey: 'legacy-xyz' });
    env.fail.syncSet = true;
    await expect(loadSettings()).rejects.toThrow('sync write failed');
    expect(heldKey()).toBe('legacy-xyz');
    env.fail.syncSet = false;
    expect((await loadSettings()).deeplApiKey).toBe('legacy-xyz');
  });
});

describe('reset and import', () => {
  it('reset clears the key too', async () => {
    await saveSettings({ deeplApiKey: 'secret-abc' });
    await resetSettings();
    expect(heldKey()).toBeUndefined();
    expect((await loadSettings()).deeplApiKey).toBe('');
  });

  it('import routes an older backup key to local, not to sync', async () => {
    const backup = JSON.stringify({ ...defaultSettings(), deeplApiKey: 'from-backup', targetLang: 'ja' });
    const s = await importSettings(backup);
    expect(s.deeplApiKey).toBe('from-backup');
    expect(heldKey()).toBe('from-backup');
    expect(syncedBlob()?.deeplApiKey).toBe('');
    expect(syncedBlob()?.targetLang).toBe('ja');
  });
});

// A settings file gets shared: to ask for help on Discord, or as "optimised
// settings" from someone else. It carried the DeepL key in clear, importing one
// without a key erased the key on this device, and its Lingva server became
// the one every chat line went to, with nothing on screen to say so.
describe('settings backup files', () => {
  it('never export the DeepL key', async () => {
    await saveSettings({ deeplApiKey: 'secret-abc', targetLang: 'fr' });
    const file = JSON.parse(await exportSettings()) as Record<string, unknown>;
    expect(file.deeplApiKey ?? '').toBe('');
    expect(file.targetLang).toBe('fr');
  });

  it('keep the key on this device when the imported file has none', async () => {
    await saveSettings({ deeplApiKey: 'secret-abc' });
    await importSettings(JSON.stringify({ ...defaultSettings(), targetLang: 'ja' }));
    expect(heldKey()).toBe('secret-abc');
    expect((await loadSettings()).deeplApiKey).toBe('secret-abc');
    expect(syncedBlob()?.targetLang).toBe('ja');
  });

  it("keep this device's Lingva server, whatever the file says", async () => {
    await saveSettings({ lingvaInstance: '' });
    const s = await importSettings(
      JSON.stringify({ ...defaultSettings(), lingvaInstance: 'https://lingva.example', providerOrder: ['lingva'] }),
    );
    expect(s.lingvaInstance).toBe('');
    expect(syncedBlob()?.lingvaInstance).toBe('');
    expect(syncedBlob()?.providerOrder).toEqual(['lingva']);
  });
});

// local-first was the default until 2026-11-05 and saving any setting wrote it down,
// so a stored value says nothing about whether the reader ever picked it.
describe('the one move off the old default', () => {
  const stored = (extra: Record<string, unknown>) =>
    env.sync.set(STORAGE_KEY_SETTINGS, { ...defaultSettings(), engineModeMoved: undefined, ...extra });

  it('moves a reader still on local-first, and writes it down', async () => {
    stored({ engineMode: 'local-first', targetLang: 'fr' });
    const s = await loadSettings();
    expect(s.engineMode).toBe('cloud-first');
    expect(s.targetLang).toBe('fr');
    expect(syncedBlob()).toMatchObject({ engineMode: 'cloud-first', engineModeMoved: true, targetLang: 'fr' });
  });

  it('happens once: local-first picked afterwards stays', async () => {
    stored({ engineMode: 'local-first' });
    await loadSettings();
    await saveSettings({ engineMode: 'local-first' });
    expect((await loadSettings()).engineMode).toBe('local-first');
    expect(syncedBlob()?.engineMode).toBe('local-first');
  });

  it('never touches local-only, the mode that promises no network', async () => {
    stored({ engineMode: 'local-only' });
    expect((await loadSettings()).engineMode).toBe('local-only');
    expect(syncedBlob()).toMatchObject({ engineMode: 'local-only', engineModeMoved: true });
  });

  it('keeps the DeepL key out of the blob it writes', async () => {
    env.local.set(STORAGE_KEY_DEEPL_KEY, 'secret-abc');
    stored({ engineMode: 'local-first' });
    expect((await loadSettings()).deeplApiKey).toBe('secret-abc');
    expect(syncedBlob()?.deeplApiKey).toBe('');
  });

  it('still answers when the write fails, and moves on the next load', async () => {
    stored({ engineMode: 'local-first' });
    env.fail.syncSet = true;
    expect((await loadSettings()).engineMode).toBe('cloud-first');
    env.fail.syncSet = false;
    await loadSettings();
    expect(syncedBlob()).toMatchObject({ engineMode: 'cloud-first', engineModeMoved: true });
  });

  it('leaves a fresh install and a reset alone', async () => {
    expect((await loadSettings()).engineMode).toBe('cloud-first');
    expect(syncedBlob()).toBeUndefined();
    expect((await resetSettings()).engineMode).toBe('cloud-first');
    expect(syncedBlob()?.engineModeMoved).toBe(true);
  });
});

// "On-device only" with on-device switched off translated nothing at all
// (engineMode.combos.test.ts). The mode is the stronger promise, no network,
// so it is the switch that follows, and every other pair stays as saved.
describe('the contradictory engine pair', () => {
  const stored = (extra: Record<string, unknown>) =>
    env.sync.set(STORAGE_KEY_SETTINGS, { ...defaultSettings(), ...extra });

  it('turns on-device back on under local-only, and writes it down', async () => {
    stored({ engineMode: 'local-only', localEnabled: false, targetLang: 'fr' });
    const s = await loadSettings();
    expect(s).toMatchObject({ engineMode: 'local-only', localEnabled: true, targetLang: 'fr' });
    expect(syncedBlob()).toMatchObject({ engineMode: 'local-only', localEnabled: true });
  });

  it('leaves the five other pairs exactly as saved', async () => {
    for (const engineMode of ['local-first', 'cloud-first', 'local-only'] as const) {
      for (const localEnabled of [true, false]) {
        if (engineMode === 'local-only' && !localEnabled) continue;
        stored({ engineMode, localEnabled });
        expect(await loadSettings()).toMatchObject({ engineMode, localEnabled });
      }
    }
  });
});
