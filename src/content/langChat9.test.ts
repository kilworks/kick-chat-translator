import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT9, LANG_CHAT9_LAUGH, LANG_CHAT9_ROMAN } from './langChatCorpus9';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus 9, AVEUGLE, parce que le 8 ne l'est plus.
 *
 * Ecrit le 2026-11-04 sur la commande du 8 par un nouvel auteur qui n'a vu ni
 * le detecteur ni les autres corpus, puis verifie sans recouvrement avec toute
 * chaine litterale de src/ et test/ (6 lignes en collision reecrites par le
 * meme auteur sans qu'elles soient lues ici).
 */

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus 9, aveugle', () => {
  it('est celui qui a ete fige, octet pour octet', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/content/langChatCorpus9.ts'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '33f4041b87f03fa28ac3a1b2994742a4f0d8e84788fa9932bd61e9b4f4c086ba',
    );
    const n = (c: Record<string, readonly string[]>) => Object.values(c).flat().length;
    expect([n(LANG_CHAT9), n(LANG_CHAT9_ROMAN), n(LANG_CHAT9_LAUGH)]).toEqual([425, 50, 25]);
  });

  // La barre : au plus une reponse sure fausse par jeu, 0,7 % en tout. Lu une
  // fois en totaux, sur cinq etats du detecteur : 12 sur 500 avant le rire sans
  // vote, 8 apres, 7 apres les regles des corpus 4 et 5, 7 apres celles du 6,
  // 5 (1,0 %) apres celles des 7 et 8. Barre NON tenue : natif 5.
  it('mesure le chemin sur en totaux', () => {
    // avant le rire : 157 / 262 / 6
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT9).total)).toEqual({ right: 157, silent: 263, wrong: 5 });
    // avant les regles des corpus 7 et 8 : 0 / 48 / 2
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT9_ROMAN).total)).toEqual({ right: 0, silent: 50, wrong: 0 });
    // avant le rire : 10 / 11 / 4
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT9_LAUGH).total)).toEqual({ right: 10, silent: 15, wrong: 0 });
  });

  it('mesure le chemin brut en totaux', () => {
    expect(plain(runMatrix(detectLanguage, LANG_CHAT9).total)).toEqual({ right: 271, silent: 82, wrong: 72 });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT9_ROMAN).total)).toEqual({ right: 2, silent: 34, wrong: 14 });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT9_LAUGH).total)).toEqual({ right: 14, silent: 6, wrong: 5 });
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
          entry === 'langChat9.test.ts' ||
          entry === 'langChatCorpus9.ts'
        )
          continue;
        if (readFileSync(full, 'utf8').includes('langChatCorpus9')) readers.push(full);
      }
    };
    roots.forEach(walk);
    expect(readers).toEqual([]);
  });
});
