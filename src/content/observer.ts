import {
  buildSyntheticId,
  enclosingMessageRow,
  extractMessageText,
  extractUsername,
  findAllRows,
  findChatContainer,
  isShown,
  matchesMessageRow,
  pickInjectionTarget,
} from './selectors';
import { rootLogger } from '~/shared/logger';
import { createMetrics } from '~/shared/metrics';

const log = rootLogger.child('observer');
const metrics = createMetrics('content');

export interface DomMessage {
  /** The row element (`div[data-index]`). */
  rowElement: Element;
  /** Container we should append translations into (kept INSIDE the message bubble). */
  injectionTarget: Element;
  id: string;
  text: string;
  usernameGuess: string | undefined;
}

type Callback = (msg: DomMessage) => void;

const PROCESSED_MARK = 'data-kt-id';

/**
 * Signe la marque de CETTE instance du script.
 *
 * Une mise a jour de l'extension laisse l'ancien script dans la page, coupe de
 * `chrome.runtime` mais toujours observateur. Son MutationObserver a ete cree
 * le premier, donc il marque chaque nouvelle ligne avant le nouveau script, qui
 * la prenait pour deja traitee : l'onglet ne traduisait plus rien. Les versions
 * deja publiees ecrivent l'id nu ; une marque prefixee par instance ne peut pas
 * leur etre egale.
 */
export const INSTANCE = Math.random().toString(36).slice(2, 8);

export class ChatObserver {
  private listObserver: MutationObserver | undefined;
  private containerWatcher: MutationObserver | undefined;
  private container: Element | undefined;
  private pollHandle: ReturnType<typeof setTimeout> | undefined;
  private seenIds = new Set<string>();
  private cb: Callback;
  private running = false;

  constructor(cb: Callback) {
    this.cb = cb;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tryAttach();
  }

  stop(): void {
    this.running = false;
    this.detach();
  }

  reset(): void {
    this.detach();
    if (this.running) this.tryAttach();
  }

  /** Single teardown path: both observers are dropped together or neither is. */
  private detach(): void {
    // A pending poll is part of what is attached: left running, it attaches a
    // second pair of observers beside the next one (two reset() calls while the
    // list is missing, measured: three pairs left connected).
    clearTimeout(this.pollHandle);
    this.pollHandle = undefined;
    this.listObserver?.disconnect();
    this.listObserver = undefined;
    this.containerWatcher?.disconnect();
    this.containerWatcher = undefined;
    this.container = undefined;
    this.seenIds.clear();
  }

  private tryAttach(): void {
    if (!this.running) return;
    const container = findChatContainer(document);
    if (container) {
      if (__KT_METRICS__) metrics.count('dom.attach');
      this.attach(container);
      return;
    }
    // Selector health, the early warning for a Kick redesign. Today the only
    // signal is a toast the user sees once the extension is already broken; this
    // is the same fact, an hour earlier, in a number that can be read on demand.
    if (__KT_METRICS__) metrics.count('dom.container.miss');
    this.pollHandle = setTimeout(() => this.tryAttach(), 500);
  }

  private attach(container: Element): void {
    log.debug('attached to', container.tagName, container.className);
    this.container = container;

    for (const row of findAllRows(container)) this.process(row);

    // Virtual scrollers recycle DOM nodes: when a row is reused its inner content
    // is REPLACED (a childList mutation on the subtree), so childList+subtree is
    // sufficient. We deliberately do NOT watch characterData/attributes — on a
    // fast chat those fire constantly and would thrash the callback for no gain.
    this.listObserver = new MutationObserver((mutations) => {
      const candidates = new Set<Element>();
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (matchesMessageRow(node)) candidates.add(node);
          else {
            for (const row of findAllRows(node)) candidates.add(row);
          }
        }
        // Upward, for the recycling case the comment above describes. Replacing
        // a row's contents makes the row the mutation TARGET and never an added
        // node, so the loop above walks past it: measured with the extension
        // loaded, eight recycled rows were left untranslated, with no reason on
        // the line and no provider call. Re-processing a row whose text has not
        // changed costs nothing, since `process` returns on the id it already
        // carries, which is what keeps our own insertions from looping.
        const row = enclosingMessageRow(mut.target);
        if (row) candidates.add(row);
      }
      for (const row of candidates) this.process(row);
    });
    this.listObserver.observe(container, { childList: true, subtree: true });

    // Detect re-mount of the container (channel switch) at the document level.
    //
    // Removal is one way to lose it, hiding is the other: on a channel switch
    // Kick keeps the previous chat as a hidden copy and never removes it, so a
    // watcher that only checked `document.contains` stayed on a list that would
    // never receive another message. Checked at most twice a second, because
    // reading the layout on every mutation of a fast chat is not free.
    let lastShownCheck = 0;
    this.containerWatcher = new MutationObserver(() => {
      if (!document.contains(container)) {
        log.debug('container removed, rescanning');
        if (__KT_METRICS__) metrics.count('dom.container.remount');
        this.reset();
        return;
      }
      const now = Date.now();
      if (now - lastShownCheck < 500) return;
      lastShownCheck = now;
      if (isShown(container)) return;
      const onScreen = findChatContainer(document);
      if (onScreen && onScreen !== container && isShown(onScreen)) {
        log.debug('container hidden, moving to the one on screen');
        if (__KT_METRICS__) metrics.count('dom.container.hidden');
        this.reset();
      }
    });
    this.containerWatcher.observe(document.body, { childList: true, subtree: true });
  }

  private process(row: Element): void {
    if (__KT_METRICS__) metrics.count('dom.row.seen');
    const text = extractMessageText(row);
    if (!text) {
      // A row the observer matched but whose text selector returned nothing. A
      // handful is normal (system lines, emote-only rows). A ratio climbing
      // toward dom.row.seen means the message selectors stopped matching, which
      // is exactly what a Kick markup change looks like from in here.
      if (__KT_METRICS__) metrics.count('dom.row.textEmpty');
      return;
    }
    const username = extractUsername(row) ?? '';
    if (__KT_METRICS__ && !username) metrics.count('dom.row.noUsername');
    const id = buildSyntheticId(row, username, text);

    // If the row already carries our id mark AND it matches, we already processed it.
    const mark = `${INSTANCE}:${id}`;
    const prev = row.getAttribute(PROCESSED_MARK);
    if (prev === mark) return;
    if (this.seenIds.has(id)) {
      row.setAttribute(PROCESSED_MARK, mark);
      return;
    }
    this.seenIds.add(id);
    row.setAttribute(PROCESSED_MARK, mark);
    // Bound memory on long sessions (hours of fast chat).
    if (this.seenIds.size > 4000) this.cap(3000);

    this.cb({
      rowElement: row,
      injectionTarget: pickInjectionTarget(row),
      id,
      text,
      usernameGuess: username || undefined,
    });
  }

  cap(maxSeen = 5000): void {
    if (this.seenIds.size <= maxSeen) return;
    const arr = Array.from(this.seenIds);
    this.seenIds = new Set(arr.slice(-maxSeen));
  }
}
