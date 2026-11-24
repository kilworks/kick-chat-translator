import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockStorage } from './lockStorage';
import { getLastLang, LASTLANG_MAX, setHint, setLastLang } from './pageStore';

afterEach(() => vi.unstubAllGlobals());

describe('lockStorage', () => {
  it('asks for trusted contexts on both areas', async () => {
    const calls: string[] = [];
    const area = (n: string) => ({ setAccessLevel: async (o: { accessLevel: string }) => void calls.push(`${n}:${o.accessLevel}`) });
    vi.stubGlobal('chrome', { storage: { local: area('local'), sync: area('sync') } });
    await lockStorage();
    expect(calls).toEqual(['local:TRUSTED_CONTEXTS', 'sync:TRUSTED_CONTEXTS']);
  });

  it('does nothing where the API does not exist (Firefox)', async () => {
    vi.stubGlobal('chrome', { storage: { local: {}, sync: {} } });
    await expect(lockStorage()).resolves.toBeUndefined();
  });

  it('survives a refusal, and still tries the other area', async () => {
    const calls: string[] = [];
    vi.stubGlobal('chrome', {
      storage: {
        local: { setAccessLevel: () => Promise.reject(new Error('no')) },
        sync: { setAccessLevel: async () => void calls.push('sync') },
      },
    });
    await expect(lockStorage()).resolves.toBeUndefined();
    expect(calls).toEqual(['sync']);
  });
});

describe('pageStore', () => {
  function fakeLocal(init: Record<string, unknown> = {}) {
    const store = { ...init };
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (k: string | string[]) => Object.fromEntries([k].flat().filter((x) => x in store).map((x) => [x, store[x]])),
          set: async (o: Record<string, unknown>) => void Object.assign(store, o),
          remove: async (k: string) => void delete store[k],
        },
      },
    });
    return store;
  }

  it('still reads the per-channel key an earlier build wrote, and retires it on the next write', async () => {
    const store = fakeLocal({ 'kt.lastlang.old': 'ja' });
    expect(await getLastLang('old')).toBe('ja');
    await setLastLang('old', 'ko');
    expect(await getLastLang('old')).toBe('ko');
    expect('kt.lastlang.old' in store).toBe(false);
  });

  it('keeps the last 200 channels, not one key per channel forever', async () => {
    fakeLocal();
    for (let i = 0; i < LASTLANG_MAX + 5; i++) await setLastLang(`c${i}`, 'ja');
    expect(await getLastLang('c0')).toBeUndefined();
    expect(await getLastLang(`c${LASTLANG_MAX + 4}`)).toBe('ja');
  });

  it('refuses a slug, a language or a hint it did not mean to store', async () => {
    fakeLocal();
    expect(await setLastLang('__proto__/x', 'ja')).toBe(false);
    expect(await setLastLang('ok', '<script>')).toBe(false);
    expect(await setHint(-1)).toBe(false);
    expect(await setHint({} as unknown as number)).toBe(false);
    expect(await setHint(3)).toBe(true);
  });
});

// Two tabs saving different channels at once read the same list and one entry was lost,
// and the same answer was written again on every channel load.
describe('pageStore, last language writes', () => {
  it('keeps both entries of two writes started together', async () => {
    const store: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (k: string | string[]) => {
            await new Promise((r) => setTimeout(r, 5));
            return Object.fromEntries([k].flat().filter((x) => x in store).map((x) => [x, store[x]]));
          },
          set: async (o: Record<string, unknown>) => void Object.assign(store, o),
          remove: async (k: string) => void delete store[k],
        },
      },
    });
    await Promise.all([setLastLang('one', 'ja'), setLastLang('two', 'ko')]);
    expect(await getLastLang('one')).toBe('ja');
    expect(await getLastLang('two')).toBe('ko');
  });

  it('refuses a code the product does not know, and skips a write that changes nothing', async () => {
    const sets = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({ 'kt.lastlang.v2': [['one', 'ja']] }), set: sets, remove: async () => undefined } } });
    expect(await setLastLang('x', 'qq')).toBe(false);
    expect(await setLastLang('one', 'ja')).toBe(true);
    expect(sets).not.toHaveBeenCalled();
  });
});
