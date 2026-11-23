import { render } from 'preact';
import { defaultSettings } from '~/shared/settings';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * All settings are one item in chrome.storage.sync, capped at 8192 bytes. Past
 * about 540 blocked words the worker answers every save with an error, and the
 * page used to ignore anything that was not a settings answer: no message, and
 * every later change failed the same way, whatever the setting.
 */
vi.mock('~/shared/messages', () => ({
  send: vi.fn(async (m: { type: string }) =>
    m.type === 'settings.get'
      ? { type: 'settings', payload: defaultSettings() }
      : m.type === 'settings.set'
        ? { type: 'error', payload: { message: 'QUOTA_BYTES_PER_ITEM quota exceeded' } }
        : { type: 'none' },
  ),
}));
const { App } = await import('./App');
const { send } = await import('~/shared/messages');

afterEach(() => {
  document.body.textContent = '';
  vi.unstubAllGlobals();
});

describe('a save the browser refuses', () => {
  it('says so, and says what to shorten', async () => {
    vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '0.0.0' }) } });
    history.replaceState(null, '', '/#display');
    const root = document.createElement('div');
    document.body.append(root);
    render(<App />, root);
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));

    const select = root.querySelector<HTMLSelectElement>('#panel-display select')!;
    select.value = 'de';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));

    // Control: the change did reach the worker, or no message would prove nothing.
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'settings.set' }));
    const live = [...root.querySelectorAll('[role=status]')].map((e) => e.textContent).join(' ');
    expect(live).toContain('Not saved: your lists are too long for browser sync.');
    render(null, root);
  });
});
