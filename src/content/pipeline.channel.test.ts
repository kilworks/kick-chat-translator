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
import { inject } from './injector';
import { defaultSettings } from '~/shared/settings';
import { confidentLanguage } from './langDetect';

/** onDomMessage does not await the translate path, so let it settle before asserting. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/ Rule R1b, frozen before its sample: 13 lines changed of 577, penalty 8.38 to 2.85,
// 10 better, 2 worse. Written lines, captured chat stays out of git.
describe('TranslationPipeline, a line the engine hands back in another language', () => {
  const LINE = 'gelirsin abi bence';
  const domMsg = (text: string, channel = 'chan') => {
    const rowElement = document.createElement('div');
    const injectionTarget = document.createElement('span');
    injectionTarget.className = 'font-normal';
    injectionTarget.textContent = text;
    rowElement.appendChild(injectionTarget);
    document.body.appendChild(rowElement);
    return { rowElement, injectionTarget, id: 'r1', text, channel, username: 'user', isBot: false };
  };
  const reader = () =>
    new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false, localEnabled: false });
  const answer = (translatedText: string, detectedLang: string) => ({
    type: 'translate.result',
    payload: { ok: true, result: { translatedText, detectedLang, provider: 'google', cached: false } },
  });
  const asked = () => sendMock.mock.calls.map((c) => c[0]).filter((m) => m?.type === 'translate');

  beforeEach(() => {
    sendMock.mockReset();
    vi.mocked(inject).mockClear();
    sendMock.mockImplementation(async (m: { type: string; payload: { sourceLangHint?: string; text: string } }) =>
      m.payload?.sourceLangHint === 'tr' ? answer('tu viendras frere je pense', 'tr') : answer(m.payload?.text, 'id'),
    );
  });

  it('asks once more in the language of the channel', async () => {
    const p = reader();
    p.setChannelLang('chan', 'tr');
    await p.onDomMessage(domMsg(LINE));
    await flush();
    expect(asked().map((m) => m.payload.sourceLangHint)).toEqual([undefined, 'tr']);
    expect(inject).toHaveBeenCalledTimes(1);
  });

  it('asks only once, when the channel language hands it back too', async () => {
    sendMock.mockImplementation(async (m: { payload: { text: string } }) => answer(m.payload?.text, 'id'));
    const p = reader();
    p.setChannelLang('chan', 'tr');
    await p.onDomMessage(domMsg(LINE));
    await flush();
    expect(asked()).toHaveLength(2);
    expect(inject).not.toHaveBeenCalled();
  });

  it.each([
    ['one word', 'gelirsin', 'chan', 'tr'],
    ['the channel is in the language the engine named', LINE, 'chan', 'id'],
    ['the channel is in the language of the reader', LINE, 'chan', 'fr'],
    ['the language belongs to another channel', LINE, 'other', 'tr'],
  ])('does not ask again: %s', async (_why, line, channel, lang) => {
    const p = reader();
    p.setChannelLang('chan', lang);
    await p.onDomMessage(domMsg(line, channel));
    await flush();
    expect(asked()).toHaveLength(1);
  });

  it('does not ask again on a line the detector named', async () => {
    const named = 'jestem tutaj dzisiaj';
    expect(confidentLanguage(named)).toBeDefined();
    const p = reader();
    p.setChannelLang('chan', 'tr');
    await p.onDomMessage(domMsg(named));
    await flush();
    expect(asked()).toHaveLength(1);
  });

  it('is not asked on a line the detector leaves open', () => {
    expect(confidentLanguage(LINE)).toBeUndefined();
  });
});
