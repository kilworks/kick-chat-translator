import { describe, it, expect, vi, beforeEach } from 'vitest';

// Headless the pipeline: stub the DOM/runtime side-effecting modules so we can drive
// the message path and assert on what gets dispatched to the service worker.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
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
vi.mock('./localEngine', () => ({
  localEngine: { present: () => false, noteSeen: vi.fn(), isReady: () => false, translate: vi.fn() },
}));
vi.mock('./memcache', () => ({ memCache: { get: () => undefined, set: vi.fn() } }));

import { TranslationPipeline } from './pipeline';
import { inject, showError } from './injector';
import { defaultSettings } from '~/shared/settings';

/** onDomMessage does not await the translate path, so let it settle before asserting. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// The option has promised an on-device fallback since it shipped, and a cloud that
// failed showed an error whatever model was ready. It is the default now.
describe('TranslationPipeline, cloud first', () => {
  const LINE = 'jestem tutaj dzisiaj';
  const domMsg = () => {
    const rowElement = document.createElement('div');
    const injectionTarget = document.createElement('span');
    injectionTarget.className = 'font-normal';
    injectionTarget.textContent = LINE;
    rowElement.appendChild(injectionTarget);
    document.body.appendChild(rowElement);
    return { rowElement, injectionTarget, id: 'c1', text: LINE, channel: 'chan', username: 'user', isBot: false };
  };
  const reader = (settings: Partial<ReturnType<typeof defaultSettings>> = {}) =>
    new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false, ...settings });
  const failure = (code: string) => ({ type: 'translate.result', payload: { ok: false, error: { code, message: code } } });
  const success = { type: 'translate.result', payload: { ok: true, result: { translatedText: 'je suis ici', detectedLang: 'pl', provider: 'google', cached: false } } };
  const onDevice = vi.fn(async () => 'je suis ici sur appareil');
  const shown = () => vi.mocked(inject).mock.calls.map((c) => (c[1] as { provider: string }).provider);

  beforeEach(async () => {
    const { localEngine } = await import('./localEngine');
    onDevice.mockClear();
    Object.assign(localEngine, { present: () => true, isReady: () => true, translate: onDevice });
    sendMock.mockReset();
    vi.mocked(inject).mockClear();
    vi.mocked(showError).mockClear();
  });

  it('is the default, and asks the cloud before the model', async () => {
    expect(defaultSettings().engineMode).toBe('cloud-first');
    sendMock.mockResolvedValue(success);
    await reader().onDomMessage(domMsg());
    await flush();
    expect(onDevice).not.toHaveBeenCalled();
    expect(shown()).toEqual(['google']);
  });

  it('falls back to a ready model when the cloud fails', async () => {
    sendMock.mockResolvedValue(failure('no_provider'));
    await reader().onDomMessage(domMsg());
    await flush();
    expect(shown()).toEqual(['local']);
    expect(showError).not.toHaveBeenCalled();
  });

  it('still shows the error when no model is ready', async () => {
    const { localEngine } = await import('./localEngine');
    Object.assign(localEngine, { isReady: () => false });
    sendMock.mockResolvedValue(failure('no_provider'));
    await reader().onDomMessage(domMsg());
    await flush();
    expect(inject).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
  });

  it('leaves the channel budget alone, it is not a failure of the engine', async () => {
    sendMock.mockResolvedValue(failure('channel_budget'));
    await reader().onDomMessage(domMsg());
    await flush();
    expect(onDevice).not.toHaveBeenCalled();
  });

  it('stays off the model when the reader turned it off', async () => {
    sendMock.mockResolvedValue(failure('no_provider'));
    await reader({ localEnabled: false }).onDomMessage(domMsg());
    await flush();
    expect(onDevice).not.toHaveBeenCalled();
  });
});
