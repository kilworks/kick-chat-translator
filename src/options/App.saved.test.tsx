import { render } from 'preact';
import { defaultSettings } from '~/shared/settings';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** "saved" sat outside any live region, so a screen reader never heard a change land. */
vi.mock('~/shared/messages', () => ({
  send: vi.fn(async (m: { type: string }) =>
    m.type === 'settings.get' || m.type === 'settings.set'
      ? { type: 'settings', payload: defaultSettings() }
      : { type: 'none' },
  ),
}));
const { App } = await import('./App');

afterEach(() => {
  document.body.textContent = '';
  vi.unstubAllGlobals();
});

describe('a save that went through', () => {
  it('lands in a live region that was already on the page', async () => {
    vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '0.0.0' }) } });
    history.replaceState(null, '', '/#display');
    const root = document.createElement('div');
    document.body.append(root);
    render(<App />, root);
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    const saved = [...root.querySelectorAll('[role=status]')].find((e) => e.classList.contains('text-kick-primary'))!;
    expect(saved, 'the region exists before anything is saved').toBeTruthy();
    expect(saved.textContent).toBe('');

    const select = root.querySelector<HTMLSelectElement>('#panel-display select')!;
    select.value = 'de';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    expect(saved.textContent).toBe('saved');
    render(null, root);
  });
});
