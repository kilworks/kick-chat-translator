import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findComposerRow,
  isClipped,
  isLangChipMounted,
  localName,
  matchesQuery,
  mountLangChip,
  unmountLangChip,
  updateLangChip,
} from './langChip';
import type { ChipState } from './langChip';
import { withFavorite } from '~/shared/languages';
import { FAVORITE_LANGS_MAX } from '~/shared/constants';

/** A message box shaped like Kick's: a wide short row holding several children. */
function makeComposerRow(): { row: HTMLElement; composer: HTMLElement } {
  document.body.innerHTML = '';
  const row = document.createElement('div');
  const shield = document.createElement('span');
  const composer = document.createElement('div');
  composer.setAttribute('contenteditable', 'true');
  const emote = document.createElement('span');
  row.append(shield, composer, emote);
  document.body.appendChild(row);

  // happy-dom reports zero boxes, so the row's shape has to be declared.
  row.getBoundingClientRect = () => ({ width: 320, height: 40, top: 0, left: 0, right: 320, bottom: 40, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return { row, composer };
}

const state = (over: Partial<ChipState> = {}): ChipState => ({
  mode: 'auto',
  code: 'ko',
  favorites: [],
  ...over,
});

const noop = { onPick: () => {}, onAuto: () => {} };

beforeEach(() => {
  unmountLangChip();
  document.body.innerHTML = '';
});

describe('findComposerRow', () => {
  it('walks up to the row that holds the input, not the input itself', () => {
    const { row, composer } = makeComposerRow();
    expect(findComposerRow(composer)).toBe(row);
  });

  // A column-shaped or single-child ancestor is not the row; without this the
  // chip lands in a wrapper and drifts away from the text field.
  it('falls back to the direct parent when no row-shaped ancestor exists', () => {
    document.body.innerHTML = '';
    const wrapper = document.createElement('div');
    const composer = document.createElement('div');
    wrapper.appendChild(composer);
    document.body.appendChild(wrapper);
    wrapper.getBoundingClientRect = () => ({ width: 300, height: 300 }) as DOMRect;
    expect(findComposerRow(composer)).toBe(wrapper);
  });
});

describe('mounting', () => {
  it('puts the chip inside the message box row', () => {
    const { row, composer } = makeComposerRow();
    mountLangChip(composer, state(), noop);
    expect(row.querySelector('#kt-lang-chip')).not.toBeNull();
    expect(isLangChipMounted()).toBe(true);
  });

  it('does not mount twice', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state(), noop);
    mountLangChip(composer, state(), noop);
    expect(document.querySelectorAll('#kt-lang-chip')).toHaveLength(1);
  });

  it('removes everything it added on unmount', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state(), noop);
    unmountLangChip();
    expect(document.querySelector('#kt-lang-chip')).toBeNull();
    expect(document.querySelector('.kt-chip-host')).toBeNull();
    expect(isLangChipMounted()).toBe(false);
  });

  // Control: a stale chip left by a re-render must not be reported as mounted.
  it('reports not mounted once the node is gone from the document', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state(), noop);
    document.body.innerHTML = '';
    expect(isLangChipMounted()).toBe(false);
  });
});

describe('states', () => {
  const read = () => document.querySelector<HTMLElement>('#kt-lang-chip')!;

  // Lit le creneau du code et non le texte de toute la puce : celle-ci porte
  // aussi une fleche de sens, qui est decorative et aria-hidden. Mesurer le
  // parent faisait de ce test l'assertion "la puce ne contient rien d'autre",
  // ce qu'il n'a jamais voulu dire.
  it('shows the ISO code when a language is pinned', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ mode: 'pinned', code: 'fr' }), noop);
    expect(read().querySelector('.kt-chip-tag')!.textContent).toBe('FR');
    expect(read().dataset.mode).toBe('pinned');
  });

  // Le drapeau que la puce n'avait pas : la feuille en dessine 43 et seul le
  // selecteur s'en servait.
  it('draws the flag of the pinned language beside the code', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ mode: 'pinned', code: 'fr' }), noop);
    const flag = read().querySelector<HTMLElement>('.kt-chip-flag')!;
    // The drawing is a child of the slot, never classes on it: see flagEl.
    expect(flag.querySelector('.kt-flag.kt-flag-fr')).not.toBeNull();
    expect(flag.className).toBe('kt-chip-flag');
    expect(flag.hidden).toBe(false);
  });

  // Pause, chargement et erreur ne sont pas des langues : un drapeau y serait
  // celui de la langue d'avant, qui n'est plus ce que la puce raconte.
  it('hides that flag in the states that are not a language', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ mode: 'off', code: 'fr' }), noop);
    expect(read().querySelector<HTMLElement>('.kt-chip-flag')!.hidden).toBe(true);
  });

  it('carries every mode onto the element', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state(), noop);
    for (const mode of ['auto', 'pinned', 'off', 'loading', 'error'] as const) {
      updateLangChip(state({ mode, code: 'fr' }));
      expect(read().dataset.mode).toBe(mode);
    }
  });

  it('always carries an accessible name', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ mode: 'pinned', code: 'fr' }), noop);
    expect(read().getAttribute('aria-label')).toBeTruthy();
  });
});

describe('interaction', () => {
  // A favourite used to change what a click did: with one, the click toggled
  // the language and only the caret opened the list. That split is gone, so the
  // presence of a favourite must not change the outcome any more.
  it('a click opens the list even when a favourite exists', () => {
    const { composer } = makeComposerRow();
    const onPick = vi.fn();
    mountLangChip(composer, state({ mode: 'auto', favorites: ['fr'] }), { onPick, onAuto: () => {} });
    const chip = document.querySelector<HTMLElement>('#kt-lang-chip')!;
    chip.click();
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('a click on a pinned chip opens the list as well', () => {
    const { composer } = makeComposerRow();
    const onAuto = vi.fn();
    mountLangChip(composer, state({ mode: 'pinned', code: 'fr', favorites: ['fr'] }), { onPick: () => {}, onAuto });
    const chip = document.querySelector<HTMLElement>('#kt-lang-chip')!;
    chip.click();
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(onAuto).not.toHaveBeenCalled();
  });

  // With nothing pinned there is no sensible toggle target, so the click has to
  // open the list instead of doing nothing.
  it('opens the list when there is no favourite yet', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ mode: 'auto', favorites: [] }), noop);
    document.querySelector<HTMLElement>('#kt-lang-chip')!.click();
    expect(document.querySelector<HTMLElement>('#kt-lang-menu')!.hidden).toBe(false);
  });

  it('does nothing at all while translation is paused', () => {
    const { composer } = makeComposerRow();
    const onPick = vi.fn();
    const onAuto = vi.fn();
    mountLangChip(composer, state({ mode: 'off', favorites: ['fr'] }), { onPick, onAuto });
    document.querySelector<HTMLElement>('#kt-lang-chip')!.click();
    expect(onPick).not.toHaveBeenCalled();
    expect(onAuto).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLElement>('#kt-lang-menu')!.hidden).toBe(true);
  });

  it('the Down arrow opens the list', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state(), noop);
    const chip = document.querySelector<HTMLElement>('#kt-lang-chip')!;
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.querySelector<HTMLElement>('#kt-lang-menu')!.hidden).toBe(false);
  });

  it('Escape closes the list and hands focus back to the chip', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state(), noop);
    const chip = document.querySelector<HTMLElement>('#kt-lang-chip')!;
    const menu = document.querySelector<HTMLElement>('#kt-lang-menu')!;
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(chip);
  });

  it('lists the favourites above the full catalogue', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ favorites: ['fr', 'ja'] }), noop);
    document.querySelector<HTMLElement>('#kt-lang-chip')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    const groups = Array.from(document.querySelectorAll<HTMLElement>('.kt-chip-row')).map(
      (r) => r.dataset.group,
    );
    expect(groups.slice(0, 3)).toEqual(['auto', 'fav', 'fav']);
    expect(groups).toContain('all');
  });

  it('Down from a lone favourite lands on the first language of the full list', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ favorites: ['fr'] }), noop);
    document.querySelector<HTMLElement>('#kt-lang-chip')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    const menu = document.querySelector<HTMLElement>('#kt-lang-menu')!;
    menu.querySelector<HTMLElement>('.kt-chip-row[data-group="fav"]')!.focus();
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(menu.querySelector('.kt-chip-row[data-group="all"]'));
  });

  it('Down from a tile focused without the keyboard keeps that tile s column', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ favorites: ['ja', 'es', 'pt'] }), noop);
    document.querySelector<HTMLElement>('#kt-lang-chip')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    const menu = document.querySelector<HTMLElement>('#kt-lang-menu')!;
    const rows = [...menu.querySelectorAll<HTMLElement>('.kt-chip-row:not([hidden])')];
    // auto | ja es pt | 4 5 6 | 7 8 9: tile 6 is the third column.
    rows[6]!.focus();
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(rows.indexOf(document.activeElement as HTMLElement)).toBe(9);
  });

  it('a language never appears twice, favourite or not', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ favorites: ['fr'] }), noop);
    document.querySelector<HTMLElement>('#kt-lang-chip')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    const codes = Array.from(document.querySelectorAll<HTMLElement>('.kt-chip-row')).map(
      (r) => r.dataset.code,
    );
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('localName', () => {
  it('gives the language its name rather than an ISO code', () => {
    // The bug this exists for: the list rendered in English whatever the
    // interface language was.
    expect(localName('fr', 'Français')).toMatch(/\p{L}/u);
  });

  it('falls back to the native name for a code nothing recognises', () => {
    // `zzzz` est malforme et fait lever le moteur sur certains runtimes
    // seulement ; `xx` est bien forme et simplement inconnu, ce qui est le cas
    // qu'un lecteur rencontre. Les deux doivent rendre le nom natif.
    expect(localName('zzzz', 'Fallback')).toBe('Fallback');
    expect(localName('xx', 'Fallback')).toBe('Fallback');
  });
});

describe('withFavorite', () => {
  it('puts the newest pick first', () => {
    expect(withFavorite(['fr', 'en'], 'ja')).toEqual(['ja', 'fr', 'en']);
  });

  it('moves an existing favourite up instead of duplicating it', () => {
    expect(withFavorite(['fr', 'en'], 'en')).toEqual(['en', 'fr']);
  });

  it('never grows past the cap', () => {
    const many = withFavorite(['fr', 'en', 'es', 'ja'], 'ko');
    expect(many).toHaveLength(FAVORITE_LANGS_MAX);
    expect(many[0]).toBe('ko');
  });

  it('ignores a code that is not a supported language', () => {
    expect(withFavorite(['fr'], 'zzzz')).toEqual(['fr']);
  });
});

describe('clipping', () => {
  it('does not switch to viewport coordinates when nothing clips', () => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state(), noop);
    const chip = document.querySelector<HTMLElement>('#kt-lang-chip')!;
    expect(isClipped(chip)).toBe(false);
  });

  // Control: the detection must actually fire, otherwise the escape hatch is
  // dead code that never runs where it is needed.
  it('detects an ancestor that would slice the list in half', () => {
    const { row, composer } = makeComposerRow();
    row.style.overflow = 'hidden';
    mountLangChip(composer, state(), noop);
    const chip = document.querySelector<HTMLElement>('#kt-lang-chip')!;
    expect(isClipped(chip)).toBe(true);
  });
});

describe('filtering — 42 languages must never need a scrollbar', () => {
  const openList = (favorites: string[] = []) => {
    const { composer } = makeComposerRow();
    mountLangChip(composer, state({ favorites }), noop);
    document.querySelector<HTMLElement>('#kt-lang-chip')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    return document.querySelector<HTMLInputElement>('.kt-chip-search')!;
  };
  const visible = () =>
    Array.from(document.querySelectorAll<HTMLElement>('.kt-chip-row')).filter((r) => !r.hidden);

  it('opens with the filter focused, so typing just works', () => {
    const search = openList();
    expect(document.activeElement).toBe(search);
  });

  it('narrows the list as you type', () => {
    const search = openList();
    const before = visible().length;
    search.value = 'fr';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const after = visible().length;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  it('matches the ISO code, which is what a non-English reader types', () => {
    const search = openList();
    search.value = 'ja';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(visible().some((r) => r.dataset.code === 'ja')).toBe(true);
  });

  it('says so when nothing matches, instead of showing an empty box', () => {
    const search = openList();
    search.value = 'zzzzzz';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(visible()).toHaveLength(0);
    expect(document.querySelector<HTMLElement>('.kt-chip-empty')!.hidden).toBe(false);
  });

  it('Enter takes the first remaining match', () => {
    const { composer } = makeComposerRow();
    const onPick = vi.fn();
    mountLangChip(composer, state(), { onPick, onAuto: () => {} });
    document.querySelector<HTMLElement>('#kt-lang-chip')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    const search = document.querySelector<HTMLInputElement>('.kt-chip-search')!;
    search.value = 'japan';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onPick).toHaveBeenCalled();
  });
});

describe('matchesQuery', () => {
  it('ignores accents in either direction', () => {
    expect(matchesQuery('français', 'fr', 'francais')).toBe(true);
    expect(matchesQuery('francais', 'fr', 'français')).toBe(true);
  });

  it('matches on the ISO code as well as the name', () => {
    expect(matchesQuery('フランス語', 'fr', 'fr')).toBe(true);
  });

  it('an empty query keeps everything', () => {
    expect(matchesQuery('anything', 'xx', '   ')).toBe(true);
  });

  // Control: it must actually reject, or the filter is decorative.
  it('rejects what does not match', () => {
    expect(matchesQuery('français', 'fr', 'zzz')).toBe(false);
  });
});

describe('anchoring, against the DOM actually measured on kick.com', () => {
  const box = (w: number, h: number, x: number, y: number) => () =>
    ({ width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, x, y, toJSON: () => ({}) }) as DOMRect;

  /**
   * Read off a live channel:
   *   block   380x77 @1520,818   the composer's block
   *     field 293x46 @1565,820
   *   bar     380x36 @1520,847   sibling of the block
   *     left  280x36 @1520,847   the kicks counter
   *     right 100x36 @1800,847   gear + send  <- the chip belongs here
   */
  function liveDom() {
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    const block = document.createElement('div');
    const field = document.createElement('div');
    const bar = document.createElement('div');
    const left = document.createElement('div');
    const right = document.createElement('div');
    const gear = document.createElement('button');
    const send = document.createElement('button');
    field.setAttribute('contenteditable', 'true');
    block.appendChild(field);
    left.appendChild(document.createElement('button'));
    right.append(gear, send);
    bar.append(left, right);
    wrap.append(block, bar);
    document.body.appendChild(wrap);

    block.getBoundingClientRect = box(380, 77, 1520, 818);
    field.getBoundingClientRect = box(293, 46, 1565, 820);
    bar.getBoundingClientRect = box(380, 36, 1520, 847);
    left.getBoundingClientRect = box(280, 36, 1520, 847);
    right.getBoundingClientRect = box(100, 36, 1800, 847);
    gear.getBoundingClientRect = box(36, 36, 1800, 847);
    send.getBoundingClientRect = box(60, 36, 1840, 847);
    return { wrap, block, field, bar, left, right, gear };
  }

  it('anchors in the action bar right cluster, not in the message box', () => {
    const { right, field } = liveDom();
    expect(findComposerRow(field)).toBe(right);
  });

  it('puts the chip before the gear', () => {
    const { right, field, gear } = liveDom();
    mountLangChip(field, state(), noop);
    const host = right.querySelector('.kt-chip-host')!;
    expect(host.nextElementSibling).toBe(gear);
    expect(right.firstElementChild).toBe(host);
  });

  // The regression this exists for: the chip used to land inside the composer's
  // own block, which put it 49px below the message box on a live page.
  it('never mounts inside the composer block', () => {
    const { block, field } = liveDom();
    mountLangChip(field, state(), noop);
    expect(block.querySelector('.kt-chip-host')).toBeNull();
  });

  it('falls back to the composer parent when there is no action bar', () => {
    document.body.innerHTML = '';
    const parent = document.createElement('div');
    const field = document.createElement('div');
    field.setAttribute('contenteditable', 'true');
    parent.appendChild(field);
    document.body.appendChild(parent);
    expect(findComposerRow(field)).toBe(parent);
  });
});

/**
 * The caret splits one button in two.
 *
 * Before it, the 42-language list opened on a 400ms press or the Down arrow and
 * on nothing else. Neither is visible, so the list was reachable only by
 * someone who had read the tooltip; measured on the action bar, a second button
 * beside the chip did not fit (28px of slack at the narrow end, 24 plus a gap
 * owed under WCAG 2.5.8), so the caret is a region of the chip instead.
 *
 * Both halves are asserted here. A caret that opens the list and also swallows
 * the click on the code would satisfy a test that only watched the caret, while
 * removing the one-click language toggle the chip exists for.
 */
describe('the caret half of the chip', () => {
  const mount = (over: Partial<ChipState> = {}) => {
    const { composer } = makeComposerRow();
    const picks: string[] = [];
    mountLangChip(composer, state({ mode: 'pinned', code: 'ja', favorites: ['ja', 'es'], ...over }), {
      onPick: (c) => picks.push(c),
      onAuto: () => picks.push('auto'),
    });
    const chip = document.querySelector<HTMLElement>('.kt-chip')!;
    return { chip, picks, caret: chip.querySelector<HTMLElement>('.kt-chip-caret')! };
  };

  it('is drawn on the chip, and hidden from the accessibility tree', () => {
    const { caret } = mount();
    expect(caret).not.toBeNull();
    const svg = caret.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    // Focusable SVG is an IE-era default that still puts a stop in the tab
    // order in some engines; the chip is the one tab stop here.
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('opens the list when it is the thing clicked', () => {
    const { chip, caret, picks } = mount();
    caret.querySelector('svg')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(picks, 'the caret must not also change the language').toEqual([]);
  });

  it('closes it again on a second click, rather than reopening under itself', () => {
    const { chip, caret } = mount();
    caret.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    caret.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(chip.getAttribute('aria-expanded')).toBe('false');
  });

  // Control, and the defect it replaces. This asserted the opposite: that a
  // click landing on the code toggled the language and left the list shut. That
  // is what made the list reachable only through a caret about 12px wide, or a
  // 400ms hold no pointer advertises. A click has to reach the list from the
  // code half too, or the caret tests above pass on a chip nobody can open.
  it('opens the list from the code half, not only from the caret', () => {
    const { chip, picks } = mount();
    chip.querySelector<HTMLElement>('.kt-chip-tag')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(picks).toEqual([]);
  });

  // 'off' means translation is paused: nothing on the chip does anything, and
  // the caret is not an exception carved out of that.
  it('stays inert while translation is off', () => {
    const { chip, caret, picks } = mount({ mode: 'off' });
    caret.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(picks).toEqual([]);
  });
});
