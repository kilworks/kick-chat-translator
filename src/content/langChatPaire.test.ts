import { describe, expect, it } from 'vitest';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT_PAIRE } from './langChatPaireCorpus';
import { LANG_CHAT } from './langChatCorpus';
import { LANG_CHAT2 } from './langChatCorpus2';
import { LANG_CHAT3 } from './langChatCorpus3';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le banc de la paire malais-indonesien, en registre familier.
 *
 * Ce que les autres bancs ne pouvaient pas mesurer est explique en tete de
 * `langChatPaireCorpus.ts` : ils sont paralleles, donc les deux langues y
 * traduisent les memes phrases neutres, donc ils ne peuvent pas separer deux
 * langues qui se ressemblent. Celui-ci n'est pas parallele.
 *
 * SENS DE LECTURE. Comme partout ici, les trois issues ne s'additionnent pas et
 * `wrong` est la seule qui coute quelque chose : une ligne indonesienne lue
 * malaise part au moteur avec une langue source fausse. Le silence est l'issue
 * SURE, pas un echec.
 */

const SURE = runMatrix(confidentLanguage, LANG_CHAT_PAIRE);
const BRUT = runMatrix(detectLanguage, LANG_CHAT_PAIRE);
const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus de la paire', () => {
  // La propriete sans laquelle il ne mesurerait rien. Une ligne ecrite a
  // l'identique des deux cotes rendrait une des deux reponses fausse quoi que
  // fasse le detecteur, donc elle mesurerait le corpus.
  it('ne partage aucune ligne entre les deux langues', () => {
    const malais = new Set(LANG_CHAT_PAIRE.ms);
    expect(LANG_CHAT_PAIRE.id!.filter((t) => malais.has(t))).toEqual([]);
  });

  // Et la meme regle que les trois autres : les corpus restent distincts, sinon
  // les roles se melangent.
  it('ne partage aucune ligne avec les trois corpus paralleles', () => {
    const autres = new Set([
      ...Object.values(LANG_CHAT).flat(),
      ...Object.values(LANG_CHAT2).flat(),
      ...Object.values(LANG_CHAT3).flat(),
    ]);
    const communes = Object.values(LANG_CHAT_PAIRE).flat().filter((t) => autres.has(t));
    expect(communes).toEqual([]);
  });

  it('a trente lignes de chaque cote', () => {
    expect(LANG_CHAT_PAIRE.ms).toHaveLength(30);
    expect(LANG_CHAT_PAIRE.id).toHaveLength(30);
  });

  // L'INVARIANT, le meme que sur les trois autres corpus de chat : le chemin sur
  // ne se trompe jamais. S'il tombe un jour, c'est une regression, pas un
  // chiffre a mettre a jour.
  it('ne fait aucune erreur sur le chemin sur', () => {
    expect(SURE.total.wrong).toBe(0);
  });

  // LE CHIFFRE DE REFERENCE, releve a la creation du corpus et avant toute
  // regle ecrite pour lui. Il bougera ; le bouger sans dire dans quel sens et
  // pourquoi est ce que ce fichier existe pour empecher.
  //
  // CE CORPUS N EST PLUS ENTIEREMENT AVEUGLE, et il faut le lire en le sachant.
  // Trois cribles ecrits plus tard, `langue-candidats.mjs`, `paire-sequences.mjs`
  // et `porte-mots-candidats.mjs`, construisaient leur liste de candidats en
  // parcourant les lignes MUETTES de tous les corpus, celui-ci compris. Compter
  // si un mot apparait dans un corpus ne l expose pas ; y chercher des mots, si.
  //
  // Les cribles sont corriges et ne lisent plus que les corpus qu'on a le droit
  // de lire. Mais le passage de 48 a 65 % de rappel a ete obtenu avec sept mots
  // dont six ont ete proposes en partie par ces lignes-ci. Quatre des six
  // etaient DEJA dans le fichier, dans les jeux de porte, donc leur choix ne
  // doit rien a ce corpus ; les deux autres, `petang` et `bahawa`, sont des
  // differences orthographiques attestees contre `sore` et `bahwa`.
  //
  // Ce que ce chiffre est aujourd hui : la meilleure mesure disponible, et plus
  // une mesure a l aveugle. **Retrouver un aveugle propre demande un TROISIEME
  // corpus de paire, ecrit avant que quoi que ce soit ait ete lu.**
  it('mesure les deux chemins sur du registre familier', () => {
    // 39 / 21 / 0 avant dah malais retire, rire coreen en syllabes, karne/baad (2026-11-04)
    expect(plain(SURE.total)).toEqual({ right: 36, silent: 24, wrong: 0 });
    // 43 / 11 / 6 avant dah malais retire, rire coreen en syllabes, karne/baad (2026-11-04)
    expect(plain(BRUT.total)).toEqual({ right: 41, silent: 12, wrong: 7 });
  });

  // LA MESURE QUI JUSTIFIE LE CORPUS, et la reponse n'est pas celle qu'on
  // attendait. La file de travail demandait : est-ce que le registre familier
  // separe ces deux langues la ou la prose ne le fait pas ?
  //
  // NON, il les rend plus MUETTES. 22 lignes nommees sur 60, soit 37 %, contre
  // 40 % sur le corpus aveugle parallele. La porte malais-indonesien s'ouvre sur
  // des mots outils, `yang tidak dengan untuk saya ini itu`, et le chat familier
  // ne les ecrit pas : il ecrit `gue`, `lo`, `gak`, `aku`, `kau`, `tak`. Le
  // declencheur est en registre formel et le corpus en registre familier.
  //
  // C'est un resultat exploitable et pas un echec : il dit exactement ou aller,
  // le declencheur et pas les mots qui tranchent. Ce qu'il ne dit pas, c'est
  // QUELS mots, parce que les choisir ici brulerait ce corpus.
  it('dit ce que la porte malais-indonesien attrape en registre familier', () => {
    const par = (lang: string): Cell => {
      const b = SURE.byLang.get(lang)!;
      return {
        right: b.short.right + b.medium.right + b.long.right,
        silent: b.short.silent + b.medium.silent + b.long.silent,
        wrong: b.short.wrong + b.medium.wrong + b.long.wrong,
      };
    };
    // 15 / 15 / 0 avant dah malais retire, rire coreen en syllabes, karne/baad (2026-11-04)
    expect(plain(par('ms'))).toEqual({ right: 12, silent: 18, wrong: 0 });
    expect(plain(par('id'))).toEqual({ right: 24, silent: 6, wrong: 0 });
  });

  // Le chemin brut sur le meme corpus, celui qui pilote le moteur on-device et
  // qui alimente le drapeau. Il repond 40 fois sur 60 et se trompe sur 15. Dix-huit lignes qui partent au moteur avec une
  // langue source fausse, sur un corpus de soixante.
  //
  // ET TROIS D'ENTRE ELLES NE VONT PAS DANS LA PAIRE, sur quinze. `internet aku slow gila`
  // ressort FRANCAISE. La confusion `id`/`ms` de la matrice cachait donc une
  // deuxieme chose : sur du registre familier, franc ne se contente pas de
  // confondre les deux entre elles, il sort parfois de la famille entierement.
  it('confond les deux entre elles, et sort parfois de la paire', () => {
    expect(BRUT.confusions.get('id->ms')).toBe(2);
    // 3 avant dah malais retire, rire coreen en syllabes, karne/baad (2026-11-04)
    expect(BRUT.confusions.get('ms->id')).toBe(4);
    // Le reste part ailleurs, et il en reste UNE sur six.
    expect(BRUT.confusions.get('id->fr')).toBeUndefined();
    expect(BRUT.confusions.get('ms->fr')).toBe(1);
  });
});
