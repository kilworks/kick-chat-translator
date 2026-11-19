import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { EngineCard } from './EngineCard';
import { defaultSettings } from '~/shared/settings';
import type { Settings } from '~/shared/settings';

let host: HTMLDivElement | undefined;

function mount(over: Partial<Settings>) {
  host = document.createElement('div');
  document.body.appendChild(host);
  render(<EngineCard settings={{ ...defaultSettings(), ...over }} onPatch={() => {}} />, host);
  return {
    select: host.querySelector<HTMLSelectElement>('select')!,
    check: host.querySelector<HTMLInputElement>('input[type=checkbox]')!,
  };
}

afterEach(() => {
  if (host) render(null, host);
  host?.remove();
  host = undefined;
});

// The pair "on-device only" + on-device off translated nothing at all
// (engineMode.combos.test.ts). The page must not let it be made.
describe('engine switch and strategy, with the on-device API', () => {
  beforeEach(() => {
    (self as unknown as { Translator?: unknown }).Translator = {
      availability: async () => 'available',
      create: async () => ({ translate: async (s: string) => s }),
    };
  });
  afterEach(() => {
    delete (self as unknown as { Translator?: unknown }).Translator;
  });

  it('greys the strategy out, with the reason, when on-device is off', () => {
    const { select } = mount({ localEnabled: false, engineMode: 'cloud-first' });
    expect(select.disabled).toBe(true);
    expect(host!.textContent).toContain('cloud engines translate everything');
  });

  it('keeps on-device on while the strategy is on-device only', () => {
    const { check, select } = mount({ localEnabled: true, engineMode: 'local-only' });
    expect(check.disabled).toBe(true);
    expect(select.disabled).toBe(false);
  });

  it('leaves both free in the ordinary case', () => {
    const { check, select } = mount({ localEnabled: true, engineMode: 'cloud-first' });
    expect(check.disabled).toBe(false);
    expect(select.disabled).toBe(false);
  });
});

describe('without the on-device API (Firefox)', () => {
  it('changes nothing: both controls stay as they were', () => {
    const { check, select } = mount({ localEnabled: false, engineMode: 'local-only' });
    expect(check.disabled).toBe(false);
    expect(select.disabled).toBe(false);
  });
});
