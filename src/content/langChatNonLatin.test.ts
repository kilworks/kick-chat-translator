import { describe, expect, it } from 'vitest';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT_NL } from './langChatNonLatin';
import { confidentLanguage } from './langDetect';

/**
 * Les onze langues non latines, sur du chat, mesurees pour la premiere fois.
 *
 * `langDetect.dix.test.ts` couvrait cinq langues non latines, celles dont le
 * produit parle la langue. Les onze autres ecritures n'avaient aucune ligne de
 * chat nulle part, alors que ce sont celles que le pre-controle sert le mieux.
 */

const SURE = runMatrix(confidentLanguage, LANG_CHAT_NL);
const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });
const parLangue = (l: string): number => {
  const b = SURE.byLang.get(l)!;
  return b.short.right + b.medium.right + b.long.right;
};

describe('les ecritures non latines, sur du chat', () => {
  // L'hypothese tenait : une regle d'ecriture ne depend ni du lexique ni de la
  // longueur, donc elle ne devrait pas souffrir du changement de registre. Six
  // langues sur onze sont a 10 sur 10, et ce sont exactement les six dont
  // l'ecriture n'est partagee avec personne.
  it('lit parfaitement les six ecritures sans ambiguite', () => {
    for (const l of ['he', 'hi', 'th', 'bn', 'ta', 'el']) {
      expect(parLangue(l), l).toBe(10);
    }
  });

  it('ne se trompe plus une seule fois sur cent dix', () => {
    // 97 / 13 / 0 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    expect(plain(SURE.total)).toEqual({ right: 98, silent: 12, wrong: 0 });
  });

  // LES DEUX ERREURS ETAIENT DU PERSAN ECRIT ENTIEREMENT AVEC LE JEU ARABE,
  // `تازه اومدم` par exemple, qui ne porte aucune des six lettres que le persan
  // ajoute. Elles ne sont plus la, et ce n'est pas une regle persane de plus qui
  // les a prises : c'est que l'arabe doit maintenant se nommer lui-meme. Quand
  // personne ne parle, la reponse est le silence et plus `ar` par defaut.
  //
  // Ce banc est donc le SIXIEME corpus de chat a zero erreur, et c'est
  // l'assertion : une confusion qui reapparait ici est une regression.
  it('ne se trompe plus du tout, et c est ce qui est asserte', () => {
    const rows = [...SURE.confusions.entries()].map(([p, n]) => `${p}=${n}`);
    expect(rows).toEqual([]);
  });

  // LE RESULTAT QUI A SERVI A QUELQUE CHOSE.
  //
  // Le chinois traditionnel tombe a 4 sur 10 sur du chat alors qu'il est a 105
  // sur 120 sur Tatoeba. Une phrase ecrite se sert de beaucoup de caracteres et
  // finit par en porter un qui separe les deux ecritures ; une ligne de chat de
  // six caracteres peut n'en porter aucun.
  //
  // Six des dix lignes etaient muettes et cinq portaient un caractere
  // traditionnel qui manquait simplement a la table : 氣 灣 嗎 還 運. Encore une
  // fois, chercher ce qui MANQUE dans une table valait mieux que raffiner ce
  // qu'elle contient.
  //
  // Trois sont entres, 氣 灣 嗎, dont le japonais ecrit 気 湾 et presque jamais
  // 嗎. 還 et 運 restent DEHORS : le japonais les ecrit a l'identique, et c'est
  // le piege documente en tete de `cantonaisOuChinois`. Quatre lignes sur dix
  // restent donc muettes et deux d'entre elles le resteront.
  it('lit le chinois traditionnel sur du chat, ce qu il ne faisait pas', () => {
    expect(parLangue('zh-tw')).toBe(6);
  });

  // La limite qui reste, et elle est irreductible au niveau du caractere : une
  // ligne ecrite entierement avec ce que les deux ecritures partagent.
  it('reste muet sur une ligne que les deux ecritures partagent en entier', () => {
    expect(confidentLanguage('今天玩得很好')).toBeUndefined();
  });
});
