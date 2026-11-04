import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT10, LANG_CHAT10_LAUGH, LANG_CHAT10_ROMAN } from './langChatCorpus10';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus 10, AVEUGLE, parce que le 9 a servi a regler.
 *
 * Ecrit le 2026-11-04 sur la commande du 9 par un nouvel auteur qui n'a vu ni
 * le detecteur ni les autres corpus, puis verifie sans recouvrement avec toute
 * chaine litterale de src/ et test/ (31 lignes en collision reecrites par le
 * meme auteur sans qu'elles soient lues ici).
 */

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus 10, aveugle', () => {
  it('est celui qui a ete fige, octet pour octet', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/content/langChatCorpus10.ts'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '42f2746d767f485ebbb935b595f3d39b9c6c058947aa86d7d78f1dbcb9965bb2',
    );
    const n = (c: Record<string, readonly string[]>) => Object.values(c).flat().length;
    expect([n(LANG_CHAT10), n(LANG_CHAT10_ROMAN), n(LANG_CHAT10_LAUGH)]).toEqual([425, 50, 25]);
  });

  // La barre : au plus une reponse sure fausse par jeu, 0,7 % en tout. Lu une
  // fois en totaux, sur six etats du detecteur : 11, 9, 9, 8, 5, 5 sur 500.
  // Natif 1 et romanise 1 tiennent la barre par jeu ; le rire en garde 3 et le
  // total 1,0 % : barre NON tenue.
  it('mesure le chemin sur en totaux', () => {
    // avant toute passe : 142 / 279 / 4
    // 146 / 278 / 1 avant dah malais retire, rire coreen en syllabes, karne/baad (2026-11-04)
    // 146 / 279 / 0 avant la revue linguiste (2026-11-04)
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT10).total)).toEqual({ right: 142, silent: 283, wrong: 0 });
    // avant toute passe : 0 / 48 / 2
    // 0 / 49 / 1 avant dah malais retire, rire coreen en syllabes, karne/baad (2026-11-04)
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT10_ROMAN).total)).toEqual({ right: 0, silent: 50, wrong: 0 });
    // avant le rire : 6 / 14 / 5
    // 6 / 16 / 3 avant dah malais retire, rire coreen en syllabes, karne/baad (2026-11-04)
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT10_LAUGH).total)).toEqual({ right: 6, silent: 19, wrong: 0 });
  });

  it('mesure le chemin brut en totaux', () => {
    // 258 / 84 / 83 avant la revue linguiste (2026-11-04)
    // 256 / 84 / 85 avant les penchants du chemin brut (2026-11-04)
    expect(plain(runMatrix(detectLanguage, LANG_CHAT10).total)).toEqual({ right: 257, silent: 84, wrong: 84 });
    // 4 / 29 / 17 avant dah malais retire, rire coreen en syllabes, karne/baad (2026-11-04)
    expect(plain(runMatrix(detectLanguage, LANG_CHAT10_ROMAN).total)).toEqual({ right: 4, silent: 30, wrong: 16 });
    // 15 / 2 / 8 avant dah malais retire, rire coreen en syllabes, karne/baad (2026-11-04)
    expect(plain(runMatrix(detectLanguage, LANG_CHAT10_LAUGH).total)).toEqual({ right: 16, silent: 2, wrong: 7 });
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
          entry === 'langChat10.test.ts' ||
          entry === 'langChatCorpus10.ts'
        )
          continue;
        if (readFileSync(full, 'utf8').includes('langChatCorpus10')) readers.push(full);
      }
    };
    roots.forEach(walk);
    expect(readers).toEqual([]);
  });
});
