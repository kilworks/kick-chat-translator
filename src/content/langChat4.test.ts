import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT4, LANG_CHAT4_LAUGH, LANG_CHAT4_ROMAN } from './langChatCorpus4';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus 4, AVEUGLE, et pourquoi il fallait un quatrieme.
 *
 * Le corpus 2 ne l'est plus. `porte-candidats.mjs` y compte des lettres pour
 * proposer des lettres exclusives, `porte-mots-candidats.mjs` et
 * `langue-candidats.mjs` s'en servent de reserve de bruit pour rejeter des
 * candidats, et la regle `-aat` a ete retaillee apres avoir vu son effet dessus.
 * Son zero erreur est donc une borne haute, pas une mesure a l'aveugle.
 *
 * Celui-ci a ete ecrit le 2026-11-03 par un auteur qui n'a vu ni le detecteur ni
 * les autres corpus, puis verifie sans recouvrement avec toute chaine litterale
 * de src/ et test/. Il est mesure ici en totaux, et nulle part ailleurs : le
 * dernier test du fichier echoue si un autre fichier l'importe.
 *
 * Les totaux ci-dessous sont ceux d'AVANT toute regle jugee sur lui. Ils sont
 * fixes au commit qui l'a ajoute, avec son empreinte, pour que l'ordre soit
 * verifiable : le banc existait avant le changement qu'il departage.
 */

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus 4, aveugle', () => {
  it('est celui qui a ete fige, octet pour octet', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/content/langChatCorpus4.ts'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '8bddd40d9ea6a7077d1dd3e4ab2fd1297eab934368eac87291ac731b168ea925',
    );
    const n = (c: Record<string, readonly string[]>) => Object.values(c).flat().length;
    expect([n(LANG_CHAT4), n(LANG_CHAT4_ROMAN), n(LANG_CHAT4_LAUGH)]).toEqual([425, 50, 25]);
  });

  // LE RESULTAT, et il contredit l'invariant des trois autres corpus de chat.
  // Le chemin sur, celui qui fixe la langue source annoncee au fournisseur et le
  // saut de meme langue, n'y fait pas zero erreur : 17 lignes sur 500.
  it('mesure le chemin sur en totaux', () => {
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT4).total)).toEqual({
      right: 221,
      silent: 196,
      wrong: 8,
    });
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT4_ROMAN).total)).toEqual({
      right: 0,
      silent: 44,
      wrong: 6,
    });
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT4_LAUGH).total)).toEqual({
      right: 5,
      silent: 17,
      wrong: 3,
    });
  });

  it('mesure le chemin brut en totaux', () => {
    expect(plain(runMatrix(detectLanguage, LANG_CHAT4).total)).toEqual({
      right: 291,
      silent: 57,
      wrong: 77,
    });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT4_ROMAN).total)).toEqual({
      right: 3,
      silent: 25,
      wrong: 22,
    });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT4_LAUGH).total)).toEqual({
      right: 14,
      silent: 4,
      wrong: 7,
    });
  });

  // La regle qui le garde aveugle, ecrite comme une verification plutot que
  // comme une consigne : aucun script de candidats, aucun autre test ne le lit.
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
          entry === 'langChat4.test.ts' ||
          entry === 'langChatCorpus4.ts'
        )
          continue;
        if (readFileSync(full, 'utf8').includes('langChatCorpus4')) readers.push(full);
      }
    };
    roots.forEach(walk);
    expect(readers).toEqual([]);
  });
});
