import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { defaultSettings } from '~/shared/settings';
import type { Settings } from '~/shared/settings';
import type { ProviderStatus } from '~/shared/types';

vi.mock('~/shared/messages', () => ({ send: async () => ({ type: 'ok' }) }));
const { ProviderSection } = await import('./ProviderSection');

let host: HTMLDivElement | undefined;

function mount(over: Partial<Settings>) {
  host = document.createElement('div');
  document.body.appendChild(host);
  render(<ProviderSection settings={{ ...defaultSettings(), ...over }} providers={[]} onPatch={() => {}} />, host);
  return host;
}

afterEach(() => {
  if (host) render(null, host);
  host?.remove();
  host = undefined;
  delete (self as unknown as { Translator?: unknown }).Translator;
});

const withLocal = () => {
  (self as unknown as { Translator?: unknown }).Translator = { availability: async () => 'available' };
};

describe('the cloud list says what it is for', () => {
  it('cloud first (the default): tried first, not "used when on-device is off"', () => {
    withLocal();
    const el = mount({ engineMode: 'cloud-first', localEnabled: true });
    expect(el.textContent).toContain('Tried first, in this order');
    expect(el.textContent).not.toContain('Used when on-device is off');
  });

  it('on-device first: the fallback', () => {
    withLocal();
    expect(mount({ engineMode: 'local-first', localEnabled: true }).textContent).toContain(
      'Used when on-device cannot translate a line',
    );
  });

  it('on-device only: not used, and the list is greyed out', () => {
    withLocal();
    const el = mount({ engineMode: 'local-only', localEnabled: true });
    expect(el.textContent).toContain('Not used');
    expect(el.querySelector('fieldset')?.disabled).toBe(true);
  });

  it('no on-device engine at all: plainly the only engines', () => {
    expect(mount({ engineMode: 'cloud-first', localEnabled: true }).textContent).toContain(
      'Tried in this order. One that fails',
    );
  });
});

describe('provider facts', () => {
  it('names Lingva for what it is, and claims no DeepL figure', () => {
    const el = mount({ providerOrder: ['lingva'] });
    expect(el.textContent).toContain('Lingva (Google Translate front end');
    expect(el.textContent).not.toContain('LibreTranslate');
    expect(el.textContent).not.toContain('1,000,000');
  });
});

function mountFull(over: Partial<Settings>, providers: ProviderStatus[] = [], onPatch: (p: Partial<Settings>) => void = () => {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  render(<ProviderSection settings={{ ...defaultSettings(), ...over }} providers={providers} onPatch={onPatch} />, host);
  return host;
}

const rowOf = (el: HTMLElement, name: string) =>
  [...el.querySelectorAll('li')].find((li) => li.textContent?.includes(name))!;

describe('provider rows (P2-10)', () => {
  it('says the state in words, with the time back and the reason', () => {
    const el = mountFull({ providerOrder: ['google', 'mymemory'] }, [
      { id: 'google', available: true, cooldownLeftSec: 0 },
      { id: 'mymemory', available: false, cooldownLeftSec: 90, lastError: 'HTTP 429' },
    ]);
    expect(rowOf(el, 'Google').textContent).toContain('Ready');
    const paused = rowOf(el, 'MyMemory');
    expect(paused.textContent).toContain('Paused, back in 2 min');
    expect(paused.querySelector('[title="HTTP 429"]')).not.toBeNull();
    expect(el.textContent).not.toMatch(/\b(ok|down)\b/i);
  });

  it('shows the pause reason as text, not only a title', () => {
    const el = mountFull({ providerOrder: ['mymemory'] }, [
      { id: 'mymemory', available: false, cooldownLeftSec: 90, lastError: 'HTTP 429' },
    ]);
    expect(rowOf(el, 'MyMemory').textContent).toContain('HTTP 429');
  });

  it('keeps keyboard focus on the pressed arrow after a move', async () => {
    const { act } = await import('preact/test-utils');
    const order: Settings['providerOrder'] = ['google', 'mymemory', 'lingva'];
    const el = mountFull({ providerOrder: order }, [], () => {});
    const up = () => rowOf(el, 'MyMemory').querySelector<HTMLButtonElement>('button[aria-label^="Move up"]')!;
    up().focus();
    up().click();
    void act(() => {
      render(
        <ProviderSection settings={{ ...defaultSettings(), providerOrder: ['mymemory', 'google', 'lingva'] }} providers={[]} onPatch={() => {}} />,
        el,
      );
    });
    // MyMemory is now first: its up arrow is the dead end, and must still hold focus.
    expect(document.activeElement).toBe(up());
    expect(up().getAttribute('aria-disabled')).toBe('true');
  });

  it('disables up on the first row and down on the last', () => {
    const el = mountFull({ providerOrder: ['google', 'mymemory', 'lingva'] });
    const up = (n: string) => rowOf(el, n).querySelector<HTMLButtonElement>('button[aria-label^="Move up"]')!;
    const down = (n: string) => rowOf(el, n).querySelector<HTMLButtonElement>('button[aria-label^="Move down"]')!;
    // aria-disabled, not disabled: a disabled button drops keyboard focus.
    const dead = (b: HTMLButtonElement) => b.getAttribute('aria-disabled') === 'true';
    expect(dead(up('Google'))).toBe(true);
    expect(dead(down('Google'))).toBe(false);
    expect(dead(up('Lingva'))).toBe(false);
    expect(dead(down('Lingva'))).toBe(true);
    expect(up('Google').disabled).toBe(false);
  });

  it('a removed provider comes back in the add list', () => {
    let patched: Partial<Settings> = {};
    const el = mountFull({ providerOrder: ['google', 'mymemory'] }, [], (p) => (patched = p));
    rowOf(el, 'MyMemory').querySelector<HTMLButtonElement>('button[aria-label^="Remove"]')!.click();
    expect(patched.providerOrder).toEqual(['google']);
    render(null, el);
    const again = mountFull({ providerOrder: patched.providerOrder });
    const adds = [...again.querySelectorAll('button')].map((b) => b.textContent ?? '');
    expect(adds.some((s) => s.startsWith('+') && s.includes('MyMemory'))).toBe(true);
  });

  it('draws arrows and remove as kit icons, not text glyphs', () => {
    const el = mountFull({ providerOrder: ['google', 'mymemory'] });
    const row = rowOf(el, 'Google');
    for (const name of ['chevron-up', 'chevron-down', 'x']) {
      expect(row.querySelector(`use[href="#i-${name}"]`)).not.toBeNull();
      expect(el.querySelector(`symbol#i-${name}`)).not.toBeNull();
    }
    expect(row.textContent).not.toMatch(/[↑↓✕]/);
  });
});

describe('DeepL card (P2-11)', () => {
  const hasCard = (el: HTMLElement) => [...el.querySelectorAll('h2')].some((h) => h.textContent === 'DeepL');

  it('stays hidden while DeepL is not in the chain and has no key', () => {
    expect(hasCard(mountFull({ providerOrder: ['google'], deeplApiKey: '' }))).toBe(false);
  });
  it('shows once DeepL is in the chain', () => {
    expect(hasCard(mountFull({ providerOrder: ['google', 'deepl'], deeplApiKey: '' }))).toBe(true);
  });
  it('shows when a key exists, even out of the chain', () => {
    expect(hasCard(mountFull({ providerOrder: ['google'], deeplApiKey: 'abc:fx' }))).toBe(true);
  });

  it('stays mounted while the key is cleared', async () => {
    const { act } = await import('preact/test-utils');
    const el = mountFull({ providerOrder: ['google'], deeplApiKey: 'a' });
    const input = el.querySelector<HTMLInputElement>('input[aria-label="API key"]')!;
    input.focus();
    void act(() => {
      render(<ProviderSection settings={{ ...defaultSettings(), providerOrder: ['google'], deeplApiKey: '' }} providers={[]} onPatch={() => {}} />, el);
    });
    expect(hasCard(el)).toBe(true);
    expect(el.querySelector('input[aria-label="API key"]')).toBe(input);
    expect(document.activeElement).toBe(input);
  });

  it('ties the API key and Plan labels to their fields', () => {
    const el = mountFull({ providerOrder: ['deepl'], deeplApiKey: 'abc:fx' });
    for (const name of ['API key', 'Plan']) {
      const lab = [...el.querySelectorAll('label')].find((l) => l.textContent === name)!;
      expect(lab.htmlFor).toBeTruthy();
      expect(el.querySelector(`#${CSS.escape(lab.htmlFor)}`)).not.toBeNull();
    }
  });

  it('masks the key by default, with a show toggle', async () => {
    const { act } = await import('preact/test-utils');
    const el = mountFull({ providerOrder: ['deepl'], deeplApiKey: 'abc:fx' });
    const input = el.querySelector<HTMLInputElement>('input[aria-label="API key"]')!;
    const btn = el.querySelector<HTMLButtonElement>(`button[aria-controls="${CSS.escape(input.id)}"]`)!;
    expect(input.type).toBe('password');
    // The label carries the state; aria-pressed on top would read backwards.
    expect(btn.textContent).toBe('Show key');
    expect(btn.hasAttribute('aria-pressed')).toBe(false);
    void act(() => btn.click());
    expect(el.querySelector<HTMLInputElement>('input[aria-label="API key"]')!.type).toBe('text');
    expect(btn.textContent).toBe('Hide key');
    void act(() => btn.click());
    expect(el.querySelector<HTMLInputElement>('input[aria-label="API key"]')!.type).toBe('password');
    expect(btn.textContent).toBe('Show key');
  });
});

describe('readable text (P2-7, P2-8)', () => {
  it('no meaningful text under 12px', () => {
    const el = mountFull({ providerOrder: ['google', 'deepl'], deeplApiKey: 'abc:fx' }, [
      { id: 'google', available: true },
    ]);
    expect(el.innerHTML).not.toMatch(/text-\[(9|10|11)px\]/);
  });
});

// The DeepL switch was the one control on the start column of the page.
describe('one column for switches', () => {
  it('puts every switch on the end, the DeepL one included', () => {
    const el = mountFull({ providerOrder: ['deepl'], deeplApiKey: 'abc:fx' });
    const switches = [...el.querySelectorAll('.kt-switch')];
    expect(switches.some((s) => s.textContent?.includes('Save DeepL'))).toBe(true);
    for (const s of switches) expect(s.hasAttribute('data-reverse'), s.textContent ?? '').toBe(true);
  });
});
