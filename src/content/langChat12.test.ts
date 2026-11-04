import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT12, LANG_CHAT12_LAUGH, LANG_CHAT12_ROMAN } from './langChatCorpus12';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus 12, AVEUGLE, pour confirmer la barre tenue sur le 11.
 *
 * Ecrit le 2026-11-04 sur la meme commande par un nouvel auteur qui n'a vu ni
 * le detecteur ni les autres corpus. 23 lignes en collision avec les chaines
 * litterales de src/ et test/ reecrites par le meme auteur sans etre lues ici,
 * 0 au jugement, et aucune ligne lue avant ni apres.
 */

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus 12, aveugle', () => {
  it('est celui qui a ete fige, octet pour octet', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/content/langChatCorpus12.ts'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '381679e071fca22cc6926ec2c1b06a391428f8f743c91e99c08f0add49018f7c',
    );
    const n = (c: Record<string, readonly string[]>) => Object.values(c).flat().length;
    expect([n(LANG_CHAT12), n(LANG_CHAT12_ROMAN), n(LANG_CHAT12_LAUGH)]).toEqual([425, 50, 25]);
  });

  // La barre : au plus une reponse sure fausse par jeu, 0,7 % en tout. Lu une
  // fois en totaux, sur deux etats : 8 sur 500 avant toute passe, 1 (0,2 %)
  // apres. BARRE TENUE une deuxieme fois : natif 1, romanise 0, rire 0.
  it('mesure le chemin sur en totaux', () => {
    // avant toute passe : 165 / 257 / 3
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT12).total)).toEqual({ right: 164, silent: 260, wrong: 1 });
    // avant toute passe : 0 / 47 / 3
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT12_ROMAN).total)).toEqual({ right: 0, silent: 50, wrong: 0 });
    // avant toute passe : 11 / 12 / 2
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT12_LAUGH).total)).toEqual({ right: 11, silent: 14, wrong: 0 });
  });

  it('mesure le chemin brut en totaux', () => {
    // avant toute passe : 281 / 84 / 60
    expect(plain(runMatrix(detectLanguage, LANG_CHAT12).total)).toEqual({ right: 281, silent: 86, wrong: 58 });
    // avant toute passe : 3 / 30 / 17
    expect(plain(runMatrix(detectLanguage, LANG_CHAT12_ROMAN).total)).toEqual({ right: 5, silent: 31, wrong: 14 });
    // avant toute passe : 17 / 3 / 5
    expect(plain(runMatrix(detectLanguage, LANG_CHAT12_LAUGH).total)).toEqual({ right: 17, silent: 4, wrong: 4 });
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
          entry === 'langChat12.test.ts' ||
          entry === 'langChatCorpus12.ts'
        )
          continue;
        if (readFileSync(full, 'utf8').includes('langChatCorpus12')) readers.push(full);
      }
    };
    roots.forEach(walk);
    expect(readers).toEqual([]);
  });
});
