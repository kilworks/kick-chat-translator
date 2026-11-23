import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';
import type { Settings } from '~/shared/settings';

/**
 * Arriving on a channel with a remembered language must not write it into the
 * global targetLang: that setting is shared by every open tab, and the write
 * retranslated the other tabs into this channel's language.
 */
const patches: Partial<Settings>[] = [];

vi.mock('~/shared/settingsClient', () => ({
  fetchSettings: () =>
    Promise.resolve({
      ...defaultSettings(),
      enabled: true,
      targetLang: 'fr',
      rememberChannelLang: true,
      channelLangs: { chaine: 'es' },
    }),
  patchSettings: (p: Partial<Settings>) => {
    patches.push(p);
    return Promise.resolve(defaultSettings());
  },
  watchSettings: () => () => undefined,
}));
vi.mock('./kickApi', async (orig) => ({
  ...(await orig<object>()),
  fetchChannelLangIso: () => Promise.resolve(undefined),
}));
const vues: string[] = [];
vi.mock('./pipeline', () => ({
  TranslationPipeline: class {
    setChannelLang(): void {}
    updateSettings(s: Settings): void {
      vues.push(s.targetLang);
    }
    resetLangBlocked(): void {}
    reapplyBlocked(): void {}
    recentDecisions(): unknown[] {
      return [];
    }
    onDomMessage(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('remembered language per channel', () => {
  it('reads the channel in its language without touching the global one', async () => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'kt', onMessage: { addListener: () => undefined }, getURL: (p: string) => p },
    });
    history.replaceState(null, '', '/chaine');
    document.body.innerHTML = '<div id="channel-chatroom"><div class="no-scrollbar"></div></div>';
    vi.resetModules();
    await import('./index');
    await new Promise((ok) => setTimeout(ok, 50));
    expect(patches.filter((p) => 'targetLang' in p)).toEqual([]);
    expect(vues.at(-1)).toBe('es');
  });
});
