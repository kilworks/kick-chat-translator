/**
 * Settings access for the content script, without zod.
 *
 * shared/settings.ts is the only file in the codebase that imports zod, and the
 * content script was the only place that pulled it in for values rather than
 * types. Measured on this tree: zod is 13.7 KB gzipped, 16.8% of content.js, and
 * it was there to re-validate a blob this extension had just written itself.
 *
 * So the content script asks the service worker instead. The worker already owns
 * `settings.get` and `settings.set`, already holds the schema, and already applies
 * the result. Nothing is validated twice and no default is written down twice,
 * which is the failure mode a second local copy of the defaults would have had.
 *
 * The trade is a message round trip at startup, on an extension whose every
 * translation is already a message to that same worker.
 */
import type { Settings } from './settings';
import { send, SETTINGS_CHANGED } from './messages';

/**
 * Current settings, straight from the worker that owns them.
 *
 * Retried, because this is the first thing the content script does on a page and
 * the worker it asks may not exist yet. MV3 kills an idle worker, and a message is
 * what wakes it: the first send after a long pause can lose the race and reject.
 * Reading storage directly could not fail this way, which is what this replaced,
 * so the robustness has to come back somewhere. A retry is that somewhere, and it
 * keeps the defaults in one place instead of shipping a second copy to the page.
 *
 * A rejection here aborts main() and the extension does nothing on the page, in
 * silence. Three attempts over roughly a second is far longer than a wake takes.
 */
export async function fetchSettings(attempts = 3): Promise<Settings> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await send({ type: 'settings.get' });
      if (res.type === 'settings') return res.payload;
      last = new Error(`settings.get answered ${res.type}`);
    } catch (err: unknown) {
      last = err;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
  }
  throw last instanceof Error ? last : new Error('settings.get failed');
}

/** Apply a change. The worker validates, persists and re-applies it. */
export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const res = await send({ type: 'settings.set', payload: patch });
  if (res.type !== 'settings') throw new Error(`settings.set answered ${res.type}`);
  return res.payload;
}

/**
 * Call back whenever settings change, wherever the change came from.
 *
 * The worker tells the tab (SETTINGS_CHANGED) and this re-asks it. Reading
 * chrome.storage.onChanged here is what it replaced: a content script no longer
 * has storage access (background/lockStorage.ts), and a change event carries the
 * values, which for the DeepL key is the key itself.
 */
export function watchSettings(cb: (next: Settings) => void): () => void {
  const handler = (m: unknown): void => {
    if ((m as { type?: string } | undefined)?.type !== SETTINGS_CHANGED) return;
    void fetchSettings().then(cb).catch(() => undefined);
  };
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}
