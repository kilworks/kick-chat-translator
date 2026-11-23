import { CHANNEL_LANG_MAX } from './constants';
import type { Settings } from './settings';

/**
 * Ranger une langue pour une chaine, sans laisser l'objet grossir sans fin.
 *
 * Reecrit la cle meme quand elle existe deja, pour qu'elle reparte en fin de
 * file : l'ordre d'insertion d'un objet JavaScript est celui dans lequel les
 * cles ont ete posees, donc reposer une cle la rajeunit et c'est la plus
 * ancienne VRAIMENT inutilisee qui part.
 */
export function memoriserLangueChaine(
  memoire: Record<string, string>,
  slug: string,
  lang: string,
): Record<string, string> {
  const suite: Record<string, string> = {};
  for (const [k, v] of Object.entries(memoire)) if (k !== slug) suite[k] = v;
  suite[slug] = lang;
  const cles = Object.keys(suite);
  for (const vieille of cles.slice(0, Math.max(0, cles.length - CHANNEL_LANG_MAX))) {
    delete suite[vieille];
  }
  return suite;
}

/**
 * Les reglages tels que les lit un onglet ouvert sur `slug`.
 *
 * Une chaine en pause est eteinte, et une chaine dont on a retenu la langue se
 * lit dans celle-ci. Rien n'est ecrit : `targetLang` est partage par tous les
 * onglets, et l'y ecrire en arrivant sur une chaine retraduisait les autres
 * onglets dans la langue de celle-ci.
 */
export function vueDeChaine(s: Settings, slug: string | undefined): Settings {
  if (!slug) return s;
  let vue = s;
  if (s.pausedChannels.includes(slug)) vue = { ...vue, enabled: false };
  const retenue = s.rememberChannelLang ? s.channelLangs[slug] : undefined;
  if (retenue && retenue !== s.targetLang) vue = { ...vue, targetLang: retenue };
  return vue;
}
