import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT8, LANG_CHAT8_LAUGH, LANG_CHAT8_ROMAN } from './langChatCorpus8';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus 8, AVEUGLE, parce que le 7 ne l'est plus.
 *
 * Ecrit le 2026-11-04 sur la commande du 7 par un nouvel auteur qui n'a vu ni
 * le detecteur ni les autres corpus, puis verifie sans recouvrement avec toute
 * chaine litterale de src/ et test/ (25 lignes en collision reecrites par le
 * meme auteur sans qu'elles soient lues ici).
 *
 * Meme regime : mesure ici en totaux et nulle part ailleurs, avec son empreinte.
 */

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus 8, aveugle', () => {
  it('est celui qui a ete fige, octet pour octet', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/content/langChatCorpus8.ts'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '36d9c592d0128b907a59f1240734e6aa86a45ddd1f16700c154c8dd65223d7fb',
    );
    const n = (c: Record<string, readonly string[]>) => Object.values(c).flat().length;
    expect([n(LANG_CHAT8), n(LANG_CHAT8_ROMAN), n(LANG_CHAT8_LAUGH)]).toEqual([425, 50, 25]);
  });

  // La barre : au plus une reponse sure fausse par jeu, 0,7 % en tout. Lu une
  // fois en totaux, sur quatre etats du detecteur : 14 sur 500 (2,8 %) avant le
  // rire sans vote, 8 apres, 6 apres les regles des corpus 4 et 5, 6 (1,2 %)
  // apres celles du corpus 6, qui n'y changent rien. Barre NON tenue : natif 3,
  // romanise 3, rire 0.
  it('mesure le chemin sur en totaux', () => {
    // 162 / 260 / 3 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    // 165 / 260 / 0 avant fight/night, -iyor turc, hitto, -уть et коли ukrainiens (2026-11-04)
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT8).total)).toEqual({ right: 167, silent: 258, wrong: 0 });
    // avant les regles des corpus 4 et 5 : 0 / 46 / 4
    // 0 / 47 / 3 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT8_ROMAN).total)).toEqual({ right: 0, silent: 50, wrong: 0 });
    // avant le rire : 9 / 9 / 7 ; apres : 9 / 15 / 1
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT8_LAUGH).total)).toEqual({ right: 9, silent: 16, wrong: 0 });
  });

  it('mesure le chemin brut en totaux', () => {
    // 271 / 89 / 65 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    // 275 / 88 / 62 avant fight/night, -iyor turc, hitto, -уть et коли ukrainiens (2026-11-04)
    expect(plain(runMatrix(detectLanguage, LANG_CHAT8).total)).toEqual({ right: 276, silent: 87, wrong: 62 });
    // 2 / 30 / 18 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    expect(plain(runMatrix(detectLanguage, LANG_CHAT8_ROMAN).total)).toEqual({ right: 3, silent: 32, wrong: 15 });
    // avant le rire : 14 / 1 / 10
    expect(plain(runMatrix(detectLanguage, LANG_CHAT8_LAUGH).total)).toEqual({ right: 15, silent: 2, wrong: 8 });
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
          entry === 'langChat8.test.ts' ||
          entry === 'langChatCorpus8.ts'
        )
          continue;
        if (readFileSync(full, 'utf8').includes('langChatCorpus8')) readers.push(full);
      }
    };
    roots.forEach(walk);
    expect(readers).toEqual([]);
  });
});
