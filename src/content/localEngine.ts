import { rootLogger } from '~/shared/logger';
import { createMetrics } from '~/shared/metrics';

const log = rootLogger.child('local');
const metrics = createMetrics('content');

// On-device translation via Chromium's built-in Translator API (Chrome >= 138).
// Runs in the CONTENT SCRIPT (page window) because:
//   - the API global lives in window/page contexts, not reliably in MV3 SWs;
//   - the first model download per language pair REQUIRES a user gesture, which
//     we can only obtain from a click inside the page (the floating bar button).
// Once a pair's model is downloaded it becomes "available" and translates
// locally, unlimited, offline, instantly — no per-IP ceiling.

export type PairState = 'unknown' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface TranslatorInstance {
  translate(text: string): Promise<string>;
}
interface TranslatorCtor {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<PairState>;
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<TranslatorInstance>;
}

function ctor(): TranslatorCtor | undefined {
  return (self as unknown as { Translator?: TranslatorCtor }).Translator;
}

function pairKey(src: string, tgt: string): string {
  return `${src}>${tgt}`;
}

// The Translator API's own tags. Everything else is cut to its primary subtag,
// so pt-BR asks for `pt`. Traditional Chinese is the one variant the API names
// (`zh-Hant`, beside `zh`, in Chrome's published list): cut to `zh`, a zh-tw line
// was translated from the simplified model, and a zh-tw reader got simplified
// characters back while the cloud path answers zh-TW. No fallback to `zh` when
// a browser calls zh-Hant unavailable: the cloud then answers in the right script.
const TRANSLATOR_TAGS: Record<string, string> = { 'zh-tw': 'zh-Hant', 'zh-hant': 'zh-Hant' };

function norm(code: string): string {
  const lower = code.toLowerCase();
  return TRANSLATOR_TAGS[lower] ?? lower.split('-')[0] ?? lower;
}

type StateListener = () => void;

class LocalEngine {
  private state = new Map<string, PairState>();
  private instances = new Map<string, TranslatorInstance>();
  private creating = new Map<string, Promise<TranslatorInstance>>();
  private progress = new Map<string, number>();
  // Keyed by the API's tags, valued with the codes the caller used, so a pair
  // offered for download carries `zh-tw` back to a caller that compares it with
  // its own target, not `zh-Hant`.
  private seen = new Map<string, { src: string; tgt: string }>();
  private listeners = new Set<StateListener>();

  present(): boolean {
    return ctor() !== undefined;
  }

  onChange(cb: StateListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    for (const cb of this.listeners) cb();
  }

  stateOf(src: string, tgt: string): PairState {
    return this.state.get(pairKey(norm(src), norm(tgt))) ?? 'unknown';
  }

  progressOf(src: string, tgt: string): number {
    return this.progress.get(pairKey(norm(src), norm(tgt))) ?? 0;
  }

  isReady(src: string, tgt: string): boolean {
    return this.stateOf(src, tgt) === 'available';
  }

  /** Note a language pair we've seen in chat; probe its availability lazily. */
  noteSeen(src: string, tgt: string): void {
    const s = norm(src);
    const t = norm(tgt);
    if (!s || s === 'auto' || s === 'und' || s === t) return;
    const key = pairKey(s, t);
    this.seen.set(key, { src, tgt });
    if (!this.state.has(key)) void this.probe(s, t);
  }

  /** True if any seen source language has a downloaded model for this target. */
  hasReadyForTarget(tgt: string): boolean {
    const suffix = `>${norm(tgt)}`;
    for (const key of this.seen.keys()) {
      if (key.endsWith(suffix) && this.state.get(key) === 'available') return true;
    }
    return false;
  }

  /** Pairs we've seen that could be enabled with one user gesture. */
  downloadablePairs(): { src: string; tgt: string }[] {
    const out: { src: string; tgt: string }[] = [];
    for (const [key, pair] of this.seen) {
      const st = this.state.get(key);
      if (st === 'downloadable' || st === 'downloading') out.push(pair);
    }
    return out;
  }

  async probe(src: string, tgt: string): Promise<PairState> {
    const c = ctor();
    const key = pairKey(norm(src), norm(tgt));
    if (!c) {
      this.state.set(key, 'unavailable');
      this.emit();
      return 'unavailable';
    }
    try {
      const a = await c.availability({ sourceLanguage: norm(src), targetLanguage: norm(tgt) });
      this.state.set(key, a);
      // The one number that says whether the on-device path is even reachable
      // for the pairs this viewer actually meets. Without it, "why is anyone
      // still on the cloud" has three possible answers and no way to choose.
      if (__KT_METRICS__) metrics.count(`local.pair.${a}`);
      this.emit();
      return a;
    } catch (err: unknown) {
      log.debug('availability failed', err);
      this.state.set(key, 'unavailable');
      this.emit();
      return 'unavailable';
    }
  }

  /**
   * MUST be invoked from within a user-gesture handler the first time a pair is
   * downloaded. Creates (and downloads) translators for the given pairs.
   */
  async download(pairs: { src: string; tgt: string }[]): Promise<void> {
    const c = ctor();
    if (!c) return;
    for (const { src, tgt } of pairs) {
      const key = pairKey(norm(src), norm(tgt));
      if (this.instances.has(key)) continue;
      this.state.set(key, 'downloading');
      this.emit();
      try {
        const inst = await c.create({
          sourceLanguage: norm(src),
          targetLanguage: norm(tgt),
          monitor: (m) => {
            m.addEventListener('downloadprogress', (ev: Event) => {
              const e = ev as Event & { loaded?: number };
              this.progress.set(key, typeof e.loaded === 'number' ? e.loaded : 0);
              this.emit();
            });
          },
        });
        this.instances.set(key, inst);
        this.state.set(key, 'available');
        this.progress.set(key, 1);
        this.emit();
        log.info('on-device ready:', key);
      } catch (err: unknown) {
        log.warn('download failed', key, err);
        this.state.set(key, 'downloadable');
        this.emit();
      }
    }
  }

  /** Translate locally. Throws if the pair isn't ready (caller falls back to cloud). */
  async translate(src: string, tgt: string, text: string): Promise<string> {
    const c = ctor();
    if (!c) throw new Error('local_absent');
    const s = norm(src);
    const t = norm(tgt);
    const key = pairKey(s, t);
    let inst = this.instances.get(key);
    if (!inst) {
      if (this.state.get(key) !== 'available') throw new Error('not_ready');
      // 'available' means create() works without a gesture. One creation per
      // pair: a burst of lines arriving while the first create() loads the model
      // each started their own, and only the last instance was kept.
      let creating = this.creating.get(key);
      if (!creating) {
        creating = c.create({ sourceLanguage: s, targetLanguage: t }).finally(() => this.creating.delete(key));
        this.creating.set(key, creating);
      }
      inst = await creating;
      this.instances.set(key, inst);
    }
    const out = await inst.translate(text);
    if (!out.trim()) throw new Error('empty');
    return out;
  }
}

export const localEngine = new LocalEngine();
