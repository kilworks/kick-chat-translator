import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT7, LANG_CHAT7_LAUGH, LANG_CHAT7_ROMAN } from './langChatCorpus7';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus 7, AVEUGLE, parce que le 6 ne l'est plus.
 *
 * Ecrit le 2026-11-04 sur la commande du 6 par un nouvel auteur qui n'a vu ni
 * le detecteur ni les autres corpus, puis verifie sans recouvrement avec toute
 * chaine litterale de src/ et test/ (73 lignes en collision, dont 16 avec le
 * corpus 6, reecrites par le meme auteur sans qu'elles soient lues ici).
 *
 * Meme regime : mesure ici en totaux et nulle part ailleurs, avec son empreinte.
 */

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus 7, aveugle', () => {
  it('est celui qui a ete fige, octet pour octet', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/content/langChatCorpus7.ts'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '670fb13eed0c1e7fae8dea5f96c38bc1c108a02b74ec0f180e39fa4e30b6a557',
    );
    const n = (c: Record<string, readonly string[]>) => Object.values(c).flat().length;
    expect([n(LANG_CHAT7), n(LANG_CHAT7_ROMAN), n(LANG_CHAT7_LAUGH)]).toEqual([425, 50, 25]);
  });

  // La barre : au plus une reponse sure fausse par jeu, 0,7 % en tout. Lu une
  // fois en totaux, sur trois etats du detecteur : 12 sur 500 (2,4 %) avant le
  // rire sans vote, 8 apres, 6 (1,2 %) apres les regles lues sur les corpus 4 et
  // 5. Barre NON tenue : natif 3, romanise 2, rire 1.
  //
  // Relu une deuxieme fois en totaux, par cette epingle, quand le corpus 6 est
  // devenu banc de reglage (2026-11-04) : natif 3 a 2. Plus aveugle ; ces
  // regles se jugent sur le corpus 8.
  it('mesure le chemin sur en totaux', () => {
    // avant le rire : 166 / 254 / 5 ; apres : 164 / 256 / 5
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT7).total)).toEqual({ right: 165, silent: 258, wrong: 2 });
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT7_ROMAN).total)).toEqual({ right: 0, silent: 48, wrong: 2 });
    // avant le rire : 9 / 11 / 5
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT7_LAUGH).total)).toEqual({ right: 9, silent: 15, wrong: 1 });
  });

  it('mesure le chemin brut en totaux', () => {
    // avant : 261 / 87 / 77
    expect(plain(runMatrix(detectLanguage, LANG_CHAT7).total)).toEqual({ right: 263, silent: 88, wrong: 74 });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT7_ROMAN).total)).toEqual({ right: 2, silent: 30, wrong: 18 });
    // avant le rire : 13 / 4 / 8
    expect(plain(runMatrix(detectLanguage, LANG_CHAT7_LAUGH).total)).toEqual({ right: 13, silent: 6, wrong: 6 });
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
          entry === 'langChat7.test.ts' ||
          entry === 'langChatCorpus7.ts'
        )
          continue;
        if (readFileSync(full, 'utf8').includes('langChatCorpus7')) readers.push(full);
      }
    };
    roots.forEach(walk);
    expect(readers).toEqual([]);
  });
});
