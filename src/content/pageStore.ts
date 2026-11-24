import { send } from '~/shared/messages';

/** What the content script remembers lives in the worker: see background/pageStore.ts. */

export async function readLastLang(slug: string): Promise<string | undefined> {
  try {
    const res = await send({ type: 'lastlang.get', slug });
    return res.type === 'value' && typeof res.payload === 'string' ? res.payload : undefined;
  } catch {
    return undefined;
  }
}

export function writeLastLang(slug: string, lang: string): void {
  void send({ type: 'lastlang.set', slug, lang }).catch(() => undefined);
}

export async function readInsertHint(): Promise<unknown> {
  const res = await send({ type: 'hint.get' });
  return res.type === 'value' ? res.payload : undefined;
}

export function writeInsertHint(value: boolean | number): void {
  void send({ type: 'hint.set', value }).catch(() => undefined);
}
