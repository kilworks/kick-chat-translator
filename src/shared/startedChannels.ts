// Channels the reader switched on in this tab, for the manual start mode. Kept in sessionStorage under one key:
// a reload of the same channel stays started, a new tab or another channel starts silent, nothing is synced or sent.
const KEY = 'kt-started-channels';
const MAX = 50;

function storage(): Storage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined; // blocked storage: every channel then starts silent in manual mode
  }
}

export function readStarted(): Set<string> {
  try {
    const raw = storage()?.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Switches a channel on or off for this tab and returns the new set. */
export function setStarted(slug: string, on: boolean): Set<string> {
  const next = readStarted();
  next.delete(slug);
  if (on) next.add(slug);
  try {
    storage()?.setItem(KEY, JSON.stringify([...next].slice(-MAX)));
  } catch {
    /* a full or blocked storage keeps the state for this call only */
  }
  return next;
}
