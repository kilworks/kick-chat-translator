import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from './settings';
import { fetchSettings, watchSettings } from './settingsClient';

/**
 * The content script's first act on a page is to ask the worker for settings, and
 * in MV3 that worker may not exist yet: the browser kills it when idle and a
 * message is what wakes it, so the first send after a pause can lose the race.
 *
 * Before this client existed the content script read storage directly, which
 * cannot fail that way. A rejection here aborts main() and the extension does
 * nothing on the page, silently, which is the worst shape a failure can take.
 */

let calls: number;
let failFirst: number;

beforeEach(() => {
  calls = 0;
  failFirst = 0;
  vi.useFakeTimers();
  vi.stubGlobal('chrome', {
    runtime: {
      lastError: undefined,
      sendMessage: (_msg: unknown, cb: (r: unknown) => void) => {
        calls += 1;
        // A worker that is not awake yet answers nothing at all.
        cb(calls <= failFirst ? undefined : { type: 'settings', payload: defaultSettings() });
      },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchSettings on a cold worker', () => {
  it('answers on the first try when the worker is awake', async () => {
    await expect(fetchSettings()).resolves.toMatchObject({ enabled: true });
    expect(calls).toBe(1);
  });

  it('survives a worker that misses the first wake', async () => {
    failFirst = 1;
    const p = fetchSettings();
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ enabled: true });
    expect(calls).toBe(2);
  });

  it('survives two misses', async () => {
    failFirst = 2;
    const p = fetchSettings();
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ enabled: true });
    expect(calls).toBe(3);
  });

  it('gives up rather than hanging when the worker never answers', async () => {
    // Control: retrying must not become retrying forever. A page that waits on a
    // dead worker is no better than one that gave up immediately, and worse to
    // diagnose.
    failFirst = 99;
    // The handler is attached before the timers run on purpose. Awaiting the
    // rejection afterwards leaves a window where nothing is listening, and node
    // reports an unhandled rejection that has nothing to do with the code here.
    const settled = fetchSettings().then(
      () => undefined,
      (err: unknown) => err,
    );
    await vi.runAllTimersAsync();
    expect(await settled).toBeInstanceOf(Error);
    expect(calls).toBe(3);
  });
});

// A content script has no storage access (the worker shuts it), and a storage
// change event carries values, the DeepL key among them. The tab is told to ask.
describe('watchSettings', () => {
  it('re-asks the worker when told, and never listens to storage', async () => {
    let listener: ((m: unknown) => void) | undefined;
    const onChanged = { addListener: vi.fn() };
    vi.stubGlobal('chrome', {
      storage: { onChanged },
      runtime: {
        lastError: undefined,
        onMessage: { addListener: (l: typeof listener) => (listener = l), removeListener: () => undefined },
        sendMessage: (_m: unknown, cb: (r: unknown) => void) => cb({ type: 'settings', payload: defaultSettings() }),
      },
    });
    const seen: unknown[] = [];
    watchSettings((s) => seen.push(s));
    listener?.({ type: 'debug.decisions' });
    listener?.({ type: 'settings.changed' });
    await vi.runAllTimersAsync();
    expect(seen).toHaveLength(1);
    expect(onChanged.addListener).not.toHaveBeenCalled();
  });
});
