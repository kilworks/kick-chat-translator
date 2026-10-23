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
import { markSkipped, showError, showThrottleIndicator } from './injector';
import { defaultSettings } from '~/shared/settings';
import { detectLanguage } from './langDetect';

const JP = 'これはテストメッセージです';
const wsMsg = (text: string) => ({ id: '1', text, channel: 'chan', username: 'user', isBot: false });
/** onDomMessage does not await the translate path, so let it settle before asserting. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TranslationPipeline — effTarget (regression)', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'x', message: 'x' } } });
  });

  // Regression for the self-referential getter (`return this.effTarget === 'auto' ? … : this.effTarget`)
  // that infinite-recursed → threw in prepare() → every incoming message was dropped before reaching
  // the SW. With the bug this test throws RangeError and send is never called.
  it('resolves the auto target and dispatches to the SW without recursing', async () => {
    const pipeline = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'auto', pauseWhenHidden: false });
    await pipeline.onWebSocketMessage(wsMsg(JP));
    expect(sendMock).toHaveBeenCalledTimes(1);
    const target = sendMock.mock.calls[0]?.[0]?.payload?.targetLang as string | undefined;
    expect(target).toBeTruthy();
    expect(target).not.toBe('auto'); // resolved to a real language, not the raw sentinel
  });

  it('passes an explicit target through verbatim', async () => {
    const pipeline = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false });
    await pipeline.onWebSocketMessage(wsMsg(JP));
    expect(sendMock.mock.calls[0]?.[0]?.payload?.targetLang).toBe('fr');
  });
});

describe('TranslationPipeline — minTextLength', () => {
  const SHORT_JP = 'おはよう';

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'x', message: 'x' } } });
  });

  it('translates a short message at the default floor', async () => {
    const pipeline = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false });
    await pipeline.onWebSocketMessage(wsMsg(SHORT_JP));
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('drops it once the configured floor is raised above its length', async () => {
    const pipeline = new TranslationPipeline({
      ...defaultSettings(),
      enabled: true,
      targetLang: 'fr',
      pauseWhenHidden: false,
      minTextLength: SHORT_JP.length + 1,
    });
    await pipeline.onWebSocketMessage(wsMsg(SHORT_JP));
    expect(sendMock).not.toHaveBeenCalled();
  });
});

/**
 * The websocket path only warms the cache — it never injects. The DOM path is the
 * only one that puts a translation on screen. So anything the warm path does to
 * shared state must not be able to suppress the display path.
 */
describe('TranslationPipeline — websocket warm vs DOM display', () => {
  const domMsg = (text: string, username = 'user') => {
    const rowElement = document.createElement('div');
    const injectionTarget = document.createElement('div');
    rowElement.appendChild(injectionTarget);
    return { rowElement, injectionTarget, id: 'd1', text, channel: 'chan', username, isBot: false };
  };

  const makePipeline = () =>
    new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false });

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'x', message: 'x' } } });
  });

  it('still displays a message the websocket already warmed', async () => {
    const pipeline = makePipeline();
    await pipeline.onWebSocketMessage(wsMsg(JP));
    sendMock.mockClear();

    await pipeline.onDomMessage(domMsg(JP));
    expect(sendMock).toHaveBeenCalled();
  });

  it('sends the same source hint from the warm pass as from the display path', async () => {
    const pipeline = makePipeline();
    await pipeline.onWebSocketMessage(wsMsg(JP));
    await pipeline.onDomMessage(domMsg(JP));
    await flush();
    const hints = sendMock.mock.calls.map((c) => c[0]?.payload?.sourceLangHint as string | undefined);
    expect(hints).toEqual(['ja', 'ja']);
  });

  it('still skips a message the same user just repeated', async () => {
    const pipeline = makePipeline();
    await pipeline.onDomMessage(domMsg(JP));
    sendMock.mockClear();

    await pipeline.onDomMessage(domMsg(JP));
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('keeps translating different users sending the same text', async () => {
    const pipeline = makePipeline();
    await pipeline.onDomMessage(domMsg(JP, 'alice'));
    sendMock.mockClear();

    await pipeline.onDomMessage(domMsg(JP, 'bob'));
    expect(sendMock).toHaveBeenCalled();
  });
});

// The per-channel budget is the only worker gate that still throws a message
// away, and it goes down the failure path. On a fast chat that painted a red
// marker on every message over the cap, all of them saying the same thing about
// the channel rather than about the line.
// Nineteen rounds went into working out why a given line was left alone. A user
// has none of that, so every line the pipeline drops now says why in its tooltip.
describe('TranslationPipeline, a dropped line says why', () => {
  const domMsg = (text: string) => {
    const rowElement = document.createElement('div');
    const injectionTarget = document.createElement('div');
    rowElement.appendChild(injectionTarget);
    return { rowElement, injectionTarget, id: 'd1', text, channel: 'chan', username: 'user', isBot: false };
  };
  const reasonsGiven = () => vi.mocked(markSkipped).mock.calls.map((c) => c[1]);

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: true, result: { translatedText: 'x', detectedLang: 'ja', provider: 'google' } } });
    vi.mocked(markSkipped).mockClear();
  });

  it('names the minimum length when the message is under it', async () => {
    const p = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'en', pauseWhenHidden: false, minTextLength: 5 });
    await p.onDomMessage(domMsg('abcd'));
    expect(reasonsGiven().join(' ')).toMatch(/shorter/i);
  });

  it('says so when the message is already in the reading language', async () => {
    const p = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'ja', pauseWhenHidden: false });
    await p.onDomMessage(domMsg(JP));
    expect(reasonsGiven().join(' ')).toMatch(/already/i);
  });

  // This guard deletes the line, so it only ever gets an answer that was looked
  // up. franc calls this Spanish sentence Portuguese, and on the old input a
  // Portuguese reader lost it without a word. Measured across 42 languages, that
  // mistake cost 1217 deleted lines against 90 on the looked-up answer.
  it('does not delete a line on a language franc only guessed at', async () => {
    const p = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'pt', pauseWhenHidden: false });
    await p.onDomMessage(domMsg('Ese que te dijo eso es ateo'));
    expect(reasonsGiven().join(' ')).not.toMatch(/already/i);
  });

  // The counterweight: a language the script check read off the text is a fact,
  // and a Japanese reader must still not be shown Japanese translated to
  // Japanese. Without this, "never delete" would pass the test above too.
  it('still deletes a line whose language was read off the script', async () => {
    const p = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'ja', pauseWhenHidden: false });
    await p.onDomMessage(domMsg(JP));
    expect(reasonsGiven().join(' ')).toMatch(/already/i);
  });

  // The chat recycles its rows. A row that carried a reason and is reused for a
  // message that DOES translate has to lose it, or it explains another message.
  it('clears the reason on a line it is going to translate', async () => {
    const p = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'en', pauseWhenHidden: false });
    await p.onDomMessage(domMsg(JP));
    await flush();
    expect(reasonsGiven()).toContain('');
  });
});

// The Debug tab reads this. Nineteen rounds of hand written instrumentation
// answered the same question; the ring makes it available without any.
describe('TranslationPipeline, the last decisions are kept for the Debug tab', () => {
  /** Connected, and shaped so extractMessageText finds the text: otherwise the
   *  recycled-row guard bails out before a translation is ever recorded. */
  const liveMsg = (text: string) => {
    const rowElement = document.createElement('div');
    const injectionTarget = document.createElement('div');
    const span = document.createElement('span');
    span.className = 'font-normal';
    span.textContent = text;
    injectionTarget.appendChild(span);
    rowElement.appendChild(injectionTarget);
    document.body.appendChild(rowElement);
    return { rowElement, injectionTarget, id: 'd1', text, channel: 'chan', username: 'user', isBot: false };
  };
  const build = () =>
    new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'en', pauseWhenHidden: false, minTextLength: 5 });

  beforeEach(() => {
    document.body.innerHTML = '';
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: true, result: { translatedText: 'a translation', detectedLang: 'ja', provider: 'google' } } });
  });

  it('records both what it skipped and what it translated, newest first', async () => {
    const p = build();
    await p.onDomMessage(liveMsg('abcd'));
    await p.onDomMessage(liveMsg(JP));
    await flush();
    const seen = p.recentDecisions();
    expect(seen[0]?.outcome).toBe('translated');
    expect(seen[1]?.outcome).toMatch(/shorter/i);
  });

  it('never grows past fifty', async () => {
    const p = build();
    for (let i = 0; i < 60; i++) await p.onDomMessage(liveMsg(`ab${i}`));
    expect(p.recentDecisions()).toHaveLength(50);
  });

  it('says nothing at all before any message has been seen', () => {
    expect(build().recentDecisions()).toEqual([]);
  });

  // Three exits can end a line for "already readable". Two decide here without
  // asking anyone; the third is the service answering after the call was paid
  // for. They used to share a wording, so the Debug tab showed two verdicts for
  // what looked like one case.
  it('tells what it decided itself apart from what the service decided', async () => {
    // Our detector reads this as Japanese, so it goes out to the service, which
    // then reports the source was English, which is the reading language.
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: true, result: { translatedText: 'x', detectedLang: 'en', provider: 'google' } } });
    const p = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'en', pauseWhenHidden: false, ignoreEnglish: true, minTextLength: 5 });
    await p.onDomMessage(liveMsg(JP));
    await flush();
    const outcome = p.recentDecisions()[0]?.outcome ?? '';
    expect(outcome).toMatch(/translation service/i);
    expect(outcome).not.toBe('it is already in your language');
  });

  // The table shows one line and hangs the rest on the hover, so the ring has to
  // still be holding the rest.
  it('keeps enough of a long message to show it whole on hover', async () => {
    const p = build();
    await p.onDomMessage(liveMsg('あ'.repeat(150)));
    await flush();
    expect(p.recentDecisions()[0]?.text.length).toBeGreaterThan(80);
  });
});

describe('TranslationPipeline, a spent channel budget is reported once', () => {
  const domMsg = (text: string) => {
    const rowElement = document.createElement('div');
    const injectionTarget = document.createElement('div');
    rowElement.appendChild(injectionTarget);
    return { rowElement, injectionTarget, id: 'd1', text, channel: 'chan', username: 'user', isBot: false };
  };
  const pipeline = () =>
    new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'en', pauseWhenHidden: false });
  const failWith = (code: string) => {
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code, message: code } } });
  };

  beforeEach(() => {
    sendMock.mockReset();
    vi.mocked(showError).mockClear();
    vi.mocked(showThrottleIndicator).mockClear();
  });

  it('shows it on the bar and leaves the line bare', async () => {
    failWith('channel_budget');
    await pipeline().onDomMessage(domMsg(JP));
    await flush();
    expect(vi.mocked(showThrottleIndicator)).toHaveBeenCalledWith(true);
    expect(vi.mocked(showError)).not.toHaveBeenCalled();
  });

  it('still marks the line for every other reason', async () => {
    failWith('quota');
    await pipeline().onDomMessage(domMsg(JP));
    await flush();
    expect(vi.mocked(showError)).toHaveBeenCalled();
    expect(vi.mocked(showThrottleIndicator)).not.toHaveBeenCalled();
  });
});

// Measured on saved chat with kil's settings and an English target: the funnel
// dropped almost nothing (51 of 52 Turkish lines survived every gate), but 21 of
// 76 surviving Spanish lines and 11 of 51 Turkish ones reached the engine carrying
// a source language franc had guessed wrong. Forcing that `sl` made Google hand
// back the original text for 4 of the 11 Turkish lines probed, which the injector
// then dropped in silence, and mistranslated most of the rest.
describe('TranslationPipeline — source language handed to the engine', () => {
  const domMsg = (text: string) => {
    const rowElement = document.createElement('div');
    const injectionTarget = document.createElement('div');
    rowElement.appendChild(injectionTarget);
    return { rowElement, injectionTarget, id: 'd1', text, channel: 'chan', username: 'user', isBot: false };
  };
  const pipeline = () =>
    new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'en', pauseWhenHidden: false });
  const hintOf = () => sendMock.mock.calls[0]?.[0]?.payload?.sourceLangHint as string | undefined;

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'x', message: 'x' } } });
  });

  // franc labels this Spanish line "pt". Sent as `sl=pt` it came back as
  // "That's what I tell you, that's what I'm", against "The one who told you
  // that is an atheist" when Google was left to detect it.
  it('sends no source language when franc only guessed at it', async () => {
    await pipeline().onDomMessage(domMsg('Ese que te dijo eso es ateo'));
    expect(sendMock).toHaveBeenCalled();
    expect(hintOf()).toBeUndefined();
  });

  // Same for Turkish: franc says "id" here, and `sl=id` returned the line unchanged.
  it('sends no source language for a Turkish line franc mislabels', async () => {
    await pipeline().onDomMessage(domMsg('vay vay vay merhabalar'));
    expect(sendMock).toHaveBeenCalled();
    expect(hintOf()).toBeUndefined();
  });

  // The other half of the fix: a language read off the script is a fact, so it
  // must still be sent. Japanese and Korean were right on every saved line.
  it('still sends a language the script check read off the text', async () => {
    await pipeline().onDomMessage(domMsg(JP));
    expect(hintOf()).toBe('ja');
  });

  it('still sends Korean', async () => {
    await pipeline().onDomMessage(domMsg('진짜 최소한 바로바로 이런 드립은 처줘야 방송하는구나'));
    expect(hintOf()).toBe('ko');
  });
});

/**
 * franc calls some short foreign lines English, and the English skip deleted
 * them for English readers: 10 of 1085 foreign lines of the chat corpora.
 * A letter English does not write vetoes the skip.
 */
describe('TranslationPipeline — the English skip', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'x', message: 'x' } } });
  });
  const enReader = () => new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'en', pauseWhenHidden: false });

  it('sends an Italian line franc calls English', async () => {
    expect(detectLanguage('è troppo forte')).toBe('en');
    await enReader().onWebSocketMessage(wsMsg('è troppo forte'));
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('still skips English', async () => {
    expect(detectLanguage('i cant believe he did that again')).toBe('en');
    await enReader().onWebSocketMessage(wsMsg('i cant believe he did that again'));
    expect(sendMock).not.toHaveBeenCalled();
  });
});


/**
 * Google leaves "ngl" and "lmk" as they are and reads "idc" as "I don't know".
 * An English line going to a reader in another language is spelled out first.
 */
describe('TranslationPipeline — English chat abbreviations', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'x', message: 'x' } } });
  });
  const reader = (targetLang: string) =>
    new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang, pauseWhenHidden: false });
  const sentText = () => (sendMock.mock.calls[0]?.[0] as { payload: { text: string } }).payload.text;

  it('spells them out for a French reader', async () => {
    await reader('fr').onWebSocketMessage(wsMsg('idc about the score ngl'));
    expect(sentText()).toBe("I don't care about the score not gonna lie");
  });

  it('leaves a Polish line alone', async () => {
    await reader('fr').onWebSocketMessage(wsMsg('był w domu cały dzień'));
    expect(sentText()).toBe('był w domu cały dzień');
  });
});

describe('TranslationPipeline: only the part worth translating is sent', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ type: 'translate.result', payload: { ok: false, error: { code: 'x', message: 'x' } } });
  });
  const run = async (text: string) => {
    const pipeline = new TranslationPipeline({ ...defaultSettings(), enabled: true, targetLang: 'fr', pauseWhenHidden: false });
    await pipeline.onWebSocketMessage(wsMsg(text));
    return (sendMock.mock.calls[0]?.[0] as { payload: { text: string } } | undefined)?.payload.text;
  };

  it('sends a pasted phrase once', async () => {
    expect(await run('TAPA NA CARA PELOS TP TAPA NA CARA PELOS TP TAPA NA CARA PELOS TP')).toBe('TAPA NA CARA PELOS TP');
  });

  it('sends the sentence without the laughter around it', async () => {
    expect(await run('jajajaja como te explico que es Roblox')).toBe('como te explico que es Roblox');
  });

  it('sends nothing for a bare bot command', async () => {
    expect(await run('!slots 332')).toBeUndefined();
  });
});
