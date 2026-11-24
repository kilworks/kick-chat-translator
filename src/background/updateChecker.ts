/**
 * "Update available" check. Polls the GitHub *latest release* tag (throttled, cached
 * in storage.local) and compares it to the installed manifest version. The popup
 * surfaces a button when a newer release exists, for a copy installed by hand; the
 * button opens the Chrome Web Store listing, where the copy it installs updates itself.
 */
import {
  CHROME_STORE_ID,
  CHROME_STORE_URL,
  FIREFOX_ADDON_ID,
  GITHUB_LATEST_RELEASE_API,
  STORAGE_KEY_UPDATE,
  UPDATE_CHECK_TTL_MS,
} from '~/shared/constants';
import { isNewerVersion, type UpdateStatus } from '~/shared/version';
import { rootLogger } from '~/shared/logger';

const log = rootLogger.child('update');

const ALARM = 'kt.update';

/**
 * The same news on the toolbar icon, so it is seen without opening the popup.
 * Only a copy installed by hand ever shows it: a store copy clears it.
 */
function showOnIcon(updateAvailable: boolean): void {
  const action = globalThis.chrome?.action;
  if (!action) return;
  void action.setBadgeText({ text: updateAvailable ? '↑' : '' }).catch(() => undefined);
  if (!updateAvailable) return;
  void action.setBadgeBackgroundColor({ color: '#53FC18' }).catch(() => undefined);
  // White on Kick's green is 1.37:1. setBadgeTextColor exists from Chrome 110.
  void action.setBadgeTextColor?.({ color: '#000000' })?.catch(() => undefined);
}

function onAlarm(alarm: chrome.alarms.Alarm): void {
  if (alarm.name === ALARM) void getUpdateStatus();
}

/** Checks every six hours in the background, so the icon changes without the popup ever opening. */
export function installUpdateCheck(): void {
  // A store copy is updated by its store: no check, so no alarm to wake the worker
  // four times a day for nothing (and one a build ago left behind is taken away).
  if (fromStore()) {
    void chrome.alarms.clear(ALARM);
    void getUpdateStatus();
    return;
  }
  // Created only when missing: re-creating a named alarm resets its clock, and a
  // service worker woken more often than every six hours would never let it fire.
  void chrome.alarms.get(ALARM).then((existing) => {
    if (!existing) void chrome.alarms.create(ALARM, { periodInMinutes: UPDATE_CHECK_TTL_MS / 60_000 });
  });
  // init() runs twice on an install or an update: one listener, not two.
  if (!chrome.alarms.onAlarm.hasListener(onAlarm)) chrome.alarms.onAlarm.addListener(onAlarm);
  // From the cache unless it is stale: sets the icon again after a browser restart.
  void getUpdateStatus();
}

interface CachedCheck {
  at: number;
  latest: string | null;
}

/**
 * True when this copy came from a store, which updates it by itself.
 *
 * On Chrome the store assigns the id and it is stable for the listing, so this
 * costs no permission; a release zip, an unpacked folder or a sideload gets a
 * different one. On Firefox the id is the one the manifest fixes, and release
 * Firefox only runs that build signed by AMO, so it is an AMO copy (or a
 * developer's temporary load, who needs no notice either).
 */
function fromStore(): boolean {
  try {
    return chrome.runtime.id === CHROME_STORE_ID || chrome.runtime.id === FIREFOX_ADDON_ID;
  } catch {
    return false;
  }
}

function currentVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return '0.0.0';
  }
}

async function fetchLatestTag(): Promise<string | null> {
  try {
    const res = await fetch(GITHUB_LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string };
    return data.tag_name ?? null;
  } catch (err: unknown) {
    log.debug('update check failed', err);
    return null;
  }
}

/**
 * Resolve update status, using a cached GitHub result unless it's stale (or `force`).
 * Network failures degrade gracefully to the last known value (or "unknown").
 */
export async function getUpdateStatus(force = false): Promise<UpdateStatus> {
  const current = currentVersion();

  // A store install updates itself, so telling its owner that a newer version
  // exists offers them nothing to do. Worse, it points at a GitHub zip they
  // should not install over their managed copy, and during a store review it
  // points at a version the store does not have yet. This notice was written
  // when a release zip was the only way to get the extension.
  //
  // Returning early also means no request to GitHub at all from those copies.
  if (fromStore()) {
    showOnIcon(false);
    return { current, latest: null, updateAvailable: false, releaseUrl: CHROME_STORE_URL };
  }

  const stored = await chrome.storage.local.get(STORAGE_KEY_UPDATE);
  const cached = stored[STORAGE_KEY_UPDATE] as CachedCheck | undefined;
  let latest = cached?.latest ?? null;

  if (force || !cached || Date.now() - cached.at > UPDATE_CHECK_TTL_MS) {
    const fetched = await fetchLatestTag();
    if (fetched !== null) {
      latest = fetched;
      await chrome.storage.local.set({ [STORAGE_KEY_UPDATE]: { at: Date.now(), latest } satisfies CachedCheck });
    } else if (!cached) {
      // Record the attempt so a persistent network failure doesn't hammer the API.
      await chrome.storage.local.set({ [STORAGE_KEY_UPDATE]: { at: Date.now(), latest: null } satisfies CachedCheck });
    }
  }

  const updateAvailable = latest !== null && isNewerVersion(latest, current);
  showOnIcon(updateAvailable);
  return { current, latest, updateAvailable, releaseUrl: CHROME_STORE_URL };
}
