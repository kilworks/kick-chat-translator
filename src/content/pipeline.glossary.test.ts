import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same headless setup as pipeline.test.ts, except the in-tab cache is the real
// one: what is under test is what a cache replay shows.
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
  showLangBlocked: vi.fn(),
  showToast: vi.fn(),
  updateActiveProvider: vi.fn(),
}));
vi.mock('./localEngine', () => ({
  localEngine: { present: () => false, noteSeen: vi.fn(), isReady: () => false, translate: vi.fn() },
}));

import { TranslationPipeline } from './pipeline';
import { inject } from './injector';
import { defaultSettings } from '~/shared/settings';

let seq = 0;
const domMsg = (text: string) => {
  const rowElement = document.createElement('div');
  const injectionTarget = document.createElement('div');
  const span = document.createElement('span');
  span.className = 'font-normal';
  span.textContent = text;
  injectionTarget.appendChild(span);
  rowElement.appendChild(injectionTarget);
  document.body.appendChild(rowElement);
  return { rowElement, injectionTarget, id: `g${++seq}`, text, channel: 'glossary', username: 'user', isBot: false };
};
const shownTexts = () => vi.mocked(inject).mock.calls.map((c) => c[1]?.translatedText as string);

beforeEach(() => {
  document.body.textContent = '';
  sendMock.mockReset();
  vi.mocked(inject).mockClear();
  sendMock.mockResolvedValue({
    type: 'translate.result',
    payload: { ok: true, result: { translatedText: 'thanks bro for the stream', detectedLang: 'es', provider: 'google' } },
  });
});

describe('user glossary on a repeated line', () => {
  // The in-tab cache stored the text after the glossary, and the replay ran
  // the glossary again: the second copy of a line read "bro (brother) (brother)".
  it('applies the glossary once, on the first line and on the cached replay', async () => {
    // Two pipelines, as in two tabs: one pipeline drops a repeat as a duplicate,
    // and the in-tab cache is shared by the module either way.
    const build = () =>
      new TranslationPipeline({
        ...defaultSettings(),
        enabled: true,
        targetLang: 'en',
        pauseWhenHidden: false,
        localEnabled: false,
        glossary: ['bro -> bro (brother)'],
      });
    const line = 'gracias hermano por el directo de hoy';
    await build().onDomMessage(domMsg(line));
    await vi.waitFor(() => expect(shownTexts()).toHaveLength(1));
    await build().onDomMessage(domMsg(line));
    await vi.waitFor(() => expect(shownTexts()).toHaveLength(2));
    expect(shownTexts()).toEqual(['thanks bro (brother) for the stream', 'thanks bro (brother) for the stream']);
  });
});
