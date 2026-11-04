import { describe, expect, it } from 'vitest';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT } from './langChatCorpus';
import { LANG_CHAT2 } from './langChatCorpus2';
import { LANG_CHAT3 } from './langChatCorpus3';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus de REGLAGE, et ce qu'il a deja attrape.
 *
 * Les trois corpus de chat n'ont pas le meme role et les melanger reviendrait a
 * n'en avoir qu'un :
 *   corpus 1  a servi a choisir des mots, donc il ne mesure plus le rappel. Il
 *             reste un banc de non-regression.
 *   corpus 2  est AVEUGLE. On le mesure en total, on ne lit jamais ses lignes.
 *   corpus 3  celui-ci. On a le droit d'y lire et d'y choisir.
 *
 * Ses chiffres bougeront a chaque tour de lexique, c'est sa fonction. Ce qui ne
 * doit pas bouger est la colonne des erreurs.
 */

const SURE3 = runMatrix(confidentLanguage, LANG_CHAT3);
const BRUT3 = runMatrix(detectLanguage, LANG_CHAT3);
const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus de reglage', () => {
  // L'invariant, le meme que sur les deux autres corpus de chat.
  it('ne fait aucune erreur sur le chemin sur', () => {
    expect(SURE3.total.wrong).toBe(0);
  });

  it('en nomme 136 sur 260', () => {
    // 136 / 124 / 0 avant la revue linguiste (2026-11-04)
    expect(plain(SURE3.total)).toEqual({ right: 133, silent: 127, wrong: 0 });
    // 172 / 33 / 55 avant la revue linguiste (2026-11-04)
    expect(plain(BRUT3.total)).toEqual({ right: 171, silent: 33, wrong: 56 });
  });

  // CE QU'IL A ATTRAPE LE JOUR DE SA CREATION, et c'est la justification de son
  // existence en une ligne.
  //
  // `-ekt` etait entre dans la table des motifs exclusifs comme marqueur
  // neerlandais. Il mesurait propre sur les 5490 lignes de Tatoeba et du premier
  // corpus de chat : trois lignes neerlandaises, zero ailleurs. Ce corpus l'a
  // fait tomber en quatre lignes d'un coup, parce que `perfekt` est allemand,
  // suedois, norvegien et danois, comme `direkt`, `korrekt` et `objekt`.
  //
  // Quatre lignes ecrites sans y penser ont invalide un motif que 5490 autres
  // avaient laisse passer. C'est le protocole 4.6 en action : une absence sur un
  // corpus ne prouve rien, et le seul remede est un corpus de plus.
  it('garde les quatre lignes qui ont fait tomber -ekt', () => {
    expect(confidentLanguage('dieses emote ist perfekt')).not.toBe('nl');
    expect(confidentLanguage('den emoten är perfekt')).not.toBe('nl');
    expect(confidentLanguage('den emoten er perfekt')).not.toBe('nl');
    expect(confidentLanguage('den emote er perfekt')).not.toBe('nl');
  });

  // LE CRITERE D'ARRET DU LEXIQUE, mesure sur ce corpus et sur l'aveugle.
  //
  // Un tour de 43 mots a ete choisi ici, dans les regles : lecture des lignes
  // muettes de CE corpus, criblage complet, veto linguistique, application. Il a
  // rapporte SEPT lignes ici et ZERO sur le corpus aveugle. Pas une.
  //
  // Sept sur 260 fait 2,7 %, donc on attendait environ sept lignes sur les 260
  // de l'autre corpus. En observer zero n'est pas du bruit. Le transfert de
  // cette methode est tombe a rien.
  //
  // Le tour a ete ANNULE et n'est pas dans le fichier. Zero gain mesurable ne
  // justifie pas 43 entrees et 250 octets, et les livrer aurait gonfle le
  // chiffre de ce corpus-ci sans rien donner a personne.
  //
  // Ce qui reste utile, et c'est le critere a reprendre : un tour de lexique se
  // juge sur le corpus AVEUGLE, jamais sur celui ou les mots ont ete choisis. Si
  // l'aveugle ne bouge pas, le tour ne sert a rien, quelle que soit la beaute du
  // chiffre local. Les premiers tours de lexique transferaient a quatre
  // cinquiemes ; celui-ci a zero. La methode a un fond et il est atteint.
  //
  // Le chiffre a bouge depuis, de 87 a 119, et pas par du lexique : chaque ligne
  // de plus est lue derriere une porte partagee, une lettre exclusive, une
  // sequence ou un marqueur grammatical. C'est la distinction que ce test garde,
  // et elle tient toujours.
  //
  // Les deux dernieres sont catalanes et elles valent la peine d'etre nommees :
  // elles ne portent aucune lettre accentuee, donc aucune porte ne pouvait les
  // servir, et ce sont des mots outils exclusifs en plein air qui les prennent.
  // Un corpus de reglage qui bouge sur un mecanisme pareil ne mesure pas du
  // reglage, il mesure du transfert.
  it('ne bouge que par un mecanisme qui transfere, pas par le lexique', () => {
    // 136 avant la revue linguiste (2026-11-04)
    expect(SURE3.total.right).toBe(133);
  });

  // Les trois corpus doivent rester distincts, sinon les roles se melangent.
  it('ne partage aucune ligne avec les deux autres', () => {
    const autres = new Set([...Object.values(LANG_CHAT).flat(), ...Object.values(LANG_CHAT2).flat()]);
    const communes = Object.values(LANG_CHAT3).flat().filter((t) => autres.has(t));
    expect(communes).toEqual([]);
  });
});
