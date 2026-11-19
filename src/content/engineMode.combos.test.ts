import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pins what the pipeline does today for every engineMode x localEnabled pair,
// so a change to the options UI cannot silently change the dispatch. The trace
// lists which engine was asked, in order: 'local' for the on-device model,
// 'cloud' for a translate request to the service worker.
const { sendMock, local, trace } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  trace: [] as string[],
  local: {
    present: (): boolean => true,
    noteSeen: () => undefined,
    isReady: () => true,
    translate: async (): Promise<string> => 'traduit',
  },
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
import { inject, markSkipped, showError } from './injector';
import { defaultSettings, type Settings } from '~/shared/settings';

// A looked-up language, so the on-device path is eligible in every mode.
const LINE = 'これはテストメッセージです';
const domMsg = () => {
  const rowElement = document.createElement('div');
  const injectionTarget = document.createElement('span');
  injectionTarget.className = 'font-normal';
  injectionTarget.textContent = LINE;
  rowElement.appendChild(injectionTarget);
  // Attached and holding its text, or applyTranslation reads the row as recycled.
  document.body.replaceChildren(rowElement);
  return { rowElement, injectionTarget, id: 'd1', text: LINE, channel: 'chan', username: 'user', isBot: false };
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const ok = { type: 'translate.result', payload: { ok: true, result: { translatedText: 'cloud', detectedLang: 'ja', provider: 'google', cached: false } } };
const fail = { type: 'translate.result', payload: { ok: false, error: { code: 'no_provider', message: 'no_provider' } } };

type Mode = Settings['engineMode'];
type Scenario = 'allOk' | 'cloudFails' | 'localThrows';

interface Outcome {
  trace: string[];
  shown: string | undefined;
  error: boolean;
  skipped: boolean;
}

async function run(engineMode: Mode, localEnabled: boolean, scenario: Scenario, present = true): Promise<Outcome> {
  trace.length = 0;
  local.present = () => present;
  local.translate = async () => {
    trace.push('local');
    if (scenario === 'localThrows') throw new Error('model failed');
    return 'local';
  };
  sendMock.mockImplementation(async (m: { type: string }) => {
    if (m.type !== 'translate') return undefined;
    trace.push('cloud');
    return scenario === 'cloudFails' ? fail : ok;
  });
  const p = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false, engineMode, localEnabled });
  await p.onDomMessage(domMsg());
  await flush();
  const injected = vi.mocked(inject).mock.calls[0]?.[1] as { provider?: string } | undefined;
  const reasons = vi.mocked(markSkipped).mock.calls.map((c) => c[1]).filter(Boolean);
  return { trace: [...trace], shown: injected?.provider, error: vi.mocked(showError).mock.calls.length > 0, skipped: reasons.length > 0 };
}

beforeEach(() => {
  sendMock.mockReset();
  vi.mocked(inject).mockClear();
  vi.mocked(markSkipped).mockClear();
  vi.mocked(showError).mockClear();
});

// [mode, localEnabled, scenario, expected trace, provider shown, error shown, skipped]
const CHROME: Array<[Mode, boolean, Scenario, string[], string | undefined, boolean, boolean]> = [
  ['local-first', true, 'allOk', ['local'], 'local', false, false],
  ['local-first', true, 'cloudFails', ['local'], 'local', false, false],
  ['local-first', true, 'localThrows', ['local', 'cloud'], 'google', false, false],
  ['local-first', false, 'allOk', ['cloud'], 'google', false, false],
  ['local-first', false, 'cloudFails', ['cloud'], undefined, true, false],
  ['local-first', false, 'localThrows', ['cloud'], 'google', false, false],
  ['cloud-first', true, 'allOk', ['cloud'], 'google', false, false],
  ['cloud-first', true, 'cloudFails', ['cloud', 'local'], 'local', false, false],
  ['cloud-first', true, 'localThrows', ['cloud'], 'google', false, false],
  ['cloud-first', false, 'allOk', ['cloud'], 'google', false, false],
  ['cloud-first', false, 'cloudFails', ['cloud'], undefined, true, false],
  ['cloud-first', false, 'localThrows', ['cloud'], 'google', false, false],
  ['local-only', true, 'allOk', ['local'], 'local', false, false],
  ['local-only', true, 'cloudFails', ['local'], 'local', false, false],
  // The model threw, and the line is skipped with the "no model" reason.
  ['local-only', true, 'localThrows', ['local'], undefined, false, true],
  // The contradictory state: no engine is ever asked, every line is skipped.
  ['local-only', false, 'allOk', [], undefined, false, true],
  ['local-only', false, 'cloudFails', [], undefined, false, true],
  ['local-only', false, 'localThrows', [], undefined, false, true],
];

describe('engineMode x localEnabled, on-device model present (Chrome)', () => {
  it.each(CHROME)('%s, localEnabled=%s, %s', async (mode, enabled, scenario, expTrace, expShown, expError, expSkipped) => {
    const o = await run(mode, enabled, scenario);
    expect(o).toEqual({ trace: expTrace, shown: expShown, error: expError, skipped: expSkipped });
  });
});

// Firefox has no on-device API: present() is false whatever the settings say.
const FIREFOX: Array<[Mode, boolean, string[], boolean]> = [
  ['local-first', true, ['cloud'], false],
  ['local-first', false, ['cloud'], false],
  ['cloud-first', true, ['cloud'], false],
  ['cloud-first', false, ['cloud'], false],
  ['local-only', true, [], true],
  ['local-only', false, [], true],
];

describe('engineMode x localEnabled, no on-device model (Firefox)', () => {
  it.each(FIREFOX)('%s, localEnabled=%s', async (mode, enabled, expTrace, expSkipped) => {
    const o = await run(mode, enabled, 'allOk', false);
    expect(o.trace).toEqual(expTrace);
    expect(o.skipped).toBe(expSkipped);
  });
});

describe('websocket warm pass', () => {
  it.each<[Mode, boolean]>([
    ['local-first', true],
    ['cloud-first', true],
    ['local-only', false],
  ])('%s sends a cloud warm-up: %s', async (mode, expected) => {
    sendMock.mockResolvedValue(ok);
    const p = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false, engineMode: mode, localEnabled: false });
    await p.onWebSocketMessage({ id: 'w1', text: LINE, channel: 'chan', username: 'user', isBot: false } as never);
    expect(sendMock.mock.calls.some((c) => (c[0] as { type: string }).type === 'translate')).toBe(expected);
  });
});
