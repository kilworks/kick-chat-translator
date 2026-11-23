import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheKey } from '~/shared/normalize';

const { idb } = vi.hoisted(() => ({
  idb: { entries: new Map<string, unknown>(), gets: [] as string[], keyLists: 0 },
}));
// A key range is a pair of bounds here; the store below filters on it the way
// IndexedDB does, in key order, so warm() runs against the same contract.
vi.stubGlobal('IDBKeyRange', {
  bound: (lower: string, upper: string) => ({ lower, upper }),
});
vi.mock('idb-keyval', () => {
  const inRange = (k: string, r?: { lower: string; upper: string }) =>
    !r || (k >= r.lower && k <= r.upper);
  // A cursor walks the keys in order, one success event per step, and the
  // transaction completes after the last one, as in IndexedDB.
  let txDone: Promise<void> = Promise.resolve();
  const objectStore = {
    count: () => ({ result: idb.entries.size }),
    delete: (k: string) => {
      idb.entries.delete(k);
      return {};
    },
    openCursor: () => {
      const req: { result: unknown; onsuccess?: () => void } = { result: null };
      const ks = [...idb.entries.keys()].sort();
      let i = 0;
      txDone = new Promise<void>((resolve) => {
        const step = (): void => {
          const k = ks[i++];
          req.result =
            k === undefined
              ? null
              : { key: k, value: idb.entries.get(k), delete: () => idb.entries.delete(k), continue: () => queueMicrotask(step) };
          req.onsuccess?.();
          if (k === undefined) resolve();
        };
        queueMicrotask(step);
      });
      return req;
    },
    get transaction() {
      return { done: txDone };
    },
    getAllKeys: (r: { lower: string; upper: string } | undefined, n: number) => ({
      result: [...idb.entries.keys()]
        .sort()
        .filter((k) => inRange(k, r))
        .slice(0, n),
    }),
    getAll: (r: { lower: string; upper: string } | undefined, n: number) => ({
      result: [...idb.entries.keys()]
        .sort()
        .filter((k) => inRange(k, r))
        .slice(0, n)
        .map((k) => idb.entries.get(k)),
    }),
  };
  return {
    createStore: () => (_mode: string, cb: (s: typeof objectStore) => unknown) => cb(objectStore),
    promisifyRequest: (r: { result?: unknown; done?: Promise<void> }) => r.done ?? Promise.resolve(r.result),
    keys: () => {
      idb.keyLists++;
      return Promise.resolve([...idb.entries.keys()].sort());
    },
    get: (k: string) => {
      idb.gets.push(k);
      return Promise.resolve(idb.entries.get(k));
    },
    set: (k: string, v: unknown) => {
      idb.entries.set(k, v);
      return Promise.resolve();
    },
    del: (k: string) => {
      idb.entries.delete(k);
      return Promise.resolve();
    },
    clear: () => {
      idb.entries.clear();
      return Promise.resolve();
    },
  };
});

import { normalizeForKey, TranslationCache, warmTargets } from './cache';

describe('normalizeForKey', () => {
  it('lowercases and trims', () => {
    expect(normalizeForKey('  Hola  ')).toBe('hola');
  });

  it('collapses 3+ char repeats to 2', () => {
    expect(normalizeForKey('loooool')).toBe('lool');
    expect(normalizeForKey('草草草草')).toBe('草草');
    expect(normalizeForKey('wwwww')).toBe('ww');
  });

  it('drops trailing punctuation runs', () => {
    expect(normalizeForKey('genial!!!')).toBe('genial');
    expect(normalizeForKey('ええ？？')).toBe('ええ');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeForKey('hola    amigo')).toBe('hola amigo');
  });

  it('maps cosmetic variants to the same key (cache-hit win)', () => {
    expect(normalizeForKey('WWWW')).toBe(normalizeForKey('wwww'));
    expect(normalizeForKey('lol!!')).toBe(normalizeForKey('LOL'));
  });
});

describe('TranslationCache.key', () => {
  // The in-tab cache keys through cacheKey() while the worker keys through this
  // method. If the two formats drifted, every in-tab hit would miss in the worker.
  it('agrees with the shared cacheKey used by the in-tab cache', () => {
    const cache = new TranslationCache(10, 60_000);
    for (const [text, lang] of [
      ['Hola  amigo', 'en'],
      ['loooool', 'ja'],
      ['genial!!!', 'pt-br'],
    ] as const) {
      expect(cache.key(text, lang)).toBe(cacheKey(text, lang));
    }
  });

  it('keys cosmetic variants together but keeps target languages apart', () => {
    const cache = new TranslationCache(10, 60_000);
    expect(cache.key('WWWW', 'en')).toBe(cache.key('wwww', 'en'));
    expect(cache.key('hola', 'en')).not.toBe(cache.key('hola', 'fr'));
  });
});

describe('warmTargets', () => {
  it('puts the language being read first', () => {
    expect(warmTargets('pt', { ja: 10, es: 3 })).toEqual(['pt', 'ja', 'es']);
  });

  it('does not repeat the read target when it is also a frequent source', () => {
    expect(warmTargets('ja', { ja: 10, es: 3 })).toEqual(['ja', 'es']);
  });

  it('keeps only the most frequent sources', () => {
    expect(warmTargets('en', { a: 1, b: 2, c: 3, d: 4, e: 5 }, 2)).toEqual(['en', 'e', 'd']);
  });

  it('works with no history yet', () => {
    expect(warmTargets('fr', {})).toEqual(['fr']);
  });
});

describe('TranslationCache.warm', () => {
  beforeEach(() => {
    idb.entries.clear();
    idb.gets.length = 0;
  });

  const entry = (t: string) => ({
    translatedText: t,
    detectedLang: 'es',
    provider: 'deepl',
    storedAtMs: Date.now(),
  });

  // get() falls back to storage on a memory miss, so "the value came back" proves
  // nothing about warming. What proves it is that no storage read was needed.
  async function storageReadsFor(
    cache: TranslationCache,
    text: string,
    lang: string,
  ): Promise<string[]> {
    idb.gets.length = 0;
    await cache.get(text, lang);
    return [...idb.gets];
  }

  // IndexedDB hands keys back in lexicographic order and each key starts with its
  // target language, so an unfiltered warm starves the language sorting last.
  it('warms the target being read even when another language sorts ahead of it', async () => {
    for (let i = 0; i < 200; i++) idb.entries.set(`ar::msg${i}`, entry(`ar${i}`));
    idb.entries.set('pt::hola', entry('ola'));

    const cache = new TranslationCache(10_000, 60_000);
    await cache.warm(200, ['pt']);

    expect(await storageReadsFor(cache, 'hola', 'pt')).toEqual([]);
    // Control: a language that was not warmed still has to go to storage.
    expect(await storageReadsFor(cache, 'msg0', 'ar')).toEqual(['ar::msg0']);
  });

  it('spends the budget on the first target before the next', async () => {
    idb.entries.set('es::uno', entry('one'));
    idb.entries.set('ja::ichi', entry('one-ja'));

    const cache = new TranslationCache(10_000, 60_000);
    await cache.warm(1, ['ja', 'es']);

    expect(await storageReadsFor(cache, 'ichi', 'ja')).toEqual([]);
    expect(await storageReadsFor(cache, 'uno', 'es')).toEqual(['es::uno']);
  });

  // Listing every key of a 15,000-entry store to keep 200 was most of a worker
  // start. Each language is one bounded range read instead.
  it('reads ranges, without listing the whole store or reading key by key', async () => {
    for (let i = 0; i < 50; i++) idb.entries.set(`ar::m${i}`, entry(`a${i}`));
    for (let i = 0; i < 50; i++) idb.entries.set(`pt::m${i}`, entry(`p${i}`));
    idb.keyLists = 0;
    const cache = new TranslationCache(10_000, 60_000);
    await cache.warm(200, ['pt']);
    expect(idb.keyLists).toBe(0);
    expect(idb.gets).toEqual([]);
    expect(await storageReadsFor(cache, 'm49', 'pt')).toEqual([]);
    expect(await storageReadsFor(cache, 'm0', 'ar')).toEqual(['ar::m0']);
  });

  it('warms indiscriminately when no target is given', async () => {
    idb.entries.set('ar::x', entry('ax'));
    const cache = new TranslationCache(10_000, 60_000);
    await cache.warm(200);
    expect(await storageReadsFor(cache, 'x', 'ar')).toEqual([]);
  });
});

describe('normalizeForKey across letter case', () => {
  it('collapses ASCII case as before', () => {
    expect(normalizeForKey('HOLA')).toBe(normalizeForKey('hola'));
  });

  // Turkish capitals lowercase to a letter plus a combining dot, so the same word
  // written in two cases used to produce two cache entries and pay twice.
  it('collapses Turkish case variants onto one key', () => {
    expect(normalizeForKey('İYİ')).toBe(normalizeForKey('iyi'));
    expect(normalizeForKey('İyi')).toBe(normalizeForKey('iyi'));
  });

  // Documented limit: dotless and dotted i are different letters. Folding them
  // would be wrong everywhere else, so they stay distinct.
  it('keeps dotless i distinct from plain i', () => {
    expect(normalizeForKey('ışık')).not.toBe(normalizeForKey('isik'));
  });
});

/**
 * Ce que le cache sait dire de lui-meme.
 *
 * Quatre reglages d'Advanced le pilotaient sans qu'il puisse repondre : le
 * champ portait 15000 et rien ne disait qu'il y avait 3412 entrees dedans.
 * keys() etait deja appele pour l'eviction, il ne manquait qu'un message.
 */
describe('TranslationCache.stats', () => {
  it('reports the cap it was given, so the caller need not cross-check it', async () => {
    const c = new TranslationCache(15000, 3600_000);
    expect((await c.stats()).maxEntries).toBe(15000);
  });

  it('counts what it holds', async () => {
    const c = new TranslationCache(100, 3600_000);
    await c.set('bonjour', 'en', { translatedText: 'hello', detectedLang: 'fr', provider: 'x' });
    await c.set('merci', 'en', { translatedText: 'thanks', detectedLang: 'fr', provider: 'x' });
    const s = await c.stats();
    expect(s.inMemory).toBe(2);
    expect(s.entries).toBeGreaterThanOrEqual(2);
  });

  // L'age vient du Map et non de la base : il est declare comme un echantillon
  // parce que dater toutes les cles couterait une lecture chacune, et ce cache
  // monte a vingt mille.
  it('ages from the memory layer, and says nothing when it is empty', async () => {
    const vide = new TranslationCache(100, 3600_000);
    expect((await vide.stats()).oldestMs).toBeUndefined();

    const c = new TranslationCache(100, 3600_000);
    await c.set('bonjour', 'en', { translatedText: 'hello', detectedLang: 'fr', provider: 'x' });
    expect((await c.stats()).oldestMs).toBeGreaterThanOrEqual(0);
  });
});

describe('TranslationCache.prune', () => {
  // evict() and the TTL only touched entries the worker had seen since it
  // started, about 200 after warm(), so the database itself never shrank.
  it('drops expired entries and the oldest past the cap, from the database itself', async () => {
    idb.entries.clear();
    const now = Date.now();
    const hour = 3_600_000;
    for (let i = 0; i < 3; i++) idb.entries.set(`en::old${i}`, { translatedText: 'x', detectedLang: 'fr', provider: 'x', storedAtMs: now - 100 * hour });
    for (let i = 0; i < 5; i++) idb.entries.set(`en::fresh${i}`, { translatedText: 'x', detectedLang: 'fr', provider: 'x', storedAtMs: now - i * 60_000 });
    const c = new TranslationCache(3, 72 * hour);
    await c.prune();
    expect([...idb.entries.keys()].sort()).toEqual(['en::fresh0', 'en::fresh1', 'en::fresh2']);
    expect((await c.stats()).entries).toBe(3);
  });
});
