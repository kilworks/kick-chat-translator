import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { FilterSection } from './FilterSection';
import { defaultSettings } from '~/shared/settings';
import { LANGUAGES } from '~/shared/languages';

let host: HTMLDivElement | undefined;

function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  render(<FilterSection settings={defaultSettings()} onPatch={() => {}} />, host);
  return host;
}

afterEach(() => {
  if (host) render(null, host);
  host?.remove();
  host = undefined;
});

const filter = (el: HTMLElement) =>
  el.querySelector<HTMLInputElement>('input[type=text].kt-input')!;
// Scoped to the grid: the section also carries two toggle rows of its own,
// and counting those made the list look two entries longer than it is.
const grid = (el: HTMLElement) => el.querySelector<HTMLElement>('.grid.grid-cols-3')!;
const rows = (el: HTMLElement) => grid(el).querySelectorAll('button[aria-pressed]');

async function type(el: HTMLElement, value: string) {
  const f = filter(el);
  f.value = value;
  f.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}

/**
 * The allowlist listed all 42 languages inside a 260px scroll box, the same
 * "walk the list" problem the chip's menu had, and it takes the same answer.
 */
describe('source language allowlist', () => {
  // P3-4: a scroll box inside a long page traps the wheel; the filter field
  // already shortens the list, so the grid takes its full height.
  it('does not scroll inside the page', () => {
    expect(grid(mount()).className).not.toMatch(/overflow|max-h/);
  });

  // A set, not applied-at-once settings: a row of OFF switches read as "not translated".
  it('draws each language as a toggle chip with a tick, not a switch', () => {
    const el = mount();
    expect(grid(el).querySelector('[role=switch], input[type=checkbox]')).toBeNull();
    let patched: string[] | undefined;
    render(null, el);
    render(
      <FilterSection settings={{ ...defaultSettings(), sourceLangAllowlist: ['ja'] }} onPatch={(p) => (patched = p.sourceLangAllowlist)} />,
      el,
    );
    const on = [...rows(el)].filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(on).toHaveLength(1);
    expect(on[0]!.querySelector('use[href="#i-check"]')).not.toBeNull();
    expect(grid(el).querySelectorAll('use[href="#i-check"]')).toHaveLength(1);
    (([...rows(el)].find((b) => b.getAttribute('aria-pressed') === 'false')) as HTMLElement).click();
    expect(patched).toHaveLength(2);
  });

  it('offers every language before anything is typed', () => {
    const el = mount();
    expect(rows(el)).toHaveLength(LANGUAGES.length);
  });

  it('narrows as you type', async () => {
    const el = mount();
    const before = rows(el).length;
    await type(el, 'fr');
    expect(rows(el).length).toBeGreaterThan(0);
    expect(rows(el).length).toBeLessThan(before);
  });

  it('matches the ISO code, not only the name', async () => {
    const el = mount();
    await type(el, 'ja');
    expect(el.textContent?.toUpperCase()).toContain('JA');
  });

  // Accent folding is real but has nothing to bite on here: the default test
  // locale renders the names in English. It is covered where accented names
  // actually appear, in matchesQuery (langChip.test.ts).
  it('ignores case in the query', async () => {
    const el = mount();
    await type(el, 'FRENCH');
    expect(rows(el).length).toBeGreaterThan(0);
  });

  it('says so when nothing matches instead of showing an empty grid', async () => {
    const el = mount();
    await type(el, 'zzzzzz');
    expect(rows(el)).toHaveLength(0);
    expect(grid(el).querySelector('[role=status]')?.textContent).toBeTruthy();
  });

  it('gives the filter an accessible name', () => {
    const el = mount();
    expect(filter(el).getAttribute('aria-label')).toBeTruthy();
  });

  // Control: clearing the box has to bring every language back, or the filter
  // is a one-way trip.
  it('restores the full list when the query is cleared', async () => {
    const el = mount();
    await type(el, 'fr');
    await type(el, '');
    expect(rows(el)).toHaveLength(LANGUAGES.length);
  });
});

// A glossary line without an arrow used to vanish without a word.
describe('glossary', () => {
  it('names the lines it cannot read, and only those', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    const settings = { ...defaultSettings(), glossary: ['kusa->lol', 'kusa=lol'] };
    render(<FilterSection settings={settings} onPatch={() => {}} />, host);
    const status = [...host.querySelectorAll('[role=status]')].find((n) => n.textContent?.includes('kusa'));
    expect(status?.textContent).toContain('kusa=lol');
    expect(status?.textContent).not.toContain('kusa->lol');
  });

  it('says nothing when every line reads', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    const settings = { ...defaultSettings(), glossary: ['kusa->lol', '草→lol'] };
    render(<FilterSection settings={settings} onPatch={() => {}} />, host);
    expect(host.textContent).not.toContain('word -> replacement:');
  });
});
