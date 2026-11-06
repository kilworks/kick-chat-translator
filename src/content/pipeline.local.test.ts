import { describe, it, expect, vi, beforeEach } from 'vitest';

// The on-device path, with an engine that is present and ready for every pair,
// so what is asserted is the source language the pipeline hands it.
const { sendMock, local } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  local: { present: () => true, noteSeen: vi.fn(), isReady: () => true, translate: vi.fn() },
}));
vi.mock('~/shared/messages', () => ({ send: sendMock }));
vi.mock('./injector', () => ({
  inject: vi.fn(),
  incrementFloatingCount: vi.fn(),
  armHoverTranslate: vi.fn(),
  markSkipped: vi.fn(),
  removeAllArtifacts: vi.fn(),
  showError: vi.fn(),
  showLoading: vi.fn(),
  showThrottleIndicator: vi.fn(),
  showToast: vi.fn(),
  updateActiveProvider: vi.fn(),
}));
vi.mock('./localEngine', () => ({ localEngine: local }));
vi.mock('./memcache', () => ({ memCache: { get: () => undefined, set: vi.fn() } }));

import { TranslationPipeline } from './pipeline';
import { confidentLanguage, detectLanguage } from './langDetect';
import { defaultSettings, type Settings } from '~/shared/settings';

const domMsg = (text: string) => {
  const rowElement = document.createElement('div');
  const injectionTarget = document.createElement('div');
  rowElement.appendChild(injectionTarget);
  return { rowElement, injectionTarget, id: 'd1', text, channel: 'chan', username: 'user', isBot: false };
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const reader = (extra: Partial<Settings> = {}) =>
  new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false, engineMode: 'local-first', ...extra });
const localSource = () => local.translate.mock.calls[0]?.[0] as string | undefined;

/**
 * The on-device engine translates from the source it is told. franc's
 * non-English guesses are wrong on most chat lines, Danish read as Swedish
 * or Dutch, so those lines go to the cloud, which detects on its own.
 */
describe('TranslationPipeline — the on-device source language', () => {
  const DANISH = 'han har ingen chance';

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'x', message: 'x' } } });
    local.translate.mockReset();
    local.translate.mockResolvedValue('traduit');
  });

  it('sends a guessed non-English line to the cloud', async () => {
    expect(confidentLanguage(DANISH)).toBeUndefined();
    expect(detectLanguage(DANISH)).toBe('sv');
    await reader().onDomMessage(domMsg(DANISH));
    await flush();
    expect(local.translate).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalled();
  });

  it('keeps a looked-up language on device', async () => {
    await reader().onDomMessage(domMsg('これはテストメッセージです'));
    expect(localSource()).toBe('ja');
  });

  it('keeps an English guess on device', async () => {
    expect(confidentLanguage('i cant believe he did that again')).toBeUndefined();
    await reader().onDomMessage(domMsg('i cant believe he did that again'));
    expect(localSource()).toBe('en');
  });

  it('keeps the guess in local-only, which has no cloud', async () => {
    await reader({ engineMode: 'local-only' }).onDomMessage(domMsg(DANISH));
    expect(localSource()).toBe('sv');
  });
});
