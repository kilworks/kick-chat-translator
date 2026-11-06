import { describe, expect, it } from 'vitest';
import { isLaughter, laughterLanguage, LAUGHTER_FORMS, LAUGHTER_NOTES } from './laughter';

describe('isLaughter', () => {
  // Chaque famille attestee dans les sources citees en tete de la table.
  it.each([
    'jaja', 'jajaja', 'jeje', 'jijiji', 'jsjsjs',
    'kkk', 'kkkkk', 'rsrs', 'huehue',
    'mdr', 'ptdr', 'mouhahaha',
    'asg', 'høhøhø', 'hæhæhæ',
    'wkwk', 'wakaka', 'xixixi', 'ha3', 'ha3ha3ha3',
    '555', '55555', 'www', '2333',
    'haha', 'hahaha', 'ahahah', 'hehe', 'hihihi',
    'lol', 'lolol', 'lmao', 'rofl', 'kek', 'kekw', 'uwu',
    'xd', 'xdxd', 'xdxdxd', 'XDXD',
    'ахаха', 'хахаха', 'гггг', 'ххх', 'хххх', 'χαχα', 'ههههه', 'خخخخ', 'חחחח',
    'ㅋㅋㅋ', 'ㅎㅎㅎ', '哈哈哈', '呵呵', '草', 'हाहा',
  ])('reconnait %s', (forme) => {
    expect(isLaughter(forme)).toBe(true);
  });

  // Les pieges. Chacun a une raison d'etre la : un mot qui commence comme un
  // rire, un nombre, une marque, un rire suivi de vrai texte.
  it.each([
    'hola amigos', 'good game', 'kkona', 'kappa', 'jajaja que risa buena',
    'www.google.com', 'lolita', 'asgard', 'wakanda', 'mdr je rigole',
    'ja', 'ha', 'k', 'ok', '5', '55', '233', '2020',
    'xdesign', 'jajapan', 'hohoho', 'kekw andy',
  ])('ne prend pas %s pour un rire', (texte) => {
    expect(isLaughter(texte)).toBe(false);
  });
});

describe('laughterLanguage', () => {
  it.each([
    ['jajaja', 'es'], ['jejeje', 'es'], ['jsjsjs', 'es'],
    ['kkkkk', 'pt'], ['rsrsrs', 'pt'], ['huehuehue', 'pt'],
    ['mdr', 'fr'], ['ptdr', 'fr'],
    ['asg', 'sv'], ['høhøhø', 'da'], ['hæhæhæ', 'da'],
    ['wkwkwk', 'id'], ['wakaka', 'id'], ['xixixi', 'id'],
    ['ha3', 'ms'], ['555', 'th'], ['ｗｗｗ', 'ja'], ['2333', 'zh'],
    ['χαχα', 'el'],
  ])('%s marque %s', (forme, langue) => {
    expect(laughterLanguage(forme)).toBe(langue);
  });

  // Le `www` demi-chasse est reste du rire, mais il ne marque plus le japonais.
  // Mesure : le vote de `detectByShortWords` porte sur les JETONS et il decoupe
  // sur les non-lettres, donc `www.kick.com` donnait les jetons www, kick, com
  // et le premier votait seul. Trois vrais noms d hotes sur quatre sortaient ja
  // AVEC sl=ja, ce qui demande au moteur de traduire une URL depuis le japonais.
  // La pleine chasse ne connait pas cette ambiguite : aucun nom d hote ne
  // s ecrit en ｗ.
  it('www demi-chasse reste du rire sans marquer une langue', () => {
    expect(isLaughter('www')).toBe(true);
    expect(laughterLanguage('www')).toBeUndefined();
  });

  // La regle que la table se donne : une forme employee partout ne marque rien.
  // Une mauvaise reponse ici serait envoyee au moteur comme langue source.
  it.each(['haha', 'hahaha', 'hehe', 'hihi', 'lol', 'lmao', 'rofl', 'xd', 'xdxd', 'kek', 'uwu'])(
    '%s ne marque aucune langue',
    (forme) => {
      expect(laughterLanguage(forme)).toBeUndefined();
    },
  );

  // Le temoin des lettres danoises : sans elles, ces motifs avalent hahaha et
  // hohoho, qui n'appartiennent a personne. Mesure faite, la premiere version
  // rendait bien `da` pour `haha`.
  it('ne prend pas hahaha ni hohoho pour du danois', () => {
    expect(laughterLanguage('hahaha')).toBeUndefined();
    expect(laughterLanguage('hohoho')).toBeUndefined();
  });
});

describe('la table elle-meme', () => {
  it('donne une note a chaque forme, pour qu on puisse l auditer', () => {
    for (const f of LAUGHTER_FORMS) {
      expect(LAUGHTER_NOTES[f.motif.source]?.length ?? 0).toBeGreaterThan(8);
    }
  });

  it('ne garde aucune note orpheline', () => {
    // La note vit hors de l'entree pour qu'elle ne parte pas sur chaque page
    // Kick. Le prix de ce deplacement est qu'elle peut survivre a la forme
    // qu'elle decrit, ce que seule cette assertion voit.
    const sources = new Set(LAUGHTER_FORMS.map((f) => f.motif.source));
    for (const cle of Object.keys(LAUGHTER_NOTES)) {
      expect(sources.has(cle)).toBe(true);
    }
    expect(Object.keys(LAUGHTER_NOTES)).toHaveLength(LAUGHTER_FORMS.length);
  });

  it('n emploie que des codes ISO-2 pour les langues marquees', () => {
    for (const f of LAUGHTER_FORMS) {
      if (f.langue) expect(f.langue).toMatch(/^[a-z]{2}$/);
    }
  });

  it('ancre chaque motif sur le message entier', () => {
    // Un motif non ancre attraperait un rire au milieu d'une phrase et
    // ecarterait un vrai message.
    for (const f of LAUGHTER_FORMS) {
      expect(f.motif.source.startsWith('^')).toBe(true);
      expect(f.motif.source.endsWith('$')).toBe(true);
    }
  });

  it('repond vite sur une longue repetition qui finit mal', () => {
    // Une vraie ligne de chat, 73 K puis un caractere invisible, ne rendait jamais
    // la main : `k{2,}(?:[a-jl-z]?k{2,})*` essaie toutes les coupes. Un motif pareil
    // gele l'onglet de tout le monde dans le chat, a la demande de n'importe qui.
    const lettres = ['k', 'j', 'h', 'a', 'e', 's', 'x', 'w', '5', 'q', 'l', 'ㅋ', 'ㅎ', 'ก', 'х', 'ه', 'ה', '哈', 'ハ'];
    for (const f of LAUGHTER_FORMS) {
      for (const l of lettres) {
        const t0 = performance.now();
        f.motif.test(`${l.repeat(42)}!`);
        expect(performance.now() - t0, `${f.motif.source} sur ${l}`).toBeLessThan(100);
      }
    }
  });
});
