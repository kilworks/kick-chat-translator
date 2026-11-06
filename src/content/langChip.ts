/**
 * Language chip — the control in Kick's chat action bar.
 *
 * Bottom right, beside the gear and the send button. That position is the
 * whole point: changing the language you write in must never mean travelling
 * to the top of the chat and back.
 *
 * It sat inside the message box first. Loading it on a live channel showed why
 * that was wrong: the box is Kick's editor, its internals move, and the chip
 * ended up under it rather than in it. The action bar is a row of controls
 * that already exists for exactly this kind of button.
 *
 * One click opens the list, wherever on the chip it lands. The caret says the
 * list is there; it is not a target of its own. The list is seeded by whatever
 * you pick, so there is no configuration step and the favourites never reorder
 * themselves under the pointer between two clicks.
 *
 * Anchoring rules, learned the hard way elsewhere in this codebase: the panel
 * is re-rendered by Kick's SPA, so the chip has to be re-mountable at any time,
 * and it must never be the reason a layout moves.
 */
import { LANGUAGES, getLang, localLangName, uiLocale } from '~/shared/languages';
import { flagEl } from '~/shared/flags';
import { msg } from './msg';

const CHIP_ID = 'kt-lang-chip';
const MENU_ID = 'kt-lang-menu';
const LIST_ID = 'kt-lang-list';

export type ChipMode = 'auto' | 'pinned' | 'off' | 'loading' | 'error';

export interface ChipState {
  mode: ChipMode;
  /** ISO code shown on the chip. Ignored when mode is 'off' or 'loading'. */
  code: string;
  /** Languages offered above the full list, most recent first. */
  favorites: readonly string[];
}

export interface ChipHandlers {
  /** A language was chosen, either by toggling or from the list. */
  onPick: (code: string) => void;
  /** The chip was toggled back to following the channel's language. */
  onAuto: () => void;
}

interface Mounted {
  chip: HTMLButtonElement;
  menu: HTMLElement;
  host: Element;
  cleanup: (() => void)[];
}

let ui: Mounted | undefined;

/**
 * The row Kick draws around the text field — the one holding the shield, the
 * input and the emote button.
 *
 * Walking up from the editable node rather than matching a class: Kick renames
 * classes between releases, but the shape of the row (a box a bit taller than
 * the text, holding more than one child) is stable. Falls back to the
 * composer's own parent, which always exists.
 */
export function findComposerRow(composer: HTMLElement): Element {
  return findActionCluster(composer) ?? composer.parentElement ?? composer;
}

/**
 * The inline-end cluster of Kick's chat action bar, the one holding the gear
 * and the send button.
 *
 * Measured on a live channel, which is where the previous version was caught:
 * the bar is `DIV.flex.shrink-0`, 300x36, sitting below the composer's block as
 * a sibling of its grandparent, and its two children are a left group and an
 * `ml-auto` group carrying the gear and Chat.
 *
 * The catch, and the reason the chip had been landing above the message box:
 * on a followers-only channel that left group renders at HEIGHT ZERO. The old
 * test asked for two VISIBLE children laid out across, found one, rejected the
 * real bar and fell back to the composer's own parent. A harness cannot show
 * that, because a harness only contains what its author thought Kick contained.
 *
 * So the shape asked for is the one that actually identifies the bar: a
 * following sibling that holds a button and sits at or below the field. Every
 * following sibling is scanned, not only the immediate one.
 */
function findActionCluster(composer: HTMLElement): Element | null {
  const field = composer.getBoundingClientRect();
  let node: HTMLElement | null = composer;
  for (let depth = 0; node && depth < 6; depth++) {
    for (let sib = node.nextElementSibling; sib; sib = sib.nextElementSibling) {
      if (!(sib instanceof HTMLElement)) continue;
      if (!sib.querySelector('button')) continue;
      const bar = sib.getBoundingClientRect();
      // Below the field, and actually drawn. `- 1` for subpixel layout.
      if (bar.height <= 0 || bar.bottom < field.bottom - 1) continue;
      return endCluster(sib) ?? sib;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * The group pushed to the far end of the bar.
 *
 * Taken by DOM order rather than by measuring which is furthest right, so it
 * mirrors on its own when the interface runs right to left. Zero-height groups
 * are skipped: that is exactly what the collapsed left group is.
 */
function endCluster(bar: HTMLElement): HTMLElement | null {
  const groups = [...bar.children].filter((k): k is HTMLElement => {
    if (!(k instanceof HTMLElement)) return false;
    const b = k.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  });
  return groups[groups.length - 1] ?? null;
}

/** The chip goes at the head of the cluster, before the gear. */
function insertInRow(row: Element, wrap: HTMLElement): void {
  row.insertBefore(wrap, row.firstElementChild);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The caret that says a list exists.
 *
 * The list opened on a 400ms press or the Down arrow, and on nothing a mouse
 * could see: the chip carried no affordance whatsoever, so 42 languages sat
 * behind a gesture only the tooltip mentioned.
 *
 * It is a REGION of the chip button rather than a second button beside it.
 * Measured first: the action bar has 108px of slack on a 340px panel, 68 at
 * 300 and 28 at 260, while a separate target owes 24px under WCAG 2.5.8 plus
 * its gap. A split button does not fit the narrow end of that range; a caret
 * inside the existing button costs about 12.
 *
 * Drawn, not typed. The chip's font stack is a monospace list, and a text
 * chevron falls back to a different glyph at a different weight on every
 * machine that misses the first family.
 */
function makeCaret(): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'kt-chip-caret';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 10 6');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M1 1.5 5 5 9 1.5');
  svg.appendChild(path);
  wrap.appendChild(svg);
  return wrap;
}

function makeChip(): HTMLButtonElement {
  const chip = document.createElement('button');
  chip.id = CHIP_ID;
  chip.type = 'button';
  chip.className = 'kt-chip';
  chip.setAttribute('aria-haspopup', 'listbox');
  chip.setAttribute('aria-expanded', 'false');
  chip.setAttribute('aria-controls', MENU_ID);

  // Le pendant de la fleche de la barre du haut : celle-ci part de nous.
  const dir = document.createElement('span');
  dir.className = 'kt-chip-dir';
  dir.textContent = '\u2191';
  dir.setAttribute('aria-hidden', 'true');
  chip.appendChild(dir);

  // La puce n'avait aucun drapeau, juste deux lettres, alors que la feuille en
  // dessine 43. Peint par paintChip, qui suit la langue.
  const flag = document.createElement('span');
  flag.className = 'kt-chip-flag';
  chip.appendChild(flag);

  const tag = document.createElement('span');
  tag.className = 'kt-chip-tag';
  chip.appendChild(tag);
  chip.appendChild(makeCaret());
  return chip;
}

/**
 * The popup. Deliberately role-less.
 *
 * A `listbox` may only contain `option` children, so putting the filter field
 * inside one is invalid — axe rejects it as a critical violation. The correct
 * shape is a combobox that owns a separate listbox, which is what this builds.
 */
function makeMenu(): HTMLElement {
  const menu = document.createElement('div');
  menu.id = MENU_ID;
  menu.className = 'kt-chip-menu';
  menu.hidden = true;
  return menu;
}

/**
 * Match a language against what was typed.
 *
 * Both the displayed name and the ISO code, because the two audiences differ:
 * someone reading a Japanese interface sees フランス語 but may well type "fr".
 * Accents are folded so "francais" finds "français".
 */
/**
 * Columns in the language grid.
 *
 * The list was one language per line: 43 rows, 894px tall on a 950px window,
 * measured on a live channel. Three columns bring the same 43 entries and their
 * names into roughly a third of that height.
 */
export const MENU_COLS = 3;

/**
 * The grid's lines, as indices of the visible options, the way CSS lays them out.
 *
 * `full` takes a line of its own (the auto entry), `break` ends the current
 * line without being an option (the rule after the favourites, so the full
 * list starts at column 0 again). Index arithmetic missed both: with one
 * favourite, Down from it landed on the third language instead of the first.
 */
export function gridLines(cells: readonly ('tile' | 'full' | 'break')[], cols: number): number[][] {
  const lines: number[][] = [];
  let line: number[] = [];
  let n = 0;
  const flush = (): void => {
    if (line.length) lines.push(line);
    line = [];
  };
  for (const c of cells) {
    if (c === 'break') {
      flush();
    } else if (c === 'full') {
      flush();
      lines.push([n++]);
    } else {
      line.push(n++);
      if (line.length === cols) flush();
    }
  }
  flush();
  return lines;
}

/**
 * Where an arrow key goes from option `from`. Up and Down keep the column the
 * user last chose with Left/Right (`col`), so passing through the one-entry
 * auto line or a short last line does not drift them sideways. Everything wraps.
 */
export function gridMove(
  lines: readonly number[][],
  from: number,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  col: number,
): { to: number; col: number } {
  const total = lines.reduce((s, l) => s + l.length, 0);
  if (total === 0) return { to: -1, col };
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const to = (from + (key === 'ArrowRight' ? 1 : -1) + total) % total;
    const line = lines.find((l) => l.includes(to))!;
    return { to, col: line.indexOf(to) };
  }
  const li = lines.findIndex((l) => l.includes(from));
  const next = lines[(li + (key === 'ArrowDown' ? 1 : -1) + lines.length) % lines.length]!;
  return { to: next[Math.min(col, next.length - 1)]!, col };
}

export function matchesQuery(name: string, code: string, query: string): boolean {
  const fold = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = fold(query.trim());
  if (!q) return true;
  return fold(name).includes(q) || fold(code).includes(q);
}

/** Rows of the list: a filter box, the favourites, then every supported language. */
function fillMenu(menu: HTMLElement, state: ChipState, h: ChipHandlers, close: () => void): void {
  menu.textContent = '';

  // 42 languages do not fit any list at screen height, so the list is never
  // meant to be walked: two keystrokes should reach any of them. Sorting alone
  // makes the list predictable, not short.
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'kt-chip-search';
  search.setAttribute('role', 'combobox');
  search.setAttribute('aria-expanded', 'true');
  search.setAttribute('aria-controls', LIST_ID);
  search.setAttribute('aria-autocomplete', 'list');
  search.setAttribute('aria-label', msg('chipSearch', 'Filter languages'));
  search.placeholder = msg('chipSearch', 'Filter languages');
  menu.appendChild(search);

  const list = document.createElement('div');
  list.id = LIST_ID;
  list.className = 'kt-chip-list';
  list.setAttribute('role', 'listbox');
  // The column count lives here and only here. The grid reads it, and so does
  // the arrow-key handler, which has to move a whole row of tiles rather than
  // one tile. Reading it back off the rendered grid instead would be nicer
  // until jsdom, which does not resolve `repeat()`, hands the keyboard a
  // different number from the one on screen.
  list.style.setProperty('--kt-chip-cols', String(MENU_COLS));
  menu.appendChild(list);

  const add = (code: string, name: string, group: string): void => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'kt-chip-row';
    row.dataset.code = code;
    row.dataset.group = group;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(code === state.code));

    // The drawn flag, in the slot the ISO code used to fill. Forty-three rows
    // of two-letter codes are read letter by letter; a colour block is spotted
    // without reading, which is the whole reason flags.ts exists. The code
    // stays as the fallback for any language with no flag: `flagEl` returns
    // null rather than pointing at a wrong country, and an empty 34px slot
    // would break the column alignment.
    const iso = document.createElement('span');
    iso.className = 'kt-chip-iso';
    iso.append(flagEl(code) ?? (code === 'auto' ? '' : code.toUpperCase()));
    row.appendChild(iso);

    const label = document.createElement('span');
    label.className = 'kt-chip-name';
    label.textContent = name;
    row.appendChild(label);
    // A third of the old width per tile, so the longer names ellipsis. The
    // title gives the full one back on hover, and aria-label keeps it whole for
    // a screen reader, which reads the accessible name, not the clipped text.
    row.title = name;
    row.setAttribute('aria-label', name);

    row.dataset.name = name;
    row.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
      if (code === 'auto') h.onAuto();
      else h.onPick(code);
    });
    list.appendChild(row);
  };

  add('auto', autoLabel(), 'auto');

  const seen = new Set<string>(['auto']);
  for (const code of state.favorites) {
    if (seen.has(code)) continue;
    seen.add(code);
    const info = getLang(code);
    if (info) add(code, localName(code, info.native), 'fav');
  }

  const sep = document.createElement('div');
  sep.className = 'kt-chip-sep';
  sep.setAttribute('role', 'presentation');
  list.appendChild(sep);

  // Sorted with the UI locale's collation, on the names actually displayed —
  // a plain sort puts Čeština after Zulu in any locale that has accents.
  const rest = LANGUAGES.filter((l) => !seen.has(l.code))
    .map((l) => ({ code: l.code, name: localName(l.code, l.native) }))
    .sort((a, b) => collator().compare(a.name, b.name));
  for (const l of rest) add(l.code, l.name, 'all');

  const empty = document.createElement('div');
  empty.className = 'kt-chip-empty';
  empty.setAttribute('role', 'status');
  empty.hidden = true;
  empty.textContent = msg('chipNoMatch', 'No language matches');
  menu.appendChild(empty);

  const applyFilter = (): void => {
    const q = search.value;
    let shown = 0;
    for (const row of menu.querySelectorAll<HTMLElement>('.kt-chip-row')) {
      const hit = matchesQuery(row.dataset.name ?? '', row.dataset.code ?? '', q);
      row.hidden = !hit;
      if (hit) shown++;
    }
    // The separator only means something while both groups are on screen.
    sep.hidden = q.trim().length > 0;
    empty.hidden = shown > 0;
  };
  search.addEventListener('input', applyFilter);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      menu.querySelector<HTMLElement>('.kt-chip-row:not([hidden])')?.focus();
    } else if (e.key === 'Enter') {
      // Enter on a single remaining match picks it: two keystrokes, no pointer.
      e.preventDefault();
      const rows = menu.querySelectorAll<HTMLElement>('.kt-chip-row:not([hidden])');
      if (rows.length >= 1) rows[0]!.click();
    }
  });
}

/**
 * Collation for the language list, cached against the locale it was built for.
 *
 * It used to be cached outright. That was safe while the locale came from the
 * browser and could not change inside a page; it is not now that it comes from
 * a setting the user can change with the chat open, and a stale collator sorts
 * the list by the language they just left.
 */
let cachedCollator: { locale: string; c: Intl.Collator } | undefined;
function collator(): Intl.Collator {
  const locale = uiLocale();
  if (cachedCollator?.locale !== locale) cachedCollator = { locale, c: new Intl.Collator(locale) };
  return cachedCollator.c;
}

function autoLabel(): string {
  return msg('chipAuto', "Channel's language");
}

/**
 * The language's name in the reader's own language.
 *
 * Une seule implementation, dans `~/shared/languages`. Il y en avait TROIS, et
 * elles ne se comportaient pas pareil : celle-ci rendait le code lui-meme pour
 * une langue inconnue, celle de `langMenu` s'en sortait par un `n !== code`
 * ecrit contre le symptome sans nommer la cause, et celle de `languages.ts` a
 * la vraie reparation. Trois copies d'une fonction, deux facons de se tromper.
 */
export function localName(code: string, fallback: string): string {
  return localLangName(code, fallback);
}

/**
 * True when some ancestor would clip a popup drawn outside the box.
 *
 * The message box is Kick's, not ours, and nothing stops it carrying
 * `overflow: hidden`. An absolutely positioned list inside a clipping ancestor
 * is silently cut in half, which looks like the feature is broken rather than
 * mispositioned — so this is worth a few reads of the cascade on each open.
 */
export function isClipped(el: Element): boolean {
  let node: Element | null = el.parentElement;
  while (node && node !== document.body) {
    const s = getComputedStyle(node);
    // The shorthand has to be read too: a page that sets `overflow` alone
    // leaves the longhands empty in some engines, and the clip goes unseen.
    if (/hidden|clip|auto|scroll/.test(`${s.overflow} ${s.overflowX} ${s.overflowY}`)) return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * Anchor the list. Normally it rides with the chip; inside a clipping ancestor
 * it switches to viewport coordinates so it stays whole. Also flips below the
 * chip when there is not enough room above.
 */
function placeMenu(chip: HTMLElement, menu: HTMLElement): void {
  menu.classList.remove('kt-chip-menu-fixed');
  menu.style.cssText = '';

  // Two different ways the menu goes wrong, and only one was handled.
  //
  // Clipping: an ancestor with overflow hidden cuts it off, which isClipped
  // detects. Leaving the viewport: the flow position is set by CSS alone, which
  // knows nothing about the window. Measured at 420x520 with the chip at y=194,
  // the menu opened upward and its top landed at -132 — a third of the list
  // above the top of the screen, with no way to reach it.
  //
  // So the early return has to answer both questions, not just the first.
  // No early return any more. The menu hangs off document.body now, so there is
  // no flow position next to the chip to fall back on: leaving it unplaced puts
  // it at the top-left of the page. isClipped stays exported and tested -- the
  // clipping it detects is still real, it is simply no longer the only reason
  // to place the menu by hand.

  // Seen live on kick.com: this ran off the left of the chat column and over
  // the video player, and off the top of the window, because the only bound it
  // respected was the RIGHT edge. Every edge is clamped now, and the height is
  // whatever actually fits between the chip and the edge it opens towards —
  // not a fixed 320px the window may not have.
  const GAP = 6;
  const MARGIN = 8;
  const W = menu.offsetWidth || 190;
  const r = chip.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const roomAbove = r.top - GAP - MARGIN;
  const roomBelow = vh - r.bottom - GAP - MARGIN;
  const above = roomAbove >= Math.min(menu.scrollHeight, roomBelow) || roomAbove > roomBelow;
  const room = Math.max(80, above ? roomAbove : roomBelow);
  const h = Math.min(menu.scrollHeight, room);

  menu.classList.add('kt-chip-menu-fixed');
  menu.style.maxHeight = `${h}px`;
  menu.style.left = `${Math.max(MARGIN, Math.min(r.right - W, vw - W - MARGIN))}px`;
  menu.style.top = `${above ? Math.max(MARGIN, r.top - GAP - h) : Math.min(r.bottom + GAP, vh - h - MARGIN)}px`;
}

export function isLangChipMounted(): boolean {
  return Boolean(ui && document.getElementById(CHIP_ID));
}

export function mountLangChip(composer: HTMLElement, state: ChipState, h: ChipHandlers): void {
  if (ui && ui.chip.isConnected && document.getElementById(CHIP_ID)) return;
  unmountLangChip();

  const host = findComposerRow(composer);
  const chip = makeChip();
  const menu = makeMenu();
  const cleanup: (() => void)[] = [];

  const close = (): void => {
    // Focus has to come back to what opened the list, or a keyboard user who
    // picks a language is dropped on <body> and has to tab in from the top of
    // the page again. Escape did this; picking with Enter did not.
    //
    // Guarded on where focus actually is: the outside-click listener runs on
    // `click`, by which point focus has already moved to whatever was clicked,
    // so this never drags it back off a Kick control.
    const wasInside = menu.contains(document.activeElement);
    menu.hidden = true;
    chip.setAttribute('aria-expanded', 'false');
    if (wasInside) chip.focus();
  };
  const open = (): void => {
    fillMenu(menu, current, h, close);
    menu.hidden = false;
    chip.setAttribute('aria-expanded', 'true');
    placeMenu(chip, menu);
    menu.querySelector<HTMLElement>('.kt-chip-search')?.focus();
  };

  let current = state;

  /**
   * One click, one outcome: the list opens.
   *
   * It used to be three interactions on one 44x24 control. A click on the code
   * toggled between the channel's language and the first favourite, a click on
   * the caret opened the list, and a 400ms press-and-hold opened it too. Which
   * one you got depended on which half of the chip the pointer landed in, and
   * on whether a favourite existed yet: with none, a click anywhere opened the
   * list, which is why every harness pass in a fresh profile saw the easy case
   * and never the real one.
   *
   * The hold is gone with it. A gesture a mouse cannot see, on a control this
   * small, was the workaround for the caret being hard to hit rather than a
   * feature. Switching language is now what the list is for.
   */
  const onClick = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    if (current.mode === 'off') return;
    if (menu.hidden) open();
    else close();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open();
    }
  };

  chip.addEventListener('click', onClick);
  chip.addEventListener('keydown', onKey);
  cleanup.push(() => {
    chip.removeEventListener('click', onClick);
    chip.removeEventListener('keydown', onKey);
  });

  // Column the user last picked with Left/Right, kept across Up/Down. Only
  // while the focus is where the last arrow put it: a click or a focus set by
  // code starts from the tile's own column (chip-live caught Down from the
  // third column landing on the first).
  let wantCol = 0;
  let movedTo: HTMLElement | undefined;
  const onMenuKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Read off the DOM in grid order, rows and the visible separator alike,
      // so the lines match what CSS draws: see gridLines.
      const cells = Array.from(
        menu.querySelectorAll<HTMLElement>('.kt-chip-row:not([hidden]), .kt-chip-sep:not([hidden])'),
      );
      const rows = cells.filter((c) => c.classList.contains('kt-chip-row'));
      if (rows.length === 0) return;
      e.preventDefault();
      const lines = gridLines(
        cells.map((c) => (c.classList.contains('kt-chip-sep') ? 'break' : c.dataset.group === 'auto' ? 'full' : 'tile')),
        MENU_COLS,
      );
      const i = rows.indexOf(document.activeElement as HTMLElement);
      const from = i < 0 ? 0 : i;
      if (rows[from] !== movedTo) wantCol = lines.find((l) => l.includes(from))!.indexOf(from);
      const r = gridMove(lines, from, e.key, wantCol);
      wantCol = r.col;
      movedTo = rows[r.to];
      movedTo?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(); // close() brings the focus back
    }
  };
  menu.addEventListener('keydown', onMenuKey);
  cleanup.push(() => menu.removeEventListener('keydown', onMenuKey));

  const onDocClick = (e: Event): void => {
    if (menu.hidden) return;
    if (!menu.contains(e.target as Node) && e.target !== chip) close();
  };
  document.addEventListener('click', onDocClick);
  cleanup.push(() => document.removeEventListener('click', onDocClick));

  const wrap = document.createElement('div');
  wrap.className = 'kt-chip-host';
  wrap.appendChild(chip);
  insertInRow(host, wrap);

  // The menu goes on the body, not next to the chip.
  //
  // Measured on a live channel with the page scrolled: the menu was painted
  // over at 5 of 9 sampled points -- by a div at z-index 101, and by two
  // elements at `auto`. It declares 2147483000. A z-index only ranks an element
  // inside its own stacking context, and inside Kick's action bar no number
  // wins against a sibling context ranked elsewhere on the page. The compose
  // panel already sits on the body for the same reason and measures clean.
  document.body.appendChild(menu);
  cleanup.push(() => menu.remove());

  ui = { chip, menu, host, cleanup };
  updateLangChip(state);
  // `current` is what the handlers read when the list is built later.
  const track = (s: ChipState): void => {
    current = s;
  };
  trackers.push(track);
  cleanup.push(() => {
    const i = trackers.indexOf(track);
    if (i >= 0) trackers.splice(i, 1);
  });
}

const trackers: ((s: ChipState) => void)[] = [];

export function updateLangChip(state: ChipState): void {
  for (const t of trackers) t(state);
  if (!ui) return;
  const { chip } = ui;
  const tag = chip.querySelector<HTMLElement>('.kt-chip-tag');
  if (!tag) return;

  // Le drapeau suit la langue, et disparait pour les etats qui n'en sont pas
  // une : en pause, en cours, en erreur, il n'y a pas de langue a montrer.
  const flag = chip.querySelector<HTMLElement>('.kt-chip-flag');
  if (flag) {
    const drawn =
      state.mode === 'off' || state.mode === 'loading' || state.mode === 'error'
        ? null
        : flagEl(state.code ?? '');
    flag.replaceChildren(drawn ?? '');
    flag.hidden = !drawn;
  }

  chip.dataset.mode = state.mode;
  switch (state.mode) {
    case 'off':
      tag.textContent = 'OFF';
      chip.title = msg('chipPaused', 'Translation paused');
      break;
    case 'loading':
      tag.textContent = '···';
      chip.title = msg('chipLoading', 'Translating…');
      break;
    case 'error':
      tag.textContent = '!';
      chip.title = msg('chipError', 'Translation unavailable. Click to pick a language.');
      break;
    case 'auto':
      tag.textContent = state.code ? state.code.toUpperCase() : 'AUTO';
      chip.title = msg(
        'chipAutoTip',
        "Writing in the channel's language ($LANG$). Click to pick another.",
        [state.code.toUpperCase()],
      );
      break;
    default:
      tag.textContent = state.code.toUpperCase();
      chip.title = msg(
        'chipPinnedTip',
        "Writing in $LANG$. Click to pick another.",
        [localName(state.code, state.code.toUpperCase())],
      );
  }
  chip.setAttribute('aria-label', chip.title);
}

export function unmountLangChip(): void {
  if (!ui) {
    document.getElementById(CHIP_ID)?.closest('.kt-chip-host')?.remove();
    return;
  }
  for (const fn of ui.cleanup) fn();
  ui.chip.closest('.kt-chip-host')?.remove();
  ui = undefined;
}
