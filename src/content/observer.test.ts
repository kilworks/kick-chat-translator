import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatObserver } from './observer';

interface Recorded {
  disconnected: boolean;
  target: unknown;
  cb?: MutationCallback;
}

const created: Recorded[] = [];

class RecordingObserver {
  private rec: Recorded = { disconnected: false, target: undefined };
  // The callback used to be dropped on the floor, which meant no test could
  // deliver a mutation and the whole mutation-handling branch was unreachable
  // from here. A recycled row bug lived in it.
  constructor(cb: MutationCallback) {
    this.rec.cb = cb;
    created.push(this.rec);
  }
  observe(target: unknown): void {
    this.rec.target = target;
  }
  disconnect(): void {
    this.rec.disconnected = true;
  }
  takeRecords(): unknown[] {
    return [];
  }
}

beforeEach(() => {
  created.length = 0;
  vi.stubGlobal('MutationObserver', RecordingObserver);
  // Mirrors live Kick: several elements match the container selector and only one
  // is the message list. The decoy comes first, as it does in the real page.
  document.body.innerHTML =
    '<div id="channel-chatroom">' +
    '<div class="no-scrollbar" data-which="decoy"></div>' +
    '<div class="no-scrollbar" data-which="messages">' +
    '<div data-index="0"><button class="font-bold" style="color: rgb(1,2,3)">bob</button>' +
    '<span class="font-normal">hola amigos</span></div>' +
    '</div></div>';
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('a recycled row', () => {
  // Kick reuses chat rows: the virtual scroller replaces a row's CONTENTS and
  // leaves the row element in place. The row is then the mutation TARGET and
  // never an added node, so collecting candidates from added nodes and their
  // descendants walks straight past it.
  //
  // Measured with the extension loaded before this was written: eight recycled
  // rows kept no translation, carried no reason, and produced no provider call.
  it('is delivered when its contents are replaced', () => {
    const seen: string[] = [];
    const obs = new ChatObserver((m) => seen.push(m.text));
    obs.start();
    seen.length = 0;

    const liste = document.querySelector('[data-which="messages"]')!;
    const row = liste.querySelector('div[data-index="0"]')!;
    row.innerHTML =
      '<button class="font-bold" style="color: rgb(1,2,3)">ana</button>' +
      '<span class="font-normal">otro mensaje distinto</span>';

    const rec = created.find((r) => r.target === liste);
    expect(rec?.cb).toBeTypeOf('function');
    rec!.cb!(
      [{ type: 'childList', target: row, addedNodes: [...row.childNodes] } as unknown as MutationRecord],
      {} as MutationObserver,
    );

    expect(seen).toContain('otro mensaje distinto');
    obs.stop();
  });
});

describe('ChatObserver lifecycle', () => {
  it('observes once attached', () => {
    const obs = new ChatObserver(() => undefined);
    obs.start();
    expect(created.length).toBeGreaterThan(0);
    obs.stop();
  });

  // The failure this guards against is silent and total: binding to a container
  // that matches the selector but holds no messages means nothing is ever
  // translated, with no error anywhere.
  it('delivers the messages already on screen when it attaches', () => {
    const seen: string[] = [];
    const obs = new ChatObserver((m) => seen.push(m.text));
    obs.start();
    obs.stop();
    expect(seen).toEqual(['hola amigos']);
  });

  // Anything left observing document.body with subtree:true keeps running for the
  // life of the page and fires on every mutation anywhere in it.
  it('disconnects everything it started when stopped', () => {
    const obs = new ChatObserver(() => undefined);
    obs.start();
    obs.stop();

    expect(created.length).toBeGreaterThan(0);
    expect(created.filter((o) => !o.disconnected)).toEqual([]);
  });

  // reset() + start() runs on every channel switch, so anything not cleaned up
  // here accumulates one more observer per navigation.
  it('does not accumulate observers across channel switches', () => {
    const obs = new ChatObserver(() => undefined);
    obs.start();
    for (let i = 0; i < 5; i++) {
      obs.reset();
      obs.start();
    }
    const live = created.filter((o) => !o.disconnected);
    obs.stop();

    // At most the two an attached observer legitimately holds.
    expect(live.length).toBeLessThanOrEqual(2);
  });
});

describe('waiting for the list', () => {
  const LISTE =
    '<div id="channel-chatroom"><div class="no-scrollbar" data-which="messages">' +
    '<div data-index="0"><button class="font-bold" style="color: rgb(1,2,3)">bob</button>' +
    '<span class="font-normal">hola amigos</span></div></div></div>';
  const vivants = () => created.filter((o) => o.target && !o.disconnected);

  beforeEach(() => {
    vi.useFakeTimers();
    // A channel switch: the panel is there, the list with its rows is not yet.
    document.body.innerHTML = '<div id="channel-chatroom"></div>';
  });
  afterEach(() => vi.useRealTimers());

  // The route poll and the container guard both call reset(). Each reset used
  // to start its own poll without stopping the pending one, and every chain
  // ended in attach(): the later attach overwrote the fields of the earlier one
  // and left its two observers connected for the life of the page.
  it('attaches once however many resets arrive meanwhile', () => {
    const obs = new ChatObserver(() => undefined);
    obs.start();
    obs.reset();
    obs.reset();
    document.body.innerHTML = LISTE;
    vi.advanceTimersByTime(2000);
    expect(vivants()).toHaveLength(2);
    obs.stop();
  });

  it('attaches nothing once stopped, even with an older poll pending', () => {
    const obs = new ChatObserver(() => undefined);
    obs.start();
    obs.reset();
    obs.stop();
    document.body.innerHTML = LISTE;
    vi.advanceTimersByTime(2000);
    expect(vivants()).toHaveLength(0);
  });
});

// With no chat on the page (offline channel, followers only) the poll rescanned the
// whole document twice a second for as long as the tab lived.
describe('waiting for a chat that is not there', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="channel-chatroom"></div>';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('backs off, and still attaches the moment a chat appears', async () => {
    const scans = vi.spyOn(document, 'querySelectorAll');
    const obs = new ChatObserver(() => undefined);
    obs.start();
    await vi.advanceTimersByTimeAsync(10_000);
    const firstTen = scans.mock.calls.length;
    scans.mockClear();
    await vi.advanceTimersByTimeAsync(10_000);
    // Same wall time, fewer scans: it is on the 1 s step by now.
    expect(scans.mock.calls.length).toBeLessThan(firstTen);
    await vi.advanceTimersByTimeAsync(120_000);
    scans.mockClear();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(scans.mock.calls.length).toBeLessThan(firstTen / 3);
    obs.stop();
  });

  it('does not scan the page while the tab is hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const scans = vi.spyOn(document, 'querySelectorAll');
    const obs = new ChatObserver(() => undefined);
    obs.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(scans).not.toHaveBeenCalled();
    obs.stop();
  });
});

// A channel opened in a background tab by a reader who turned "pause when hidden"
// off must translate at once, not when the tab is shown.
describe('a hidden tab when pausing is off', () => {
  afterEach(() => vi.restoreAllMocks());
  it('attaches while hidden if told to, and not otherwise', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const attachedIn = (allow: boolean): number => {
      created.length = 0;
      const obs = new ChatObserver(() => undefined, () => allow);
      obs.start();
      const n = created.length;
      obs.stop();
      return n;
    };
    expect(attachedIn(true)).toBeGreaterThan(0);
    expect(attachedIn(false)).toBe(0);
  });
});

// The hide rule keys off a stamp. If the site drops our translation node but keeps
// the host element, the stamp stayed and the original stayed at font-size 0.
describe('a translation removed by the site', () => {
  it('takes the stamp off the line, and leaves it while a translation is still there', () => {
    const obs = new ChatObserver(() => undefined);
    obs.start();
    const cb = created.find((c) => c.cb)?.cb;
    const host = document.querySelector('[data-index]')!;
    host.setAttribute('data-kt-tr', 'block');
    host.insertAdjacentHTML('beforeend', '<div class="kt-translation">x</div>');
    const gone = document.createElement('div');
    cb?.([{ target: host, removedNodes: [gone], addedNodes: [] } as unknown as MutationRecord], {} as MutationObserver);
    expect(host.getAttribute('data-kt-tr')).toBe('block');
    host.querySelector('.kt-translation')!.remove();
    cb?.([{ target: host, removedNodes: [gone], addedNodes: [] } as unknown as MutationRecord], {} as MutationObserver);
    expect(host.hasAttribute('data-kt-tr')).toBe(false);
    obs.stop();
  });
});
