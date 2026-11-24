import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  showLangBlocked: vi.fn(),
  showToast: vi.fn(),
  updateActiveProvider: vi.fn(),
}));
vi.mock('./localEngine', () => ({
  localEngine: { present: () => false, noteSeen: vi.fn(), isReady: () => false, translate: vi.fn() },
}));
vi.mock('./memcache', () => ({ memCache: { get: () => undefined, set: vi.fn() } }));

import { TranslationPipeline } from './pipeline';
import { inject, showError, showLoading, showThrottleIndicator } from './injector';
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

  it('shows readable text on the line, never the machine code', async () => {
    const { localEngine } = await import('./localEngine');
    Object.assign(localEngine, { isReady: () => false });
    sendMock.mockResolvedValue(failure('rate_limit'));
    await reader().onDomMessage(domMsg());
    await flush();
    expect(vi.mocked(showError).mock.calls[0]?.[1]).toBe('Translation failed');
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

describe('TranslationPipeline, waiting on the worker', () => {
  const line = (n: number) => {
    const rowElement = document.createElement('div');
    const injectionTarget = document.createElement('span');
    injectionTarget.className = 'font-normal';
    injectionTarget.textContent = `jestem tutaj dzisiaj numer ${n}`;
    rowElement.appendChild(injectionTarget);
    document.body.appendChild(rowElement);
    return { rowElement, injectionTarget, id: `w${n}`, text: injectionTarget.textContent, channel: 'chan', username: `u${n}`, isBot: false };
  };
  const reader = () =>
    new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false, localEnabled: false });
  const success = { type: 'translate.result', payload: { ok: true, result: { translatedText: 'je suis ici', detectedLang: 'pl', provider: 'google', cached: false } } };

  beforeEach(() => {
    vi.useFakeTimers();
    sendMock.mockReset();
    vi.mocked(inject).mockClear();
    vi.mocked(showError).mockClear();
    vi.mocked(showThrottleIndicator).mockClear();
    vi.mocked(showLoading).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  // "…" went on every line sent and came off when the answer did. A refusal
  // answers in milliseconds, so on a chat over its budget most lines flashed it
  // for nothing, and each flash cost the page two layouts.
  it('shows no placeholder on a line the worker answers at once', async () => {
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'channel_budget', message: 'x' } } });
    await reader().onDomMessage(line(200));
    await vi.advanceTimersByTimeAsync(1_000);
    sendMock.mockResolvedValue(success);
    await reader().onDomMessage(line(201));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(inject).toHaveBeenCalledTimes(1);
    expect(showLoading).not.toHaveBeenCalled();
  });

  // The delay opened a window the immediate "…" never had: Kick reuses a row
  // for the next message, and a timer left from the old one marked the new
  // one as waiting, where nothing would ever take it off.
  it('puts no placeholder on a row recycled for another message meanwhile', async () => {
    sendMock.mockReturnValue(new Promise(() => undefined));
    const m = line(203);
    await reader().onDomMessage(m);
    m.injectionTarget.textContent = 'otra persona escribe otra cosa';
    await vi.advanceTimersByTimeAsync(300);
    expect(showLoading).not.toHaveBeenCalled();
  });

  it('shows the placeholder once an answer is slow to come', async () => {
    let answer: (v: unknown) => void = () => undefined;
    sendMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await reader().onDomMessage(line(202));
    await vi.advanceTimersByTimeAsync(200);
    expect(showLoading).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(showLoading).toHaveBeenCalledTimes(1);
    answer(success);
    await vi.advanceTimersByTimeAsync(10);
    expect(inject).toHaveBeenCalledTimes(1);
  });

  // `send` had no deadline: a worker that never answered kept the row on "…"
  // and the message alive for as long as the page lived.
  it('gives up on an answer that never comes and offers the retry', async () => {
    sendMock.mockReturnValue(new Promise(() => undefined));
    await reader().onDomMessage(line(1));
    await vi.advanceTimersByTimeAsync(25_000);
    expect(showError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showError).mock.calls[0]?.[2]).toBeTypeOf('function');
    expect(inject).not.toHaveBeenCalled();
  });

  it('drops an answer that arrives after the deadline, never writing the line twice', async () => {
    let answer: (v: unknown) => void = () => undefined;
    sendMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await reader().onDomMessage(line(2));
    await vi.advanceTimersByTimeAsync(25_000);
    answer(success);
    await vi.advanceTimersByTimeAsync(10);
    expect(showError).toHaveBeenCalledTimes(1);
    expect(inject).not.toHaveBeenCalled();
  });

  // Each refusal armed its own 5 s timer, so at twice the budget hundreds ran a
  // minute and the hourglass was taken off and put back while refusals went on.
  it('keeps one hourglass timer and hides it 5 s after the last refusal', async () => {
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'channel_budget', message: 'x' } } });
    const p = reader();
    // The pipeline's own minute interval (userDedup) is already there.
    const base = vi.getTimerCount();
    for (let n = 0; n < 10; n++) {
      await p.onDomMessage(line(100 + n));
      await vi.advanceTimersByTimeAsync(400);
    }
    const hidden = () => vi.mocked(showThrottleIndicator).mock.calls.filter((c) => c[0] === false).length;
    expect(hidden()).toBe(0);
    expect(vi.getTimerCount()).toBe(base + 1);
    // The last refusal came 400 ms ago: 4.6 s more is 5 s after it.
    await vi.advanceTimersByTimeAsync(4_500);
    expect(hidden()).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(hidden()).toBe(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(hidden()).toBe(1);
  });
});

// A model that never answers left one pending line per message, holding its row,
// for the life of the page. The cloud path had a deadline; this one had none.
describe('TranslationPipeline, an on-device model that stalls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sendMock.mockReset();
    vi.mocked(showError).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('gives up on it after the same deadline as the cloud, and shows the failure', async () => {
    const { localEngine } = await import('./localEngine');
    Object.assign(localEngine, { present: () => true, isReady: () => true, translate: () => new Promise<string>(() => undefined) });
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'no_provider', message: 'x' } } });
    const rowElement = document.createElement('div');
    const injectionTarget = document.createElement('span');
    injectionTarget.className = 'font-normal';
    injectionTarget.textContent = 'jestem tutaj dzisiaj wieczorem';
    rowElement.appendChild(injectionTarget);
    document.body.appendChild(rowElement);
    const p = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false });
    await p.onDomMessage({ rowElement, injectionTarget, id: 'stall', text: injectionTarget.textContent, channel: 'chan', username: 'u', isBot: false });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(showError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(showError).toHaveBeenCalledTimes(1);
  });
});
