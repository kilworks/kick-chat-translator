/**
 * Pure, DOM-free decision logic for the compose preview (outgoing translation).
 *
 * Kept separate from the DOM controller (`compose.ts`) and the panel UI
 * (`composeUi.ts`) so the fluidity-critical bits — what to translate, request
 * ordering, and rate limiting — are deterministic and unit-testable in isolation.
 */
import { isNoise, isSameLanguageAsTarget } from './filters';
import { isSlangOnly } from '~/shared/glossary';
import { EMOTE_NAME_RE } from './emoteParser';

/** Wait this long after the last keystroke before translating the settled text. */
export const COMPOSE_DEBOUNCE_MS = 320;
/** Don't bother translating fragments shorter than this. */
export const COMPOSE_MIN_LEN = 2;
/** Don't translate anything longer than this — chat lines are short; huge input is a paste. */
export const COMPOSE_MAX_LEN = 500;
/** Safety net against pathological typing — caps network calls per rolling minute. */
export const COMPOSE_MAX_PER_MIN = 30;

export type ComposeAction =
  | 'translate'
  | 'skip-empty'
  | 'skip-short'
  | 'skip-long'
  | 'skip-noise'
  | 'skip-same-lang'
  | 'skip-unchanged';

/** True when the text is nothing but links and/or @mentions — nothing to translate. */
export function isLinkOrMentionOnly(text: string): boolean {
  if (!/\S/.test(text)) return false;
  const stripped = text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
  return stripped.length === 0;
}

// Kick's emote markup, as readComposerText writes the composer's emote images.
const EMOTE_TOKEN_RE = /\[emote:\d+:[^\]\s]+\]/g;
// The same, plus emote names typed as words (7TV turns "pepe" + Tab into
// "PepePls" as plain text). Google mangles those 44% of the time (peepoJoyeux).
const ANY_EMOTE_RE = new RegExp(`${EMOTE_TOKEN_RE.source}|${EMOTE_NAME_RE.source}`, 'g');

/**
 * What the engine is asked to translate: the words, without the emotes, line
 * breaks kept.
 *
 * The emotes used to travel as ⟦n⟧ placeholders. Measured on the free Google
 * endpoint, 12 chat lines x 3 emote positions x 15 targets: Chinese came back
 * BLANK on 7 of 36 lines, and 213 of 540 lines were worded differently from
 * the same words sent alone ("quel bon frère vivant" for "direct"). Sent alone,
 * the words translate exactly as they did before emotes were kept at all.
 */
export function motsPourMoteur(text: string): string {
  return text
    .replace(ANY_EMOTE_RE, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * The translated words put back among the composer's emotes: parts[i] goes
 * before emote i, the last part after the last one. The words take the place
 * of the first stretch that held words, so an emote typed before them stays
 * before, one typed after stays after, and one typed between words ends up
 * after them (the engine reorders words; where "between" falls is unknowable).
 */
export function morceauxAutourDesEmotes(traduit: string, source: string, re: RegExp = EMOTE_TOKEN_RE): string[] {
  const avant = source.split(re);
  const ou = Math.max(0, avant.findIndex((p) => p.trim() !== ''));
  const dernier = avant.length - 1;
  return avant.map((_, i) =>
    i === ou ? `${i > 0 ? ' ' : ''}${traduit.trim()}${i < dernier ? ' ' : ''}` : '',
  );
}

/**
 * What the editor write gets from the text Tab inserts. That text already has
 * the emotes back in as Kick markup (remettreEmotes), while the editor keeps
 * its emote nodes: passed as is, every insert typed `[emote:id:name]` out as
 * words next to the emote it stands for (measured live, compose-scenarios T2).
 */
export function morceauxPourEditeur(insere: string, source: string): string[] {
  const mots = insere.replace(EMOTE_TOKEN_RE, ' ').replace(/ {2,}/g, ' ').trim();
  return morceauxAutourDesEmotes(mots, source);
}

/**
 * The same, as one text with the emotes back in, Kick markup and typed names
 * alike: what the preview shows and Tab inserts. The insert then cuts that text
 * on Kick markup only, since only those are nodes in the editor.
 */
export function remettreEmotes(traduit: string, source: string): string {
  const emotes = source.match(ANY_EMOTE_RE) ?? [];
  if (emotes.length === 0) return traduit;
  return morceauxAutourDesEmotes(traduit, source, ANY_EMOTE_RE)
    .map((p, i) => p + (emotes[i] ?? ''))
    .join('');
}

/**
 * Would Tab change nothing? The engine handed the text back as it was, as it
 * does for a translation just inserted and read again (measured: the preview
 * came back with the very words in the box). Case and spacing don't count.
 */
export function rienAEchanger(source: string, traduit: string): boolean {
  const n = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();
  return n(source) === n(traduit);
}

/** The words only: what language detection and the length/noise gates look at. */
export function sansEmotes(text: string): string {
  return text.replace(ANY_EMOTE_RE, ' ').replace(/\s+/g, ' ').trim();
}

// @handles and URLs the translator must leave untouched in YOUR outgoing message.
const PROTECT_RE = /(?:https?:\/\/\S+|@[\w.]+)/g;

/**
 * Replace @mentions and URLs with inert placeholders so the translation engine
 * doesn't mangle a username or link in the message you're composing. Restore them
 * after translation with {@link unmaskProtected}.
 */
export function maskProtected(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(PROTECT_RE, (m) => {
    tokens.push(m);
    return `⟦${tokens.length - 1}⟧`;
  });
  return { masked, tokens };
}

export function unmaskProtected(text: string, tokens: string[]): string {
  if (tokens.length === 0) return text;
  // Spaces tolerated inside the brackets. Measured on the free Google endpoint
  // with three messages into all 42 other languages: 124 of 126 kept the
  // placeholder intact, and the two that did not were Cantonese, which came back
  // as "⟦ 0 ⟧" and left the reader's @mention and link out of the message.
  return text.replace(/⟦\s*(\d+)\s*⟧/g, (whole, n: string) => tokens[Number(n)] ?? whole);
}

/**
 * Decide whether the currently-typed text warrants a (network) translation.
 * All cheap gates run before any request is issued — this is the first line of
 * defence for both quota and fluidity.
 *
 * @param text            current composer text (raw, untrimmed)
 * @param lastTranslated  the text we last produced a translation for (for dedup)
 * @param detected        auto-detected source language (ISO2) or undefined
 * @param target          desired output language (ISO2)
 * @param minLen          minimum meaningful length
 */
export function decideComposeAction(
  text: string,
  lastTranslated: string | undefined,
  detected: string | undefined,
  target: string,
  minLen: number = COMPOSE_MIN_LEN,
): ComposeAction {
  const full = text.trim();
  // Gates judge the words: an emote-only message has nothing to translate.
  const t = sansEmotes(full);
  if (t.length === 0) return 'skip-empty';
  if (t.length < minLen) return 'skip-short';
  if (t.length > COMPOSE_MAX_LEN) return 'skip-long';
  // Don't translate when *you* type pure streaming slang/emotes or only handles/links.
  if (isNoise(t) || isLinkOrMentionOnly(t) || isSlangOnly(t)) return 'skip-noise';
  // Only skip on a *confident* same-language detection — undefined means "let the
  // provider auto-detect", which is correct for short/ambiguous input.
  if (detected && isSameLanguageAsTarget(detected, target)) return 'skip-same-lang';
  if (lastTranslated !== undefined && full === lastTranslated.trim()) return 'skip-unchanged';
  return 'translate';
}

/**
 * Monotonic request sequencer. Every in-flight translation gets an id; a response
 * is applied only when it is still the latest — stale responses (the user kept
 * typing) are dropped so the preview never flickers to an out-of-date result.
 */
export class Sequencer {
  private latest = 0;

  next(): number {
    return ++this.latest;
  }

  get current(): number {
    return this.latest;
  }

  isCurrent(id: number): boolean {
    return id === this.latest;
  }
}

export interface PanelGeom {
  left: number;
  width: number;
  bottom: number;
}

/** Viewport facts the panel placement needs — passed in so the math stays pure. */
export interface PanelViewport {
  innerWidth: number;
  innerHeight: number;
  /** Height hidden behind an on-screen keyboard (visualViewport bottom inset), px. */
  keyboardInset: number;
}

/** Gap between the panel and whatever it sits above. */
export const COMPOSE_PANEL_GAP = 6;
/** Keep at least this much of the viewport above the panel so its top never clips. */
export const COMPOSE_PANEL_TOP_MARGIN = 30;

/**
 * Fixed-position geometry for the compose panel: glued just above the composer,
 * clamped fully inside the viewport, lifted clear of the on-screen keyboard
 * (`keyboardInset`) and of any overlay that opens over the composer (`obstacleTop`,
 * a viewport-relative Y). Pure so the placement is unit-tested without a DOM.
 *
 * `bottom` is a CSS `bottom` offset (distance from the viewport's bottom edge).
 */
export function computePanelGeom(
  rect: { left: number; top: number; width: number },
  vp: PanelViewport,
  obstacleTop?: number,
): PanelGeom {
  const width = Math.round(rect.width);
  const maxLeft = Math.max(4, vp.innerWidth - width - 4);
  const left = Math.min(Math.max(4, Math.round(rect.left)), maxLeft);

  const keyboardFloor = Math.max(0, Math.round(vp.keyboardInset)) + 4;
  let bottom = Math.round(vp.innerHeight - rect.top + COMPOSE_PANEL_GAP);
  // If an overlay (emote/emoji picker) opens above the composer, clear it.
  if (obstacleTop !== undefined && obstacleTop < rect.top) {
    bottom = Math.max(bottom, Math.round(vp.innerHeight - obstacleTop + COMPOSE_PANEL_GAP));
  }
  // Keep the top edge on-screen, then never let the keyboard cover it.
  bottom = Math.min(bottom, vp.innerHeight - COMPOSE_PANEL_TOP_MARGIN);
  bottom = Math.max(bottom, keyboardFloor);
  return { left, width, bottom };
}

/**
 * Room to add under Kick's chat list so its newest lines sit above the panel.
 *
 * Measured on kick.com (1280x720 and 1500x950, 2026-11-20): the list ends 34px
 * above the composer and a one-line panel is 38px tall from 6px above it, so it
 * covered the bottom 10px of the last line, and nearly all of it on a channel
 * without the chat-mode band ("Followers only") that fills part of that gap.
 * The line hidden is the one a reply is usually about.
 *
 * @param panelTop viewport Y of the panel's top edge
 * @param listBottom viewport Y of the chat list's bottom edge
 */
export function chatReserve(panelTop: number, listBottom: number): number {
  return Math.max(0, Math.ceil(listBottom - panelTop));
}

/** Sliding-window rate limiter. */
export class RateLimiter {
  private hits: number[] = [];

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true and records a hit when under the cap; false when the window is full. */
  tryAcquire(now: number = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    this.hits = this.hits.filter((t) => t > cutoff);
    if (this.hits.length >= this.max) return false;
    this.hits.push(now);
    return true;
  }
}

/**
 * Cette frappe echange-t-elle le message contre sa traduction ?
 *
 * Une fonction et non trois lignes dans le gestionnaire, parce que le choix a
 * des bords qui se testent mal a travers le DOM : Shift+Tab doit passer, Tab
 * seul ne doit rien prendre en mode 'ctrl-enter', et Ctrl/Cmd+Entree doit
 * marcher dans les deux modes.
 *
 * L'appelant a deja verifie que l'apercu est a l'ecran. C'est lui qui paie
 * pour Tab : sans apercu il n'y a rien a accepter et la touche n'est jamais
 * touchee, ce qui est la seule raison pour laquelle prendre la touche de
 * navigation est acceptable.
 */
export function toucheEchange(
  e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey'>,
  mode: 'tab-and-enter' | 'ctrl-enter',
): boolean {
  if (e.key === 'Tab') return mode === 'tab-and-enter' && !e.shiftKey;
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey);
}
