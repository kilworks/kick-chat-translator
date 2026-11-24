import { STORAGE_KEY_STATS } from '~/shared/constants';
import type { DayStat, ProviderId, UsageStats } from '~/shared/types';

const HISTORY_DAYS = 7;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function empty(): UsageStats {
  return {
    totalRequests: 0,
    totalCacheHits: 0,
    totalErrors: 0,
    byProvider: {},
    byLang: {},
    byChannel: {},
    charsSent: 0,
    todayKey: todayKey(),
    history: [],
  };
}

/**
 * Fold a finished day into the retained history, newest last.
 * A day with no requests is dropped rather than stored as 0%: an unused day is
 * missing data, and charting it as a real hit rate would misreport it.
 */
export function archiveDay(prev: UsageStats, keep: number = HISTORY_DAYS): DayStat[] {
  const prior = (prev.history ?? []).filter((d) => d.day !== prev.todayKey);
  if (prev.totalRequests <= 0) return prior.slice(-keep);
  const entry: DayStat = {
    day: prev.todayKey,
    requests: prev.totalRequests,
    cacheHits: prev.totalCacheHits,
  };
  return [...prior, entry].slice(-keep);
}

/**
 * How long counts wait in memory before one write. Every storage write also wakes
 * an onChanged listener in every extension context, and a busy chat made about
 * 2,400 a day-hour of them at 1.5 s. The popup reads the memory, not the disk.
 */
const STATS_FLUSH_MS = 15_000;
/** Most distinct languages or channels the day's counters keep. */
const BY_KEY_MAX = 300;

export class StatsTracker {
  private state: UsageStats = empty();
  private dirty = false;
  private flushHandle: ReturnType<typeof setTimeout> | undefined;

  async load(): Promise<UsageStats> {
    const stored = await chrome.storage.local.get(STORAGE_KEY_STATS);
    const v = stored[STORAGE_KEY_STATS] as UsageStats | undefined;
    if (v && v.todayKey === todayKey()) {
      this.state = { ...v, history: v.history ?? [] };
    } else {
      // Day changed while the worker was down: keep the outgoing day before resetting.
      this.state = { ...empty(), history: v ? archiveDay(v) : [] };
      await this.persist();
    }
    return this.state;
  }

  current(): UsageStats {
    return this.state;
  }

  /** Un message refuse par le budget par chaine. */
  recordThrottled(): void {
    this.rollover();
    this.state.throttled = (this.state.throttled ?? 0) + 1;
    this.scheduleFlush();
  }

  recordRequest(provider: ProviderId, sourceLang: string, chars: number, cached: boolean, channel?: string): void {
    this.rollover();
    this.state.totalRequests += 1;
    if (cached) this.state.totalCacheHits += 1;
    else {
      this.state.byProvider[provider] = (this.state.byProvider[provider] ?? 0) + 1;
      this.state.charsSent += chars;
    }
    // A new key is taken only below a cap: the maps are keyed by what a page sends.
    if (sourceLang && (sourceLang in this.state.byLang || Object.keys(this.state.byLang).length < BY_KEY_MAX)) {
      this.state.byLang[sourceLang] = (this.state.byLang[sourceLang] ?? 0) + 1;
    }
    if (channel && (channel in this.state.byChannel || Object.keys(this.state.byChannel).length < BY_KEY_MAX)) {
      this.state.byChannel[channel] = (this.state.byChannel[channel] ?? 0) + 1;
    }
    this.scheduleFlush();
  }

  recordError(): void {
    this.rollover();
    this.state.totalErrors += 1;
    this.scheduleFlush();
  }

  async reset(): Promise<UsageStats> {
    this.state = empty();
    await this.persist();
    return this.state;
  }

  private rollover(): void {
    const k = todayKey();
    if (this.state.todayKey !== k) {
      this.state = { ...empty(), history: archiveDay(this.state) };
    }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushHandle) return;
    this.flushHandle = setTimeout(() => {
      this.flushHandle = undefined;
      if (this.dirty) void this.persist();
    }, STATS_FLUSH_MS);
  }

  /** Write what is pending now: the worker is about to stop, and the timer would not outlive it. */
  async flush(): Promise<void> {
    if (this.flushHandle) {
      clearTimeout(this.flushHandle);
      this.flushHandle = undefined;
    }
    if (this.dirty) await this.persist();
  }

  private async persist(): Promise<void> {
    this.dirty = false;
    await chrome.storage.local.set({ [STORAGE_KEY_STATS]: this.state });
  }
}
