import { describe, it, expect, vi, beforeEach } from 'vitest';

// The language allowlist used to drop lines without a word on the bar or in the
// popup. The pipeline now keeps the last lines that reached it, and tells the
// bar when the share it dropped is worth saying. A window, not a run: a run that
// reset on every allowed line flipped the bar on each line of a mixed chat.
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
vi.mock('./memcache', () => ({ memCache: { get: () => undefined, set: vi.fn() } }));

import { LANG_BLOCKED_MIN, LANG_BLOCKED_WINDOW, TranslationPipeline } from './pipeline';
import { showLangBlocked } from './injector';
import { defaultSettings } from '~/shared/settings';
import type { Settings } from '~/shared/settings';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
let n = 0;
/** Connected and shaped like a Kick row, so the recycled-row guard lets it through. */
const line = (text: string, channel = 'chan') => {
  const rowElement = document.createElement('div');
  const injectionTarget = document.createElement('div');
  const span = document.createElement('span');
  span.className = 'font-normal';
  span.textContent = text;
  injectionTarget.appendChild(span);
  rowElement.appendChild(injectionTarget);
  document.body.appendChild(rowElement);
  n++;
  return { rowElement, injectionTarget, id: `d${n}`, text, channel, username: `user${n}`, isBot: false };
};
const RU = ['привет всем как дела', 'это очень смешно', 'давай играть дальше', 'где ты был вчера'];
const JA = 'これはテストメッセージです';
const settings = (over: Partial<Settings> = {}): Settings => ({
  ...defaultSettings(),
  enabled: true,
  targetLang: 'en',
  pauseWhenHidden: false,
  minTextLength: 1,
  sourceLangAllowlist: ['ja'],
  ...over,
});

describe('the language allowlist is said, not silent', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.mocked(showLangBlocked).mockClear();
    sendMock.mockReset();
    sendMock.mockResolvedValue({
      type: 'translate.result',
      payload: { ok: true, result: { translatedText: 'a translation', detectedLang: 'ja', provider: 'google' } },
    });
  });

  it('says nothing for fewer drops than the threshold, then gives the count', async () => {
    const p = new TranslationPipeline(settings());
    for (let i = 0; i < LANG_BLOCKED_MIN - 1; i++) await p.onDomMessage(line(RU[i]!));
    expect(p.langBlockedCount()).toBe(0);
    expect(vi.mocked(showLangBlocked)).not.toHaveBeenCalled();
    await p.onDomMessage(line(RU[LANG_BLOCKED_MIN - 1]!));
    expect(p.langBlockedCount()).toBe(LANG_BLOCKED_MIN);
    expect(vi.mocked(showLangBlocked)).toHaveBeenLastCalledWith(LANG_BLOCKED_MIN);
  });

  it('holds through a mixed chat, and clears after a whole window with no drop', async () => {
    const p = new TranslationPipeline(settings());
    for (const t of RU) await p.onDomMessage(line(t));
    expect(p.langBlockedCount()).toBe(4);
    // One allowed line between drops no longer flips it off and on.
    await p.onDomMessage(line(JA));
    await flush();
    expect(p.langBlockedCount()).toBe(4);
    for (let i = 0; i < LANG_BLOCKED_WINDOW - 2; i++) await p.onDomMessage(line(JA));
    await flush();
    expect(p.langBlockedCount()).toBeGreaterThan(0);
    await p.onDomMessage(line(JA));
    await flush();
    expect(p.langBlockedCount()).toBe(0);
    expect(vi.mocked(showLangBlocked)).toHaveBeenLastCalledWith(0);
  });

  // In hover mode an allowed line is only armed, never painted, so a count
  // that waited for "translated" never saw it and climbed for good.
  it('counts an allowed line where the allowlist lets it through, hover mode too', async () => {
    const p = new TranslationPipeline(settings({ displayStyle: 'hover' }));
    for (const t of RU.slice(0, 3)) await p.onDomMessage(line(t));
    expect(p.langBlockedCount()).toBe(3);
    for (let i = 0; i < LANG_BLOCKED_WINDOW; i++) await p.onDomMessage(line(JA));
    expect(p.langBlockedCount()).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('starts over on a route change, with no new line needed', async () => {
    const p = new TranslationPipeline(settings());
    for (const t of RU) await p.onDomMessage(line(t, 'one'));
    expect(p.langBlockedCount()).toBe(4);
    p.resetLangBlocked('');
    expect(p.langBlockedCount()).toBe(0);
    expect(vi.mocked(showLangBlocked)).toHaveBeenLastCalledWith(0);
  });

  it('clears itself when the allowlist changes', async () => {
    const p = new TranslationPipeline(settings());
    for (const t of RU) await p.onDomMessage(line(t));
    p.updateSettings(settings({ sourceLangAllowlist: ['ja', 'ru'] }));
    expect(p.langBlockedCount()).toBe(0);
    expect(vi.mocked(showLangBlocked)).toHaveBeenLastCalledWith(0);
  });

  it('starts over on another channel', async () => {
    const p = new TranslationPipeline(settings());
    for (const t of RU) await p.onDomMessage(line(t, 'one'));
    await p.onDomMessage(line('совсем другой канал', 'two'));
    expect(p.langBlockedCount()).toBe(0);
  });

  // Control: other reasons to skip neither count nor break the run.
  it('ignores lines skipped for other reasons', async () => {
    const p = new TranslationPipeline(settings({ minTextLength: 6 }));
    await p.onDomMessage(line(RU[0]!));
    await p.onDomMessage(line('ok')); // too short
    await p.onDomMessage(line(RU[1]!));
    await p.onDomMessage(line(RU[2]!));
    expect(p.langBlockedCount()).toBe(3);
  });

  // Control: without an allowlist the same Russian lines go to the engine.
  it('stays at zero with no allowlist', async () => {
    const p = new TranslationPipeline(settings({ sourceLangAllowlist: [] }));
    for (const t of RU) await p.onDomMessage(line(t));
    await flush();
    expect(p.langBlockedCount()).toBe(0);
    expect(vi.mocked(showLangBlocked)).not.toHaveBeenCalled();
  });
});
