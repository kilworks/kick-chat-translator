import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractChannelSlug, fetchChannelLangIso } from './kickApi';

const mockFetch = (body: unknown, status = 200): void => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
};

describe('extractChannelSlug', () => {
  it('returns the first path segment for a channel URL', () => {
    expect(extractChannelSlug('/adinross')).toBe('adinross');
    expect(extractChannelSlug('/adinross/clips')).toBe('adinross');
  });

  it('returns undefined for reserved routes', () => {
    expect(extractChannelSlug('/browse')).toBeUndefined();
    expect(extractChannelSlug('/community')).toBeUndefined();
    expect(extractChannelSlug('/settings')).toBeUndefined();
    expect(extractChannelSlug('/')).toBeUndefined();
  });

  it('lowercases the slug', () => {
    expect(extractChannelSlug('/AdinRoss')).toBe('adinross');
  });
});

describe('fetchChannelLangIso', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('extracts and normalizes the live channel language', async () => {
    mockFetch({ chatroom: { id: 1 }, livestream: { lang_iso: 'ES' } });
    expect(await fetchChannelLangIso('kt-test-es')).toBe('es');
  });

  it('normalizes regional variants (pt-BR)', async () => {
    mockFetch({ livestream: { lang_iso: 'pt-BR' } });
    expect(await fetchChannelLangIso('kt-test-ptbr')).toBe('pt-br');
  });

  it('returns undefined for an offline channel', async () => {
    mockFetch({ chatroom: { id: 2 }, livestream: null });
    expect(await fetchChannelLangIso('kt-test-offline')).toBeUndefined();
  });

  it('tolerates a 403 (Cloudflare) without throwing', async () => {
    mockFetch('', 403);
    await expect(fetchChannelLangIso('kt-test-403')).resolves.toBeUndefined();
  });
});

describe('channel metadata requests', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  // Compose and the bar ask for the language at almost the same moment on a
  // route change; both go through one metadata call, so Kick sees one request.
  it('coalesces concurrent lookups into a single request', async () => {
    const spy = vi.fn(
      async () => new Response(JSON.stringify({ chatroom: { id: 7 }, livestream: { lang_iso: 'ja' } }), { status: 200 }),
    );
    globalThis.fetch = spy as unknown as typeof fetch;

    const [lang, again] = await Promise.all([
      fetchChannelLangIso('kt-test-coalesce'),
      fetchChannelLangIso('kt-test-coalesce'),
    ]);

    expect(lang).toBe('ja');
    expect(again).toBe('ja');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('serves a live channel from cache instead of refetching', async () => {
    const spy = vi.fn(
      async () => new Response(JSON.stringify({ chatroom: { id: 9 }, livestream: { lang_iso: 'de' } }), { status: 200 }),
    );
    globalThis.fetch = spy as unknown as typeof fetch;

    expect(await fetchChannelLangIso('kt-test-cached')).toBe('de');
    expect(await fetchChannelLangIso('kt-test-cached')).toBe('de');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('remembers the language of a channel that has since gone offline', async () => {
    const stored: Record<string, unknown> = {};
    // The content script has no storage of its own: the worker's pageStore answers.
    const { getLastLang, setLastLang } = await import('~/background/pageStore');
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: (k: string | string[]) => Promise.resolve(Object.fromEntries([k].flat().filter((x) => x in stored).map((x) => [x, stored[x]]))),
          set: (obj: Record<string, unknown>) => {
            Object.assign(stored, obj);
            return Promise.resolve();
          },
          remove: (k: string) => {
            delete stored[k];
            return Promise.resolve();
          },
        },
      },
      runtime: {
        lastError: undefined,
        sendMessage: (m: { type: string; slug: string; lang: string }, cb: (r: unknown) => void) => {
          if (m.type === 'lastlang.set') void setLastLang(m.slug, m.lang).then(() => cb({ type: 'ack' }));
          else void getLastLang(m.slug).then((payload) => cb({ type: 'value', payload }));
        },
      },
    });

    mockFetch({ chatroom: { id: 1 }, livestream: { lang_iso: 'ja' } });
    expect(await fetchChannelLangIso('kt-test-persist')).toBe('ja');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.stringify(stored['kt.lastlang.v2'])).toContain('kt-test-persist');
    expect(stored['kt.lastlang.kt-test-persist']).toBeUndefined();

    // Same channel, now offline: the live field is gone but compose should still
    // target Japanese rather than falling back to English.
    mockFetch({ chatroom: { id: 1 }, livestream: null });
    expect(await fetchChannelLangIso('kt-test-persist-offline')).toBeUndefined();
    // A channel remembered by an earlier build (one key per channel) is still read.
    stored['kt.lastlang.kt-test-persist-offline'] = 'ja';
    expect(await fetchChannelLangIso('kt-test-persist-offline')).toBe('ja');
  });
});

describe('extractChannelSlug', () => {
  it('names the channel, lowercased, and refuses site routes', () => {
    expect(extractChannelSlug('/SomeChannel/videos')).toBe('somechannel');
    expect(extractChannelSlug('/browse')).toBeUndefined();
    expect(extractChannelSlug('/Categories/x')).toBeUndefined();
    expect(extractChannelSlug('/')).toBeUndefined();
  });
});
