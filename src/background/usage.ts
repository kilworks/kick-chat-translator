import {
  GA_API_SECRET,
  GA_ENDPOINT,
  GA_MEASUREMENT_ID,
  STORAGE_KEY_USAGE,
} from '~/shared/constants';
import { USAGE_COUNTERS, addCounts, percentile, type UsageCounts, type UsageEnv } from '~/shared/usage';
import type { Settings } from '~/shared/settings';

/**
 * The worker's half of the opt-in usage statistics (see shared/usage.ts):
 * sums one day in storage.local and sends it, once, the first time the worker
 * runs on a later day. Nothing is sent without consent, and a day counted
 * without consent is thrown away rather than kept for later.
 */

const ALARM = 'kt-usage';
/** Enough for a stable p95 of a day's cloud latency, small enough for storage. */
const LATENCY_KEEP = 200;

export interface Day {
  day: string;
  counts: UsageCounts;
  /** Cloud round trips in ms, a reservoir sample. */
  lat: number[];
  seen: number;
  env?: UsageEnv;
}

const today = (): string => new Date().toISOString().slice(0, 10);
const empty = (): Day => ({ day: today(), counts: {}, lat: [], seen: 0 });

let state: Day | undefined;
let getSettings: () => Settings;
let writing: Promise<void> = Promise.resolve();

async function load(): Promise<Day> {
  if (state) return state;
  const got = await chrome.storage.local.get(STORAGE_KEY_USAGE);
  state = (got[STORAGE_KEY_USAGE] as Day | undefined) ?? empty();
  return state;
}

function save(): void {
  const snapshot = state;
  writing = writing.then(() => chrome.storage.local.set({ [STORAGE_KEY_USAGE]: snapshot })).catch(() => undefined);
}

const isFirefox = (): boolean => chrome.runtime.getURL('').startsWith('moz-extension:');

/**
 * Consent. Chrome: the setting, which the popup asks for once and the options
 * page can change. Firefox: its own data-collection permission, granted at
 * install or from the options page; before Firefox 140 there is no such
 * consent at all, and then nothing is sent (Mozilla's rule for old versions).
 */
export async function usageAllowed(settings: Settings): Promise<boolean> {
  if (!isFirefox()) return settings.usageStats;
  try {
    const perms = (await chrome.permissions.getAll()) as { data_collection?: string[] };
    return perms.data_collection?.includes('technicalAndInteraction') ?? false;
  } catch {
    return false;
  }
}

/** Counts and environment flushed by a content script. */
export async function addUsage(counts: UsageCounts, env?: UsageEnv): Promise<void> {
  if (!(await usageAllowed(getSettings()))) return;
  const d = await rollover();
  d.counts = addCounts(d.counts, counts);
  if (env && typeof env.has7tv === 'boolean' && typeof env.localApi === 'boolean') d.env = { has7tv: env.has7tv, localApi: env.localApi };
  save();
}

/** One translation answered by the worker's chain, and how long the cloud took. */
export async function recordTranslation(provider: string, cached: boolean, ms?: number): Promise<void> {
  if (!(await usageAllowed(getSettings()))) return;
  const key = cached ? 'tr_cache' : provider === 'google' ? 'tr_google' : provider === 'deepl' ? 'tr_deepl' : provider === 'local' ? 'tr_local' : 'tr_other';
  const d = await rollover();
  d.counts = addCounts(d.counts, { [key]: 1 });
  if (!cached && ms !== undefined && provider !== 'local') {
    d.seen += 1;
    if (d.lat.length < LATENCY_KEEP) d.lat.push(Math.round(ms));
    else {
      const j = Math.floor(Math.random() * d.seen);
      if (j < LATENCY_KEEP) d.lat[j] = Math.round(ms);
    }
  }
  save();
}

export async function recordProviderError(): Promise<void> {
  if (!(await usageAllowed(getSettings()))) return;
  const d = await rollover();
  d.counts = addCounts(d.counts, { err_provider: 1 });
  save();
}

/** Today's bucket; a finished day is sent (or dropped) first. */
async function rollover(): Promise<Day> {
  const d = await load();
  if (d.day === today()) return d;
  const finished = d;
  state = empty();
  save();
  if (Object.keys(finished.counts).length > 0 && (await usageAllowed(getSettings()))) await send(finished);
  return state;
}

function browserName(): string {
  if (isFirefox()) return 'firefox';
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands ?? [];
  const named = brands.map((b) => b.brand).find((b) => !/chromium|not.?a.?brand/i.test(b));
  return (named ?? 'chromium').toLowerCase().slice(0, 30);
}

async function clientId(): Promise<string> {
  const KEY = 'kt.usage.cid';
  const got = await chrome.storage.local.get(KEY);
  const have = got[KEY] as string | undefined;
  if (have) return have;
  // A random number, nothing derived from the user or the machine. GA needs it
  // to count each install once a day.
  const id = `${Math.floor(Math.random() * 2 ** 31)}.${Math.floor(Date.now() / 1000)}`;
  await chrome.storage.local.set({ [KEY]: id });
  return id;
}

/** The event GA receives. Pure, so the exact payload is testable. */
export function buildEvent(
  d: Day,
  settings: Settings,
  version: string,
  browser: string,
  uiLang: string,
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    ext_version: version,
    browser,
    ui_lang: settings.uiLang === 'auto' ? uiLang : settings.uiLang,
    target_lang: settings.targetLang,
    engine_mode: settings.engineMode,
    has_7tv: d.env?.has7tv ? 1 : 0,
    local_api: d.env?.localApi ? 1 : 0,
    lat_p50: percentile(d.lat, 50),
    lat_p95: percentile(d.lat, 95),
    // GA counts a user active only on an event carrying engagement time.
    engagement_time_msec: 1,
    session_id: Number(d.day.replaceAll('-', '')),
  };
  for (const k of USAGE_COUNTERS) params[k] = d.counts[k] ?? 0;
  return params;
}

async function send(d: Day): Promise<void> {
  if (!GA_MEASUREMENT_ID || !GA_API_SECRET || __KT_DEV__) return;
  const url = `${GA_ENDPOINT}?measurement_id=${encodeURIComponent(GA_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(GA_API_SECRET)}`;
  const body = JSON.stringify({
    client_id: await clientId(),
    non_personalized_ads: true,
    events: [
      {
        name: 'daily_usage',
        params: buildEvent(d, getSettings(), chrome.runtime.getManifest().version, browserName(), chrome.i18n.getUILanguage()),
      },
    ],
  });
  // no-cors: a write-only call needs no host permission, and adding one would
  // make Chrome disable the extension on update until each user re-accepts.
  await fetch(url, { method: 'POST', mode: 'no-cors', body, credentials: 'omit' }).catch(() => undefined);
}

/**
 * Wire the daily send. The alarm is what makes a day go out without traffic.
 *
 * On Firefox the browser's consent is the source of truth, granted in the
 * install prompt or later; `setConsent` mirrors it into the setting so the
 * page counts, the options page shows it, and the popup never asks twice.
 */
export function installUsage(settings: () => Settings, setConsent: (on: boolean) => void): void {
  getSettings = settings;
  if (isFirefox()) {
    const sync = (): void =>
      void usageAllowed(getSettings()).then((on) => {
        if (on !== getSettings().usageStats || !getSettings().usageStatsAsked) setConsent(on);
      });
    sync();
    chrome.permissions.onAdded.addListener(sync);
    chrome.permissions.onRemoved.addListener(sync);
  }
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARM) void rollover();
  });
  void chrome.alarms.get(ALARM).then((existing) => {
    if (!existing) void chrome.alarms.create(ALARM, { periodInMinutes: 60 });
  });
}

/** Consent withdrawn: forget the day being counted. */
export async function dropUsage(): Promise<void> {
  state = empty();
  await chrome.storage.local.remove(STORAGE_KEY_USAGE);
}
