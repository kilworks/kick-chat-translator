import { rootLogger } from '~/shared/logger';

const log = rootLogger.child('lock');

/**
 * Shut chrome.storage to content scripts.
 *
 * By default a content script reads and writes storage.local and storage.sync
 * itself. That made the worker's gates (no DeepL key to a page, a page writing
 * only PAGE_SETTINGS) decoration: a compromised content-script context could read
 * `kt.deeplKey.v1` or write `kt.settings.v2` directly, lingvaInstance included.
 * TRUSTED_CONTEXTS leaves the extension's own pages and the worker in, and the
 * content script talks to the worker.
 *
 * The level is not persisted by the browser, so this runs on every worker start.
 * Firefox has no setAccessLevel: there the call is skipped and the content script
 * keeps the access it always had (the key is still never sent to it).
 * shortcut: no equivalent on Firefox, revisit if it ships storage access levels.
 */
export async function lockStorage(): Promise<void> {
  // Metrics builds only (a constant false in a release): the content-side metrics
  // sink and its bridge write chrome.storage.local from the page's world, and the
  // lock would silently drop that data.
  if (__KT_METRICS__) return;
  for (const area of [chrome.storage?.local, chrome.storage?.sync]) {
    if (typeof area?.setAccessLevel !== 'function') continue;
    try {
      await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    } catch (err: unknown) {
      // Refused: the content script keeps its default access, nothing else changes,
      // and without this line nobody would know the protection is absent.
      log.warn('storage access level refused, content scripts keep storage access', err);
    }
  }
}
