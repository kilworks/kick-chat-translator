import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '~/shared/settings';

/**
 * Deux copies vivantes du script de contenu dans la meme page.
 *
 * C'est l'etat d'un onglet Kick sur Firefox apres chaque mise a jour : Firefox
 * injecte lui-meme le nouveau script dans les onglets ouverts, ce que Chrome ne
 * fait pas, puis `onInstalled` l'injecte une seconde fois. Les deux copies ont
 * un `chrome.runtime` valide, donc le test d'orphelin ne les separait pas, et
 * chacune traduisait chaque message.
 *
 * Le test charge le module deux fois, comme deux injections, puis pose une
 * ligne et compte qui la passe au pipeline. Rouge sans la passation de
 * `data-kt-instance` : les deux copies la prennent.
 */

const recues: string[] = [];
let copie = '';
// Les reglages se font attendre tant que `retenir` est vrai, pour rejouer deux
// injections dont la seconde arrive avant que la premiere ait fini de monter.
let retenir = false;
const enAttente: (() => void)[] = [];

vi.mock('~/shared/settingsClient', () => ({
  fetchSettings: () =>
    new Promise((ok) => {
      const rendre = () => ok({ ...defaultSettings(), enabled: true });
      if (retenir) enAttente.push(rendre);
      else rendre();
    }),
  patchSettings: () => Promise.resolve(defaultSettings()),
  watchSettings: () => () => undefined,
}));
vi.mock('./kickApi', async (orig) => ({
  ...(await orig<object>()),
  fetchChannelLangIso: () => Promise.resolve(undefined),
}));
vi.mock('./pipeline', () => ({
  TranslationPipeline: class {
    private readonly nom = copie;
    setChannelLang(): void {}
    updateSettings(): void {}
    reapplyBlocked(): void {}
    recentDecisions(): unknown[] {
      return [];
    }
    onDomMessage(): Promise<void> {
      recues.push(this.nom);
      return Promise.resolve();
    }
  },
}));

const rangee = (texte: string, i: number): string =>
  `<div data-index="${i}"><div class="w-full min-w-0 shrink-0">` +
  `<button class="font-bold" style="color: rgb(1,2,3)">pseudo${i}</button>` +
  `<span class="font-normal">${texte}</span></div></div>`;

const attendre = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function injecter(nom: string): Promise<void> {
  copie = nom;
  vi.resetModules();
  await import('./index');
  await attendre(50);
}

describe('deux copies vivantes du script dans un onglet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    recues.length = 0;
  });

  it('ne laisse que la plus recente prendre les messages', async () => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'kt', onMessage: { addListener: () => undefined }, getURL: (p: string) => p },
    });
    history.replaceState(null, '', '/kt-un');
    document.body.innerHTML =
      '<div id="channel-chatroom"><div class="no-scrollbar">' + rangee('hola amigo que tal', 0) + '</div></div>';

    await injecter('auto');
    await injecter('onInstalled');
    recues.length = 0;

    document
      .querySelector('#channel-chatroom .no-scrollbar')!
      .insertAdjacentHTML('beforeend', rangee('seguimos aqui despues de actualizar', 1));
    await attendre(100);

    expect(recues).toEqual(['onInstalled']);
  });

  // Sur Firefox les deux injections tombent a quelques millisecondes : la
  // premiere copie attend encore ses reglages quand la seconde se nomme.
  it('tient quand la seconde copie arrive pendant le montage de la premiere', async () => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'kt', onMessage: { addListener: () => undefined }, getURL: (p: string) => p },
    });
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    history.replaceState(null, '', '/kt-un');
    document.body.innerHTML =
      '<div id="channel-chatroom"><div class="no-scrollbar">' + rangee('hola amigo que tal', 0) + '</div></div>';

    retenir = true;
    await injecter('auto');
    await injecter('onInstalled');
    retenir = false;
    for (const rendre of enAttente.splice(0)) rendre();
    await attendre(50);
    recues.length = 0;

    document
      .querySelector('#channel-chatroom .no-scrollbar')!
      .insertAdjacentHTML('beforeend', rangee('seguimos aqui despues de actualizar', 1));
    await attendre(100);

    expect(recues).toEqual(['onInstalled']);
    expect(document.querySelectorAll('#kt-floating-bar').length).toBeLessThanOrEqual(1);
    expect(erreurs).not.toHaveBeenCalled();
    erreurs.mockRestore();
  });
});
