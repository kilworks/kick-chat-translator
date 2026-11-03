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
