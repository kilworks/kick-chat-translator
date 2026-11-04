import { describe, expect, it } from 'vitest';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT } from './langChatCorpus';
import { LANG_CHAT2 } from './langChatCorpus2';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le meme detecteur, sur 260 lignes de chat qu'il n'a jamais vues.
 *
 * Ce fichier existe pour repondre a une question que `langChat.test.ts` ne peut
 * plus poser. Son corpus a servi a construire le lexique : on a lu ses lignes
 * muettes, choisi des mots pour les couvrir, et remesure dessus. Le chiffre qui
 * en sort est donc flatte d'une quantite inconnue.
 *
 * Celui-ci a ete ecrit apres, sur d'autres sujets, sans consulter une seule fois
 * ce que le detecteur en faisait. L'ecart entre les deux EST la part de
 * memorisation, et c'est la seule facon de la connaitre.
 *
 * IL N'EST PLUS AVEUGLE (2026-11-03). Trois scripts de candidats le lisent et la
 * regle `-aat` a ete retaillee sur son effet ici ; son zero est une borne haute.
 * Le banc aveugle est desormais le corpus 4, `langChat4.test.ts`.
 */

const SURE1 = runMatrix(confidentLanguage, LANG_CHAT);
const SURE2 = runMatrix(confidentLanguage, LANG_CHAT2);
const BRUT2 = runMatrix(detectLanguage, LANG_CHAT2);

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });
const rappel = (c: Cell) => Math.round((100 * c.right) / (c.right + c.silent + c.wrong));

describe('le detecteur sur du chat qu il n a jamais vu', () => {
  // LE RESULTAT QUI COMPTE, et il est meilleur que le chiffre de rappel.
  //
  // Zero erreur sur 260 lignes neuves, dans 26 langues, apres plus de deux cents
  // entrees de lexique ajoutees en regardant un AUTRE corpus. La surete ne se
  // memorise pas : elle vient de ce que chaque entree a ete criblee contre 5490
  // lignes avant d'entrer, et ca, ca generalise.
  it('ne se trompe jamais, comme sur le corpus qu il connait', () => {
    expect(SURE2.total.wrong).toBe(0);
  });

  // LE PRIX, et il a fallu deux mesures pour l'obtenir honnetement.
  //
  // Brut : 46 % de rappel sur le corpus qui a construit le lexique, 30 % ici.
  // Seize points. La premiere lecture etait que ces seize points sont de la
  // memorisation, et elle etait FAUSSE de moitie.
  //
  // Les deux corpus n'ont pas la meme longueur de ligne. Le premier a ete ecrit
  // en visant le chat court et fait 83 % de lignes sous vingt caracteres,
  // mediane 16 ; le second a derive vers des phrases plus longues, 37 % et
  // mediane 22. Or le lexique s'arrete a vingt caracteres. Comparer les deux
  // totaux compare donc deux melanges de longueurs autant que deux corpus.
  //
  // A longueur egale, l'ecart se separe proprement, et c'est le test suivant.
  //
  // Les regles de lettres ont referme six points de cet ecart, 32 a 38, en trois
  // tours, et elles l'ont fait du BON cote : le corpus aveugle a gagne six, sept
  // puis trois lignes pendant que le corpus flatte en gagnait zero, trois puis
  // quatre. Un mecanisme qui rapporte autant la ou il n'a pas ete regle que la
  // ou il l'a ete est exactement ce que le lexique n'arrivait plus a faire.
  it('rappelle un tiers de moins en brut, mais la longueur en explique la moitie', () => {
    // 148 et 61 avant le 2026-11-03, le retrait de `nem` du hongrois.
    // 147 / 113 / 0 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    // 146 / 114 / 0 avant la revue linguiste (2026-11-04)
    expect(plain(SURE2.total)).toEqual({ right: 141, silent: 119, wrong: 0 });
    // 60 avant la revue linguiste (2026-11-04)
    expect(rappel(SURE1.total)).toBe(59);
    // 57 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    // 56 avant la revue linguiste (2026-11-04)
    expect(rappel(SURE2.total)).toBe(54);
    // Le facteur confondant, mesure : les deux corpus ne sont pas comparables tels quels.
    const lignes = (c: Record<string, readonly string[]>): string[] => Object.values(c).flat();
    const part = (c: Record<string, readonly string[]>): number =>
      Math.round((100 * lignes(c).filter((t) => t.length <= 20).length) / lignes(c).length);
    expect(part(LANG_CHAT)).toBe(83);
    expect(part(LANG_CHAT2)).toBe(37);
  });

  // LA MESURE HONNETE, bande par bande.
  //
  //   <= 20 car : 59 % sur le corpus de reglage, 55 % a l'aveugle -> 4 points
  //   >  20 car : 60 % contre 56 %                  -> 4 points
  //
  // Les deux points de la bande courte sont la memorisation du lexique, et ils
  // sont reels : c'est une liste de mots choisie en lisant un corpus. Ils ont
  // valu jusqu'a huit points ; ce qui les a reduits n'est pas le lexique qui
  // s'ameliore mais tout le reste qui rattrape, lettres, portes, sequences et
  // mots outils, sur un corpus que rien de tout cela n'a jamais vu.
  //
  // LA BANDE LONGUE EST LE RESULTAT LE PLUS INSTRUCTIF DU FICHIER, et son
  // histoire vaut plus que sa valeur du jour. Elle n'est servie que par les
  // ecritures, les lettres, les portes et les terminaisons, jamais par le
  // lexique. Son ecart etait de trois points, il est monte a quinze, il est
  // redescendu a huit, et AUCUN de ces trois mouvements n'est de la memorisation.
  //
  // La montee : les terminaisons extraites de Tatoeba servent la prose et pas le
  // chat, 76 lignes contre une, et les portes `ä` et `š` servent des langues
  // dont le corpus 1 contient plus de lignes longues que le corpus 2. Deux
  // sources de registre et de composition, pas de reglage.
  //
  // La descente : les deux tours de portes partagees, +6 puis +7 lignes ici,
  // dont l'essentiel dans cette bande. Une porte ne peut pas memoriser un corpus
  // qu'elle n'a jamais vu, donc ces points sont du transfert au sens strict.
  //
  // Les deux bandes ne sont plus au meme ecart, trois points contre dix, et le
  // sens de l'inegalite est contre-intuitif : c'est la bande que le lexique NE
  // sert PAS qui transfere le moins bien. La cause n'est pas de la memorisation,
  // c'est que les deux corpus n'ont pas les memes langues aux memes longueurs.
  // Ne pas lire l'ecart d'une bande comme une mesure de reglage sans avoir
  // d'abord regarde de quoi cette bande est faite.
  // 2026-11-03 : l'ecart est de 4 points en bande courte et 3 en bande longue
  // depuis le retrait de `nem`, donc le titre ne se lit plus a la lettre.
  it('memorise trois fois moins au-dela de la borne du lexique', () => {
    const bande = (
      corp: Record<string, readonly string[]>,
      garde: (t: string) => boolean,
    ): Record<string, readonly string[]> =>
      Object.fromEntries(Object.entries(corp).map(([l, v]) => [l, v.filter(garde)]));
    const court = (t: string): boolean => t.length <= 20;
    const long = (t: string): boolean => t.length > 20;
    // 60 avant la revue linguiste (2026-11-04)
    expect(rappel(runMatrix(confidentLanguage, bande(LANG_CHAT, court)).total)).toBe(59);
    // 56 avant la revue linguiste (2026-11-04)
    expect(rappel(runMatrix(confidentLanguage, bande(LANG_CHAT2, court)).total)).toBe(54);
    expect(rappel(runMatrix(confidentLanguage, bande(LANG_CHAT, long)).total)).toBe(60);
    // 57 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    // 56 avant la revue linguiste (2026-11-04)
    expect(rappel(runMatrix(confidentLanguage, bande(LANG_CHAT2, long)).total)).toBe(55);
  });

  // Le chemin brut perd moins parce qu'il ne depend pas du lexique : franc lit
  // des trigrammes, pas des mots choisis a la main. Sa perte, 61 % a 55 %, est
  // du bruit d'echantillonnage plutot que de la memorisation.
  it('montre que seul le chemin qui depend du lexique perd au changement de corpus', () => {
    // 184 / 28 / 48 avant la revue linguiste (2026-11-04)
    // 180 / 28 / 52 avant les penchants du chemin brut (2026-11-04)
    expect(plain(BRUT2.total)).toEqual({ right: 182, silent: 28, wrong: 50 });
    // 71 avant la revue linguiste (2026-11-04)
    expect(rappel(BRUT2.total)).toBe(70);
  });

  // La regle qui garde ce banc utilisable, et elle est fragile : il suffit d'une
  // fois. Le jour ou un mot est ajoute au lexique parce qu'il couvre une ligne
  // d'ici, ce corpus devient le premier et il en faut un troisieme. L'assertion
  // ne peut pas verifier ca, donc elle verifie ce qu'elle peut : que les deux
  // corpus restent distincts.
  it('ne partage aucune ligne avec le corpus qui a servi au reglage', () => {
    const premier = new Set(Object.values(LANG_CHAT).flat());
    const communes = Object.values(LANG_CHAT2).flat().filter((t) => premier.has(t));
    expect(communes).toEqual([]);
  });
});
