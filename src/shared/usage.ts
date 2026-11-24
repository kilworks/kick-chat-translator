/**
 * Anonymous daily usage statistics: what is counted, shared by the content
 * script (which counts) and the worker (which sums a day and sends it once).
 *
 * Opt-in only (settings.usageStats, off by default; Firefox asks through its
 * own data-collection consent). What leaves the device is one GA4 event a day
 * made of the counts below plus the environment: no message text, no username,
 * no channel, nothing typed. PRIVACY.md lists the same fields; keep both in step.
 */
export const USAGE_COUNTERS = [
  // Translations shown, by engine. 'cache' answered without a network call.
  'tr_local',
  'tr_google',
  'tr_deepl',
  'tr_other',
  'tr_cache',
  // A provider failed or answered blank.
  'err_provider',
  // Lines that never reached an engine (duplicate, same language, emotes only...).
  'skipped',
  // Compose: a translation offered, taken (Tab, click, Ctrl+Enter), dismissed (Esc).
  'compose_preview',
  'compose_insert',
  'compose_dismiss',
] as const;

export type UsageCounter = (typeof USAGE_COUNTERS)[number];
export type UsageCounts = Partial<Record<UsageCounter, number>>;

/** What only the page can see. */
export interface UsageEnv {
  /** 7TV re-renders the chat and takes Tab in the composer. */
  has7tv: boolean;
  /** Chrome's on-device Translator API exists in this browser. */
  localApi: boolean;
}

/** The most one counter can take from one flush. */
const COUNT_MAX = 10_000;

/** Fold one batch of counts into another. */
export function addCounts(into: UsageCounts, from: UsageCounts): UsageCounts {
  const out: UsageCounts = { ...into };
  for (const k of USAGE_COUNTERS) {
    const n = from[k];
    // A count from a page: a number or nothing (a string would be concatenated
    // and shipped), and bounded, one minute of chat does not make a million.
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = (out[k] ?? 0) + Math.min(Math.floor(n), COUNT_MAX);
  }
  return out;
}

/** Percentile of a sample, nearest rank. 0 for an empty one. */
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] ?? 0;
}
