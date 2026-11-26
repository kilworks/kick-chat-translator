import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';
import type { Settings } from '~/shared/settings';

/** Manual start: the popup must not say "on" over a silent channel, and must start it in the tab. */
let settings: Settings = defaultSettings();

vi.mock('~/shared/messages', () => ({
  send: vi.fn(async (m: { type: string }) => {
    if (m.type === 'settings.get') return { type: 'settings', payload: settings };
    if (m.type === 'stats.get') {
      return {
        type: 'stats',
        payload: {
          totalRequests: 3,
          totalCacheHits: 0,
          totalErrors: 0,
          byLang: {},
          byProvider: {},
          byChannel: {},
          charsSent: 0,
          todayKey: 'today',
          history: [],
        },
      };
    }
    return { type: 'none' };
  }),
}));

const { App } = await import('./App');

const sendMessage = vi.fn();
function stubTab(waiting: boolean | 'none', setAnswer = false): void {
  sendMessage.mockReset();
  sendMessage.mockImplementation(async (_id: number, m: { type: string }) => {
    if (waiting === 'none') throw new Error('Could not establish connection');
    if (m.type === 'start.state') return { waiting };
    if (m.type === 'start.set') return { waiting: setAnswer };
    return undefined;
  });
  vi.stubGlobal('chrome', {
    runtime: {
      getManifest: () => ({ version: '0.0.0' }),
      openOptionsPage: vi.fn(),
      getURL: (p: string) => `ext://${p}`,
    },
    tabs: {
      query: vi.fn(async () => [{ url: 'https://kick.com/some-channel', id: 7 }]),
      sendMessage,
      create: vi.fn(),
    },
  });
}

async function mount(): Promise<HTMLElement> {
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  return root;
}
const resume = (root: HTMLElement) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === 'Resume');

describe('popup, manual start', () => {
  beforeEach(() => {
    settings = { ...defaultSettings(), enabled: true, usageStatsAsked: true, startMode: 'manual' };
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('shows the waiting card and starts the channel in the tab', async () => {
    stubTab(true);
    const root = await mount();
    expect(root.textContent).toContain('Paused on this channel');
    // Like a pause: the stats card steps aside, or the popup passes the 600px a browser gives it (610 to 634 px, measured).
    expect(root.textContent).not.toContain('Today');
    resume(root)!.click();
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
    expect(sendMessage).toHaveBeenCalledWith(7, { type: 'start.set' }, { frameId: 0 });
    expect(resume(root)).toBeUndefined();
  });

  it('keeps the card when the tab says it is still waiting after the click', async () => {
    stubTab(true, true);
    const root = await mount();
    resume(root)!.click();
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
    expect(resume(root)).toBeDefined();
  });

  it('shows nothing once the channel is started', async () => {
    stubTab(false);
    expect(resume(await mount())).toBeUndefined();
  });

  it('shows nothing in auto mode, even if the tab says waiting', async () => {
    settings = { ...settings, startMode: 'auto' };
    stubTab(true);
    expect(resume(await mount())).toBeUndefined();
    // Auto mode has nothing to ask the tab.
    expect(sendMessage).not.toHaveBeenCalledWith(7, { type: 'start.state' }, { frameId: 0 });
  });

  it('shows nothing when the tab has no content script', async () => {
    stubTab('none');
    expect(resume(await mount())).toBeUndefined();
  });
});
