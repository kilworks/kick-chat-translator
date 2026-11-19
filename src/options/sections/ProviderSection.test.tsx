import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { defaultSettings } from '~/shared/settings';
import type { Settings } from '~/shared/settings';

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
