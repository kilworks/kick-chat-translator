import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';

// A fresh module per test: provider health lives in module state.
describe('anyProviderReady', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('is false while every configured provider cools down, true again once one recovers', async () => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    const { anyProviderReady, translateGroup } = await import('./index');
    const s = { ...defaultSettings(), providerOrder: ['google' as const], concurrency: 1 };
    expect(anyProviderReady(s)).toBe(true);

    globalThis.fetch = vi.fn(async () => new Response('x', { status: 429 })) as unknown as typeof fetch;
    await translateGroup([{ messageId: '1', text: 'bonjour', targetLang: 'en' }], s, 1);

    expect(anyProviderReady(s)).toBe(false);
    vi.setSystemTime(Date.now() + 61_000);
    expect(anyProviderReady(s)).toBe(true);
  });
});
