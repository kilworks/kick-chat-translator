import { afterEach, describe, expect, it, vi } from 'vitest';
import { deeplProvider } from './deepl';
import { ProviderError } from './types';

const baseCtx = { deeplApiKey: '', deeplPlan: 'free' as const, deeplBudgetPct: 0, lingvaInstance: '', myMemoryEmail: '', concurrency: 4 };

describe('deeplProvider', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('requires an API key', async () => {
    await expect(
      deeplProvider.translate({ messageId: '1', text: 'x', targetLang: 'en' }, baseCtx),
    ).rejects.toMatchObject({ code: 'no_key' });
  });

  it('returns translated text on success', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          translations: [{ detected_source_language: 'JA', text: 'Hello' }],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const res = await deeplProvider.translate(
      { messageId: '1', text: 'こんにちは', targetLang: 'en' },
      { ...baseCtx, deeplApiKey: 'k:fx' },
    );
    expect(res.translatedText).toBe('Hello');
    expect(res.detectedLang).toBe('ja');
  });

  it('throws auth on 403', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    await expect(
      deeplProvider.translate(
        { messageId: '1', text: 'x', targetLang: 'en' },
        { ...baseCtx, deeplApiKey: 'k:fx' },
      ),
    ).rejects.toMatchObject({ code: 'auth' });
  });

  it('throws quota on 456', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 456 })) as unknown as typeof fetch;
    await expect(
      deeplProvider.translate(
        { messageId: '1', text: 'x', targetLang: 'en' },
        { ...baseCtx, deeplApiKey: 'k:fx' },
      ),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('skips unsupported targets without hitting the network', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(
      deeplProvider.translate({ messageId: '1', text: 'hi', targetLang: 'tl' }, { ...baseCtx, deeplApiKey: 'k:fx' }),
    ).rejects.toMatchObject({ code: 'unsupported' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // The detector can now name a language DeepL has never heard of. Sending it as
  // source_lang is an HTTP 400, and a 400 counts against the provider's health
  // and pushes it out of rotation, over a message DeepL could have handled by
  // detecting the language itself.
  it('drops a source hint DeepL has no language for, rather than sending a 400', async () => {
    let sentBody = '';
    globalThis.fetch = vi.fn(async (_url: unknown, init: { body?: string }) => {
      sentBody = String(init.body);
      return new Response(JSON.stringify({ translations: [{ detected_source_language: 'ZH', text: 'where' }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    await deeplProvider.translate(
      { messageId: '1', text: '佢哋去咗邊度呀', targetLang: 'en', sourceLangHint: 'yue' },
      { ...baseCtx, deeplApiKey: 'k:fx' },
    );
    expect(sentBody).not.toContain('source_lang');
  });

  it('still sends a source hint DeepL does know, without its region', async () => {
    let sentBody = '';
    globalThis.fetch = vi.fn(async (_url: unknown, init: { body?: string }) => {
      sentBody = String(init.body);
      return new Response(JSON.stringify({ translations: [{ detected_source_language: 'ZH', text: 'hi' }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    await deeplProvider.translate(
      { messageId: '1', text: '你好', targetLang: 'en', sourceLangHint: 'zh-tw' },
      { ...baseCtx, deeplApiKey: 'k:fx' },
    );
    expect(sentBody).toContain('source_lang=ZH');
    expect(sentBody).not.toContain('ZH-HANT');
  });

  it('refuses Cantonese as a target without hitting the network', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(
      deeplProvider.translate({ messageId: '1', text: 'hi', targetLang: 'yue' }, { ...baseCtx, deeplApiKey: 'k:fx' }),
    ).rejects.toMatchObject({ code: 'unsupported' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps pt-br to the PT-BR target code', async () => {
    let sentBody = '';
    globalThis.fetch = vi.fn(async (_url: unknown, init: { body?: string }) => {
      sentBody = String(init.body);
      return new Response(JSON.stringify({ translations: [{ detected_source_language: 'EN', text: 'olá' }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    await deeplProvider.translate(
      { messageId: '1', text: 'hi', targetLang: 'pt-br' },
      { ...baseCtx, deeplApiKey: 'k:fx' },
    );
    expect(sentBody).toContain('target_lang=PT-BR');
  });

  it('sends formality=prefer_more for a formal compose into a supported target (JA)', async () => {
    let sentBody = '';
    globalThis.fetch = vi.fn(async (_url: unknown, init: { body?: string }) => {
      sentBody = String(init.body);
      return new Response(JSON.stringify({ translations: [{ detected_source_language: 'FR', text: 'こんにちは' }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    await deeplProvider.translate(
      { messageId: '1', text: 'bonjour', targetLang: 'ja', formal: true },
      { ...baseCtx, deeplApiKey: 'k:fx' },
    );
    expect(sentBody).toContain('formality=prefer_more');
  });

  it('sends one request for a whole batch, keeping the order', async () => {
    let sentBody = '';
    const fetchSpy = vi.fn(async (_url: unknown, init: { body?: string }) => {
      sentBody = String(init.body);
      return new Response(
        JSON.stringify({
          translations: [
            { detected_source_language: 'ES', text: 'one' },
            { detected_source_language: 'FR', text: 'two' },
            { detected_source_language: 'DE', text: 'three' },
          ],
        }),
        { status: 200 },
      );
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const out = await deeplProvider.translateBatch!(
      [
        { messageId: '1', text: 'uno', targetLang: 'en' },
        { messageId: '2', text: 'deux', targetLang: 'en' },
        { messageId: '3', text: 'drei', targetLang: 'en' },
      ],
      { ...baseCtx, deeplApiKey: 'k:fx' },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sentBody.match(/(^|&)text=/g)).toHaveLength(3);
    expect(out.map((r) => r.translatedText)).toEqual(['one', 'two', 'three']);
    expect(out.map((r) => r.detectedLang)).toEqual(['es', 'fr', 'de']);
  });

  it('rejects a response whose result count does not match the batch', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ translations: [{ detected_source_language: 'ES', text: 'one' }] }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

    await expect(
      deeplProvider.translateBatch!(
        [
          { messageId: '1', text: 'uno', targetLang: 'en' },
          { messageId: '2', text: 'dos', targetLang: 'en' },
        ],
        { ...baseCtx, deeplApiKey: 'k:fx' },
      ),
    ).rejects.toMatchObject({ code: 'count_mismatch' });
  });

  // Never observed against DeepL: no key on this machine. These pin what is sent.
  const batchBody = async (hints: (string | undefined)[]): Promise<string> => {
    let sentBody = '';
    globalThis.fetch = vi.fn(async (_url: unknown, init: { body?: string }) => {
      sentBody = String(init.body);
      return new Response(
        JSON.stringify({ translations: hints.map(() => ({ detected_source_language: 'JA', text: 'x' })) }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    await deeplProvider.translateBatch!(
      hints.map((h, i) => ({ messageId: String(i), text: `t${i}`, targetLang: 'en', ...(h ? { sourceLangHint: h } : {}) })),
      { ...baseCtx, deeplApiKey: 'k:fx' },
    );
    return sentBody;
  };

  it('keeps the source language on a batch whose lines all share it', async () => {
    expect(await batchBody(['ja', 'ja'])).toContain('source_lang=JA');
  });

  it('leaves a batch with mixed or missing hints to detection', async () => {
    expect(await batchBody(['ja', 'ko'])).not.toContain('source_lang');
    expect(await batchBody(['ja', undefined])).not.toContain('source_lang');
  });

  it('sends Norwegian as NB, not NO', async () => {
    const body = await batchBody(['no', 'no']);
    expect(body).toContain('source_lang=NB');
    expect(body).not.toContain('source_lang=NO');
  });

  it('does not hit the network for an empty batch', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(deeplProvider.translateBatch!([], { ...baseCtx, deeplApiKey: 'k:fx' })).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('omits formality on targets DeepL does not support it on (fi)', async () => {
    let sentBody = '';
    globalThis.fetch = vi.fn(async (_url: unknown, init: { body?: string }) => {
      sentBody = String(init.body);
      return new Response(JSON.stringify({ translations: [{ detected_source_language: 'FR', text: 'x' }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    await deeplProvider.translate(
      { messageId: '1', text: 'bonjour', targetLang: 'fi', formal: true },
      { ...baseCtx, deeplApiKey: 'k:fx' },
    );
    expect(sentBody).not.toContain('formality');
  });

  // `context` is free on DeepL's side, so the anti-transliteration hint costs a
  // few bytes of request and nothing else. It rides here rather than in the
  // content script, where the rescued wiring built it: the field is a DeepL
  // parameter and building it on the page cost 380 bytes on every Kick page for
  // something only this provider reads.
  //
  // Never observed against the real API: that needs a key this machine has not
  // got. What is asserted is that the hint reaches the request body.
  describe('anti-transliteration hint in context', () => {
    let sentBody = '';
    const captureFetch = (): void => {
      globalThis.fetch = vi.fn(async (_url: unknown, init: { body?: string }) => {
        sentBody = String(init.body);
        return new Response(
          JSON.stringify({ translations: [{ detected_source_language: 'FR', text: 'x' }] }),
          { status: 200 },
        );
      }) as unknown as typeof fetch;
    };
    // The body is a form: spaces come back as '+', so reading it as a raw
    // string finds neither the hint nor the chat context. Three assertions were
    // red on that and the product was right on all three.
    const contextSent = (): string | null => new URLSearchParams(sentBody).get('context');

    it('rides along on a short message aimed at a non-Latin script', async () => {
      captureFetch();
      await deeplProvider.translate(
        { messageId: '1', text: 'bonjour', targetLang: 'ja' },
        { ...baseCtx, deeplApiKey: 'k:fx' },
      );
      expect(contextSent()).toContain('Do not transliterate');
    });

    it('keeps the chat context it was given and appends the hint', async () => {
      captureFetch();
      await deeplProvider.translate(
        { messageId: '1', text: 'merci', targetLang: 'ja', context: 'previous chat lines' },
        { ...baseCtx, deeplApiKey: 'k:fx' },
      );
      const body = contextSent() ?? '';
      expect(body).toContain('previous chat lines');
      expect(body).toContain('Do not transliterate');
    });

    it('stays out of a Latin target, where the defect cannot happen', async () => {
      captureFetch();
      await deeplProvider.translate(
        { messageId: '1', text: 'bonjour', targetLang: 'es', context: 'previous chat lines' },
        { ...baseCtx, deeplApiKey: 'k:fx' },
      );
      const body = contextSent() ?? '';
      expect(body).toContain('previous chat lines');
      expect(body).not.toContain('Do not transliterate');
    });

    it('stays out of a long message, where providers translate anyway', async () => {
      captureFetch();
      await deeplProvider.translate(
        { messageId: '1', text: 'this is a much longer chat line', targetLang: 'ja' },
        { ...baseCtx, deeplApiKey: 'k:fx' },
      );
      expect(contextSent() ?? '').not.toContain('Do not transliterate');
    });
  });
});
