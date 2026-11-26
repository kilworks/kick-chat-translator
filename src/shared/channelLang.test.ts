import { describe, expect, it } from 'vitest';
import { memoriserLangueChaine, vueDeChaine } from './channelLang';
import { defaultSettings } from './settings';
import { CHANNEL_LANG_MAX } from './constants';

/**
 * La memoire des langues par chaine.
 *
 * Elle vit dans chrome.storage.sync, qui plafonne a 8 Ko par cle, et elle
 * partage cette cle avec tous les autres reglages. Un objet qui ne se vide
 * jamais ne casse donc pas cette fonction : il casse l'enregistrement de TOUT
 * le reste, silencieusement, le jour ou quelqu'un a suivi assez de chaines.
 * C'est la seule raison pour laquelle le bornage est teste avant le reste.
 */
describe('memoriserLangueChaine', () => {
  it('remembers a language for a channel', () => {
    expect(memoriserLangueChaine({}, 'canal', 'ja')).toEqual({ canal: 'ja' });
  });

  it('replaces the language of a channel already known', () => {
    expect(memoriserLangueChaine({ canal: 'ja' }, 'canal', 'fr')).toEqual({ canal: 'fr' });
  });

  it('leaves the other channels alone', () => {
    const avant = { a: 'ja', b: 'fr' };
    expect(memoriserLangueChaine(avant, 'c', 'es')).toEqual({ a: 'ja', b: 'fr', c: 'es' });
    // L'entree n'est pas modifiee sur place : les reglages sont diffuses a
    // plusieurs onglets et muter l'objet recu ferait diverger les copies.
    expect(avant).toEqual({ a: 'ja', b: 'fr' });
  });

  it('never grows past the cap', () => {
    let memoire: Record<string, string> = {};
    for (let i = 0; i < CHANNEL_LANG_MAX + 20; i++) {
      memoire = memoriserLangueChaine(memoire, `canal${i}`, 'ja');
    }
    expect(Object.keys(memoire)).toHaveLength(CHANNEL_LANG_MAX);
  });

  it('drops the oldest, and keeps the newest', () => {
    let memoire: Record<string, string> = {};
    for (let i = 0; i < CHANNEL_LANG_MAX + 1; i++) {
      memoire = memoriserLangueChaine(memoire, `canal${i}`, 'ja');
    }
    expect(memoire.canal0).toBeUndefined();
    expect(memoire[`canal${CHANNEL_LANG_MAX}`]).toBe('ja');
  });

  // Le point qui rend le bornage utile plutot que juste correct : revoir une
  // chaine la rajeunit. Sans cela, la chaine qu'on regarde tous les jours
  // serait jetee la premiere pour avoir ete rencontree en premier.
  it('refreshes a channel seen again, so it is not the next one dropped', () => {
    let memoire: Record<string, string> = {};
    for (let i = 0; i < CHANNEL_LANG_MAX; i++) {
      memoire = memoriserLangueChaine(memoire, `canal${i}`, 'ja');
    }
    memoire = memoriserLangueChaine(memoire, 'canal0', 'fr');
    memoire = memoriserLangueChaine(memoire, 'nouvelle', 'es');
    expect(memoire.canal0).toBe('fr');
    expect(memoire.canal1).toBeUndefined();
  });
});

/**
 * What a tab on one channel reads. The remembered language used to be written
 * into the global targetLang on arrival, so opening channel B (German) in a
 * second tab turned channel A's tab (Spanish) German too.
 */
describe('vueDeChaine', () => {
  const base = { ...defaultSettings(), targetLang: 'fr', rememberChannelLang: true, channelLangs: { a: 'es', b: 'de' } };

  it('reads each channel in its own language, and leaves the global alone', () => {
    expect(vueDeChaine(base, 'a').targetLang).toBe('es');
    expect(vueDeChaine(base, 'b').targetLang).toBe('de');
    expect(vueDeChaine(base, 'c').targetLang).toBe('fr');
    expect(base.targetLang).toBe('fr');
  });

  it('follows the global language when remembering is off', () => {
    expect(vueDeChaine({ ...base, rememberChannelLang: false }, 'a').targetLang).toBe('fr');
  });

  it('turns translation off on a paused channel only', () => {
    const paused = { ...base, enabled: true, pausedChannels: ['a'] };
    expect(vueDeChaine(paused, 'a').enabled).toBe(false);
    expect(vueDeChaine(paused, 'b').enabled).toBe(true);
    expect(vueDeChaine(paused, undefined).enabled).toBe(true);
  });

  it('manual start: a started channel is on even if it was paused before', () => {
    const m = { ...base, enabled: true, startMode: 'manual' as const, pausedChannels: ['a'] };
    expect(vueDeChaine(m, 'a', new Set(['a'])).enabled).toBe(true);
    expect(vueDeChaine(m, 'a', new Set()).enabled).toBe(false);
    expect(vueDeChaine(m, 'b', new Set(['a'])).enabled).toBe(false);
  });
});
