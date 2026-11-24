import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';
import { translateGroup } from './index';

/**
 * The cascade around `isTransliteration`.
 *
 * A provider that spells the input's sounds in the target's script answered
 * successfully and answered nothing: the reader gets ボンジュール where a
 * translation would have said こんにちは. Measured against the real Google web
 * endpoint on 90 pairs of a short expression and a non-Latin target, 18 come
 * back as a phonetic spelling.
 *
 * The chain treats that as unresolved so the next provider gets a turn, and
 * keeps the spelling so that everyone-transliterates still shows the reader
 * something instead of an error.
 *
 * Providers are exercised through a stubbed `fetch` rather than replaced, so
 * their own parsing runs. That is what caught the shape of Google's payload
 * mattering: the reply has to be redecoded by `google.ts` for this to mean
 * anything.
 */

const KATA = 'ボンジュール';
const SEMANTIC = 'こんにちは';

function settings(order: ('google' | 'mymemory')[]) {
  return { ...defaultSettings(), providerOrder: order, concurrency: 1 };
}

function googleBody(text: string): string {
  return JSON.stringify([[[text, 'bonjour', null, null, 10]], null, 'fr']);
}

function myMemoryBody(text: string): string {
  return JSON.stringify({ responseData: { translatedText: text }, responseStatus: 200 });
}

/** Answers per host, and records which hosts were actually asked. */
function stubFetch(answers: { google: string; mymemory: string }) {
  const seen: string[] = [];
  // Both providers under test call `fetch` with a string, so the stub takes one.
  globalThis.fetch = vi.fn(async (url: string) => {
    if (url.includes('translate.googleapis.com')) {
      seen.push('google');
      return new Response(googleBody(answers.google), { status: 200 });
    }
    if (url.includes('mymemory')) {
      seen.push('mymemory');
      return new Response(myMemoryBody(answers.mymemory), { status: 200 });
    }
    throw new Error(`unexpected host: ${url}`);
  }) as unknown as typeof fetch;
  return seen;
}

const req = (id: string, text: string) => ({ messageId: id, text, targetLang: 'ja' });

describe('translateGroup, transliteration cascade', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // First in the file on purpose: the chain keeps a sticky provider in module
  // state, so this is the only test that can assert the order it was given.
  it('leaves a transliterated item unresolved so the next provider answers', async () => {
    const seen = stubFetch({ google: KATA, mymemory: SEMANTIC });

    const [out] = await translateGroup([req('1', 'bonjour')], settings(['google', 'mymemory']), 1);

    expect(seen).toEqual(['google', 'mymemory']);
    expect(out?.ok).toBe(true);
    if (out?.ok) {
      expect(out.result.translatedText).toBe(SEMANTIC);
      expect(out.result.provider).toBe('mymemory');
    }
  });

  it('keeps the spelling rather than failing when every provider transliterates', async () => {
    stubFetch({ google: KATA, mymemory: KATA });

    const [out] = await translateGroup([req('2', 'bonjour')], settings(['google', 'mymemory']), 1);

    // A kept transliteration beats a hard failure: the row shows something and
    // the retry arrow is still there.
    expect(out?.ok).toBe(true);
    if (out?.ok) expect(out.result.translatedText).toBe(KATA);
  });

  it('does not cascade a real translation', async () => {
    const seen = stubFetch({ google: SEMANTIC, mymemory: KATA });

    const [out] = await translateGroup([req('3', 'bonjour')], settings(['google', 'mymemory']), 1);

    expect(seen).not.toContain('mymemory');
    if (out?.ok) expect(out.result.translatedText).toBe(SEMANTIC);
  });

  it('does not cascade katakana for a target the guard does not cover', async () => {
    const seen = stubFetch({ google: KATA, mymemory: SEMANTIC });

    const [out] = await translateGroup(
      [{ messageId: '4', text: 'bonjour', targetLang: 'fr' }],
      settings(['google', 'mymemory']),
      1,
    );

    // Nothing about a Latin target can be a phonetic spelling in this sense, and
    // the guard returns false before looking at the output at all.
    expect(seen).not.toContain('mymemory');
    if (out?.ok) expect(out.result.translatedText).toBe(KATA);
  });
});

describe('the sticky provider expires', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  // Before the expiry, one katakana answer from Google to `clutch` made MyMemory
  // sticky, and MyMemory then resolved every later line for every target: Google
  // was never asked again. Witnessed red with the TTL check removed.
  it('hands the chain back to the user order after the TTL, and not before', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
    let seen = stubFetch({ google: KATA, mymemory: SEMANTIC });
    await translateGroup([req('s1', 'clutch')], settings(['google', 'mymemory']), 1);
    expect(seen).toEqual(['google', 'mymemory']);

    // Inside the window the fallback keeps the lead: that is the anti-churn half.
    vi.setSystemTime(new Date('2026-11-03T12:00:30Z'));
    seen = stubFetch({ google: SEMANTIC, mymemory: SEMANTIC });
    await translateGroup([{ messageId: 's2', text: 'nice play', targetLang: 'fr' }], settings(['google', 'mymemory']), 1);
    expect(seen).toEqual(['mymemory']);

    // Past it, the user's first choice is asked first again.
    vi.setSystemTime(new Date('2026-11-03T12:01:01Z'));
    seen = stubFetch({ google: SEMANTIC, mymemory: SEMANTIC });
    await translateGroup([{ messageId: 's3', text: 'nice play', targetLang: 'fr' }], settings(['google', 'mymemory']), 1);
    expect(seen).toEqual(['google']);
  });
});

describe('the detected language comes back in the product codes', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Measured on the free endpoint: a Hebrew line is detected 'iw' and a Chinese
  // one 'zh-CN'. Neither is a key of the language table, so the badge printed
  // "IW" and "ZH-CN" instead of the language's name.
  for (const [google, ours] of [['iw', 'he'], ['zh-CN', 'zh']] as const) {
    it(`reads Google's ${google} as ${ours}`, async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response(JSON.stringify([[['hello', 'x', null, null, 10]], null, google]), { status: 200 }),
      ) as unknown as typeof fetch;
      const [out] = await translateGroup([{ messageId: '1', text: 'x', targetLang: 'en' }], settings(['google']), 1);
      expect(out?.ok && out.result.detectedLang).toBe(ours);
    });
  }
});

describe('a provider that never answers', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  /** Google hangs and ignores its signal; MyMemory answers at once. */
  function hangingGoogle(): string[] {
    const seen: string[] = [];
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('translate.googleapis.com')) {
        seen.push('google');
        return new Promise<Response>(() => undefined);
      }
      seen.push('mymemory');
      return Promise.resolve(new Response(myMemoryBody('bonjour'), { status: 200 }));
    }) as unknown as typeof fetch;
    return seen;
  }

  // Nothing bounded a provider call: one that never settled held its flush, and
  // every tab waiting on that flush with its rows on "…", until the network gave
  // up or the browser stopped the worker. A fresh module each time, since the
  // failure cools Google down for whatever runs next.
  it('gives up on a line at its deadline, as a network failure, and the next provider answers', async () => {
    vi.resetModules();
    const { translateGroup: fresh, getProviderStatus } = await import('./index');
    vi.useFakeTimers();
    const seen = hangingGoogle();
    const pending = fresh([{ messageId: 'h1', text: 'hello there', targetLang: 'fr' }], settings(['google', 'mymemory']), 1);
    await vi.advanceTimersByTimeAsync(60_000);
    const [out] = await pending;
    expect(seen).toEqual(['google', 'mymemory']);
    expect(out?.ok && out.result.translatedText).toBe('bonjour');
    // The network rung of the backoff ladder, never the five-minute quota one.
    const google = getProviderStatus(settings(['google', 'mymemory'])).find((s) => s.id === 'google');
    expect(google?.cooldownLeftSec).toBe(0);
  });

  it('gives up on a batch at its deadline and the next provider answers every line', async () => {
    vi.resetModules();
    const { translateGroup: fresh } = await import('./index');
    vi.useFakeTimers();
    const seen = hangingGoogle();
    const pending = fresh(
      [
        { messageId: 'b1', text: 'hello there', targetLang: 'fr' },
        { messageId: 'b2', text: 'good game', targetLang: 'fr' },
      ],
      settings(['google', 'mymemory']),
      1,
    );
    await vi.advanceTimersByTimeAsync(60_000);
    const out = await pending;
    expect(seen).toEqual(['google', 'mymemory', 'mymemory']);
    expect(out.map((o) => o.ok)).toEqual([true, true]);
  });
});

// Each flush made its own pool, so two groups together ran twice the cap.
describe('translateGroup, concurrency cap across groups', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('never has more provider calls in flight than the setting, however many groups', async () => {
    let live = 0;
    let peak = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      if (url.includes('mymemory')) return new Response(myMemoryBody('x'), { status: 200 });
      return new Response(googleBody('x'), { status: 200 });
    }) as unknown as typeof fetch;
    const s = { ...defaultSettings(), providerOrder: ['mymemory' as const], concurrency: 2 };
    const group = (tag: string) => translateGroup([1, 2, 3, 4].map((n) => req(`${tag}${n}`, `hello ${tag} ${n}`)), s, 2);
    await Promise.all([group('a'), group('b'), group('c')]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
