import type { Settings } from '~/shared/settings';
import type { Decision } from '~/shared/messages';
import type { ProviderId, TranslationOutcome, TranslationResult } from '~/shared/types';
import { MAX_TEXT_LENGTH } from '~/shared/constants';
import { rootLogger } from '~/shared/logger';
import { send } from '~/shared/messages';
import { applyUserGlossary, isSlangOnly } from '~/shared/glossary';
import { createMetrics } from '~/shared/metrics';
import { mentionsOf, parseKickContent } from './emoteParser';
import { countUsage } from './usage';
import { spellOutAbbreviations } from './abbreviations';
import { extractMessageText, findAllRows } from './selectors';
import { confidentLanguage, detectLanguage } from './langDetect';
import { resolveBrowserLang } from '~/shared/languages';
import { isContextCritical } from '~/shared/langTiers';
import { hasBlockedKeyword, hasNonEnglishLetter, isBareCommand, isNoise, isSameLanguageAsTarget, normalizeElongation, shouldDropBySourceLang, shouldDropByUserOrChannel, trimForEngine } from './filters';
import { HANDLED_SELECTOR, inject, incrementFloatingCount, armHoverTranslate, markSkipped, removeAllArtifacts, showError, showLoading, showThrottleIndicator, showToast, updateActiveProvider } from './injector';
import { localEngine } from './localEngine';
import { memCache } from './memcache';
import { msg as localised } from './msg';

const log = rootLogger.child('pipeline');
const metrics = createMetrics('content');

export interface IncomingDomMessage {
  rowElement: Element;
  injectionTarget: Element;
  id: string;
  text: string;
  channel: string;
  username: string;
  isBot: boolean;
}

export interface IncomingWsMessage {
  id: string;
  text: string;
  channel: string;
  username: string;
  isBot: boolean;
}

interface Prepared {
  /** What goes to the engine: the line's words, abbreviations spelled out when English. */
  real: string;
  detected: string | undefined;
  /** `confidentLanguage` of the line as written, for the engine's `sl`. */
  hint: string | undefined;
}

interface RawResult {
  translatedText: string;
  detectedLang: string;
  provider: ProviderId;
}

/**
 * Filter codes turned into something a reader can act on.
 *
 * English only, like every other string this content script shows. It has no
 * translation runtime of its own, and giving it one would put the whole UI
 * catalogue (about 67 KB) on every Kick page just to fill a tooltip.
 */
const DROP_REASON: Record<string, string> = {
  bot: localised('dropBot', 'the sender looks like a bot'),
  user_blacklisted: localised('dropUserBlocked', 'this user is on your blocked list'),
  channel_blacklisted: localised('dropChannelBlocked', 'this channel is on your blocked list'),
  channel_not_whitelisted: localised('dropChannelNotAllowed', 'this channel is not on your allowed list'),
  lang_unknown: localised('dropLangUnknown', 'its language could not be identified'),
  lang_not_allowed: localised('dropLangNotAllowed', 'its language is not on your allowed list'),
};

/** How many decisions the Debug tab can look back over. */
const DECISION_LOG_MAX = 50;

const CONTEXT_LINES = 2;
// Pro-drop, no-person-marking sources (ja/ko/zh/vi/th/ar) drop the subject; feeding
// more prior dialogue lets DeepL's `context` infer the right person ("he", not "I").
const CONTEXT_LINES_HARD = 6;
const MAX_CONTEXT_KEEP = CONTEXT_LINES_HARD + 1;

export class TranslationPipeline {
  private settings: Settings;
  private recent = new Map<string, string[]>();
  /** Per-user dedup: skip identical messages spammed by the same user. */
  private userDedup = new Map<string, string>();
  /**
   * The last few calls this made, so the Debug tab can show them. Memory only,
   * never written to storage, and dropped with the page.
   */
  private decisions: Decision[] = [];

  private note(text: string, outcome: string): void {
    // Kept whole enough to be readable in full on hover. Still bounded, because
    // this text comes from a page we do not control.
    this.decisions.push({ at: Date.now(), text: text.slice(0, 200), outcome });
    if (this.decisions.length > DECISION_LOG_MAX) this.decisions.shift();
  }

  /** Newest first, for the Debug tab. */
  recentDecisions(): Decision[] {
    return [...this.decisions].reverse();
  }

  /**
   * Leave the reason on the line and remember it. An empty reason clears the
   * line, which every message about to be translated does, so a recycled row
   * never keeps the explanation of the message that used it before.
   */
  private skip(msg: IncomingDomMessage, reason: string): void {
    markSkipped(msg.injectionTarget, reason);
    countUsage('skipped');
    if (reason) {
      this.note(msg.text, reason);
      // The Debug tab shows the last 50 one by one, which answers "why was THIS
      // line left alone" and never "what share of chat never reaches an engine".
      // The defaults for ignoreEnglish and minTextLength were picked without it.
      if (__KT_METRICS__) metrics.count(`skip.${reason}`);
    }
  }

  constructor(settings: Settings) {
    this.settings = settings;
    // Bound dedup map size.
    setInterval(() => { if (this.userDedup.size > 200) this.userDedup.clear(); }, 60_000);
  }

  updateSettings(next: Settings): void {
    const before = this.settings;
    this.settings = next;
    if (before.enabled !== next.enabled || before.blockedKeywords.join('\n') !== next.blockedKeywords.join('\n')) {
      this.reapplyBlocked();
    }
  }

  /**
   * Hide or show every row already on screen for the current keywords.
   *
   * Only new messages went through the check, so a keyword added while the
   * spam was on screen hid nothing that was there, and neither did the lines
   * present when the extension attached (measured on a live chat with the
   * keyword set: 6 to 7 matching lines stayed visible). Typing "!fish" is
   * what someone does once the chat is already full of it.
   */
  reapplyBlocked(root: ParentNode = document): void {
    for (const row of findAllRows(root)) {
      const blocked = this.settings.enabled && hasBlockedKeyword(extractMessageText(row), this.settings);
      (row as HTMLElement).style.display = blocked ? 'none' : '';
    }
  }

  /**
   * Reading target — resolves the 'auto' sentinel to the user's browser language.
   *
   * ⚠️ Read from `this.settings.targetLang`, NEVER `this.effTarget`. Referencing the
   * getter from inside itself is infinite recursion (`RangeError: Maximum call stack`).
   * That exact typo shipped in v2.1.0–v2.2.0 and silently broke ALL incoming translation
   * (`prepare()` threw on every message; the rejection was swallowed by the observer's
   * `void onDomMessage(...)`). See pipeline.test.ts + docs/postmortem-2026-06-03-efftarget-recursion.md.
   */
  private get effTarget(): string {
    return this.settings.targetLang === 'auto' ? resolveBrowserLang() : this.settings.targetLang;
  }

  /** Cheap filters + a single franc-min call. Returns undefined to skip. */
  private prepare(
    rawText: string,
    meta: { username: string; channel: string; isBot: boolean },
    opts: { dedup: boolean } = { dedup: true },
  ): Prepared | string {
    // An empty reason means "skipped, but there is nothing worth telling this
    // line about": the two gates below are about the whole tab, not the message.
    if (!this.settings.enabled) return '';
    // Live visibility gate — read document.hidden each message so a backgrounded
    // tab never translates (no quota burn), with no stuck-paused state.
    if (this.settings.pauseWhenHidden && typeof document !== 'undefined' && document.hidden) {
      return '';
    }
    const dropped = shouldDropByUserOrChannel(meta, this.settings);
    if (dropped) return DROP_REASON[dropped] ?? dropped;

    // Per-user dedup: if this user just sent the exact same message, skip it.
    // Common in chat spam — saves a provider call + avoids duplicate translations.
    // Only the DOM path takes part. It is the only path that displays, so letting
    // the websocket warm pass claim the slot first would suppress the display of a
    // message nobody has seen yet.
    if (opts.dedup) {
      const dedupKey = meta.username.toLowerCase();
      if (dedupKey && this.userDedup.get(dedupKey) === rawText) return localised('skipDuplicate', 'the same user just sent this');
      if (dedupKey) this.userDedup.set(dedupKey, rawText);
    }

    const parsed = parseKickContent(rawText).realText;
    if (isBareCommand(parsed)) return localised('skipCommand', 'it is a command for a chat bot');
    const realText = trimForEngine(parsed);
    if (realText.length < this.settings.minTextLength) {
      return `it is shorter than your ${this.settings.minTextLength} character minimum`;
    }
    if (realText.length > MAX_TEXT_LENGTH) return localised('skipTooLong', 'it is longer than the size limit');
    if (isNoise(realText)) return localised('skipNoise', 'it is only emoji, symbols or laughter'); // kkkk / rsrs / xd / digits
    if (isSlangOnly(realText)) return localised('skipSlang', 'it is only chat slang'); // poggers / copium / kekw …

    const detected = detectLanguage(realText);
    // Three exits can end a line for "already readable", and they are not the
    // same event: two of them decide here without asking anyone, the third is
    // the service answering after the call was made. Each says which it is, or
    // the Debug tab shows two verdicts for what looks like one case.
    if (this.settings.ignoreEnglish && this.effTarget === 'en' && detected === 'en' && !hasNonEnglishLetter(realText)) {
      return localised('skipEnglish', 'it looks like English and you asked to skip English');
    }
    // This one deletes the line. It gets the looked-up answer, never the guessed
    // one, and that is the whole difference between a message the reader skips
    // and a message the reader never knew existed.
    //
    // What it used to get: `detected`, franc included. Measured against 5040
    // Tatoeba sentences in 42 languages (src/content/langMatrix.test.ts), franc
    // included is wrong on 24 percent of all lines and 29 percent of the short
    // ones a chat is made of. Every one of those wrong answers naming language T
    // is a line deleted from the screen of every reader reading in T: 133 lines
    // for a Spanish reader, 110 for a French one, 126 for a Swedish one, 1217 in
    // total. On the looked-up answer the same count is 90, a 93 percent drop,
    // and what is left is almost all Bulgarian and Ukrainian read as Russian by
    // the Cyrillic rule, which is a rule to sharpen rather than a guess to stop
    // trusting.
    //
    // The cost is the other direction and it is small: a line genuinely in the
    // reader's language that only franc recognised now goes to the engine and
    // comes back identical, caught by the `tt === real` check after the call. A
    // wasted request against a message restored.
    //
    // The two neighbours above and below deliberately keep `detected`:
    //   ignoreEnglish, because measured on the same corpus the safe answer names
    //   only 1 English line in 120 against 78 for franc, so switching it would
    //   send two thirds of a genuinely English chat to the engine to save the 48
    //   foreign lines franc miscalls English. Bad trade, and revisit it when the
    //   short-word table covers more than six languages.
    //   shouldDropBySourceLang, because it drops on `lang_unknown`, so feeding it
    //   a quieter detector makes it delete MORE for anyone who set an allowlist.
    //   That one needs its semantics rethought, not its input swapped.
    const hint = confidentLanguage(realText);
    if (isSameLanguageAsTarget(hint, this.effTarget)) {
      return localised('skipSameLang', 'it is already in your language');
    }
    const byLang = shouldDropBySourceLang(detected, this.settings);
    if (byLang) return DROP_REASON[byLang] ?? byLang;

    // "ngl", "idc", "lmk" reach a reader in another language as they are, or as
    // something else. Spelled out, the engine translates what was said. Same
    // English gate as the skip above, so a Polish `w` or a French `l` stays.
    const real =
      this.effTarget !== 'en' && detected === 'en' && !hasNonEnglishLetter(realText)
        ? spellOutAbbreviations(realText)
        : realText;
    return { real, detected, hint };
  }

  /** Rolling per-channel context (previous lines) for DeepL disambiguation.
   *  Formatted as "username: message" so DeepL understands it's a dialogue. */
  private contextFor(channel: string, current: string, username: string | undefined, lines: number): string {
    const buf = this.recent.get(channel) ?? [];
    const ctx = buf.slice(-lines).join('\n');
    buf.push(username ? `${username}: ${current}` : current);
    if (buf.length > MAX_CONTEXT_KEEP) buf.shift();
    this.recent.set(channel, buf);
    // Bound the map so visiting many channels in one session can't leak.
    if (this.recent.size > 20) {
      const oldest = this.recent.keys().next().value;
      if (oldest !== undefined && oldest !== channel) this.recent.delete(oldest);
    }
    return ctx;
  }

  async onWebSocketMessage(msg: IncomingWsMessage): Promise<void> {
    if (this.settings.engineMode === 'local-only') return;
    const prepared = this.prepare(msg.text, msg, { dedup: false });
    if (typeof prepared === 'string') return;
    // Same source hint as the display path. The warm pass usually reaches the
    // worker first, so the answer it caches is the one the reader sees, and a
    // hint makes it cache an answer translated from a guess.
    const { hint } = prepared;
    try {
      await send({
        type: 'translate',
        payload: {
          messageId: `ws:${msg.id}`,
          text: prepared.real,
          targetLang: this.effTarget,
          channel: msg.channel,
          ...(hint ? { sourceLangHint: hint } : {}),
        },
      });
    } catch (err: unknown) {
      log.debug('ws warmup failed', err);
    }
  }

  async onDomMessage(msg: IncomingDomMessage): Promise<void> {
    // Set both ways: the virtual scroller recycles rows, so a row hidden for a
    // blocked line must come back when it carries the next one.
    const blocked = this.settings.enabled && hasBlockedKeyword(msg.text, this.settings);
    (msg.rowElement as HTMLElement).style.display = blocked ? 'none' : '';
    if (blocked) return;
    const prepared = this.prepare(msg.text, msg);
    if (typeof prepared === 'string') {
      this.skip(msg, prepared);
      return;
    }
    // This line is going to be translated, so drop any reason left on it by the
    // message that used this row before the virtual scroller recycled it.
    this.skip(msg, '');
    const { real, detected, hint } = prepared;
    const target = this.effTarget;

    // ── 0. In-tab memory cache: instant, zero round-trip ──
    const mem = memCache.get(real, target);
    if (mem) {
      // stats.ts counts one totalCacheHits for both tiers, so nothing says
      // whether this in-tab map earns its size or the SW cache does all the work.
      if (__KT_METRICS__) metrics.count('cache.mem.hit');
      this.applyTranslation(msg, real, mem, { store: false });
      return;
    }
    if (__KT_METRICS__) metrics.count('cache.mem.miss');

    // ── 1. On-device (Chrome; absent on Brave → straight to cloud) ──
    //
    // The on-device engine has no auto-detect: it translates from whatever
    // source it is told. It is told the looked-up language, or franc's guess
    // when that guess is English. Any other guess goes to the cloud, which
    // detects per line. Measured on the chat corpus, franc's non-English guesses
    // name the wrong language on 166 of 264 lines (Tatoeba: 470 of 834):
    // Danish as Swedish or Dutch, Catalan as Spanish. On device that is a line
    // translated from a language it is not in, or returned unchanged and
    // dropped, and a model downloaded for a language nobody wrote. English guesses are kept: nearly
    // every English line is a guess, 74 of 109 were right on the corpora, more
    // on a chat that is mostly English. local-only has no cloud, so it keeps
    // the guess as before.
    const localSource =
      hint ?? (detected === 'en' || this.settings.engineMode === 'local-only' ? detected : undefined);
    if (
      this.settings.localEnabled &&
      this.settings.engineMode !== 'cloud-first' &&
      localSource &&
      localEngine.present()
    ) {
      localEngine.noteSeen(localSource, target);
      if (localEngine.isReady(localSource, target)) {
        showLoading(msg.injectionTarget);
        const t0 = performance.now();
        try {
          const translatedText = await localEngine.translate(localSource, target, real);
          this.applyTranslation(msg, real, { translatedText, detectedLang: localSource, provider: 'local' }, { store: true });
          // Seen to painted, on device. `e2e.cloud` in translateAndApply is the
          // same span for the other path, so the two are directly comparable.
          // local-first has been the default since it shipped and nothing has
          // ever measured whether it is the faster one.
          if (__KT_METRICS__) metrics.timing('e2e.local', performance.now() - t0);
          void send({ type: 'stats.local', payload: { lang: localSource, chars: real.length } }).catch(() => undefined);
          return;
        } catch (err: unknown) {
          log.debug('local translate failed, falling back', err);
        }
      } else if (this.settings.engineMode === 'local-only') {
        this.skip(msg, localised('skipNoModel', 'there is no on device model for its language yet'));
        removeAllArtifacts(msg.injectionTarget);
        return;
      }
    }

    if (this.settings.engineMode === 'local-only') {
      this.skip(msg, localised('skipNoModel', 'there is no on device model for its language yet'));
      removeAllArtifacts(msg.injectionTarget);
      return;
    }

    // ── 2. Hover-to-translate: just show a placeholder, translate on hover ──
    if (this.settings.displayStyle === 'hover') {
      armHoverTranslate(msg.injectionTarget, () => {
        void this.translateAndApply(msg, real, detected, hint);
      });
      return;
    }

    // ── 3. Cloud chain (coalesced + batched in the SW) ──
    void this.translateAndApply(msg, real, detected, hint);
  }

  /** Shared cloud translate + apply, used by both normal flow and hover-to-translate. */
  private async translateAndApply(msg: IncomingDomMessage, real: string, sourceLang?: string, hint?: string): Promise<void> {
    // Subject-dropping languages need more prior dialogue so the engine infers the
    // right person; everything else gets the cheap 2-line window.
    const lines = isContextCritical(sourceLang) ? CONTEXT_LINES_HARD : CONTEXT_LINES;
    const context = this.contextFor(msg.channel, real, msg.username, lines);
    showLoading(msg.injectionTarget);
    // Counterpart of `e2e.local`. This span covers the whole round trip the
    // reader waits through: coalescing window, SW cache lookup, provider call and
    // every fallback the chain walked. Not the provider latency the SW records,
    // which is only the last hop of it.
    const t0 = performance.now();
    // Only tell the engine the source language when we looked it up rather than
    // guessed it. A guessed `sl` makes the engine translate from the wrong
    // language, and the result is either dropped for matching the original or
    // shown while saying something else. `sourceLang` still sizes the context
    // window above, where being wrong costs nothing.
    const outcome = await this.requestCloud(real, this.effTarget, msg.channel, context, false, hint);
    if (!outcome) {
      showError(msg.injectionTarget, localised('errTranslateFailed', 'Translation failed'), () => void this.forceRetranslate(msg, real));
      return;
    }
    if (!outcome.ok) {
      // #7 — Toast on notable failures (max 1 per 30s to avoid spam).
      const code = outcome.error.code;
      // Budget saturation is a fact about the channel, not about this line: on a
      // fast chat every message over the cap would carry its own red marker and
      // say the same thing hundreds of times. Report it once, on the bar, and
      // leave the line bare. Every other reason keeps its per-line marker.
      if (code === 'channel_budget') {
        showThrottleIndicator(true);
        setTimeout(() => showThrottleIndicator(false), 5000);
        removeAllArtifacts(msg.injectionTarget);
        return;
      }
      if (code === 'saturated' || code === 'no_provider') {
        this.maybeToast(localised('toastAllDown', 'Every translation provider is down. Retrying shortly.'));
      } else if (code === 'quota' || outcome.error.message?.includes('quota')) {
        this.maybeToast(
          localised('toastQuota', '$PROVIDER$ quota reached. Falling back to the next provider.', [
            outcome.error.provider ?? 'Provider',
          ]),
        );
      }
      showError(msg.injectionTarget, code, () => void this.forceRetranslate(msg, real));
      return;
    }
    this.applyTranslation(msg, real, outcome.result, { store: true });
    // Only the success path is timed. A line that ended on showError never
    // reached the reader, and folding those into the same series would drag the
    // median toward a latency nobody actually waited for a translation through.
    if (__KT_METRICS__) metrics.timing('e2e.cloud', performance.now() - t0);
    if (__KT_METRICS__) metrics.count(outcome.result.cached ? 'cache.sw.hit' : 'cache.sw.miss');
  }

  /**
   * Second and last attempt, on the flattened text, after the engine returned the
   * line unchanged. `noCache` because the cache would hand back the same refusal,
   * and `normalized` so a second refusal ends as a skip instead of looping.
   */
  private async retryNormalized(msg: IncomingDomMessage, flat: string): Promise<void> {
    const outcome = await this.requestCloud(flat, this.effTarget, msg.channel, '', true, confidentLanguage(flat));
    if (!outcome?.ok) {
      this.skip(msg, localised('skipSame', 'the translation came back the same as the original'));
      removeAllArtifacts(msg.injectionTarget);
      return;
    }
    if (__KT_METRICS__) metrics.count('retry.normalized.answered');
    this.applyTranslation(msg, flat, outcome.result, { store: true, normalized: true });
  }

  /** ⟳ button: re-translate ignoring caches (and skip the same-lang guard). */
  private async forceRetranslate(msg: IncomingDomMessage, real: string): Promise<void> {
    showLoading(msg.injectionTarget);
    const outcome = await this.requestCloud(real, this.effTarget, msg.channel, '', true);
    if (!outcome || !outcome.ok) {
      // A failed retry must not delete the button that started it.
      showError(msg.injectionTarget, localised('errTranslateFailed', 'Translation failed'), () => void this.forceRetranslate(msg, real));
      return;
    }
    this.applyTranslation(msg, real, outcome.result, { store: true, force: true });
  }

  private async requestCloud(
    text: string,
    target: string,
    channel: string,
    context: string,
    noCache: boolean,
    sourceLang?: string,
  ): Promise<TranslationOutcome | undefined> {
    try {
      // The whole round trip to the worker and back. Measured against
      // `leg.sw.total`, which the worker records for its own share: the
      // difference is message transport plus, in MV3, waking a worker that the
      // browser may have killed since the last line.
      const call = (): ReturnType<typeof send> => send({
        type: 'translate',
        payload: {
          messageId: 'dom',
          text,
          targetLang: target,
          channel,
          ...(sourceLang ? { sourceLangHint: sourceLang } : {}),
          ...(context ? { context } : {}),
          ...(noCache ? { noCache: true } : {}),
        },
      });
      const res = __KT_METRICS__ ? await metrics.measure('leg.roundtrip', call) : await call();
      return res.type === 'translate.result' ? res.payload : undefined;
    } catch (err: unknown) {
      log.warn('cloud translate failed', err);
      return undefined;
    }
  }

  private applyTranslation(
    msg: IncomingDomMessage,
    real: string,
    result: RawResult,
    opts: { store: boolean; force?: boolean; normalized?: boolean },
  ): void {
    // Everything from having the text to it being on screen: the recycled-row
    // rescue below walks the panel, and injection touches the DOM of a page we do
    // not control. Cheap in theory, never measured, and it sits inside the 780ms
    // that the provider call does not account for.
    const paintT0 = performance.now();
    try {
      this.applyTranslationInner(msg, real, result, opts);
    } finally {
      if (__KT_METRICS__) metrics.timing('leg.inject', performance.now() - paintT0);
    }
  }

  private applyTranslationInner(
    msg: IncomingDomMessage,
    real: string,
    result: RawResult,
    opts: { store: boolean; force?: boolean; normalized?: boolean },
  ): void {
    // If the original row was recycled by virtual scroll, try to find another
    // visible row that still holds the same text and inject there instead of
    // silently dropping the translation we just paid for.
    if (this.rowRecycled(msg)) {
      const rescued = this.findRowWithText(msg.text);
      if (!rescued) {
        // Paid for, nowhere to put it, and not kept either: the cache write
        // sits below this return. How often that happens is the difference
        // between a detail and a leak.
        if (__KT_METRICS__) metrics.count('drop.recycled.unrescued');
        return;
      }
      msg = { ...msg, rowElement: rescued.row, injectionTarget: rescued.target };
    }
    const tt = applyUserGlossary(result.translatedText, this.settings.glossary);
    if (!tt) {
      this.skip(msg, localised('skipGlossary', 'your glossary emptied the translation'));
      removeAllArtifacts(msg.injectionTarget);
      return;
    }
    if (!opts.force) {
      if (isSameLanguageAsTarget(result.detectedLang, this.effTarget) && this.settings.ignoreEnglish) {
        this.skip(msg, localised('skipDetected', 'the translation service found it was already in your language'));
        removeAllArtifacts(msg.injectionTarget);
        return;
      }
      if (tt.trim().toLowerCase() === real.trim().toLowerCase()) {
        // The engine handed the line straight back. On stretched chat that is
        // usually why: "BINNNNNNNGOOOOOOO" and "muuuuy biennnn" both return
        // unchanged, and flattened they come back as "BINGO" and "très bien".
        // Retrying here rather than flattening every line up front is deliberate:
        // Google already copes with some stretching, and normalising first turns
        // "sooo goood" from "tellement bon" into "alors mon Dieu". After a refusal
        // there is nothing left to spoil.
        const flat = normalizeElongation(real);
        if (!opts.normalized && flat !== real && flat.length > 0) {
          if (__KT_METRICS__) metrics.count('retry.normalized');
          void this.retryNormalized(msg, flat);
          return;
        }
        this.skip(msg, localised('skipSame', 'the translation came back the same as the original'));
        removeAllArtifacts(msg.injectionTarget);
        return;
      }
    }
    if (opts.store) {
      // A hit rate of zero says nothing on its own: never written and never
      // asked again look identical from the read side.
      if (__KT_METRICS__) {
        metrics.count('cache.mem.store');
        metrics.timing('cache.mem.size', memCache.size());
      }
      memCache.set(real, this.effTarget, {
        translatedText: tt,
        detectedLang: result.detectedLang,
        provider: result.provider,
      });
    }
    const mentions = mentionsOf(msg.text);
    const full: TranslationResult = {
      messageId: msg.id,
      translatedText: mentions.length > 0 ? `${mentions.join(' ')} ${tt}` : tt,
      detectedLang: result.detectedLang,
      provider: result.provider,
      cached: false,
    };
    inject(msg.injectionTarget, full, this.settings, () => void this.forceRetranslate(msg, real));
    this.note(real, 'translated');
    incrementFloatingCount();
    updateActiveProvider(result.provider);
    // Provider switch notification.
    if (this.lastProvider && this.lastProvider !== result.provider) {
      this.maybeToast(localised('toastSwitched', 'Switched to $PROVIDER$', [result.provider]));
    }
    this.lastProvider = result.provider;
  }

  /** Track provider switches to notify the user. */
  private lastProvider: string | undefined;

  /** #7 — Rate-limited toast: max 1 every 30s. */
  private lastToastMs = 0;
  private maybeToast(msg: string): void {
    if (Date.now() - this.lastToastMs < 30_000) return;
    this.lastToastMs = Date.now();
    showToast(msg);
  }

  /** Virtual-scroll guard: row reused for a newer message while we awaited. */
  private rowRecycled(msg: IncomingDomMessage): boolean {
    return !msg.rowElement.isConnected || extractMessageText(msg.rowElement) !== msg.text;
  }

  /** Scan visible rows for one that still holds the given text (recycled-row rescue). */
  private findRowWithText(text: string): { row: Element; target: Element } | undefined {
    const rows = document.querySelectorAll('#channel-chatroom div[data-index]');
    for (const row of rows) {
      if (extractMessageText(row) === text && !row.querySelector(HANDLED_SELECTOR)) {
        const target = row.querySelector('div.w-full.min-w-0.shrink-0') ?? row.querySelector('div.group') ?? row.firstElementChild ?? row;
        return { row, target };
      }
    }
    return undefined;
  }
}
