import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT11, LANG_CHAT11_LAUGH, LANG_CHAT11_ROMAN } from './langChatCorpus11';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus 11, AVEUGLE, parce que le 10 a servi a regler.
 *
 * Ecrit le 2026-11-04 sur la commande du 10 par un nouvel auteur qui n'a vu ni
 * le detecteur ni les autres corpus. 27 lignes en collision avec les chaines
 * litterales de src/ et test/ reecrites par le meme auteur sans etre lues ici ;
 * une collision restait au jugement, une ligne native russe que le chemin sur
 * lit juste, donc sans effet sur le compte des fausses.
 */

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus 11, aveugle', () => {
  it('est celui qui a ete fige, octet pour octet', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/content/langChatCorpus11.ts'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'bd6f2dfa1e26ef433f241d9d2d5241d47f11f27f26cbfaeba8d64558745eccaf',
    );
    const n = (c: Record<string, readonly string[]>) => Object.values(c).flat().length;
    expect([n(LANG_CHAT11), n(LANG_CHAT11_ROMAN), n(LANG_CHAT11_LAUGH)]).toEqual([425, 50, 25]);
  });

  // La barre : au plus une reponse sure fausse par jeu, 0,7 % en tout. Lu une
  // fois en totaux, sur trois etats du detecteur : 8 sur 500 avant toute passe,
  // 1 apres les regles des corpus 4 a 9, 1 apres celles du 10. BARRE TENUE :
  // 0,2 %, natif 1, romanise 0, rire 0.
  it('mesure le chemin sur en totaux', () => {
    // avant toute passe : 173 / 250 / 2
    // 174 / 250 / 1 avant la revue linguiste (2026-11-04)
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT11).total)).toEqual({ right: 170, silent: 255, wrong: 0 });
    // avant toute passe : 0 / 48 / 2
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT11_ROMAN).total)).toEqual({ right: 0, silent: 50, wrong: 0 });
    // avant toute passe : 11 / 10 / 4
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT11_LAUGH).total)).toEqual({ right: 11, silent: 14, wrong: 0 });
  });

  it('mesure le chemin brut en totaux', () => {
    // avant toute passe : 284 / 78 / 63
    // 283 / 80 / 62 avant la revue linguiste (2026-11-04)
    // 279 / 83 / 63 avant les penchants du chemin brut (2026-11-04)
    expect(plain(runMatrix(detectLanguage, LANG_CHAT11).total)).toEqual({ right: 283, silent: 81, wrong: 61 });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT11_ROMAN).total)).toEqual({ right: 1, silent: 30, wrong: 19 });
    // avant toute passe : 15 / 5 / 5
    expect(plain(runMatrix(detectLanguage, LANG_CHAT11_LAUGH).total)).toEqual({ right: 17, silent: 6, wrong: 2 });
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
          entry === 'langChat11.test.ts' ||
          entry === 'langChatCorpus11.ts'
        )
          continue;
        if (readFileSync(full, 'utf8').includes('langChatCorpus11')) readers.push(full);
      }
    };
    roots.forEach(walk);
    expect(readers).toEqual([]);
  });
});
