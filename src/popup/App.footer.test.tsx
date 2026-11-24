import { readFileSync } from 'node:fs';
import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';

/**
 * The popup's update link and Clear cache button, mounted. The link used to
 * carry an English title and a "⬆" typed into a translated sentence; the
 * button gave nothing back when pressed.
 */
const sent: { type: string }[] = [];
let update: Record<string, unknown> | undefined;
let asked = true;
let setReply: unknown;
let workerDown = false;
const stats = { totalRequests: 3, totalCacheHits: 0, totalErrors: 0, byLang: {}, byProvider: {}, byChannel: {}, charsSent: 0, todayKey: 'today', history: [] };

vi.mock('~/shared/messages', () => ({
  send: vi.fn(async (m: { type: string }) => {
    sent.push(m);
    if (workerDown) throw new Error('No response');
    if (m.type === 'settings.set' && setReply) return setReply;
    if (m.type === 'settings.get') return { type: 'settings', payload: { ...defaultSettings(), usageStatsAsked: asked } };
    if (m.type === 'stats.get') return { type: 'stats', payload: stats };
    if (m.type === 'update.status' && update) return { type: 'update.info', payload: update };
    if (m.type === 'cache.clear') return { type: 'ack' };
    return { type: 'none' };
  }),
}));

const { App } = await import('./App');

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

async function mount(): Promise<HTMLElement> {
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  return root;
}

beforeEach(() => {
  sent.length = 0;
  update = undefined;
  asked = true;
  setReply = undefined;
  workerDown = false;
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: '1.0.0' }), openOptionsPage: vi.fn() },
    tabs: { query: vi.fn(async () => [{ url: 'https://kick.com/some-channel' }]) },
  });
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('update link', () => {
  it('draws its arrow as a hidden icon and names both versions in the title', async () => {
    update = { current: '1.0.0', latest: '1.1.0', updateAvailable: true, releaseUrl: 'https://example.com/r' };
    const root = await mount();
    const link = root.querySelector('a[href="https://example.com/r"]')!;
    expect(link.textContent).toContain('Update available');
    expect(link.textContent).not.toContain('⬆');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(link.getAttribute('title')).toBe('Version 1.0.0 installed, 1.1.0 available');
    // In the place of the day's numbers. The engines stay: someone updating
    // may be doing so because one of them broke.
    expect(root.textContent).not.toContain('Today');
    expect(root.textContent).toContain('Providers');
  });

  it('holds the stats question back while it is offered', async () => {
    update = { current: '1.0.0', latest: '1.1.0', updateAvailable: true, releaseUrl: 'https://example.com/r' };
    asked = false;
    const root = await mount();
    expect(root.textContent).toContain('Update available');
    expect(root.textContent).not.toContain('No thanks');
  });

  it('is absent, and the stats back, when there is nothing to install', async () => {
    update = { current: '1.0.0', latest: '1.0.0', updateAvailable: false, releaseUrl: 'https://example.com/r' };
    const root = await mount();
    expect(root.querySelector('a[href="https://example.com/r"]')).toBeNull();
    expect(root.textContent).toContain('Today');
    expect(root.textContent).toContain('Providers');
  });
});

describe('Clear cache', () => {
  it('says it is done in the live status line for 2 s, then goes quiet', async () => {
    const root = await mount();
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const button = root.querySelector<HTMLButtonElement>('button[aria-label="Clear cache"]')!;
    const status = root.querySelector('[role="status"]')!;
    expect(status.textContent).not.toContain('Cache cleared');
    button.click();
    await flush();
    expect(sent.some((m) => m.type === 'cache.clear')).toBe(true);
    // The message alone, not appended to the version line where it was cut.
    expect(status.textContent).toBe('Cache cleared');
    expect(status.getAttribute('title')).toBe('Cache cleared');
    expect(button.querySelector('use')?.getAttribute('href')).toBe('#i-check');
    vi.advanceTimersByTime(2000);
    await flush();
    expect(status.textContent).not.toContain('Cache cleared');
    expect(button.querySelector('use')?.getAttribute('href')).toBe('#i-trash');
  });
});

describe('.kt-label in caseless scripts', () => {
  // Letter spacing breaks Arabic joining; capitals mean nothing without case.
  it.each(['src/popup/styles.css', 'src/options/styles.css'])('%s drops capitals and tracking', (file) => {
    const css = readFileSync(file, 'utf8');
    const rule = css.match(/\.kt-label:is\(([^{]*)\)\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    for (const lang of ['ar', 'fa', 'he', 'th', 'ja', 'zh']) expect(rule![1]).toContain(`:lang(${lang})`);
    expect(rule![2]).toMatch(/text-transform:\s*none/);
    expect(rule![2]).toMatch(/letter-spacing:\s*normal/);
  });
});

// A popup that cannot reach the worker used to show the defaults as if they were
// the reader's settings, and a refused change left the control where it was, mute.
describe('when the worker does not answer', () => {
  it('says so in the status line instead of showing defaults as fact', async () => {
    workerDown = true;
    const root = await mount();
    expect(root.querySelector('[role="status"]')?.textContent).toBe('unavailable');
  });

  it('says when a change was refused', async () => {
    setReply = { type: 'error', payload: { message: 'not allowed' } };
    const root = await mount();
    root.querySelector<HTMLInputElement>('input[role="switch"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Not saved.');
  });
});

// "click Enable" does not work when the accessible name is another sentence.
describe('the header switch', () => {
  it('has an accessible name that starts with its visible label', async () => {
    const root = await mount();
    const input = root.querySelector<HTMLInputElement>('input[role="switch"]')!;
    const visible = input.closest('label')!.textContent!.trim();
    expect(input.getAttribute('aria-label')!.startsWith(visible)).toBe(true);
  });
});

describe('popup select', () => {
  it('draws the chevron the options page does', () => {
    const css = readFileSync('src/popup/styles.css', 'utf8');
    expect(css).toMatch(/\.kt-select\s*\{[^}]*background-image:\s*url\(/);
  });
});
