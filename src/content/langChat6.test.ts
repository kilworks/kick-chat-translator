import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runMatrix, type Cell } from './langMatrix';
import { LANG_CHAT6, LANG_CHAT6_LAUGH, LANG_CHAT6_ROMAN } from './langChatCorpus6';
import { confidentLanguage, detectLanguage } from './langDetect';

/**
 * Le corpus 6, AVEUGLE, parce que le 5 ne l'est plus.
 *
 * Le corpus 5 a ete lu deux fois en totaux, la seconde pour la regle du rire.
 * Celui-ci a ete ecrit le 2026-11-04 sur la commande du 5, par un auteur qui
 * n'a vu ni le detecteur ni les autres corpus, puis verifie sans recouvrement
 * avec toute chaine litterale de src/ et test/ (53 lignes en collision
 * reecrites par le meme auteur, sans qu'elles soient lues ici).
 *
 * Meme regime que le 5 : mesure ici en totaux et nulle part ailleurs, avec son
 * empreinte.
 */

const plain = (c: Cell) => ({ right: c.right, silent: c.silent, wrong: c.wrong });

describe('le corpus 6, aveugle', () => {
  it('est celui qui a ete fige, octet pour octet', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/content/langChatCorpus6.ts'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'cf6e73dab3eff9da0e34cbeca36f878d0b51aacc92e0c0f3b0280cb710f23be9',
    );
    const n = (c: Record<string, readonly string[]>) => Object.values(c).flat().length;
    expect([n(LANG_CHAT6), n(LANG_CHAT6_ROMAN), n(LANG_CHAT6_LAUGH)]).toEqual([425, 50, 25]);
  });

  // La barre, reprise du corpus 4 : au plus une reponse sure fausse par jeu,
  // 0,7 % en tout. Premiere regle jugee sur lui, le rire qui ne vote plus a cote
  // d'un mot inconnu ni ne decide de l'ecriture (reglee sur un banc a part),
  // lu une fois en totaux : 12 sur 500 (2,4 %) avant, 3 apres (0,6 %), le rire
  // de 9 a 0, les natives de 162 a 159 justes et 2 fausses avant comme apres.
  // Le total tient la barre, pas le jeu natif (2 fausses).
  //
  // Relu une deuxieme fois en totaux pour les regles reglees sur les corpus 4 et
  // 5 (2026-11-04) : une native de muette a juste, les 3 fausses inchangees. Plus
  // aveugle ; ces regles se jugent sur le corpus 7.
  //
  // Devenu banc de reglage le 2026-11-04 : ses 3 lignes fausses lues pour
  // retirer `no` des jetons anglais, `давай` des mots russes, et ajouter `sab`
  // et `ko` au hinglish. Plus aucune fausse.
  it('mesure le chemin sur en totaux', () => {
    // avant : 162 / 261 / 2
    // 159 / 266 / 0 avant fight/night, -iyor turc, hitto, -уть et коли ukrainiens (2026-11-04)
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT6).total)).toEqual({ right: 160, silent: 265, wrong: 0 });
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT6_ROMAN).total)).toEqual({ right: 0, silent: 50, wrong: 0 });
    // avant : 7 / 9 / 9
    // 9 / 16 / 0 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    expect(plain(runMatrix(confidentLanguage, LANG_CHAT6_LAUGH).total)).toEqual({ right: 8, silent: 17, wrong: 0 });
  });

  it('mesure le chemin brut en totaux', () => {
    // 236 / 116 / 73 avant fight/night, -iyor turc, hitto, -уть et коли ukrainiens (2026-11-04)
    expect(plain(runMatrix(detectLanguage, LANG_CHAT6).total)).toEqual({ right: 237, silent: 115, wrong: 73 });
    expect(plain(runMatrix(detectLanguage, LANG_CHAT6_ROMAN).total)).toEqual({ right: 2, silent: 31, wrong: 17 });
    // avant : 7 / 9 / 9
    // 9 / 9 / 7 avant les mots partages retires (vse, iz, mia, давай) et le lexique ajoute (2026-11-04)
    expect(plain(runMatrix(detectLanguage, LANG_CHAT6_LAUGH).total)).toEqual({ right: 8, silent: 9, wrong: 8 });
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
          entry === 'langChat6.test.ts' ||
          entry === 'langChatCorpus6.ts'
        )
          continue;
        if (readFileSync(full, 'utf8').includes('langChatCorpus6')) readers.push(full);
      }
    };
    roots.forEach(walk);
    expect(readers).toEqual([]);
  });
});
