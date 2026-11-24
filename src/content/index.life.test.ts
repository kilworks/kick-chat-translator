import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';

/**
 * What the content script does with a tab nobody is looking at, a copy that was
 * replaced, and a page with no chat on it. Same harness as index.relais.test.ts.
 */

const recues: string[] = [];
let nom = '';

vi.mock('~/shared/settingsClient', () => ({
  fetchSettings: () => Promise.resolve({ ...defaultSettings(), enabled: true }),
  patchSettings: () => Promise.resolve(defaultSettings()),
  watchSettings: () => () => undefined,
}));
vi.mock('./kickApi', async (orig) => ({
  ...(await orig<object>()),
  fetchChannelLangIso: () => Promise.resolve(undefined),
}));
vi.mock('./pipeline', () => ({
  TranslationPipeline: class {
    private readonly copie = nom;
    setChannelLang(): void {}
    updateSettings(): void {}
    resetLangBlocked(): void {}
    reapplyBlocked(): void {}
    dispose(): void {}
    recentDecisions(): unknown[] {
      return [];
    }
    onDomMessage(m: { text: string }): Promise<void> {
      recues.push(`${this.copie}:${m.text}`);
      return Promise.resolve();
    }
  },
}));

const rangee = (texte: string, i: number): string =>
  `<div data-index="${i}"><div class="w-full min-w-0 shrink-0">` +
  `<button class="font-bold" style="color: rgb(1,2,3)">pseudo${i}</button>` +
  `<span class="font-normal">${texte}</span></div></div>`;
const liste = (): Element => document.querySelector('#channel-chatroom .no-scrollbar')!;
const attendre = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function injecter(copie: string): Promise<void> {
  nom = copie;
  vi.resetModules();
  await import('./index');
  await attendre(50);
}

function page(chemin: string): void {
  vi.stubGlobal('chrome', { runtime: { id: 'kt', onMessage: { addListener: () => undefined }, getURL: (p: string) => p } });
  history.replaceState(null, '', chemin);
  document.body.innerHTML = '<div id="channel-chatroom"><div class="no-scrollbar">' + rangee('hola amigo que tal', 0) + '</div></div>';
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  recues.length = 0;
  history.replaceState(null, '', '/');
});

describe('a tab that is hidden and paused', () => {
  it('stops reading the chat, and takes in what came meanwhile when it is shown again', async () => {
    page('/kt-cache');
    await injecter('a');
    recues.length = 0;
    const masque = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    liste().insertAdjacentHTML('beforeend', rangee('une ligne pendant que l onglet dort', 1));
    await attendre(60);
    expect(recues, 'the observer is disconnected while hidden').toEqual([]);

    masque.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await attendre(60);
    expect(recues.some((r) => r.includes('une ligne pendant que l onglet dort'))).toBe(true);
  });
});

describe('a copy that was replaced', () => {
  it('takes its document listeners with it', async () => {
    page('/kt-vie');
    const signaux: AbortSignal[] = [];
    const add = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(((type: string, fn: EventListener, opt?: AddEventListenerOptions) => {
      if (type === 'visibilitychange' && opt?.signal) signaux.push(opt.signal);
      return add(type, fn, opt);
    }) as typeof document.addEventListener);
    await injecter('premiere');
    await injecter('seconde');
    // The first copy notices it was replaced on its next mutation.
    liste().insertAdjacentHTML('beforeend', rangee('encore une ligne', 2));
    await attendre(80);
    expect(signaux).toHaveLength(2);
    expect(signaux[0]!.aborted).toBe(true);
    expect(signaux[1]!.aborted).toBe(false);
  });
});

describe('a page with no chat', () => {
  it('does not start the bar search loop on the home page', async () => {
    page('/');
    document.body.innerHTML = '<main>home</main>';
    const attentes = vi.spyOn(globalThis, 'setTimeout');
    await injecter('accueil');
    expect(attentes.mock.calls.filter((c) => c[1] === 400)).toEqual([]);
  });

  it('does not put the 58 KB stylesheet in a page with no chat, and does on a channel', async () => {
    document.getElementById('kt-inject-style')?.remove();
    page('/');
    document.body.innerHTML = '<main>home</main>';
    await injecter('accueil');
    expect(document.querySelector('style#kt-inject-style')).toBeNull();
    page('/kt-style');
    await injecter('chaine');
    expect(document.querySelector('style#kt-inject-style')).not.toBeNull();
  });
});
