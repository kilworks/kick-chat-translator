import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT5, LANG_CHAT5_LAUGH, LANG_CHAT5_ROMAN } from './langChatCorpus5';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus 5, AVEUGLE, parce que le 4 ne l'est plus.
 *
 * Le corpus 4 a ete lu deux fois en totaux pour juger le tour du 2026-11-03, et
 * sa barre n'etait pas tenue : 1,2 % de reponses sures fausses, dont trois
 * lignes de russe en lettres latines. La regle suivante ne peut pas etre jugee
 * sur lui. Celui-ci a ete ecrit le 2026-11-04 sur la meme commande, par un
 * auteur qui n'a vu ni le detecteur ni les autres corpus, puis verifie sans
 * recouvrement avec toute chaine litterale de src/ et test/.
 *
 * Meme regime que le 4 : mesure ici en totaux et nulle part ailleurs, totaux
 * d'AVANT toute regle jugee sur lui fixes au commit qui l'ajoute, avec son
 * empreinte.
 */

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus 5, aveugle', () => {
  it('est celui qui a ete fige, octet pour octet', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/content/langChatCorpus5.ts'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '7998dbb85266a8d4f200ab54433d579ae6b4ffba841a7c63cefb8e1df5e25132',
    );
    const n = (c: Record<string, readonly string[]>) => Object.values(c).flat().length;
    expect([n(LANG_CHAT5), n(LANG_CHAT5_ROMAN), n(LANG_CHAT5_LAUGH)]).toEqual([425, 50, 25]);
  });

  // La barre, ecrite avant de le mesurer et reprise du corpus 4 : au plus une
  // reponse sure fausse par jeu, 0,7 % en tout. Mesure a son ajout, avant toute
  // regle : 13 sur 500 (2,6 %), 3 natives, 3 romanisees, 7 de rire.
  //
  // La premiere regle jugee sur lui, la forme -yy de l'adjectif russe (reglee sur
  // un banc a part, 8 lignes de 50 passees de `fi` a muet), n'y change RIEN : les
  // trois russes romanisees fausses n'ont pas cette forme. Lu une fois.
  //
  // La deuxieme, le rire qui ne vote plus a cote d'un mot que la table ne connait
  // pas et qui ne decide plus de l'ecriture (reglee sur un banc a part de 141
  // lignes, 73 sures fausses a 1), lue une deuxieme fois en totaux : 13 a 6 sur
  // 500 (1,2 %), le rire de 7 a 0 et 12 a 14 justes, les natives de 190 a 185
  // justes et toujours 3 fausses. Barre toujours pas tenue. Plus aveugle : la regle
  // suivante se juge sur un corpus 6.
  //
  // Devenu banc de reglage le 2026-11-04 : ses lignes fausses ont ete lues pour
  // ecrire `fuer`, le hinglish courant, le veto ii du `-aat` neerlandais,
  // l'adjectif russe en ch/sh/zh/kh et -noe, `pfv`. Il en garde une, `gg bro`
  // rangee indonesienne et lue anglaise.
  it('mesure le chemin sur en totaux', () => {
    // 185 / 239 / 1 avant la revue linguiste (2026-11-04)
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT5).total)).toEqual({ right: 178, silent: 246, wrong: 1 });
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT5_ROMAN).total)).toEqual({ right: 0, silent: 50, wrong: 0 });
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT5_LAUGH).total)).toEqual({ right: 14, silent: 11, wrong: 0 });
  });

  it('mesure le chemin brut en totaux', () => {
    // 271 / 76 / 78 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    // 269 / 78 / 78 avant la revue linguiste (2026-11-04)
    // 263 / 81 / 81 avant les penchants du chemin brut (2026-11-04)
    expect(plain(runMatrix(detectLanguage, LANG_CHAT5).total)).toEqual({ right: 266, silent: 78, wrong: 81 });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT5_ROMAN).total)).toEqual({ right: 4, silent: 33, wrong: 13 });
    // 15 / 2 / 8 avant le rire sans vote du chemin sur
    expect(plain(runMatrix(detectLanguage, LANG_CHAT5_LAUGH).total)).toEqual({ right: 16, silent: 1, wrong: 8 });
  });

  it('n est lu par aucun autre fichier', () => {
    const roots = ['src', 'test', 'scripts'].map((d) => resolve(process.cwd(), d));
    const readers: string[] = [];
    const walk = (dir: string): void => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry);
        if (entry === 'node_modules') continue;
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (
          !/\.(m?[jt]sx?)$/.test(entry) ||
          entry === 'langChat5.test.ts' ||
          entry === 'langChatCorpus5.ts'
        )
          continue;
        if (readFileSync(full, 'utf8').includes('langChatCorpus5')) readers.push(full);
      }
    };
    roots.forEach(walk);
    expect(readers).toEqual([]);
  });
});
