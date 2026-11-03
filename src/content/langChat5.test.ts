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
  it('mesure le chemin sur en totaux', () => {
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT5).total)).toEqual({ right: 190, silent: 232, wrong: 3 });
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT5_ROMAN).total)).toEqual({ right: 0, silent: 47, wrong: 3 });
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT5_LAUGH).total)).toEqual({ right: 12, silent: 6, wrong: 7 });
  });

  it('mesure le chemin brut en totaux', () => {
    expect(plain(runMatrix(detectLanguage, LANG_CHAT5).total)).toEqual({ right: 270, silent: 75, wrong: 80 });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT5_ROMAN).total)).toEqual({ right: 2, silent: 32, wrong: 16 });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT5_LAUGH).total)).toEqual({ right: 15, silent: 2, wrong: 8 });
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
