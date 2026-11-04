import { describe, expect, it } from 'vitest';
import { runMatrix, type Cell, type Run } from './langMatrix';
import { LANG_CHAT } from './langChatCorpus';
import { LANG_CORPUS } from './langCorpus';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le meme detecteur, mesure sur du REGISTRE CHAT.
 *
 * `langMatrix.test.ts` mesure 5040 phrases ecrites de Tatoeba. Ce fichier mesure
 * 390 lignes de chat sur les 26 langues latines, celles que le pre-controle
 * d'ecriture ne sert pas du tout. Ce que le corpus vaut et ne vaut pas est ecrit
 * en entier en tete de `langChatCorpus.ts` et doit etre lu avant de citer un
 * chiffre d'ici : les lignes sont ecrites par ce projet, donc le rappel mesure
 * aussi le vocabulaire choisi. Le silence et les regressions, eux, tiennent.
 *
 * Deux regimes, parce qu'un chat contient les deux : tel quel, et diacritiques
 * retirees comme le fait un clavier presse.
 */

const DIACRITIQUES = /[̀-ͯ]/g;
const sansDiacritiques = (t: string): string =>
  t
    .normalize('NFD')
    .replace(DIACRITIQUES, '')
    // Ce que NFD ne decompose pas et qu'un clavier remplace quand meme.
    .replace(/ł/g, 'l')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/đ/g, 'd')
    .replace(/ı/g, 'i');

const NU: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(LANG_CHAT).map(([l, v]) => [l, v.map(sansDiacritiques)]),
);

const CHAT_SURE = runMatrix(confidentLanguage, LANG_CHAT);
const CHAT_BRUT = runMatrix(detectLanguage, LANG_CHAT);
const NU_SURE = runMatrix(confidentLanguage, NU);
const NU_BRUT = runMatrix(detectLanguage, NU);

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });
const muet = (c: Cell) => Math.round((100 * c.silent) / (c.right + c.silent + c.wrong));
const zeroRight = (run: Run): string[] =>
  [...run.byLang.entries()]
    .filter(([, b]) => b.short.right + b.medium.right + b.long.right === 0)
    .map(([lang]) => lang)
    .sort();

describe('le chemin sur, sur du chat', () => {
  // Le resultat qui compte le plus et qui n'etait pas acquis : sur 390 lignes de
  // chat dans 26 langues, la reponse sure n'est fausse AUCUNE fois. Les regles
  // ecrites contre des phrases de Tatoeba ne se mettent pas a mentir quand le
  // registre change ; elles se taisent.
  it('ne se trompe jamais, dans les deux regimes', () => {
    expect(CHAT_SURE.total.wrong).toBe(0);
    expect(NU_SURE.total.wrong).toBe(0);
  });

  // Et voici le prix, qui est le vrai chiffre de ce fichier. Il repond a la
  // question de la phase 1 : peut-on donner au moteur on-device la reponse sure
  // au lieu de la devinette ? Le silence etait de 85 lignes sur 100 quand cette
  // question a ete posee, il est de 49, et basculer enverrait toujours la moitie
  // de ce chat au cloud avec sa latence et son quota. La reponse reste non, mais
  // elle n'est plus hors de portee.
  //
  // CE QUI A ETE DIT ICI ET QUI ETAIT FAUX : que seul le lexique de mots courts
  // ferait baisser ce chiffre, et pas une regle de lettres de plus. Les portes
  // partagees sont exactement une regle de lettres, et elles ont pris les trois
  // derniers points pendant que le lexique avait cesse de rapporter quoi que ce
  // soit. C'etait une prediction, pas une mesure, et elle s'est trompee.
  it('se tait sur trois lignes de chat sur quatre', () => {
    // 237 avant le 2026-11-03 : `ezt nem hiszem el` et `nem látok semmit` ne
    // portaient que `nem`, sorti parce que c'est aussi du portugais courant.
    // 235 / 155 / 0 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    expect(plain(CHAT_SURE.total)).toEqual({ right: 234, silent: 156, wrong: 0 });
    expect(muet(CHAT_SURE.total)).toBe(40);
  });

  // Ce que coute le clavier, et c'est la fragilite de toute l'approche par
  // lettre exclusive mise en chiffre : sans diacritiques le rappel tombe des
  // deux tiers. Une regle qui lit ř ou ų ne lit plus rien des que l'utilisateur
  // tape vite, et c'est le cas majoritaire dans un chat sur telephone.
  //
  // CE QUI SURVIT AU CLAVIER, et c'est la seule chose de cette page qui monte
  // quand les diacritiques tombent : une porte declenchee par un MOT. `jeg` et
  // `ikke` s'ecrivent en ASCII, donc la porte nordique repond encore, la ou les
  // vingt-six portes a lettre sont muettes. Une ligne de plus ici, et c'est la
  // direction a retenir pour les langues que le clavier deshabille.
  it('perd un tiers de son rappel quand les diacritiques tombent', () => {
    // 157 / 233 / 0 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    expect(plain(NU_SURE.total)).toEqual({ right: 156, silent: 234, wrong: 0 });
    expect(muet(NU_SURE.total)).toBe(60);
  });
});

describe('le chemin brut, sur du chat', () => {
  // Ce chiffre a CHANGE DE SENS pendant que le lexique s'etendait, et l'ancienne
  // version de ce test est plus instructive que la nouvelle.
  //
  // Avant l'extension du lexique aux vingt langues qui manquaient, le chemin
  // brut se trompait sur 33 lignes de chat sur 100 contre 23 sur les memes 26
  // langues de Tatoeba : franc etait nettement pire sur du chat, parce qu'une
  // ligne de cinq mots ne porte pas assez de trigrammes pour lui.
  //
  // Les deux taux se sont rapproches jusqu'a l'egalite, 28 contre 28, puis
  // l'ecart s'est ROUVERT dans l'autre sens a mesure que les terminaisons
  // orthographiques entraient : elles portent sur de la prose, donc elles
  // servent Tatoeba plus que le chat. La tolerance de ce test est large exprès,
  // le point n'est pas la valeur mais le fait que les deux restent du meme
  // ordre. Ce n'est pas franc qui s'est ameliore : c'est que
  // `detectLanguage` consulte le lexique AVANT lui, donc chaque ligne que le
  // lexique nomme est une ligne que franc ne voit plus. L'ecart de registre
  // n'est pas comble, il est court-circuite, et il reapparaitra entier des que
  // le lexique manquera un mot.
  it('se trompe sur plus d une ligne de chat sur quatre', () => {
    // 275 / 49 / 66 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    expect(plain(CHAT_BRUT.total)).toEqual({ right: 274, silent: 50, wrong: 66 });
    const tatoeba = runMatrix(detectLanguage, memesLangues());
    const partChat = CHAT_BRUT.total.wrong / 390;
    const partTatoeba = tatoeba.total.wrong / (26 * 120);
    expect(Math.abs(partChat - partTatoeba)).toBeLessThan(0.04);
  });

  it('empire encore sans diacritiques', () => {
    // 216 / 86 / 88 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    expect(plain(NU_BRUT.total)).toEqual({ right: 215, silent: 87, wrong: 88 });
  });

  // Sept langues ne marquent pas un seul point sur le chemin BRUT, franc compris,
  // alors que Tatoeba n'en montrait que trois. `sk no da ca` s'effondrent au
  // passage au registre court : elles avaient des points sur des phrases
  // completes et n'en ont plus aucun sur cinq mots. C'est la file de travail
  // reelle, et elle n'est pas celle que Tatoeba dessinait.
  it('ne laisse plus aucune langue a zero sur du chat', () => {
    expect(zeroRight(CHAT_BRUT)).toEqual([]);
  });
});

/** Les memes 26 langues dans Tatoeba, pour que le contraste soit un calcul et pas une phrase. */
function memesLangues(): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = {};
  for (const l of Object.keys(LANG_CHAT)) {
    const lines = LANG_CORPUS[l];
    if (lines) out[l] = lines;
  }
  return out;
}

describe('le contraste avec Tatoeba, sur les memes langues', () => {
  // Le silence bouge peu, et c'est contre-intuitif : on attendait que le
  // lexique de chat fasse mieux sur du chat. Il ne le fait pas parce qu'il ne
  // couvre que six langues sur vingt-six. Ce qui bouge vraiment est l'erreur de
  // franc, et elle bouge dans le mauvais sens.
  //
  // Le silence Tatoeba descend de 61 a 55 avec les portes partagees, les
  // lettres vietnamiennes, la porte nordique sans lettre et les marqueurs
  // tagalog, celui du chat de 50 a 47. Les deux bougent moins que
  // le rappel parce qu'une regle de lettre a besoin d'une lettre accentuee, et
  // le chat en ecrit moins que la prose.
  it('montre que le registre coute a franc et pas au chemin sur', () => {
    const t = runMatrix(confidentLanguage, memesLangues());
    expect(muet(t.total)).toBe(38);
    expect(muet(CHAT_SURE.total)).toBe(40);
    // 5, puis 3 avec le retrait de `mano`, puis 1 avec les mots jawi : la seule
    // erreur qui reste sur les 26 langues du chat est `ms -> ar`, une ligne
    // jawi sans lettre ni mot utilisable.
    expect(t.total.wrong).toBe(1);
  });
});
