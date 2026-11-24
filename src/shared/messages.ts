import type {
  CacheStats,
  ProviderStatus,
  TranslationOutcome,
  TranslationRequest,
  UsageStats,
} from './types';
import type { Settings } from './settings';
import type { UpdateStatus } from './version';
import type { UsageCounts, UsageEnv } from './usage';

/** One line the pipeline made up its mind about. Kept in memory only, never stored. */
export interface Decision {
  at: number;
  text: string;
  /** "translated", or the same reason the line carries in its tooltip. */
  outcome: string;
}

export type RuntimeMessage =
  | { type: 'translate'; payload: TranslationRequest }
  | { type: 'settings.get' }
  | { type: 'settings.set'; payload: Partial<Settings> }
  | { type: 'settings.reset' }
  | { type: 'stats.get' }
  | { type: 'stats.reset' }
  | { type: 'providers.status' }
  | { type: 'cache.clear' }
  | { type: 'cache.stats' }
  | { type: 'open.options' }
  | { type: 'stats.local'; payload: { lang: string; chars: number } }
  | { type: 'deepl.usage' }
  | { type: 'update.status'; force?: boolean }
  | { type: 'debug.decisions' }
  /** Write a translation around the composer's emotes, see background/lexicalWrite. */
  | { type: 'compose.write'; parts: string[] }
  /** Opt-in usage counts from a page, about once a minute (shared/usage.ts). */
  | { type: 'usage.add'; counts: UsageCounts; env?: UsageEnv }
  /** The chat catalogue for one locale, kept out of the page script. */
  | { type: 'i18n.chat'; locale: string }
  /** What a Kick tab remembers, held by the worker (background/pageStore.ts). */
  | { type: 'lastlang.get'; slug: string }
  | { type: 'lastlang.set'; slug: string; lang: string }
  | { type: 'hint.get' }
  | { type: 'hint.set'; value: boolean | number }
  | { type: 'ping' };

/** Worker to tab: the settings changed, ask again. Carries no settings, so no key. */
export const SETTINGS_CHANGED = 'settings.changed';

export type RuntimeResponse =
  | { type: 'translate.result'; payload: TranslationOutcome }
  | { type: 'settings'; payload: Settings }
  | { type: 'stats'; payload: UsageStats }
  | { type: 'cache.stats'; payload: CacheStats }
  | { type: 'providers'; payload: ProviderStatus[] }
  | { type: 'deepl.usage'; payload: { configured: boolean; count: number; limit: number } }
  | { type: 'update.info'; payload: UpdateStatus }
  | { type: 'debug.decisions'; payload: Decision[] }
  | { type: 'i18n.chat'; payload?: Record<string, string> }
  | { type: 'value'; payload?: unknown }
  | { type: 'ack' }
  | { type: 'error'; payload: { message: string } };

export function send(msg: RuntimeMessage): Promise<RuntimeResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res: RuntimeResponse | undefined) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (!res) {
        reject(new Error('No response'));
        return;
      }
      resolve(res);
    });
  });
}

type HandlerResult = RuntimeResponse | void;

export function onMessage(
  handler: (
    msg: RuntimeMessage,
    sender: chrome.runtime.MessageSender,
  ) => Promise<HandlerResult> | HandlerResult,
): void {
  chrome.runtime.onMessage.addListener((msg: RuntimeMessage, sender, sendResponse) => {
    const result = handler(msg, sender);
    if (result instanceof Promise) {
      result
        .then((r) => {
          if (r) sendResponse(r);
        })
        .catch((err: unknown) =>
          sendResponse({
            type: 'error',
            payload: { message: err instanceof Error ? err.message : String(err) },
          } satisfies RuntimeResponse),
        );
      return true;
    }
    if (result) sendResponse(result);
    return false;
  });
}
