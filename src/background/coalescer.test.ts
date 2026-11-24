import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { Settings } from '~/shared/settings';
import type { TranslationOutcome, TranslationRequest } from '~/shared/types';
import { BATCH_MAX_ITEMS, BATCH_WINDOW_MS, MIN_BATCH_WINDOW_MS } from '~/shared/constants';
import { TranslationCoalescer } from './coalescer';
import { translateGroup } from './translator';
import type { TranslationCache } from './cache';
import type { StatsTracker } from './stats';

vi.mock('./translator', () => ({ translateGroup: vi.fn() }));

const mockTranslateGroup = translateGroup as unknown as Mock;

function okOutcome(req: TranslationRequest): TranslationOutcome {
  return {
    ok: true,
    result: {
      messageId: req.messageId,
      translatedText: `t:${req.text}`,
      detectedLang: 'es',
      provider: 'deepl',
      cached: false,
    },
  };
}

function makeCoalescer() {
  const recordRequest = vi.fn();
  const recordError = vi.fn();
  const cache = {
    key: (text: string, target: string) => `${target}:${text}`,
    setMany: vi.fn(async () => undefined),
  } as unknown as TranslationCache;
  const stats = { recordRequest, recordError } as unknown as StatsTracker;
  const coalescer = new TranslationCoalescer({
    getSettings: () => ({ concurrency: 4 }) as Settings,
    cache,
    stats,
  });
  return { coalescer, recordRequest, recordError, cache };
}

function req(text: string, targetLang = 'en', messageId = text): TranslationRequest {
  return { messageId, text, targetLang };
}

describe('TranslationCoalescer', () => {
  beforeEach(() => {
    mockTranslateGroup.mockReset();
    mockTranslateGroup.mockImplementation((reqs: TranslationRequest[]) =>
      Promise.resolve(reqs.map(okOutcome)),
    );
  });

  it('sends one dispatch for messages submitted in the same window', async () => {
    const { coalescer } = makeCoalescer();
    const results = await Promise.all([
      coalescer.submit(req('uno')),
      coalescer.submit(req('dos')),
      coalescer.submit(req('tres')),
    ]);

    expect(mockTranslateGroup).toHaveBeenCalledTimes(1);
    expect((mockTranslateGroup.mock.calls[0]![0] as TranslationRequest[]).map((r) => r.text)).toEqual([
      'uno',
      'dos',
      'tres',
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('translates duplicated text once and resolves every caller', async () => {
    const { coalescer, recordRequest } = makeCoalescer();
    const [a, b] = await Promise.all([coalescer.submit(req('same')), coalescer.submit(req('same', 'en', '2'))]);

    const dispatched = mockTranslateGroup.mock.calls[0]![0] as TranslationRequest[];
    expect(dispatched).toHaveLength(1);
    expect(a.ok && a.result.translatedText).toBe('t:same');
    expect(b.ok && b.result.translatedText).toBe('t:same');
    // The extra caller is booked as a cache hit, not a second provider call.
    expect(recordRequest.mock.calls.filter((c) => c[3] === true)).toHaveLength(1);
  });

  it('keeps different target languages in separate dispatches', async () => {
    const { coalescer } = makeCoalescer();
    await Promise.all([coalescer.submit(req('hola', 'en')), coalescer.submit(req('hola', 'fr'))]);

    expect(mockTranslateGroup).toHaveBeenCalledTimes(2);
    const targets = mockTranslateGroup.mock.calls
      .map((c) => (c[0] as TranslationRequest[])[0]!.targetLang)
      .sort();
    expect(targets).toEqual(['en', 'fr']);
  });

  it('flushes immediately once the batch is full instead of waiting for the window', async () => {
    const { coalescer } = makeCoalescer();
    const pending = Array.from({ length: BATCH_MAX_ITEMS }, (_, i) => coalescer.submit(req(`m${i}`)));
    await Promise.all(pending);

    expect(mockTranslateGroup).toHaveBeenCalledTimes(1);
    expect(mockTranslateGroup.mock.calls[0]![0]).toHaveLength(BATCH_MAX_ITEMS);
  });

  it('resolves every caller with an error when the dispatch throws', async () => {
    const { coalescer, recordError } = makeCoalescer();
    mockTranslateGroup.mockRejectedValue(new Error('network down'));

    const results = await Promise.all([coalescer.submit(req('uno')), coalescer.submit(req('dos'))]);
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(recordError).toHaveBeenCalledTimes(2);
  });
});

/**
 * How long a line is held before dispatch, and why the thresholds sit where
 * they do.
 *
 * A window only earns its latency if another line arrives during it. Expected
 * arrivals are rate x window, so 180ms needs roughly 5.5 lines a second to
 * collect even one more. The tiers used to open at 3 lines per TEN seconds,
 * which is 0.3/s, so an ordinary chat waited 180ms to be batched with nothing.
 *
 * Measured on a live channel, 90 seconds, 40 translations: 217ms end to end at
 * p50 of which 186ms was this wait, while Google answered in 43ms, and 24 of 27
 * dispatches carried a single message.
 */
describe('TranslationCoalescer window', () => {
  beforeEach(() => {
    mockTranslateGroup.mockReset();
    mockTranslateGroup.mockImplementation((reqs: TranslationRequest[]) =>
      Promise.resolve(reqs.map(okOutcome)),
    );
  });

  /**
   * Fake milliseconds a line is held, once `warm` lines have already gone
   * through inside the estimator's ten-second memory.
   *
   * Warming happens in waves below BATCH_MAX_ITEMS, each drained before the
   * next. A single wave of 60 would trip the full-batch flush at 40 and leave
   * the remaining 20 waiting on a timer the measurement had stopped advancing,
   * which is a hung test, not a slow window.
   */
  async function waitedMs(warm: number): Promise<number> {
    vi.useFakeTimers();
    try {
      const { coalescer } = makeCoalescer();
      let sent = 0;
      while (sent < warm) {
        const wave = Math.min(30, warm - sent);
        const pending: Promise<unknown>[] = [];
        for (let i = 0; i < wave; i++) pending.push(coalescer.submit(req(`warm${sent + i}`)));
        sent += wave;
        await vi.advanceTimersByTimeAsync(400);
        await Promise.all(pending);
      }

      mockTranslateGroup.mockClear();
      const measured = coalescer.submit(req('mesure'));
      const started = Date.now();
      // Advanced in small steps so the moment the timer fires is observable
      // rather than jumped over.
      for (let t = 0; t < 600; t += 5) {
        await vi.advanceTimersByTimeAsync(5);
        if (mockTranslateGroup.mock.calls.length > 0) break;
      }
      const held = Date.now() - started;
      await measured;
      return held;
    } finally {
      vi.useRealTimers();
    }
  }

  it('holds an ordinary chat for the floor, not the batching window', async () => {
    // A handful of lines in the last ten seconds, where a 180ms window collects
    // a fraction of one extra line.
    const waited = await waitedMs(3);
    expect(waited).toBeLessThanOrEqual(MIN_BATCH_WINDOW_MS + 5);
    // Control: the assertion above must be able to fail. The old tiers held
    // this same traffic for BATCH_WINDOW_MS.
    expect(waited, 'held for the full batching window on a quiet chat').toBeLessThan(
      BATCH_WINDOW_MS,
    );
  });

  it('still batches a chat fast enough for batching to pay', async () => {
    // 60 lines in the last ten seconds is 6/s, past the point where a 180ms
    // window collects more than one line.
    const waited = await waitedMs(60);
    expect(waited).toBeGreaterThanOrEqual(BATCH_WINDOW_MS - 5);
  });
});

describe('TranslationCoalescer, writes and in-flight copies', () => {
  beforeEach(() => {
    mockTranslateGroup.mockReset();
    mockTranslateGroup.mockImplementation((reqs: TranslationRequest[]) => Promise.resolve(reqs.map(okOutcome)));
  });

  // One transaction per translated line was the worker's steadiest disk churn.
  it('writes a whole batch to the cache once, not once per line', async () => {
    const { coalescer, cache } = makeCoalescer();
    await Promise.all([coalescer.submit(req('uno')), coalescer.submit(req('dos')), coalescer.submit(req('tres'))]);
    const many = (cache as unknown as { setMany: Mock }).setMany;
    expect(many).toHaveBeenCalledTimes(1);
    expect(many.mock.calls[0]![0]).toHaveLength(3);
  });

  // The dedup ended when the batch was SENT: copypasta arriving while a slow
  // provider was still answering paid one request per copy.
  it('joins a copy of a line whose request is still in flight', async () => {
    let answer: (o: TranslationOutcome[]) => void = () => undefined;
    mockTranslateGroup.mockImplementationOnce(() => new Promise<TranslationOutcome[]>((r) => (answer = r)));
    const { coalescer } = makeCoalescer();
    const first = coalescer.submit(req('kappa', 'en', 'a'));
    await new Promise((r) => setTimeout(r, MIN_BATCH_WINDOW_MS + 30));
    expect(mockTranslateGroup).toHaveBeenCalledTimes(1);
    const copy = coalescer.submit(req('kappa', 'en', 'b'));
    answer([okOutcome(req('kappa'))]);
    await Promise.all([first, copy]);
    expect(mockTranslateGroup).toHaveBeenCalledTimes(1);
  });
});
