import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { defaultSettings, type Settings } from '~/shared/settings';
import { DisplaySection } from './DisplaySection';

const SAMPLE = '¿alguien más está viendo esto?';

function mount(patch: Partial<Settings>, onPatch: (p: Partial<Settings>) => void = () => undefined): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  // act flushes the effect synchronously for a sync callback; the thenable it
  // hands back is only useful for async ones, so it is deliberately dropped.
  void act(() => {
    render(
      <DisplaySection settings={{ ...defaultSettings(), ...patch }} onPatch={onPatch} />,
      root,
    );
  });
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('kt-hide-original');
});

// The preview is built by the content script's own inject(), so the class it ends
// up with is the same one a real chat line would get. Picking a style has to move
// that class, otherwise the preview is decoration rather than an answer to "what
// does this style look like".
describe('display style preview', () => {
  it.each([
    ['below', 'kt-translation'],
    ['inline', 'kt-translation-inline'],
    ['replace', 'kt-translation-replace'],
  ] as const)('renders %s with the real %s class', (style, cls) => {
    const root = mount({ displayStyle: style });
    const shown = root.querySelector(`.${cls}`);
    expect(shown).not.toBeNull();
    expect(shown?.textContent).toContain('is anyone else seeing this?');
  });

  /**
   * `hover` shows nothing until you point at the line, so a preview that drew a
   * finished translation described one of the other three styles.
   *
   * "Nothing" is now literal. It used to append a green "Hover to translate"
   * under every message, worth +61% of row height measured against an untouched
   * line, so the preview has to show the absence rather than the label.
   */
  it('previews hover as the nothing it draws', () => {
    const root = mount({ displayStyle: 'hover' });
    const mark = root.querySelector('.kt-hover-armed');
    expect(mark, 'the row was never armed').not.toBeNull();
    expect(mark!.textContent, 'the marker is bookkeeping, not a label').toBe('');
    expect(
      root.querySelector('.kt-translation'),
      'a finished translation is exactly what hover does not show',
    ).toBeNull();
  });

  it('offers every value the schema accepts', () => {
    const root = mount({});
    const labels = [...root.querySelectorAll('button')].map((b) => b.textContent ?? '');
    for (const label of ['Below', 'Inline', 'Replace', 'On hover']) {
      expect(
        labels.some((l) => l.includes(label)),
        `no card for ${label}`,
      ).toBe(true);
    }
  });

  it('keeps the sample original next to the translation', () => {
    const root = mount({ displayStyle: 'below' });
    expect(root.textContent).toContain(SAMPLE);
  });

  it('shows the source badge only when that setting is on', () => {
    // .kt-src-flag since the drawn 16x12 flags took the .kt-flag name; this
    // preview renders through injector.ts, so it follows the badge's real class.
    expect(mount({ showSourceBadge: true }).querySelector('.kt-src-flag')).not.toBeNull();
    document.body.innerHTML = '';
    expect(mount({ showSourceBadge: false }).querySelector('.kt-src-flag')).toBeNull();
  });

  // The hide-original rule lives on the document root, so the preview shows what
  // the toggle does rather than describing it.
  it('follows the keep-original toggle', () => {
    mount({ showOriginal: false });
    expect(document.documentElement.classList.contains('kt-hide-original')).toBe(true);
    document.body.innerHTML = '';
    mount({ showOriginal: true });
    expect(document.documentElement.classList.contains('kt-hide-original')).toBe(false);
  });
});

/**
 * `replace` hides the original itself, so "keep original text visible" cannot
 * do anything while it is selected. Leaving the switch live would put the same
 * defect back that this style was just fixed for: a control that moves and
 * changes nothing.
 */
describe('keep-original while Replace is selected', () => {
  const keepOriginal = (root: HTMLElement) =>
    [...root.querySelectorAll('input[type=checkbox]')].find((i) =>
      (i.closest('label')?.textContent ?? '').includes('Keep original text visible'),
    ) as HTMLInputElement | undefined;

  it('turns the switch off and says why', () => {
    const root = mount({ displayStyle: 'replace' });
    const box = keepOriginal(root);
    expect(box, 'the keep-original switch was not found at all').toBeDefined();
    expect(box!.disabled).toBe(true);
    expect(root.textContent).toContain('The Replace style always hides it.');
  });

  // Control: the switch is live under the styles that do leave an original
  // standing, or the assertion above would pass on a switch that is never
  // usable at all.
  it.each(['below', 'inline'] as const)('leaves it usable under %s', (style) => {
    const root = mount({ displayStyle: style });
    expect(keepOriginal(root)!.disabled).toBe(false);
    expect(root.textContent).not.toContain('The Replace style always hides it.');
  });
});

const group = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll<HTMLElement>('[role=radiogroup]')].find(
    (g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent === name,
  );

// Three to five choices behind a <select> cost a click and hide the options.
describe('small sets are shown as choices, not dropdowns', () => {
  it.each([
    ['Font', 5],
    ['Density', 3],
    ['Chat theme', 3],
    ['Accent colour', 4],
    ['Clicking the preview', 2],
    ['Key that swaps in the translation', 2],
  ])('%s is a radio group of %i', (name, n) => {
    const root = mount({});
    const g = group(root, name);
    expect(g, `no radio group named ${name}`).toBeDefined();
    expect(g!.querySelectorAll('[role=radio]')).toHaveLength(n);
  });

  it('leaves the language pickers as the only dropdowns', () => {
    expect(mount({}).querySelectorAll('select')).toHaveLength(2);
  });

  it('names each accent swatch by its colour and reports the pick', () => {
    const onPatch = vi.fn();
    const root = mount({ accent: 'kick' }, onPatch);
    const swatches = [...group(root, 'Accent colour')!.querySelectorAll<HTMLElement>('[role=radio]')];
    expect(swatches.map((s) => s.getAttribute('aria-label'))).toEqual(['Kick green', 'Cyan', 'Violet', 'Amber']);
    swatches[2]!.click();
    expect(onPatch).toHaveBeenCalledWith({ accent: 'violet' });
  });

  it('maps the compose choices onto their stored values', () => {
    const onPatch = vi.fn();
    const root = mount({ composeInsertMode: 'insert', composeInsertKey: 'tab-and-enter' }, onPatch);
    const pick = (name: string, label: string) =>
      [...group(root, name)!.querySelectorAll<HTMLElement>('[role=radio]')].find((r) => r.textContent === label)!.click();
    pick('Clicking the preview', 'Copies it');
    expect(onPatch).toHaveBeenCalledWith({ composeInsertMode: 'copy' });
    pick('Key that swaps in the translation', 'Ctrl/Cmd+Enter only');
    expect(onPatch).toHaveBeenCalledWith({ composeInsertKey: 'ctrl-enter' });
    expect(onPatch).toHaveBeenCalledTimes(2);
  });

  it('maps the compose choices back the other way', () => {
    const onPatch = vi.fn();
    const root = mount({ composeInsertMode: 'copy', composeInsertKey: 'ctrl-enter' }, onPatch);
    const pick = (name: string, label: string) =>
      [...group(root, name)!.querySelectorAll<HTMLElement>('[role=radio]')].find((r) => r.textContent === label)!.click();
    pick('Clicking the preview', 'Puts it in the chat box');
    expect(onPatch).toHaveBeenLastCalledWith({ composeInsertMode: 'insert' });
    pick('Key that swaps in the translation', 'Tab or Ctrl/Cmd+Enter');
    expect(onPatch).toHaveBeenLastCalledWith({ composeInsertKey: 'tab-and-enter' });
    expect(onPatch).toHaveBeenCalledTimes(2);
  });
});

// The settings that change the preview sat below it and changed out of view.
describe('preview stays in view', () => {
  it('is pinned at the top of its card, above every setting it shows', () => {
    const root = mount({});
    const preview = root.querySelector<HTMLElement>('[data-kt-preview]');
    expect(preview, 'no pinned preview').not.toBeNull();
    expect(preview!.classList.contains('sticky')).toBe(true);
    expect(preview!.classList.contains('bg-kick-surface')).toBe(true);
    // No hard cut under it, and no 43% of a 400% zoom viewport.
    expect(preview!.classList.contains('border-b')).toBe(true);
    expect(preview!.classList.contains('border-kick-stroke')).toBe(true);
    expect(preview!.className).toContain('[@media(max-height:500px)]:static');
    const card = preview!.closest('section')!;
    const first = card.querySelector('button, input, select');
    expect(preview!.compareDocumentPosition(first!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('style cards state', () => {
  const cards = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLElement>('button[aria-pressed]')];

  it('presses only the chosen card and ticks it', () => {
    const root = mount({ displayStyle: 'inline' });
    const c = cards(root);
    expect(c.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);
    expect(c.map((b) => b.querySelector('use')?.getAttribute('href') ?? null)).toEqual([null, '#i-card-check', null, null]);
    expect(root.querySelector('symbol#i-card-check path')?.getAttribute('d')).toBe('M20 6 9 17l-5-5');
  });
});

describe('labels are tied to their control', () => {
  it('every label has a for that resolves to a control', () => {
    const root = mount({});
    // A switch is its own label element and needs no for.
    const labels = [...root.querySelectorAll('label:not(.kt-switch)')];
    expect(labels.length).toBeGreaterThanOrEqual(4);
    for (const l of labels) {
      const f = l.getAttribute('for');
      expect(f, l.textContent ?? '').toBeTruthy();
      expect(document.getElementById(f!)).not.toBeNull();
    }
  });
});

// Segments hugged the start while switches hugged the end (critic minor): the
// compact controls now sit on the switches' end column, label at the start.
describe('one shared column', () => {
  it('puts sliders and segmented groups on the end column, like the switches', () => {
    const root = mount({});
    const rows = [...root.querySelectorAll<HTMLElement>('.kt-row-inline')];
    // 2 sliders + 4 groups in Display style, 2 groups in Compose preview.
    expect(rows).toHaveLength(8);
    for (const r of rows) {
      expect(r.querySelector(':scope > .ms-auto'), r.textContent ?? '').not.toBeNull();
      expect(r.querySelector(':scope > .kt-label')).toBeNull();
    }
    for (const s of root.querySelectorAll('.kt-switch')) expect(s.hasAttribute('data-reverse')).toBe(true);
  });

  it('keeps 8px under a label when a row wraps', () => {
    const css = readFileSync('src/options/styles.css', 'utf8');
    const rule = css.slice(css.indexOf('.kt-row-inline {'), css.indexOf('}', css.indexOf('.kt-row-inline {')));
    expect(rule).toMatch(/gap-y-2\b/);
    expect(rule).toMatch(/justify-between/);
  });
});

describe('plain words', () => {
  it('drops the warning and the "(off = ...)" phrasing', () => {
    const text = mount({}).textContent ?? '';
    expect(text).not.toContain('may still change');
    expect(text).not.toContain('(off =');
    expect(text).not.toContain('(toggle live)');
  });

  it('keeps meaningful text at 12px or more', () => {
    const src = readFileSync('src/options/sections/DisplaySection.tsx', 'utf8');
    expect(src.match(/text-\[(9|10|11)px\]/g)).toBeNull();
  });
});

describe('style cards at 320px', () => {
  // The recommended badge ran out of its card over the next one.
  it('lets the card heading wrap', () => {
    const root = mount({});
    const head = root.querySelector('button[aria-pressed] > div')!;
    expect(head.className).toContain('flex-wrap');
  });
});

// Picking Cyan, Violet or Amber changed nothing in the pinned preview, which is
// there to answer "what does this look like".
describe('accent in the preview', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-kt-accent');
    document.documentElement.removeAttribute('data-kt-scheme');
  });

  it('puts the chosen accent on the page the preview is drawn under', () => {
    mount({ accent: 'violet' });
    expect(document.documentElement.getAttribute('data-kt-accent')).toBe('violet');
    expect(document.documentElement.getAttribute('data-kt-scheme')).toBe('dark');
  });
});

// A screen reader read "Text size 0.85" where the screen shows 85%.
describe('sliders', () => {
  it('say their value the way the screen does', () => {
    const root = mount({});
    const ranges = [...root.querySelectorAll<HTMLInputElement>('input[type=range]')];
    expect(ranges.length).toBeGreaterThan(0);
    for (const r of ranges) expect(r.getAttribute('aria-valuetext')).toMatch(/\S/);
  });
});
