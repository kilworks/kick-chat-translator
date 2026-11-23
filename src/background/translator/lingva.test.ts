import { afterEach, describe, expect, it, vi } from 'vitest';
import { lingvaProvider } from './lingva';
import { ProviderError } from './types';

const baseCtx = {
  deeplApiKey: '',
  deeplPlan: 'free' as const,
  deeplBudgetPct: 0,
  lingvaInstance: 'https://lingva.example',
  myMemoryEmail: '', concurrency: 4
};

const reply = (translation: string, detectedSource?: string) =>
  new Response(JSON.stringify({ translation, info: { detectedSource } }), { status: 200 });

describe('lingvaProvider', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the translation and detected source', async () => {
    globalThis.fetch = vi.fn(async () => reply('hola', 'en')) as unknown as typeof fetch;
    const res = await lingvaProvider.translate({ messageId: '1', text: 'hi', targetLang: 'es' }, baseCtx);
    expect(res.translatedText).toBe('hola');
    expect(res.detectedLang).toBe('en');
  });

  // Lingva publishes 109 codes and Cantonese is not one of them. Counting that
  // as a broken instance would walk the whole pool marking each one unhealthy,
  // and take Lingva out of the chain for every other language too.
  it('treats a language it does not carry as unsupported, not as a broken instance', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ error: 'Invalid target language code.' }), { status: 400 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(
      lingvaProvider.translate({ messageId: '1', text: 'hi', targetLang: 'yue' }, baseCtx),
    ).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('stops at the first instance for a missing language instead of walking the pool', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ error: 'Invalid target language code.' }), { status: 400 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(
      lingvaProvider.translate(
        { messageId: '1', text: 'hi', targetLang: 'yue' },
        { ...baseCtx, lingvaInstance: '' },
      ),
    ).rejects.toMatchObject({ code: 'unsupported' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // Measured against lingva-scraper 1.1.0's languages.json, which the API
  // validates with: he, zh-tw and pt-br are not keys there, iw, zh_HANT and pt are.
  it('speaks Lingva codes for Hebrew, Traditional Chinese and Brazilian Portuguese', async () => {
    const paths: string[] = [];
    globalThis.fetch = vi.fn(async (url: unknown) => {
      paths.push(new URL(String(url)).pathname);
      return reply('x', 'iw');
    }) as unknown as typeof fetch;
    await lingvaProvider.translate({ messageId: '1', text: 'hi', targetLang: 'he' }, baseCtx);
    await lingvaProvider.translate({ messageId: '2', text: 'hi', targetLang: 'zh-tw', sourceLangHint: 'pt-br' }, baseCtx);
    await lingvaProvider.translate({ messageId: '3', text: 'hi', targetLang: 'pt-br', sourceLangHint: 'zh-tw' }, baseCtx);
    await lingvaProvider.translate({ messageId: '4', text: 'hi', targetLang: 'en', sourceLangHint: 'yue' }, baseCtx);
    expect(paths).toEqual(['/api/v1/auto/iw/hi', '/api/v1/pt/zh_HANT/hi', '/api/v1/zh/pt/hi', '/api/v1/auto/en/hi']);
  });

  it('still reports a genuine 400 as a provider failure', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: 'Something else went wrong' }), { status: 400 }),
    ) as unknown as typeof fetch;
    await expect(
      lingvaProvider.translate({ messageId: '1', text: 'hi', targetLang: 'es' }, baseCtx),
    ).rejects.toMatchObject({ code: 'http_400' });
  });

  it('falls back to auto when the instance reports no source language', async () => {
    globalThis.fetch = vi.fn(async () => reply('hola')) as unknown as typeof fetch;
    const res = await lingvaProvider.translate({ messageId: '1', text: 'hi', targetLang: 'es' }, baseCtx);
    expect(res.detectedLang).toBe('auto');
  });

  it('strips trailing slashes from the configured instance', async () => {
    let seen = '';
    globalThis.fetch = vi.fn(async (url: unknown) => {
      seen = String(url);
      return reply('hola');
    }) as unknown as typeof fetch;
    await lingvaProvider.translate(
      { messageId: '1', text: 'hi', targetLang: 'es' },
      { ...baseCtx, lingvaInstance: 'https://lingva.example///' },
    );
    expect(seen).toBe('https://lingva.example/api/v1/auto/es/hi');
  });

  it('escapes text that would otherwise change the request path', async () => {
    let seen = '';
    globalThis.fetch = vi.fn(async (url: unknown) => {
      seen = String(url);
      return reply('ok');
    }) as unknown as typeof fetch;
    await lingvaProvider.translate({ messageId: '1', text: 'a/b?c#d', targetLang: 'es' }, baseCtx);
    expect(seen).toBe('https://lingva.example/api/v1/auto/es/a%2Fb%3Fc%23d');
  });

  it('treats an empty translation as an error rather than a blank message', async () => {
    globalThis.fetch = vi.fn(async () => reply('')) as unknown as typeof fetch;
    await expect(
      lingvaProvider.translate({ messageId: '1', text: 'hi', targetLang: 'es' }, baseCtx),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('surfaces the instance status code', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 429 })) as unknown as typeof fetch;
    await expect(
      lingvaProvider.translate({ messageId: '1', text: 'hi', targetLang: 'es' }, baseCtx),
    ).rejects.toMatchObject({ code: 'rate_limit' });
  });

  // The message travels in the URL path, so percent-encoding decides whether the
  // request is even expressible. These build the string in memory; no instance is
  // contacted, which is the point of the guard.
  describe('oversized messages', () => {
    it('skips without a request when the encoded text exceeds the limit', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      // Each CJK char encodes to 9 bytes, so this clears 4000 well before the
      // 800-character cap the pipeline already applies.
      const text = '日'.repeat(500);
      expect(encodeURIComponent(text).length).toBeGreaterThan(4000);

      await expect(
        lingvaProvider.translate({ messageId: '1', text, targetLang: 'en' }, baseCtx),
      ).rejects.toMatchObject({ code: 'unsupported' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('still sends a long ASCII message, which encodes one byte per character', async () => {
      const fetchSpy = vi.fn(async () => reply('ok'));
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const text = 'a'.repeat(800);
      expect(encodeURIComponent(text).length).toBeLessThan(4000);

      await expect(
        lingvaProvider.translate({ messageId: '1', text, targetLang: 'es' }, baseCtx),
      ).resolves.toMatchObject({ translatedText: 'ok' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('sends non-ASCII that stays under the limit', async () => {
      const fetchSpy = vi.fn(async () => reply('ok'));
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const text = '日'.repeat(400);
      expect(encodeURIComponent(text).length).toBeLessThan(4000);

      await expect(
        lingvaProvider.translate({ messageId: '1', text, targetLang: 'en' }, baseCtx),
      ).resolves.toMatchObject({ translatedText: 'ok' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // The shipped pool holds one declared instance since lingva.ml left it; the
  // failover is kept for the next one, and tested on a pool of two.
  it('tries the next pooled instance when one fails', async () => {
    vi.resetModules();
    vi.doMock('~/shared/constants', async (orig) => ({
      ...(await orig<object>()),
      LINGVA_POOL: ['https://one.example', 'https://two.example'],
    }));
    const { lingvaProvider: pooled } = await import('./lingva');
    vi.doUnmock('~/shared/constants');
    const hosts: string[] = [];
    globalThis.fetch = vi.fn(async (url: unknown) => {
      hosts.push(new URL(String(url)).host);
      if (hosts.length === 1) return new Response('', { status: 500 });
      return reply('hola');
    }) as unknown as typeof fetch;

    const res = await pooled.translate(
      { messageId: '1', text: 'hi', targetLang: 'es' },
      { ...baseCtx, lingvaInstance: '' },
    );

    expect(res.translatedText).toBe('hola');
    expect(hosts.length).toBeGreaterThan(1);
    expect(new Set(hosts).size).toBe(hosts.length);
  });
});
