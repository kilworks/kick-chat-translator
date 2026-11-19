import { readFileSync } from 'node:fs';
import { render } from 'preact';
import { defaultSettings } from '~/shared/settings';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The tab bar had no ARIA at all: six buttons, none announced as a tab, none
 * telling which was showing, and five Tab presses to cross it.
 *
 * Read from the source rather than mounted: App pulls the whole settings
 * pipeline through chrome.runtime, and what is asserted here is the markup
 * contract, which the source carries exactly.
 */
vi.mock('~/shared/messages', () => ({
  send: vi.fn(async (m: { type: string }) =>
    m.type === 'settings.get' ? { type: 'settings', payload: defaultSettings() } : { type: 'none' },
  ),
}));
const { App } = await import('./App');

const src = readFileSync('src/options/App.tsx', 'utf8');

describe('options tab bar', () => {
  it('declares the tablist and its tabs', () => {
    expect(src).toContain('role="tablist"');
    expect(src).toContain('role="tab"');
    expect(src).toContain('aria-selected={tab === tb.id}');
  });

  it('names the tablist, which axe requires of a landmark-like grouping', () => {
    expect(src).toMatch(/role="tablist"[\s\S]{0,120}aria-label=/);
  });

  it('binds each tab to the panel it shows, both ways', () => {
    expect(src).toContain('aria-controls={tab === tb.id ? `panel-${tb.id}` : undefined}');
    expect(src).toContain('id={`tab-${tb.id}`}');
    expect(src).toContain('id={`panel-${tab}`}');
    expect(src).toContain('aria-labelledby={`tab-${tab}`}');
  });

  it('rovs the tabindex so the bar is one tab stop', () => {
    expect(src).toContain('tabIndex={tab === tb.id ? 0 : -1}');
  });

  it('handles the four keys the pattern asks for', () => {
    const keys = src.slice(src.indexOf('function onTabKey'));
    const body = keys.slice(0, keys.indexOf('\n  }\n'));
    for (const k of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) expect(body).toContain(k);
    // Wraps rather than stopping at the ends, which is what APG specifies.
    expect(body).toContain('% TABS.length');
  });

  it('moves focus after the render, not during it', () => {
    // The tab losing focus is about to get tabIndex -1; focusing the new one
    // in the same tick lands on an element that has not rendered yet and the
    // browser drops focus to the body.
    expect(src).toMatch(/requestAnimationFrame\(\(\) => tabRefs\.current\[id\]\?\.focus\(\)\)/);
  });

  it('wraps the tabs rather than scrolling them under the Discord link', () => {
    // A scrolled-out tab kept its box under the link at 320 and 414px
    // (verify_overflow). Measured: scratchpad/p2-15/measure.mjs.
    const nav = src.match(/role="tablist"[\s\S]*?class="([^"]*)"/)![1]!;
    expect(nav.split(' ')).toContain('flex-wrap');
    expect(nav).not.toContain('overflow-x-auto');
  });

  it('keeps meaningful text at 12px or more', () => {
    expect(src).not.toMatch(/text-\[(9|10|11)px\]/);
  });
});

describe('options tab bar, mounted', () => {
  async function mountApp(): Promise<HTMLElement> {
    vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '0.0.0' }) } });
    history.replaceState(null, '', '/#filters');
    const root = document.createElement('div');
    document.body.append(root);
    render(<App />, root);
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    return root;
  }
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });
  const sel = (r: HTMLElement) => r.querySelector('[role=tab][aria-selected="true"]')!.id;

  it('mirrors ArrowRight in rtl', async () => {
    const root = await mountApp();
    const nav = root.querySelector<HTMLElement>('[role=tablist]')!;
    nav.style.direction = 'rtl';
    root.querySelector('#tab-filters')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(sel(root)).toBe('tab-display');
  });

  it('keeps ArrowRight forward in ltr', async () => {
    const root = await mountApp();
    root.querySelector('#tab-filters')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(sel(root)).toBe('tab-advanced');
  });

  it('points aria-controls only at the rendered panel, inside a main landmark', async () => {
    const root = await mountApp();
    const tabs = [...root.querySelectorAll('[role=tab]')];
    for (const tb of tabs) {
      const c = tb.getAttribute('aria-controls');
      if (tb.getAttribute('aria-selected') === 'true') expect(root.querySelector(`#${c}`)).not.toBeNull();
      else expect(c).toBeNull();
    }
    expect(root.querySelector('main > [role=tabpanel]')).not.toBeNull();
  });
});
