/**
 * Compose preview panel — the floating box above the chat composer that shows a
 * live translation of what the user is typing.
 *
 * Positioned `fixed` and tracked to the composer's bounding box so it never
 * mutates Kick's layout (zero layout shift) and never reflows the input. All
 * state transitions keep the previous text on screen until the next one is ready,
 * so the panel never flashes empty while a request is in flight.
 */
import { getLang } from '~/shared/languages';
import { flagEl } from '~/shared/flags';
import { chatReserve, computePanelGeom, morceauxPourEditeur } from './composeLogic';
import { send } from '~/shared/messages';
import { showToast } from './injector';
import { msg } from './msg';

const COMPOSE_ID = 'kt-compose-bar';

export type ComposeUiState =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | { kind: 'ready'; text: string; provider: string };

export interface ComposeUiHandlers {
  /** User clicked the translation to insert it into the chat box. */
  onInsert: () => void;
}

interface ComposeUi {
  panel: HTMLElement;
  textEl: HTMLElement;
  targetEl: HTMLElement;
  composer: HTMLElement;
  reposition: () => void;
  resizeObs: ResizeObserver | undefined;
}

let ui: ComposeUi | undefined;

/** Read the plain text currently in the composer (textarea/input value or contenteditable text). */
export function readComposerText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
  // innerText preserves line breaks for multi-line messages; textContent collapses them.
  // innerText puts a blank line between Lexical's <p>: one line per paragraph,
  // or a two-line message came back from Tab with an empty line inside (measured).
  if (!el.querySelector('img[data-emote-id]')) return (el.innerText ?? el.textContent ?? '').replace(/\n\n/g, '\n');
  // Kick's emotes are <img data-emote-id data-emote-name> nodes innerText skips, so
  // a translation written back would drop them. Spell them as Kick's own
  // [emote:id:name] markup instead; maskProtected keeps it through the translator.
  // A detached clone has no layout, so innerText is gone: Lexical's <p> are the lines.
  const clone = el.cloneNode(true) as HTMLElement;
  for (const img of clone.querySelectorAll<HTMLImageElement>('img[data-emote-id]')) {
    img.replaceWith(`[emote:${img.dataset.emoteId}:${img.dataset.emoteName || img.alt}]`);
  }
  const lines = clone.querySelectorAll('p');
  return lines.length ? [...lines].map((p) => p.textContent ?? '').join('\n') : (clone.textContent ?? '');
}

export function mountComposePreview(
  composer: HTMLElement,
  targetLang: string,
  handlers: ComposeUiHandlers,
): void {
  // Re-mount cleanly if the composer node changed (SPA swap).
  if (ui && ui.composer === composer && document.getElementById(COMPOSE_ID)) return;
  unmountComposePreview();
  loadInsertHint();

  const panel = document.createElement('div');
  panel.id = COMPOSE_ID;
  panel.className = 'kt-compose';
  panel.dataset.state = 'hidden';

  // Read-only badge of the auto-detected output language (the channel's language).
  // No manual picker — the target is detected, not configured.
  const targetEl = document.createElement('span');
  targetEl.className = 'kt-compose-target';
  setTargetBadge(targetEl, targetLang);
  panel.appendChild(targetEl);

  // The translation — the hero of the chip, full width.
  const textEl = document.createElement('span');
  textEl.className = 'kt-compose-text';
  textEl.dir = 'auto'; // render RTL languages (Arabic/Hebrew/Persian) correctly
  panel.appendChild(textEl);

  // Subtle insert cue. The whole chip is clickable; this just signals the action.
  const insert = document.createElement('span');
  insert.className = 'kt-compose-insert';
  marquerInsertion(insert);
  panel.appendChild(insert);

  // Clicking the translation inserts it (mousedown, so the composer doesn't lose
  // focus to a real click first — keeps the caret where the user expects).
  panel.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handlers.onInsert();
  });

  document.body.appendChild(panel);

  const reposition = (): void => {
    if (panel.dataset.state === 'hidden') return; // no layout work while not shown
    positionPanel(panel, composer);
  };

  // Track the composer's box so the panel stays glued to it when the input grows
  // to multiple lines — fires only on a real size change, never on the keystroke path.
  let resizeObs: ResizeObserver | undefined;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(reposition);
    resizeObs.observe(composer);
  }

  ui = { panel, textEl, targetEl, composer, reposition, resizeObs };

  window.addEventListener('scroll', reposition, { passive: true, capture: true });
  window.addEventListener('resize', reposition, { passive: true });
  // The on-screen keyboard / pinch-zoom move the visual viewport without firing a
  // window resize — track it so the panel stays put above the keyboard.
  window.visualViewport?.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('scroll', reposition);
  reposition();
}

function positionPanel(panel: HTMLElement, composer: HTMLElement): void {
  const r = composer.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return; // composer detached / hidden
  // Track the *visual* viewport so the panel rides above the on-screen keyboard
  // (which shrinks visualViewport without touching innerHeight) instead of hiding
  // behind it. Falls back to the layout viewport on desktop.
  const vv = window.visualViewport;
  const keyboardInset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  const overlay = findOverlayTopAbove(composer, r.top);
  const chip = chipTopAbove(r.top);
  const geom = computePanelGeom(
    { left: r.left, top: r.top, width: r.width },
    { innerWidth: window.innerWidth, innerHeight: window.innerHeight, keyboardInset },
    overlay === undefined ? chip : chip === undefined ? overlay : Math.min(overlay, chip),
  );
  panel.style.left = `${geom.left}px`;
  panel.style.width = `${geom.width}px`;
  panel.style.bottom = `${geom.bottom}px`;
  // The key name beside the glyph gives way first on a narrow column: there it
  // took the width the translation needs (the glyph's title still names it).
  panel.dataset.narrow = String(geom.width < HINT_MIN_WIDTH);
  // offsetHeight, not the box: the panel slides in by a 5px transform.
  reserveChat(composer, window.innerHeight - geom.bottom - panel.offsetHeight);
}

/**
 * Padding added under Kick's chat list while the panel is up, so the last
 * lines scroll above it instead of under it (chatReserve says why). Checked on
 * kick.com: #chatroom-messages is a plain block scroller with absolutely
 * placed rows, so bottom padding extends its scroll range and Kick keeps it.
 * shortcut: found by Kick's id only; if Kick renames it the panel covers the
 * last line again, as before, and nothing else breaks.
 */
let reserved: { list: HTMLElement; prev: string; px: number } | undefined;

function reserveChat(composer: HTMLElement, panelTop: number): void {
  const list = composer.closest('#channel-chatroom')?.querySelector<HTMLElement>('#chatroom-messages');
  if (!list) return releaseChat();
  if (reserved && reserved.list !== list) releaseChat();
  const px = chatReserve(panelTop, list.getBoundingClientRect().bottom);
  if (reserved?.px === px) return; // also what stops the scroll below from looping back here
  if (px === 0) return releaseChat();
  // Following the chat at the bottom: stay at the bottom. Reading back up: no jump.
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 4;
  reserved ??= { list, prev: list.style.paddingBottom, px: 0 };
  reserved.px = px;
  list.style.paddingBottom = `${px}px`;
  if (atBottom) list.scrollTop = list.scrollHeight;
}

function releaseChat(): void {
  if (!reserved) return;
  reserved.list.style.paddingBottom = reserved.prev;
  reserved = undefined;
}

/**
 * Our own language chip, in the row just above the composer. The panel sat on
 * the composer's top edge and covered 18 of its 24px: the control that sets
 * this preview's language was out of reach while typing, and the bottom 6px of
 * its outline showed under the panel.
 */
function chipTopAbove(composerTop: number): number | undefined {
  const chip = document.querySelector<HTMLElement>('.kt-chip');
  if (!chip) return undefined;
  const box = chip.getBoundingClientRect();
  if (box.height === 0) return undefined;
  return box.top < composerTop && box.bottom <= composerTop + 8 ? box.top : undefined;
}

// Kick's own popups over the composer: completion lists (`:emote`, `@user`,
// `/command`, where Tab completes) and the emote picker, which our preview
// covered. Always in the DOM, open = has height (measured on kick.com 2026-10-16).
// 7TV replaces the `:emote` list with its own, which our preview covered too.
const KICK_SUGGESTION_PANELS =
  '#chat-emote-suggestion-panel, #chat-mention-panel, #chat-command-suggestion-panel, #chat-emotes-picker-panel, .seventv-autocomplete-list';

export function isKickSuggestionOpen(): boolean {
  return [...document.querySelectorAll<HTMLElement>(KICK_SUGGESTION_PANELS)].some(
    (el) => el.getBoundingClientRect().height > 0,
  );
}

// Overlays Kick pops up over the composer (emote / emoji picker, autocomplete) that
// our panel must not overlap. Selector-light + size-gated so it ignores the small
// toggle buttons and never dodges ordinary chat content.
const OVERLAY_SELECTORS = [
  '[data-testid*="emote" i]',
  '[data-testid*="emoji" i]',
  '[class*="emote-picker" i]',
  '[class*="emoji-picker" i]',
  '[role="dialog"]',
  '[role="listbox"]',
];

/**
 * Viewport-relative top of an overlay that opens *above* the composer, or undefined
 * when none is open — so the panel can sit above the overlay rather than under it.
 */
function findOverlayTopAbove(composer: HTMLElement, composerTop: number): number | undefined {
  for (const sel of OVERLAY_SELECTORS) {
    let nodes: NodeListOf<HTMLElement>;
    try {
      nodes = document.querySelectorAll<HTMLElement>(sel);
    } catch {
      continue; // invalid selector, skip
    }
    for (const el of nodes) {
      if (el.id === COMPOSE_ID || el.contains(composer) || composer.contains(el)) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 40 || box.height < 40) continue; // ignore icons / toggle buttons
      // A popover sitting above the composer (not the chat list below, nor a side panel).
      if (box.top < composerTop && box.bottom <= composerTop + 8) return box.top;
    }
  }
  return undefined;
}

export function updateComposePreview(state: ComposeUiState): void {
  if (!ui) return;
  const { panel, textEl } = ui;
  switch (state.kind) {
    case 'hidden':
      panel.dataset.state = 'hidden';
      releaseChat();
      // Once hidden, the text belongs to a message that is gone: the next
      // 'loading' would pulse it under a different message (measured).
      textEl.textContent = '';
      return;
    case 'loading':
      // Keep prior text visible and pulsing while refreshing. On a first
      // translation (no text yet) stay hidden so there's no empty-panel flash.
      panel.dataset.state = textEl.textContent ? 'loading' : 'hidden';
      if (!textEl.textContent) releaseChat();
      if (textEl.textContent) ui.reposition();
      return;
    case 'ready':
      // Emotes read as their name, not as Kick's [emote:id:name] markup.
      textEl.textContent = state.text.replace(/\[emote:\d+:([^\]\s]+)\]/g, '$1');
      if (panel.dataset.state === 'hidden') noteHintShown();
      panel.dataset.state = 'ready';
      ui.reposition();
      return;
  }
}

/**
 * Quelle touche echange ce qu'on a tape contre sa traduction, et ce que le
 * marqueur en dit.
 *
 * Un module et non un parametre de createComposePreview : le panneau est
 * construit une fois et le reglage peut changer sous lui, depuis la page
 * d'options, sans qu'on redessine le chat.
 */
let toucheInsertion: 'tab-and-enter' | 'ctrl-enter' = 'tab-and-enter';

/**
 * Until the reader has inserted a translation once, or seen the panel come up
 * HINT_MAX_SHOWN times, the key is named beside the glyph. Someone who reads
 * the preview and types their own reply never inserts, and kept the hint on
 * every message. Kept in storage.local like the other per-browser memories of
 * this script, never in synced settings: true once done, else the count shown.
 */
const INSERT_HINT_KEY = 'kt.composeInsertHintDone';
const HINT_MAX_SHOWN = 5;
/** Below this panel width the key name is hidden (see positionPanel). */
const HINT_MIN_WIDTH = 300;
let insertHintDone = false;
let insertHintLoaded = false;
let insertHintShown = 0;

function loadInsertHint(): void {
  if (insertHintLoaded) return;
  insertHintLoaded = true;
  try {
    void chrome.storage.local
      .get(INSERT_HINT_KEY)
      .then((got) => {
        const v: unknown = got[INSERT_HINT_KEY];
        if (v === true || (typeof v === 'number' && v >= HINT_MAX_SHOWN)) markInsertHintDone(false);
        else if (typeof v === 'number') insertHintShown = Math.max(insertHintShown, v);
      })
      .catch(() => undefined);
  } catch {
    // No extension context (tests, an orphaned script): keep the hint.
  }
}

/** The panel came up with the hint on it: count it, and retire it after the last one. */
function noteHintShown(): void {
  if (insertHintDone) return;
  if (insertHintShown >= HINT_MAX_SHOWN) {
    markInsertHintDone(true);
    return;
  }
  insertHintShown++;
  try {
    void chrome.storage.local.set({ [INSERT_HINT_KEY]: insertHintShown }).catch(() => undefined);
  } catch {
    // Nothing to remember it in: the count starts over on the next page.
  }
}

function markInsertHintDone(persist: boolean): void {
  if (insertHintDone) return;
  insertHintDone = true;
  const el = document.querySelector<HTMLElement>('.kt-compose-insert');
  if (el) marquerInsertion(el);
  if (!persist) return;
  try {
    void chrome.storage.local.set({ [INSERT_HINT_KEY]: true }).catch(() => undefined);
  } catch {
    // Same: nothing to remember it in, the hint comes back on the next page.
  }
}

/** The reader inserted a translation: they know the key, drop the hint for good. */
export function noteComposeInserted(): void {
  markInsertHintDone(true);
}

/** Le glyphe de la touche, et l'aide qui la nomme. */
function marquerInsertion(el: HTMLElement): void {
  const tab = toucheInsertion === 'tab-and-enter';
  // U+21E5 est le symbole de tabulation, U+21B5 celui du retour. Aucun des
  // deux n'est un emoji : ils se dessinent avec la police du texte.
  el.textContent = tab ? '\u21e5' : '\u21b5';
  const tip = tab
    ? msg('composeInsertTipTab', 'Insert \u00b7 Tab \u00b7 Esc to dismiss')
    : msg('composeInsertTip', 'Insert \u00b7 Ctrl/Cmd+Enter \u00b7 Esc to dismiss');
  // The key name only, quiet, beside the glyph: the verb is in the tooltip.
  // A green "Tab to insert" at 600 was louder than the translation it sat by.
  if (!insertHintDone) {
    const hint = document.createElement('span');
    hint.className = 'kt-compose-hint';
    // Every catalogue's tooltip names the key (composeUi.hint.test.ts), so no English fallback here.
    hint.textContent = insertKeyName(tip, '');
    el.append(hint);
  }
  el.title = tip;
}

/**
 * The key's name as this language writes it ("Strg/Cmd+Eingabe" in German):
 * the middle of the cue's own tooltip, "Insert, <key>, Esc to dismiss" joined
 * by middle dots, so the hint and the tooltip never name two different keys.
 */
export function insertKeyName(tip: string, fallback: string, mac = isMac()): string {
  const parts = tip.split(' \u00b7 ');
  const name = parts.length === 3 && parts[1] ? parts[1] : fallback;
  // "Ctrl/Cmd+Enter" names two keyboards; beside the glyph, only this one's
  // ("Ctrl+Enter", or "Cmd+Enter" on a Mac). The tooltip keeps both.
  return name.replace(/^([^/+]+)\/([^/+]+)\+/, (_, pc: string, apple: string) => `${mac ? apple : pc}+`);
}

function isMac(): boolean {
  try {
    return /Mac|iPhone|iPad/.test(navigator.platform);
  } catch {
    return false;
  }
}

/** Appele au demarrage et a chaque changement de reglages. */
export function setComposeInsertKey(mode: 'tab-and-enter' | 'ctrl-enter'): void {
  toucheInsertion = mode;
  const el = document.querySelector<HTMLElement>('.kt-compose-insert');
  if (el) marquerInsertion(el);
}

/** Update the target badge when the detected channel language (or override) changes. */
export function setComposeTargetLang(lang: string): void {
  if (ui) setTargetBadge(ui.targetEl, lang);
}

function setTargetBadge(el: HTMLElement, lang: string): void {
  el.replaceChildren(flagEl(lang) ?? lang.toUpperCase().slice(0, 2));
  el.title = msg('composeAutoTip', 'Auto · writing in $LANG$', [
    getLang(lang)?.native ?? lang.toUpperCase(),
  ]);
}

export function isComposePreviewMounted(): boolean {
  return ui !== undefined && document.getElementById(COMPOSE_ID) !== null;
}

/** True when a translation is currently on screen (used for keyboard shortcuts). */
export function isComposePreviewVisible(): boolean {
  return ui?.panel.dataset.state === 'ready';
}

/** Toggle a subtle rate-limit indicator on the panel. */
export function setComposeThrottle(on: boolean): void {
  if (ui) ui.panel.dataset.throttled = on ? 'true' : 'false';
}

export function unmountComposePreview(): void {
  if (ui) {
    window.removeEventListener('scroll', ui.reposition, { capture: true } as EventListenerOptions);
    window.removeEventListener('resize', ui.reposition);
    window.visualViewport?.removeEventListener('resize', ui.reposition);
    window.visualViewport?.removeEventListener('scroll', ui.reposition);
    ui.resizeObs?.disconnect();
  }
  releaseChat();
  document.getElementById(COMPOSE_ID)?.remove();
  ui = undefined;
}

// ─── Writing the translation back into Kick's composer ───────────────────────

/**
 * Insert `text` into the composer, replacing its current content. Falls back to
 * the clipboard (with a toast) when the editor genuinely doesn't accept the write.
 *
 * Kick ships a Lexical contenteditable (`div.editor-input[role=textbox]`). Verified
 * live: `document.execCommand('insertText')` is silently ignored there, but a
 * synthetic `beforeinput`/insertText over a full selection is honoured and replaces
 * the content. Lexical reconciles a frame later, so success is checked async.
 */
export function insertIntoComposer(el: HTMLElement, text: string, mode: 'insert' | 'copy'): void {
  if (mode === 'copy') {
    copyAndToast(text);
    return;
  }
  try {
    const before = readComposerText(el).trim();

    // Native textarea/input (legacy / mobile layouts): write via the prototype
    // setter so React's value tracker notices, then fire input.
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.focus();
      el.select();
      setNativeValue(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    el.focus();
    // Emotes in the box: a select-all replace would delete them, so the page
    // world rewrites the editor state around them (background/lexicalWrite).
    if (el.querySelector('img[data-emote-id]')) {
      el.dataset.ktComposer = '';
      // No editor reachable (another layout, a browser without world MAIN): the
      // plain replace keeps the words, the emotes as [emote:id:name] text.
      send({ type: 'compose.write', parts: morceauxPourEditeur(text, readComposerText(el)) })
        .then((r) => r.type === 'ack' || replaceAll(el, text))
        .catch(() => replaceAll(el, text));
      return;
    }
    replaceAll(el, text);

    // Fall back to clipboard only if the box is genuinely unchanged after the
    // editor has had a frame to apply — a lenient check so editor-side transforms
    // (emoji shortcodes, autolink) don't trigger a spurious "copied" toast.
    // An unchanged box only means the insert failed when the translation would
    // have changed it. When it matches what was typed there is nothing to rescue,
    // and copying anyway would overwrite the user's clipboard for nothing.
    window.setTimeout(() => {
      if (text.trim() !== before && readComposerText(el).trim() === before) copyAndToast(text);
    }, 180);
  } catch {
    copyAndToast(text);
  }
}

// Rich contenteditable: select-all so the translation replaces the typed
// source, then drive a synthetic insertText that Lexical/React will apply.
function replaceAll(el: HTMLElement, text: string): void {
  selectAllIn(el);
  el.dispatchEvent(
    new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }),
  );
}

function selectAllIn(el: HTMLElement): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.select();
    return;
  }
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

function setNativeValue(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc?.set) desc.set.call(el, value);
  else el.value = value;
}

function copyAndToast(text: string): void {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
  showToast(msg('toastCopied', 'Translation copied. Paste it with Ctrl+V.'));
}
