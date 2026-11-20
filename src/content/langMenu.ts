/**
 * The language list, shared by the chip in the action bar and the float bar.
 *
 * There is one of these on purpose. The float bar used a native <select> with
 * 43 options: measured on a live channel, its dropdown covered 845 of the chat
 * panel's 890 pixels, and a native dropdown is drawn by the system, outside the
 * document, where no stylesheet and no max-height can reach it. Writing a
 * second menu to fix that would leave two lists to keep in agreement, so the
 * chip's list became this module and the bar calls it too.
 *
 * The shape answers one situation: someone streaming in a language that is not
 * their own, switching between three or four of them live, while the chat
 * scrolls. So the favourites sit on top as flag tiles, taken by colour without
 * reading and without scrolling, and everything else is two keystrokes away
 * through the filter. Forty-two rows fit in no window at screen height, so the
 * list is not meant to be walked.
 */
import { LANGUAGES, getLang, localLangName, uiLocale } from '~/shared/languages';
import { flagEl } from '~/shared/flags';

/**
 * Columns in the panel's language grid.
 *
 * One column showed 6 rows of 40, measured on a live channel: 1200px of list
 * inside a 281px panel. Three columns, the same as the chip's menu, so the two
 * lists of the same 42 languages stop looking like two different products.
 */
export const PANEL_COLS = 3;

/** Marge interieure du panneau, et gouttiere de la grille. Les deux sont dans
 *  la feuille ; ici elles ne servent qu'a savoir combien de colonnes tiennent. */
const PANEL_PAD_X = 8;
const GRID_GAP = 2;

/**
 * Largeur minimale d'une colonne pour qu'un nom reste reconnaissable.
 *
 * Le budget de texte d'une colonne vaut sa largeur moins 40 : 8 et 8 de marges
 * de rangee, 16 de drapeau, 8 de gouttiere. A 127 il reste 87px, soit environ
 * quatorze caracteres a 12px, ce qui laisse "Chinese (Taiwan)" se couper sur
 * "Taiw" plutot que sur la parenthese. Coupe a la parenthese, il etait
 * indecidable a cote de "Chinese".
 */
export const MIN_COL_W = 127;

/**
 * Colonnes tenables a cette largeur.
 *
 * PANEL_COLS etait une constante, donc une colonne de chat etroite gardait ses
 * trois colonnes et rendait six caracteres par nom. n colonnes demandent
 * n*MIN + (n-1)*GAP + PAD, d'ou la division ci-dessous, qui est exacte et pas
 * une approximation.
 */
export function colsFor(capW: number): number {
  const n = Math.floor((capW - PANEL_PAD_X + GRID_GAP) / (MIN_COL_W + GRID_GAP));
  return Math.max(1, Math.min(PANEL_COLS, n));
}
import { msg } from './msg';

export interface LangMenuState {
  /** The code currently in effect, shown as the selected option. */
  code: string;
  /** Offered above the full list, most recent first. */
  favorites: readonly string[];
}

export interface LangMenuHandlers {
  /** A language was chosen. */
  onPick: (code: string) => void;
  /** The reader went back to following the channel's language. */
  onAuto: () => void;
  /**
   * A language was added to or removed from the favourites. Optional: a caller
   * that does not store favourites simply gets no star.
   */
  onToggleFavorite?: (code: string) => void;
}

/** Verbatim lucide paths. A hand-approximated path renders a broken glyph. */
const ICONS: Readonly<Record<string, string>> = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  star:
    '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
};

function icon(name: keyof typeof ICONS, cls: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `kt-lang-ico ${cls}`.trim());
  // innerHTML on an SVG element takes markup we wrote ourselves, from the table
  // above; nothing here comes from the page or from a translation.
  svg.innerHTML = ICONS[name] ?? '';
  return svg;
}

/**
 * Does this language match what was typed?
 *
 * Matches the name, the language's own name and the ISO code,
 * accent-insensitively, so someone typing "francais" finds "Français", someone
 * typing "br" finds "pt-br", and someone typing "Deutsch" in a Japanese
 * interface finds the row named ドイツ語.
 */
export function matchesQuery(name: string, code: string, query: string, native = ''): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fold(name).includes(q) || fold(code).includes(q) || fold(native).includes(q);
}

/** Text in its own direction, isolated from the line around it. */
export function isolated(text: string): HTMLElement {
  const bdi = document.createElement('bdi');
  bdi.dir = 'auto';
  bdi.textContent = text;
  return bdi;
}

/**
 * The language's own name, when it says something the localised name does not.
 * Undefined when the two are the same word (German in a German interface), so
 * no row repeats itself.
 */
export function endonymFor(name: string, native: string | undefined): string | undefined {
  return native && fold(native) !== fold(name) ? native : undefined;
}

function fold(s: string): string {
  return s
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
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

/** Is any ancestor clipping this element? */
export function isClipped(el: Element): boolean {
  let p: Element | null = el.parentElement;
  while (p && p !== document.body) {
    const s = getComputedStyle(p);
    if (/hidden|clip|auto|scroll/.test(`${s.overflow} ${s.overflowX} ${s.overflowY}`)) return true;
    p = p.parentElement;
  }
  return false;
}

/** The empty panel, ready to be filled. Hidden until something opens it. */
export function makeLangMenu(id: string): HTMLElement {
  const menu = document.createElement('div');
  menu.id = id;
  menu.className = 'kt-lang-panel';
  menu.hidden = true;
  return menu;
}

interface Row {
  el: HTMLElement;
  code: string;
  name: string;
  native?: string;
}

/**
 * Fill the panel and wire it.
 *
 * @param close Called after a pick, and by Escape. The caller owns hiding the
 *   panel and returning focus, because only it knows what opened it.
 */
export function fillLangMenu(
  menu: HTMLElement,
  state: LangMenuState,
  h: LangMenuHandlers,
  close: () => void,
): void {
  menu.textContent = '';
  const listId = `${menu.id}-list`;

  const searchWrap = document.createElement('div');
  searchWrap.className = 'kt-lang-search';
  searchWrap.appendChild(icon('search', ''));
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'kt-lang-input';
  search.setAttribute('role', 'combobox');
  search.setAttribute('aria-expanded', 'true');
  search.setAttribute('aria-controls', listId);
  search.setAttribute('aria-autocomplete', 'list');
  search.setAttribute('aria-label', msg('chipSearch', 'Filter languages'));
  search.placeholder = msg('chipSearch', 'Filter languages');
  searchWrap.appendChild(search);
  menu.appendChild(searchWrap);

  const box = document.createElement('div');
  box.id = listId;
  box.setAttribute('role', 'listbox');
  box.setAttribute('aria-label', msg('chipSearch', 'Filter languages'));
  menu.appendChild(box);

  const rows: Row[] = [];
  const seen = new Set<string>();

  // ── Favourites, as flag tiles on one row ──────────────────────────────
  // No heading above them: four tiles over a hairline read as a group without
  // being named, and naming it would cost a row of height on a panel whose
  // whole point is to stop covering the chat. The name is on the group for
  // anyone who cannot see the composition.
  const favs = state.favorites.filter((c) => getLang(c));
  if (favs.length) {
    const strip = document.createElement('div');
    strip.className = 'kt-lang-favs';
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', msg('langFavorites', 'Favourites'));
    for (const code of favs) {
      seen.add(code);
      const info = getLang(code);
      if (!info) continue;
      const name = localName(code, info.native);
      const tile = document.createElement('div');
      tile.className = 'kt-lang-fav';
      tile.setAttribute('role', 'option');
      tile.tabIndex = -1;
      tile.setAttribute('aria-selected', String(code === state.code));
      tile.setAttribute('aria-label', name);
      // The rows carry their code; the tiles did not, which left them
      // identifiable only by a visible label. Now that the flag is the whole
      // tile, that label is gone and the code is how anything addresses one.
      tile.dataset.code = code;

      const flag = flagEl(code);
      if (flag) tile.appendChild(flag);
      // No code under the flag either. It was rendering at 9px in a 73x44
      // tile, which is a label nobody reads, and the tile already carries the
      // language's full name as its accessible name and its tooltip. The flag
      // gets the room instead, which is what the tile is aimed at in the first
      // place. zh and zh-tw draw two different flags, so the pair that most
      // needed telling apart still is.
      tile.title = name;

      tile.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
        h.onPick(code);
      });
      strip.appendChild(tile);
      rows.push({ el: tile, code, name, native: info.native });
    }
    box.appendChild(strip);

    const sep = document.createElement('div');
    sep.className = 'kt-lang-sep';
    sep.setAttribute('role', 'presentation');
    box.appendChild(sep);
  }

  // ── Everything else, scrollable ───────────────────────────────────────
  const list = document.createElement('div');
  list.className = 'kt-lang-list';
  // axe asks a scrollable region to be reachable by keyboard. It costs no tab
  // stop while the panel is shut, which is the only state the bar is measured
  // in, and it is one more Tab away only once the panel is already open.
  list.tabIndex = 0;
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', msg('langAll', 'All languages'));
  // Le compte de colonnes vit sur cet element et la grille le lit, pour que les
  // fleches et la mise en page ne puissent pas diverger. placeLangMenu le
  // reecrit une fois la largeur mesuree ; PANEL_COLS n'est plus que le plafond,
  // et la valeur posee ici sert au panneau qui n'a pas encore ete place.
  list.style.setProperty('--kt-lp-cols', String(PANEL_COLS));
  list.dataset.cols = String(PANEL_COLS);
  box.appendChild(list);

  const addRow = (code: string, name: string, isAuto: boolean, native?: string): void => {
    const row = document.createElement('div');
    row.className = 'kt-lang-row';
    row.setAttribute('role', 'option');
    row.tabIndex = -1;
    row.setAttribute('aria-selected', String(code === state.code));
    row.dataset.code = code;
    row.dataset.name = name;
    // In a third of the old width the longest label runs out of room: measured
    // across all 40 rows, exactly one does, "Brazilian Portuguese". It keeps
    // its full text in the DOM and ellipsises on screen, so a screen reader
    // still reads it whole; the title gives it back to a pointer.
    row.title = native ? `${name} (${native})` : name;

    if (isAuto) {
      const globe = document.createElement('span');
      globe.className = 'kt-lang-globe';
      globe.appendChild(icon('globe', ''));
      row.appendChild(globe);
    } else {
      const flag = flagEl(code);
      if (flag) {
        row.appendChild(flag);
      } else {
        // No flag rather than a wrong one; the gap keeps the columns aligned.
        const hole = document.createElement('span');
        hole.className = 'kt-lang-globe';
        row.appendChild(hole);
      }
    }

    // No ISO code column. Measured on a live channel: it took 38px of a 218px
    // row, 17 percent of the width, to repeat what the flag beside it and the
    // name after it already say. Three encodings of one fact is what made the
    // row cramped, and the width it frees is what lets the list run in columns.
    // The language's own name under the localised one, for a reader who knows
    // "Deutsch" or "日本語" before the word their interface uses for it. A
    // second line and not a suffix: on the same line it would take the width
    // the localised name already runs short of.
    const text = document.createElement('span');
    text.className = 'kt-lang-text';
    const label = document.createElement('span');
    label.className = 'kt-lang-name';
    label.textContent = name;
    text.appendChild(label);
    if (native) {
      const own = document.createElement('span');
      own.className = 'kt-lang-native';
      own.lang = code;
      // The box keeps the list's direction, so the name lines up under the one
      // above it; the <bdi> inside lets العربية, עברית, فارسی run in their own.
      // dir=auto on the box itself pushed them to the far edge of the cell.
      own.append(isolated(native));
      text.appendChild(own);
    }
    row.appendChild(text);

    if (!isAuto && h.onToggleFavorite) {
      const star = icon('star', 'kt-lang-star');
      star.dataset.on = 'false';
      // A <button> inside role="option" is invalid, and 42 focusable stars
      // would be 42 tab stops. Pointer here, Alt+Enter on the focused row.
      star.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        h.onToggleFavorite?.(code);
      });
      row.appendChild(star);
    }

    row.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
      if (isAuto) h.onAuto();
      else h.onPick(code);
    });
    list.appendChild(row);
    rows.push({ el: row, code, name, native });
  };

  addRow('auto', msg('chipAuto', "Channel's language"), true);
  seen.add('auto');

  const rest = LANGUAGES.filter((l) => !seen.has(l.code))
    .map((l) => {
      const name = localName(l.code, l.native);
      return { code: l.code, name, native: endonymFor(name, l.native) };
    })
    // Sorted with the UI locale's collation, on the names actually displayed:
    // a plain sort puts Čeština after Zulu in any locale that has accents.
    .sort((a, b) => collator().compare(a.name, b.name));
  for (const l of rest) addRow(l.code, l.name, false, l.native);

  const empty = document.createElement('div');
  empty.className = 'kt-lang-empty';
  empty.setAttribute('role', 'status');
  empty.hidden = true;
  empty.textContent = msg('chipNoMatch', 'No language matches');
  list.appendChild(empty);

  const strip = box.querySelector<HTMLElement>('.kt-lang-favs');
  const sep = box.querySelector<HTMLElement>('.kt-lang-sep');

  const applyFilter = (): void => {
    const q = search.value;
    let shown = 0;
    for (const r of rows) {
      const hit = matchesQuery(r.name, r.code, q, r.native);
      r.el.hidden = !hit;
      if (hit) shown++;
    }
    // While filtering, the favourites strip and its hairline only get in the
    // way: what was typed is the grouping now.
    const filtering = q.trim().length > 0;
    if (strip) strip.hidden = filtering;
    if (sep) sep.hidden = filtering;
    empty.hidden = shown > 0;
  };

  const visible = (): HTMLElement[] => rows.filter((r) => !r.el.hidden).map((r) => r.el);

  const move = (from: HTMLElement | null, step: number): void => {
    const v = visible();
    if (!v.length) return;
    const i = from ? v.indexOf(from) : -1;
    const next = v[Math.max(0, Math.min(v.length - 1, i + step))];
    next?.focus();
  };

  search.addEventListener('input', applyFilter);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      visible()[0]?.focus();
    } else if (e.key === 'Enter') {
      // Enter on a single remaining match picks it: two keystrokes, no pointer.
      e.preventDefault();
      visible()[0]?.click();
    }
  });

  box.addEventListener('keydown', (e) => {
    const here = document.activeElement as HTMLElement | null;
    const onRow = here?.classList.contains('kt-lang-row') || here?.classList.contains('kt-lang-fav');
    if (!onRow) return;
    // The list runs in columns now, so Down and Up have to cross a whole grid
    // row rather than land on the next tile along. The favourites strip is a
    // single flex row, so a step of one is right there, and Left/Right step one
    // everywhere. Le pas se lit sur le dataset que la grille lit aussi, et non
    // plus sur PANEL_COLS : depuis que le compte s'adapte a la largeur, une
    // constante ferait sauter deux rangees la ou l'ecran n'en montre qu'une.
    // Le relire sur la grille rendue serait faux sous jsdom, qui ne resout pas
    // repeat().
    const pas = here!.classList.contains('kt-lang-row')
      ? Number(list.dataset.cols) || PANEL_COLS
      : 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(here!, pas);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const v = visible();
      if (v.indexOf(here!) < pas) search.focus();
      else move(here!, -pas);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(here!, 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(here!, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      visible()[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const v = visible();
      v[v.length - 1]?.focus();
    } else if (e.key === 'Enter' && e.altKey) {
      // The star has no tab stop, so this is its keyboard equivalent.
      e.preventDefault();
      const code = here!.dataset.code;
      if (code && h.onToggleFavorite) h.onToggleFavorite(code);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      here!.click();
    }
  });

  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
}

/** Put the focus where the panel expects it when it opens. */
export function focusLangMenu(menu: HTMLElement): void {
  menu.querySelector<HTMLInputElement>('.kt-lang-input')?.focus();
}

/**
 * The box the panel has to stay inside: the chat column, not the window.
 *
 * Walks out to the first ancestor that clips, which on kick.com is the chat
 * column itself, and falls back to the anchor when nothing clips (the harness
 * stages, and any layout that changes under us).
 *
 * This exists because the panel was bounded by the viewport and by nothing
 * else. Measured on the repository's own bar-panel stage: a 408px panel inside
 * a 340px chat column, hanging 68px past its edges, which is most of why
 * opening it read as the chat having been replaced rather than covered.
 */
function columnBox(anchor: HTMLElement): { width: number; height: number } {
  for (let p = anchor.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (!/hidden|clip|auto|scroll/.test(`${s.overflow} ${s.overflowX} ${s.overflowY}`)) continue;
    const r = p.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { width: r.width, height: r.height };
  }
  // The anchor stands in for the width only, which PANEL_MIN_W floors anyway.
  // Its height is a 24px button, not a column: taken as one, the 0.6 share
  // capped the panel at the 80px floor while its list ran 338px past it, with
  // no background behind. Zero is what panelGeometry reads as unknown.
  const r = anchor.getBoundingClientRect();
  return { width: r.width, height: 0 };
}

/** Gap between the panel and the control it hangs from. */
const GAP = 6;
/** Smallest margin the panel keeps against any edge it is clamped to. */
const MARGIN = 8;
/**
 * Widest the panel is ever drawn, and narrowest.
 *
 * 408 is the readable width for three columns of language names. 280 is the
 * floor: below it the three columns stop being readable at all, and a panel
 * that narrow is worse than one slightly wider than its column.
 */
export const PANEL_MAX_W = 408;
export const PANEL_MIN_W = 280;
/**
 * Most of the chat column the panel may cover.
 *
 * This is the number that answers the report. The panel used to be bounded by
 * the window and by nothing else, so on a tall window it took whatever it
 * wanted and on a short one it took everything. Leaving 40% of the column
 * showing is what tells a reader that this is a menu over their chat and not a
 * screen that replaced it.
 */
export const PANEL_COLUMN_SHARE = 0.6;

export interface PanelGeometryInput {
  /** The control the panel hangs from, in viewport coordinates. */
  anchor: { top: number; bottom: number; right: number };
  /** The chat column the panel must stay inside. Zero height means unknown. */
  column: { width: number; height: number };
  viewport: { width: number; height: number };
  /** What the panel would be at its preferred width, unconstrained. */
  content: { width: number; height: number };
  prefer: 'above' | 'below';
}

export interface PanelGeometry {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  above: boolean;
}

/**
 * Where the panel goes, as arithmetic.
 *
 * Split out from the DOM so the bounds can be tested at real numbers instead of
 * only looked at. jsdom and happy-dom resolve no layout, so a test that drove
 * placeLangMenu directly would measure zeros and pass on anything.
 *
 * Two bounds, from two different reports:
 *  - width, from the chat column rather than the window. Measured on this
 *    repository's own bar-panel stage: 408px of panel inside a 340px column,
 *    68px of it hanging past both edges.
 *  - height, capped at a share of that column, so some chat always shows.
 */
export function panelGeometry(i: PanelGeometryInput): PanelGeometry {
  const capW = Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, i.column.width - MARGIN * 2));
  const width = Math.min(i.content.width || capW, capW);

  const roomAbove = i.anchor.top - GAP - MARGIN;
  const roomBelow = i.viewport.height - i.anchor.bottom - GAP - MARGIN;
  const share = i.column.height > 0 ? i.column.height * PANEL_COLUMN_SHARE : Infinity;
  const wanted = Math.min(i.content.height, i.prefer === 'above' ? roomBelow : roomAbove);
  const above =
    i.prefer === 'above'
      ? roomAbove >= wanted || roomAbove > roomBelow
      : roomBelow < wanted && roomAbove > roomBelow;
  const room = Math.max(80, above ? roomAbove : roomBelow);
  const maxHeight = Math.max(80, Math.min(i.content.height, room, share));

  return {
    width,
    maxHeight,
    above,
    left: Math.max(MARGIN, Math.min(i.anchor.right - width, i.viewport.width - width - MARGIN)),
    top: above
      ? Math.max(MARGIN, i.anchor.top - GAP - maxHeight)
      : Math.min(i.anchor.bottom + GAP, i.viewport.height - maxHeight - MARGIN),
  };
}

/**
 * Anchor the panel. Normally it rides with what opened it; inside a clipping
 * ancestor it switches to viewport coordinates so it stays whole. Flips to the
 * other side of the anchor when there is not enough room on the preferred one.
 *
 * @param prefer Which side to try first. The chip sits at the bottom of the
 *   chat and opens upward; the float bar sits at the top and opens downward.
 */
export function placeLangMenu(
  anchor: HTMLElement,
  menu: HTMLElement,
  prefer: 'above' | 'below' = 'above',
): void {
  menu.classList.remove('kt-lang-panel-fixed');
  menu.style.cssText = '';

  // Two different ways the panel goes wrong, and only one used to be handled.
  //
  // Clipping: an ancestor with overflow hidden cuts it off, which isClipped
  // detects. Leaving the viewport: the flow position is set by CSS alone, which
  // knows nothing about the window. Measured at 420x520 with the chip at y=194,
  // the menu opened upward and its top landed at -132, a third of the list
  // above the top of the screen with no way to reach it.
  // Plus de repli sur la position de flux. Le panneau pend du body : il n'a
  // plus de place naturelle a cote de son ancre, donc ne rien faire le laisse
  // en haut a gauche de la page. isClipped reste exporte et teste, le rognage
  // qu'il detecte est toujours reel, il n'est simplement plus la seule raison
  // de placer a la main.
  const r = anchor.getBoundingClientRect();
  const column = columnBox(anchor);

  // The width cap goes on before anything is measured: a narrower panel is a
  // taller one, so reading the content height first would size it for a width
  // it is not going to get.
  const capW = Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, column.width - MARGIN * 2));
  menu.style.setProperty('--kt-lp-max-w', `${capW}px`);

  // Les colonnes suivent la largeur reelle, pas une constante. Pose avant la
  // mesure de hauteur : moins de colonnes veut dire une liste plus haute, donc
  // lire la hauteur d'abord la mesurerait pour une grille qu'elle n'aura pas.
  const list = menu.querySelector<HTMLElement>('.kt-lang-list');
  if (list) {
    const cols = String(colsFor(capW));
    list.style.setProperty('--kt-lp-cols', cols);
    list.dataset.cols = cols;
  }

  const g = panelGeometry({
    anchor: { top: r.top, bottom: r.bottom, right: r.right },
    column,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    content: { width: menu.offsetWidth, height: menu.scrollHeight },
    prefer,
  });

  menu.classList.add('kt-lang-panel-fixed');
  menu.style.maxHeight = `${g.maxHeight}px`;
  menu.style.left = `${g.left}px`;
  menu.style.top = `${g.top}px`;
}
