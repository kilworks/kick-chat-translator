import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { EngineCard, chipView } from './EngineCard';
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

describe('plain words (P2-7, P2-8)', () => {
  afterEach(() => {
    delete (self as unknown as { Translator?: unknown }).Translator;
  });

  it('explains on-device without jargon and without tiny text', () => {
    (self as unknown as { Translator?: unknown }).Translator = { availability: async () => 'available' };
    mount({ localEnabled: true, engineMode: 'cloud-first' });
    const text = host!.textContent ?? '';
    expect(text).not.toMatch(/Chromium|rate-limit|models/i);
    expect(text).toContain('on your computer');
    expect(host!.innerHTML).not.toMatch(/text-\[(9|10|11)px\]/);
  });

  it('promises nothing local where the browser has no on-device engine', () => {
    mount({ localEnabled: false, engineMode: 'cloud-first' });
    const text = host!.textContent ?? '';
    expect(text).not.toContain('download');
    expect(text).toContain('cloud engines translate everything');
  });
});

describe('download chips group', () => {
  it('names the group instead of an orphan label', () => {
    (self as unknown as { Translator?: unknown }).Translator = { availability: async () => 'available' };
    mount({});
    const g = host!.querySelector('[role=group]')!;
    const name = host!.querySelector(`#${CSS.escape(g.getAttribute('aria-labelledby')!)}`);
    expect(name?.textContent).toContain('Download languages');
    expect([...host!.querySelectorAll('label')].some((l) => l.textContent?.includes('Download languages'))).toBe(false);
    delete (self as unknown as { Translator?: unknown }).Translator;
  });
});

describe('download chips', () => {
  const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const chip = (code: string) => host!.querySelector<HTMLButtonElement>(`[role=group] button[aria-label*="${code}"]`);
  let asked: string[] = [];
  let created = 0;

  beforeEach(() => {
    asked = [];
    created = 0;
    (self as unknown as { Translator?: unknown }).Translator = {
      availability: async (o: { sourceLanguage: string; targetLanguage: string }) => {
        asked.push(o.targetLanguage);
        return o.sourceLanguage === 'ko' ? 'unavailable' : o.sourceLanguage === 'es' ? 'available' : 'downloadable';
      },
      create: async () => {
        created++;
        return { translate: async (s: string) => s };
      },
    };
  });
  afterEach(() => {
    delete (self as unknown as { Translator?: unknown }).Translator;
  });

  // "Download languages -> AUTO" printed the sentinel, and the API was asked
  // for a model into "auto", which is no language.
  it('resolves an auto target to a language, in the heading and in the probe', async () => {
    mount({ targetLang: 'auto' });
    await flush();
    const heading = host!.querySelector(`#${CSS.escape(host!.querySelector('[role=group]')!.getAttribute('aria-labelledby')!)}`)!;
    expect(heading.textContent).not.toMatch(/auto/i);
    expect(heading.textContent).toContain('English');
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((l) => l === 'en')).toBe(true);
  });

  it('names each chip by its language and what a press does', async () => {
    mount({ targetLang: 'en' });
    await flush();
    const ja = chip('Japanese')!;
    expect(ja.getAttribute('aria-label')).toBe('Download Japanese');
    expect(ja.textContent).toContain('Japanese');
    expect(ja.hasAttribute('aria-disabled')).toBe(false);
    expect(ja.querySelector('use')!.getAttribute('href')).toBe('#i-eng-download');
  });

  it('marks an unavailable pair without relying on opacity, and refuses the press', async () => {
    mount({ targetLang: 'en' });
    await flush();
    const ko = chip('Korean')!;
    expect(ko.getAttribute('aria-label')).toBe('Korean, not available');
    expect(ko.getAttribute('aria-disabled')).toBe('true');
    // A solid edge: dashed read as "empty"; the ban icon and the name carry it.
    expect(ko.className).not.toContain('border-dashed');
    expect(ko.className).not.toMatch(/\/75|opacity/);
    expect(ko.querySelector('use')!.getAttribute('href')).toBe('#i-eng-ban');
    ko.click();
    await flush();
    expect(created).toBe(0);
    expect(chip('Korean')!.getAttribute('aria-label')).toBe('Korean, not available');
  });

  it('shows a downloaded pair with a tick and keeps it focusable', async () => {
    mount({ targetLang: 'en' });
    await flush();
    const es = chip('Spanish')!;
    expect(es.getAttribute('aria-label')).toBe('Spanish, downloaded');
    expect(es.getAttribute('aria-disabled')).toBe('true');
    expect(es.disabled).toBe(false);
    expect(es.querySelector('use')!.getAttribute('href')).toBe('#i-eng-check');
  });

  // Control: a downloadable chip does reach the API, so the refusal above is real.
  it('downloads on a press of a downloadable chip', async () => {
    mount({ targetLang: 'en' });
    await flush();
    chip('Japanese')!.click();
    await flush();
    expect(created).toBe(1);
    expect(chip('Japanese')!.getAttribute('aria-label')).toBe('Japanese, downloaded');
    // Said in the live region too: a renamed button is often not spoken.
    expect(host!.querySelector('[role=status]')!.textContent).toBe('Japanese, downloaded');
  });

  it('says a failed download, visibly, and lets the chip be pressed again', async () => {
    (self as unknown as { Translator: { create: () => Promise<never> } }).Translator.create = async () => {
      throw new Error('network');
    };
    mount({ targetLang: 'en' });
    await flush();
    chip('Japanese')!.click();
    await flush();
    const status = host!.querySelector('[role=status]')!;
    expect(status.textContent).toBe('Japanese: download failed, try again');
    expect(status.className).not.toContain('sr-only');
    expect(chip('Japanese')!.getAttribute('aria-label')).toBe('Download Japanese');
  });

  // A ready chip is not a selected one: no green fill, green on the tick only.
  it('draws a downloaded chip neutral, with the green on its tick', async () => {
    mount({ targetLang: 'en' });
    await flush();
    const es = chip('Spanish')!;
    expect(es.className).not.toMatch(/bg-kick-primary/);
    expect(es.querySelector('svg')!.getAttribute('class')).toContain('text-kick-primary');
  });

  it('carries no glyph in the chip text', async () => {
    mount({ targetLang: 'en' });
    await flush();
    expect(host!.querySelector('[role=group]')!.textContent).not.toMatch(/[\u2713\u2715\u2026\u2B07]/);
  });
});

describe('chipView', () => {
  it.each([
    ['available', false, 'ready'],
    ['available', true, 'ready'],
    ['unavailable', false, 'unavailable'],
    ['downloadable', false, 'download'],
    ['downloadable', true, 'busy'],
    [undefined, false, 'download'],
    [undefined, true, 'busy'],
  ] as const)('%s busy=%s -> %s', (probe, busy, want) => {
    expect(chipView(probe, busy)).toBe(want);
  });
});
