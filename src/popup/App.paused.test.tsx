import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';

/**
 * The bar pauses one channel. Before this row, the popup's switch read "on"
 * over a tab that translated nothing, and the only way back was to find the
 * bar again. Mounted rather than read from source: what is asserted is that
 * the row follows the active tab and that Resume writes the right list.
 */
const sent: unknown[] = [];
let settings = { ...defaultSettings(), usageStatsAsked: true, pausedChannels: ['some-channel', 'other'] };
let stats: Record<string, unknown> = {};
const usedStats = { totalRequests: 3, totalCacheHits: 0, totalErrors: 0, byLang: {}, byProvider: {}, byChannel: {}, charsSent: 0, todayKey: 'today', history: [] };

vi.mock('~/shared/messages', () => ({
  send: vi.fn(async (m: { type: string; payload?: Record<string, unknown> }) => {
    sent.push(m);
    if (m.type === 'settings.get') return { type: 'settings', payload: settings };
    if (m.type === 'settings.set') {
      settings = { ...settings, ...m.payload };
      return { type: 'settings', payload: settings };
    }
    if (m.type === 'stats.get') return { type: 'stats', payload: stats };
    return { type: 'none' };
  }),
}));

const { App } = await import('./App');

function stubTab(url: string): void {
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: '0.0.0' }), openOptionsPage: vi.fn() },
    tabs: { query: vi.fn(async () => [{ url }]) },
  });
}

async function mount(): Promise<HTMLElement> {
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  return root;
}

const resumeButton = (root: HTMLElement) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === 'Resume');

describe('popup on a paused channel', () => {
  beforeEach(() => {
    sent.length = 0;
    settings = { ...defaultSettings(), usageStatsAsked: true, pausedChannels: ['some-channel', 'other'] };
    stats = usedStats;
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('says so and resumes only that channel', async () => {
    stubTab('https://kick.com/some-channel');
    const root = await mount();
    expect(root.textContent).toContain('Paused on this channel');
    // In place of the day's numbers, not on top of them: both together put the
    // default popup at 654px against Chrome's 600px ceiling.
    expect(root.textContent).not.toContain('Today');
    resumeButton(root)!.click();
    await new Promise((r) => setTimeout(r, 0));
    const set = sent.find((m) => (m as { type: string }).type === 'settings.set');
    expect(set).toEqual({ type: 'settings.set', payload: { pausedChannels: ['other'] } });
    expect(root.textContent).not.toContain('Paused on this channel');
    expect(root.textContent).toContain('Today');
  });

  it('stays quiet on a channel that is not paused', async () => {
    stubTab('https://kick.com/not-paused');
    const root = await mount();
    expect(root.textContent).toContain('Target language');
    expect(resumeButton(root)).toBeUndefined();
  });

  it('stays quiet off Kick, even on a path that matches a paused slug', async () => {
    stubTab('https://example.com/some-channel');
    const root = await mount();
    expect(root.textContent).toContain('Target language');
    expect(resumeButton(root)).toBeUndefined();
  });
});

const FIRST = 'Open a Kick channel: its chat is translated as it arrives.';

describe('popup for someone who has translated nothing yet', () => {
  const fresh = { ...usedStats, totalRequests: 0, history: [] };
  beforeEach(() => {
    sent.length = 0;
    settings = { ...defaultSettings(), usageStatsAsked: true };
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('points to Kick when the tab is elsewhere, in place of the empty day', async () => {
    stats = fresh;
    stubTab('https://example.com/');
    const root = await mount();
    expect(root.textContent).toContain(FIRST);
    expect(root.textContent).not.toContain('Today');
  });

  it('says nothing on Kick itself', async () => {
    stats = fresh;
    stubTab('https://kick.com/');
    const root = await mount();
    expect(root.textContent).not.toContain(FIRST);
  });

  // Everyone else on a tab that is not Kick used to see the full settings and the
  // day's numbers with no hint that this tab would not be translated.
  it('tells a regular once, in a line, that this tab is not Kick, and keeps the stats', async () => {
    stats = { ...fresh, history: [{ day: 'yesterday', requests: 40 }] };
    stubTab('https://example.com/');
    const root = await mount();
    expect(root.textContent).toContain(FIRST);
    expect(root.querySelector('.kt-card')?.textContent).not.toContain(FIRST);
    expect(root.textContent).toContain('Today');
  });
});
