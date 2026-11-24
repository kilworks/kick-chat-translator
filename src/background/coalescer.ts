import type { Settings } from '~/shared/settings';
import type { TranslationOutcome, TranslationRequest } from '~/shared/types';
import {
  BATCH_MAX_ITEMS,
  BATCH_WINDOW_MS,
  MAX_BATCH_WINDOW_MS,
  MIN_BATCH_WINDOW_MS,
} from '~/shared/constants';
import { rootLogger } from '~/shared/logger';
import { createMetrics } from '~/shared/metrics';
import { translateGroup } from './translator';
import type { TranslationCache } from './cache';
import type { StatsTracker } from './stats';

const log = rootLogger.child('coalescer');
const metrics = createMetrics('sw');

interface Entry {
  req: TranslationRequest;
  key: string;
  resolvers: ((o: TranslationOutcome) => void)[];
  /** When this line entered the window, so the wait it paid can be measured. */
  at: number;
}

export interface CoalescerDeps {
  getSettings: () => Settings;
  cache: TranslationCache;
  stats: StatsTracker;
}

/**
 * Buffers translate requests for a short window, dedups identical text in-flight,
 * groups by target language and dispatches as a batch (DeepL) or concurrency-capped
 * per-item (others) through the provider chain.
 */
export class TranslationCoalescer {
  private pending: Entry[] = [];
  private byKey = new Map<string, Entry>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Adaptive batch window: track message rate to auto-tune. */
  private recentSubmits: number[] = [];

  constructor(private deps: CoalescerDeps) {}

  /**
   * How long to hold a line before dispatching, from the rate lines arrive at.
   *
   * The window only earns its latency if something else shows up during it.
   * Expected arrivals are rate x window, so a 180ms window needs about 5.5
   * lines a second before it collects even one extra. The thresholds here used
   * to open at 3 lines per TEN seconds, which is 0.3/s: a reader on an ordinary
   * chat waited 180ms to be batched with nothing.
   *
   * Measured on a live channel, 90 seconds, 40 translations: 217ms end to end
   * at p50, of which 186ms was this wait, while Google's own call answered in
   * 43ms. Of 27 dispatches, 24 carried a single message. 86% of the median was
   * our own timer, spent collecting one line.
   *
   * The tiers are now placed where batching actually pays. Nothing changes on a
   * genuinely fast chat, which is the only regime that was ever being served;
   * what changes is the ordinary one, which was paying for it.
   */
  private adaptiveWindowMs(): number {
    const now = Date.now();
    // Keep only the last 10s of submit timestamps. Recorded in submit(), not
    // here: this runs only when a new window opens, so counting here counted
    // WINDOWS rather than messages. At one count per window the estimate could
    // never exceed about five a second, and the fast tier at twenty was
    // unreachable by construction.
    this.recentSubmits = this.recentSubmits.filter((t) => now - t < 10_000);
    const perSecond = this.recentSubmits.length / 10;
    // Below this, a window collects less than one extra line and is pure delay.
    //
    // "Pure delay" is true of the arrival RATE and false of the floor, and the
    // difference was measured by trying to remove it. Setting the low tier to 0:
    // on messages spaced 1.2s apart, the wait went from 44ms to 0 at p50 and the
    // provider was called 15 times either way, so the window bought nothing
    // there. On the same corpus arriving in bursts of three, the calls went from
    // 6 to 15 for the same 24 translations, 2.5x the requests against an
    // endpoint that soft-bans per IP.
    //
    // The reason is that a burst does not reach submit() in one tick: each row
    // goes through the observer, language detection and a cache lookup first, so
    // the siblings land a few milliseconds apart and a setTimeout(0) fires
    // before them. The 40ms floor is what absorbs that spread. Reverted, and
    // written down here so the next reading of the line above does not cost
    // another round trip to find out.
    const chosen =
      perSecond * (BATCH_WINDOW_MS / 1000) < 1
        ? MIN_BATCH_WINDOW_MS
        : perSecond < 20
          ? BATCH_WINDOW_MS
          : MAX_BATCH_WINDOW_MS;
    // The window this actually picked, and the rate it picked it from. Inferring
    // either one from `leg.coalesce.wait` does not work: a line that joins a
    // window already open waits the remainder, not the whole of it, so the wait
    // and the window are different numbers.
    if (__KT_METRICS__) {
      metrics.timing('coalesce.window', chosen);
      metrics.timing('coalesce.rate10s', this.recentSubmits.length);
    }
    return chosen;
  }

  /** `key` when the caller already derived it (handleTranslate does, for its cache lookup). */
  submit(req: TranslationRequest, knownKey?: string): Promise<TranslationOutcome> {
    const key = knownKey ?? this.deps.cache.key(req.text, req.targetLang);
    const existing = this.byKey.get(key);
    if (existing) {
      return new Promise((resolve) => existing.resolvers.push(resolve));
    }
    const entry: Entry = { req, key, resolvers: [], at: Date.now() };
    // Every line counts toward the arrival rate, including the ones that join a
    // window already open. Those are the majority on exactly the fast chats the
    // rate is meant to detect.
    this.recentSubmits.push(entry.at);
    this.byKey.set(key, entry);
    this.pending.push(entry);
    const p = new Promise<TranslationOutcome>((resolve) => entry.resolvers.push(resolve));

    if (this.pending.length >= BATCH_MAX_ITEMS) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.adaptiveWindowMs());
    }
    return p;
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    // What the batching window actually cost each line, before a provider was
    // even called. The window is adaptive by arrival rate, so the nominal
    // constant does not tell you what a reader waited through.
    const flushedAt = Date.now();
    if (__KT_METRICS__) for (const e of batch) metrics.timing('leg.coalesce.wait', flushedAt - e.at);

    const settings = this.deps.getSettings();
    const groups = new Map<string, Entry[]>();
    for (const e of batch) {
      const g = groups.get(e.req.targetLang);
      if (g) g.push(e);
      else groups.set(e.req.targetLang, [e]);
    }

    await Promise.all(
      [...groups.values()].map(async (entries) => {
        const reqs = entries.map((e) => e.req);
        let outcomes: TranslationOutcome[];
        try {
          outcomes = await translateGroup(reqs, settings, settings.concurrency);
        } catch (err: unknown) {
          log.warn('group dispatch threw', err);
          outcomes = reqs.map(() => ({
            ok: false as const,
            error: { code: 'dispatch', message: 'dispatch failed' },
          }));
        }
        const writes: { key: string; value: { translatedText: string; detectedLang: string; provider: string } }[] = [];
        entries.forEach((entry, i) => {
          this.finalize(entry, outcomes[i] ?? { ok: false, error: { code: 'no_result', message: 'no result' } }, writes);
        });
        // One write for the group, not one per line.
        if (writes.length > 0) void this.deps.cache.setMany(writes);
      }),
    );
  }

  private finalize(
    entry: Entry,
    outcome: TranslationOutcome,
    writes: { key: string; value: { translatedText: string; detectedLang: string; provider: string } }[],
  ): void {
    const { stats } = this.deps;
    // Out of the dedup map only now that the answer exists: a copy of this line
    // arriving while the provider is slow joins it instead of paying for another request.
    this.byKey.delete(entry.key);
    const dedupCount = entry.resolvers.length;
    if (outcome.ok) {
      writes.push({
        key: entry.key,
        value: {
          translatedText: outcome.result.translatedText,
          detectedLang: outcome.result.detectedLang,
          provider: outcome.result.provider,
        },
      });
      stats.recordRequest(outcome.result.provider, outcome.result.detectedLang, entry.req.text.length, false, entry.req.channel);
      // Extra callers that shared this in-flight translation count as cache hits.
      for (let k = 1; k < dedupCount; k++) {
        stats.recordRequest(outcome.result.provider, outcome.result.detectedLang, 0, true, entry.req.channel);
      }
    } else {
      stats.recordError();
    }
    for (const resolve of entry.resolvers) resolve(outcome);
  }
}
