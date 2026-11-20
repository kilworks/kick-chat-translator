import { afterEach, describe, expect, it } from 'vitest';
import { endonymFor, fillLangMenu, makeLangMenu, matchesQuery } from './langMenu';
import { setUiLocale } from '~/shared/languages';

// P3-1: each language also under its own name (Deutsch, 日本語), and a filter
// that finds the localised name, that name and the ISO code.

afterEach(() => {
  setUiLocale(undefined);
  document.body.innerHTML = '';
});

const open = (locale: string): HTMLElement => {
  setUiLocale(locale);
  const menu = makeLangMenu('kt-test-menu');
  document.body.appendChild(menu);
  fillLangMenu(menu, { code: 'auto', favorites: [] }, { onPick: () => {}, onAuto: () => {} }, () => {});
  return menu;
};
const row = (menu: HTMLElement, code: string) => menu.querySelector<HTMLElement>(`.kt-lang-row[data-code="${code}"]`)!;
const filter = (menu: HTMLElement, q: string): string[] => {
  const input = menu.querySelector<HTMLInputElement>('.kt-lang-input')!;
  input.value = q;
  input.dispatchEvent(new Event('input'));
  return [...menu.querySelectorAll<HTMLElement>('.kt-lang-row')].filter((r) => !r.hidden).map((r) => r.dataset.code!);
};

describe('endonymFor', () => {
  it('gives the own name when it differs', () => {
    expect(endonymFor('German', 'Deutsch')).toBe('Deutsch');
    expect(endonymFor('ドイツ語', 'Deutsch')).toBe('Deutsch');
  });

  // A row that says "Deutsch / Deutsch" repeats itself; case and accents alone
  // ("français" against "Français") are the same word too.
  it('gives nothing when the two are the same word', () => {
    expect(endonymFor('Deutsch', 'Deutsch')).toBeUndefined();
    expect(endonymFor('français', 'Français')).toBeUndefined();
    expect(endonymFor('German', undefined)).toBeUndefined();
  });
});

describe('matchesQuery with the own name', () => {
  it('finds a language by its own name', () => {
    expect(matchesQuery('ドイツ語', 'de', 'deutsch', 'Deutsch')).toBe(true);
  });

  it('still finds by localised name and code, and rejects the rest', () => {
    expect(matchesQuery('ドイツ語', 'de', 'ドイツ', 'Deutsch')).toBe(true);
    expect(matchesQuery('ドイツ語', 'de', 'de', 'Deutsch')).toBe(true);
    expect(matchesQuery('ドイツ語', 'de', 'zzz', 'Deutsch')).toBe(false);
  });
});

describe('the language panel shows and searches the own name', () => {
  it('prints the own name under the localised one in a Japanese interface', () => {
    const menu = open('ja');
    const de = row(menu, 'de');
    expect(de.querySelector('.kt-lang-name')!.textContent).not.toBe('Deutsch');
    const own = de.querySelector<HTMLElement>('.kt-lang-native')!;
    expect(own.textContent).toBe('Deutsch');
    expect(own.lang).toBe('de');
    expect(de.title).toContain('Deutsch');
  });

  // Control: the row in the interface's own language does not repeat itself.
  it('adds nothing where the two names are one', () => {
    const menu = open('de');
    expect(row(menu, 'de').querySelector('.kt-lang-native')).toBeNull();
    expect(row(menu, 'ja').querySelector('.kt-lang-native')!.textContent).toBe('日本語');
  });

  it('filters on the own name, the localised name and the code', () => {
    const menu = open('ja');
    expect(filter(menu, 'Deutsch')).toEqual(['de']);
    expect(filter(menu, 'ドイツ')).toEqual(['de']);
    expect(filter(menu, 'pt-br')).toEqual(['pt-br']);
  });
});

// Arabic, Hebrew and Persian own names sat against the far edge of their cell
// in a left-to-right list: dir=auto was on the box. The box keeps the list's
// direction; only the text inside runs right to left.
describe('right-to-left own names', () => {
  it('isolates the text, not the box that aligns it', async () => {
    const { isolated } = await import('./langMenu');
    const el = isolated('العربية');
    expect(el.tagName).toBe('BDI');
    expect(el.dir).toBe('auto');
    expect(el.textContent).toBe('العربية');
  });
});
