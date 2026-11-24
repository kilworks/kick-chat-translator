import { isSupportedLang } from '~/shared/languages';

/**
 * What a Kick tab may remember, kept by the worker.
 *
 * Content scripts can read and write chrome.storage by default, and the worker
 * now shuts that door (see lockStorage.ts) so the DeepL key and the settings blob
 * are out of reach of the page's context. The two small things the content script
 * persisted for itself go through here instead, validated, in one place.
 */
export const INSERT_HINT_KEY = 'kt.composeInsertHintDone';
const LASTLANG_KEY = 'kt.lastlang.v2';
/** Channels remembered, oldest dropped first. Before 3.6.4 there was one key per channel, forever. */
export const LASTLANG_MAX = 200;
const SLUG_RE = /^[\w-]{1,64}$/;
const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
/** Pairs, not an object: integer-like slugs would be reordered by the engine. */
type LastLangs = [slug: string, lang: string][];

const legacyKey = (slug: string): string => `kt.lastlang.${slug}`;

export async function getLastLang(slug: string): Promise<string | undefined> {
  if (!SLUG_RE.test(slug)) return undefined;
  const got = await chrome.storage.local.get([LASTLANG_KEY, legacyKey(slug)]);
  const list = got[LASTLANG_KEY] as LastLangs | undefined;
  const hit = Array.isArray(list) ? list.find((e) => e[0] === slug)?.[1] : undefined;
  // The per-channel key an earlier build wrote: still read, so nothing is forgotten on update.
  const v: unknown = hit ?? got[legacyKey(slug)];
  return typeof v === 'string' ? v : undefined;
}

/** One write at a time: two tabs setting different channels used to lose one entry. */
let lastLangQueue: Promise<unknown> = Promise.resolve();

export function setLastLang(slug: string, lang: string): Promise<boolean> {
  const run = lastLangQueue.then(() => writeLastLang(slug, lang));
  lastLangQueue = run.catch(() => undefined);
  return run;
}

async function writeLastLang(slug: string, lang: string): Promise<boolean> {
  if (!SLUG_RE.test(slug) || !LANG_RE.test(lang) || !isSupportedLang(lang)) return false;
  const got = await chrome.storage.local.get(LASTLANG_KEY);
  const prev = got[LASTLANG_KEY] as LastLangs | undefined;
  // Same answer as the one held: nothing to write (this is sent on every channel load).
  if (Array.isArray(prev) && prev.at(-1)?.[0] === slug && prev.at(-1)?.[1] === lang) return true;
  const list = (Array.isArray(prev) ? prev : []).filter((e) => e[0] !== slug);
  list.push([slug, lang]);
  await chrome.storage.local.set({ [LASTLANG_KEY]: list.slice(-LASTLANG_MAX) });
  await chrome.storage.local.remove(legacyKey(slug));
  return true;
}

/** true once done, otherwise how many times the hint was shown. */
export async function getHint(): Promise<boolean | number | undefined> {
  const v: unknown = (await chrome.storage.local.get(INSERT_HINT_KEY))[INSERT_HINT_KEY];
  return v === true || typeof v === 'number' ? v : undefined;
}

export async function setHint(value: unknown): Promise<boolean> {
  if (value !== true && !(typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1000)) return false;
  await chrome.storage.local.set({ [INSERT_HINT_KEY]: value });
  return true;
}
