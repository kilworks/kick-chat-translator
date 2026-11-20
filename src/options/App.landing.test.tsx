import { render } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';

/**
 * Mounted rather than read from source: what is asserted is which tab a page
 * opened without a hash lands on, that a hash still picks its tab, and what
 * the interface language button draws when it is set to Auto.
 */
let settings = defaultSettings();

vi.mock('~/shared/messages', () => ({
  send: vi.fn(async (m: { type: string }) => {
    if (m.type === 'settings.get') return { type: 'settings', payload: settings };
    if (m.type === 'providers.status') return { type: 'providers', payload: [] };
    return { type: 'none' };
  }),
}));

const { App } = await import('./App');

async function mount(hash = ''): Promise<HTMLElement> {
  vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '0.0.0' }) } });
  history.replaceState(null, '', `/${hash}`);
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  return root;
}

const selected = (root: HTMLElement) => root.querySelector('[role=tab][aria-selected="true"]')?.id;

describe('options landing tab', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    settings = defaultSettings();
  });

  it('opens on Display without a hash, where the language and the look are', async () => {
    expect(selected(await mount())).toBe('tab-display');
  });

  it('still lets a hash pick the tab', async () => {
    expect(selected(await mount('#filters'))).toBe('tab-filters');
    document.body.innerHTML = '';
    expect(selected(await mount('#providers'))).toBe('tab-providers');
  });

  // The popup's allowlist line names the card and links to it, not to the top
  // of the tab where the General card sits.
  it('opens #filters-langs on Filters, at the allowlist card', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const root = await mount('#filters-langs');
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    expect(selected(root)).toBe('tab-filters');
    expect(document.activeElement?.id).toBe('filters-langs');
    expect(scrolled).toHaveBeenCalled();
  });
});

describe('interface language button', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    settings = defaultSettings();
  });

  it('shows the flag of the resolved locale in front of Auto, not an empty box', async () => {
    settings = { ...defaultSettings(), uiLang: 'auto' };
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    const root = await mount();
    const button = root.querySelector('button[aria-haspopup="listbox"]')!;
    expect(button.textContent).toContain('Auto');
    expect(button.querySelector('.kt-flag')).not.toBeNull();
  });
});
