import { render } from 'preact';
import { act } from 'preact/test-utils';
import { defaultSettings } from '~/shared/settings';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/shared/messages', () => ({
  send: vi.fn(async (m: { type: string }) =>
    m.type === 'settings.get' ? { type: 'settings', payload: defaultSettings() } : { type: 'none' },
  ),
}));
const { App } = await import('./App');

afterEach(() => {
  document.body.textContent = '';
  vi.unstubAllGlobals();
});

async function mounted(): Promise<HTMLElement> {
  vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '0.0.0' }) } });
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  return root;
}

describe('the interface language list', () => {
  it('tags every native name with its language, so CJK glyphs and speech come out right', async () => {
    const root = await mounted();
    await act(() => root.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click());
    const ja = [...root.querySelectorAll('[role=option]')].find((o) => o.querySelector('[lang="ja"]'));
    expect(ja).toBeTruthy();
    expect(root.querySelector('[role=option] [lang="zh-tw"]')).toBeTruthy();
  });

  it('shows a focus outline on the focused row, not only a faint tint', async () => {
    const root = await mounted();
    await act(() => root.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click());
    expect(root.querySelector('[role=option]')!.className).toContain('focus-visible:outline-2');
  });

  it('closes when focus leaves it', async () => {
    const root = await mounted();
    const box = root.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
    await act(() => box.click());
    expect(root.querySelector('[role=listbox]')).not.toBeNull();
    await act(() => {
      root.querySelector('[role=option]')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    });
    expect(root.querySelector('[role=listbox]')).toBeNull();
  });
});
