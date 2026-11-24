import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UsageStats } from '~/shared/types';
import { STORAGE_KEY_STATS } from '~/shared/constants';
import { archiveDay, StatsTracker } from './stats';

function day(todayKey: string, totalRequests: number, totalCacheHits: number, history?: UsageStats['history']): UsageStats {
  return {
    totalRequests,
    totalCacheHits,
    totalErrors: 0,
    byProvider: {},
    byLang: {},
    byChannel: {},
    charsSent: 0,
    todayKey,
    history,
  };
}

function stubStorage(initial: Record<string, unknown>): void {
  const store: Record<string, unknown> = { ...initial };
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: (key: string) => Promise.resolve(key in store ? { [key]: store[key] } : {}),
        set: (obj: Record<string, unknown>) => {
          Object.assign(store, obj);
          return Promise.resolve();
        },
      },
    },
  });
}

describe('StatsTracker.load', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The worker is normally restarted after midnight rather than kept alive across
  // the rollover, so this is the path that actually retains a day.
  it('archives the stored day when it loads on a later date', async () => {
    stubStorage({ [STORAGE_KEY_STATS]: day('2020-01-01', 10, 4) });

    const state = await new StatsTracker().load();

    expect(state.todayKey).not.toBe('2020-01-01');
    expect(state.totalRequests).toBe(0);
    expect(state.history).toEqual([{ day: '2020-01-01', requests: 10, cacheHits: 4 }]);
  });

  it('keeps an unfinished day and tolerates a record without history', async () => {
    const today = new Date().toISOString().slice(0, 10);
    stubStorage({ [STORAGE_KEY_STATS]: day(today, 7, 3) });

    const state = await new StatsTracker().load();

    expect(state.totalRequests).toBe(7);
    expect(state.history).toEqual([]);
  });

  it('starts clean when nothing is stored yet', async () => {
    stubStorage({});

    const state = await new StatsTracker().load();

    expect(state.totalRequests).toBe(0);
    expect(state.history).toEqual([]);
  });
});

describe('archiveDay', () => {
  it('appends the finished day, newest last', () => {
    const out = archiveDay(day('2026-08-11', 10, 4, [{ day: '2026-08-10', requests: 5, cacheHits: 1 }]));
    expect(out).toEqual([
      { day: '2026-08-10', requests: 5, cacheHits: 1 },
      { day: '2026-08-11', requests: 10, cacheHits: 4 },
    ]);
  });

  it('drops a day with no traffic instead of storing it as 0%', () => {
    const prior = [{ day: '2026-08-10', requests: 5, cacheHits: 1 }];
    expect(archiveDay(day('2026-08-11', 0, 0, prior))).toEqual(prior);
  });

  it('tolerates a record stored before history existed', () => {
    expect(archiveDay(day('2026-08-11', 3, 2))).toEqual([{ day: '2026-08-11', requests: 3, cacheHits: 2 }]);
  });

  it('keeps only the most recent days', () => {
    const prior = Array.from({ length: 7 }, (_, i) => ({
      day: `2026-08-0${i + 1}`,
      requests: 1,
      cacheHits: 0,
    }));
    const out = archiveDay(day('2026-08-11', 9, 9, prior), 7);
    expect(out).toHaveLength(7);
    expect(out[0]?.day).toBe('2026-08-02');
    expect(out[6]?.day).toBe('2026-08-11');
  });

  it('does not duplicate a day already present in history', () => {
    const prior = [{ day: '2026-08-11', requests: 2, cacheHits: 1 }];
    const out = archiveDay(day('2026-08-11', 8, 5, prior));
    expect(out).toEqual([{ day: '2026-08-11', requests: 8, cacheHits: 5 }]);
  });
});


/**
 * Le compteur de refus du budget par chaine.
 *
 * Sans lui, le reglage qui plafonne ce seau ne peut pas dire s'il a deja servi
 * a quelque chose, et le lecteur regle un nombre a l'aveugle. C'est le meme
 * defaut que le cache muet, sur un autre champ de la meme carte.
 */
describe('throttle counter', () => {
  it('starts absent rather than at zero, for records written before it existed', () => {
    const s = new StatsTracker();
    expect(s.current().throttled).toBeUndefined();
  });

  it('counts each refusal', () => {
    const s = new StatsTracker();
    s.recordThrottled();
    s.recordThrottled();
    expect(s.current().throttled).toBe(2);
  });

  // Il ne doit pas compter les messages qui PASSENT : un compteur qui monte
  // tout seul ferait croire a un plafond atteint en permanence.
  it('is untouched by a request that goes through', () => {
    const s = new StatsTracker();
    s.recordRequest('google', 'fr', 10, false);
    expect(s.current().throttled).toBeUndefined();
  });
});

// A write per 1.5 s for as long as a chat ran, each one an onChanged event in every
// extension context. The popup reads the memory, so the disk can wait.
describe('StatsTracker write cadence', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function counting() {
    const writes: unknown[] = [];
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), set: async (o: unknown) => void writes.push(o) } } });
    return writes;
  }

  it('batches a busy chat into one write per 15 s', async () => {
    vi.useFakeTimers();
    const writes = counting();
    const t = new StatsTracker();
    for (let i = 0; i < 100; i++) t.recordRequest('google', 'es', 5, false, 'c');
    await vi.advanceTimersByTimeAsync(14_000);
    expect(writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(writes).toHaveLength(1);
  });

  it('flush() writes at once what is pending, then nothing more', async () => {
    vi.useFakeTimers();
    const writes = counting();
    const t = new StatsTracker();
    t.recordRequest('google', 'es', 5, false);
    await t.flush();
    expect(writes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(writes).toHaveLength(1);
  });
});
