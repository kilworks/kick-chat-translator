import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';
import type { Settings } from '~/shared/settings';

/**
 * P1-7, language half: a source-language allowlist used to drop lines without a
 * word in the popup. The chat tab counts its recent drops; the popup asks it and
 * shows one line with the way to the filter.
 */
let settings: Settings = defaultSettings();

vi.mock('~/shared/messages', () => ({
  send: vi.fn(async (m: { type: string }) => {
    if (m.type === 'settings.get') return { type: 'settings', payload: settings };
    if (m.type === 'stats.get') {
      return { type: 'stats', payload: { totalRequests: 3, totalCacheHits: 0, totalErrors: 0, byLang: {}, byProvider: {}, byChannel: {}, charsSent: 0, todayKey: 'today', history: [] } };
    }
    return { type: 'none' };
  }),
}));

const { App } = await import('./App');

const create = vi.fn();
function stubTab(count: number | 'none'): void {
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: '0.0.0' }), openOptionsPage: vi.fn(), getURL: (p: string) => `ext://${p}` },
    tabs: {
      query: vi.fn(async () => [{ url: 'https://kick.com/some-channel', id: 7 }]),
      sendMessage: vi.fn(async (_id: number, m: { type: string }) => {
        if (count === 'none') throw new Error('Could not establish connection');
        return m.type === 'filter.langBlocked' ? { count } : undefined;
      }),
      create,
    },
  });
}

function stubOffChannel(): void {
  stubTab(4);
  chrome.tabs.query = vi.fn(async () => [{ url: 'https://kick.com/', id: 7 }]) as never;
}

async function mount(): Promise<HTMLElement> {
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  return root;
}

const LINE = ': some recent lines were not translated.';

describe('popup, language allowlist', () => {
  beforeEach(() => {
    create.mockClear();
    settings = { ...defaultSettings(), enabled: true, usageStatsAsked: true, sourceLangAllowlist: ['ja'] };
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('says so in one line, linked to the allowlist card by its name', async () => {
    stubTab(4);
    const root = await mount();
    expect(root.textContent).toContain(`Source languages allowlist${LINE}`);
    const link = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Source languages allowlist');
    expect(link?.className).toBe('kt-link');
    link!.click();
    expect(create).toHaveBeenCalledWith({ url: 'ext://src/options/index.html#filters-langs' });
  });

  // A working allowlist is not a blocked channel: the day's numbers stay and
  // Options keeps the one green button.
  it('keeps the stats and Options as the primary', async () => {
    stubTab(4);
    const root = await mount();
    expect(root.textContent).toContain('Today');
    // The engines card gives the line its place (600px budget, measure-popup).
    expect(root.textContent).not.toContain('Providers');
    const options = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Options');
    expect(options?.className.split(' ')).toContain('kt-btn');
    expect(options?.className).not.toContain('kt-btn-ghost');
  });

  // A Kick page with no channel has no chat whose lines it could be about.
  it('says nothing off a channel', async () => {
    stubOffChannel();
    expect((await mount()).textContent).not.toContain(LINE);
  });

  // Controls: no drops, no allowlist, or a tab that cannot answer, and nothing shows.
  it('says nothing when the chat reports none', async () => {
    stubTab(0);
    expect((await mount()).textContent).not.toContain(LINE);
  });

  it('says nothing once the allowlist is cleared', async () => {
    settings = { ...settings, sourceLangAllowlist: [] };
    stubTab(4);
    expect((await mount()).textContent).not.toContain(LINE);
  });

  it('says nothing when the tab has no content script to ask', async () => {
    stubTab('none');
    expect((await mount()).textContent).not.toContain(LINE);
  });
});
