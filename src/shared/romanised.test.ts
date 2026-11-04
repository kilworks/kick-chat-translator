import { describe, expect, it } from 'vitest';
import { romanisedLanguage, ROMANISED_MARKERS, ROMANISED_WEAK_MARKERS } from './romanised';

describe('romanisedLanguage', () => {
  it.each([
    ['privet kak dela segodnya', 'ru'],
    ['spasibo bolshoe za stream', 'ru'],
    ['pozhaluysta pomogite mne', 'ru'],
    ['khorosho ochen khorosho', 'ru'],
    ['nichego ne ponyatno', 'ru'],
    ['konechno eto pravda', 'ru'],
    ['zdravstvuyte vsem privet', 'ru'],
    ['ti kaneis re file einai kalo', 'el'],
    ['kalimera se olous ti kanete', 'el'],
    ['kalispera paidia ti ginetai', 'el'],
    ['efharisto poli file mou', 'el'],
    ['giati to ekanes auto', 'el'],
    ['den katalava tipota', 'el'],
    ['konnichiwa minna genki desu ka', 'ja'],
    ['arigatou gozaimasu subarashii', 'ja'],
    ['ohayou gozaimasu minna san', 'ja'],
    ['yoroshiku onegaishimasu', 'ja'],
    ['ganbatte kudasai', 'ja'],
  ])('marque %s comme %s', (texte, langue) => {
    expect(romanisedLanguage(texte)).toBe(langue);
  });

  // Les temoins de frontiere qui comptent le plus : des mots japonais que
  // l argot internet anglais a adoptes. Un anglophone les ecrit sans parler un
  // mot de japonais, donc ils n ont rien a faire dans la table, et ce test
  // interdit de les y ajouter par confort.
  it.each([
    'that is so kawaii', 'sugoi play bro', 'senpai noticed me', 'baka gamer',
    'nice desu', 'sensei teach me', 'malaka is everywhere', 'gyro please',
  ])('ne marque pas l emprunt %s', (texte) => {
    expect(romanisedLanguage(texte)).toBeUndefined();
  });

  it.each([
    'hola amigos como estan todos', 'bonsoir tout le monde ca va',
    'guten abend zusammen wie geht es', 'herkese iyi aksamlar nasilsiniz',
    'boa noite pessoal tudo bem', 'good evening everyone how are you',
    'dobry wieczor wszystkim', 'buonasera a tutti come state',
  ])('laisse le texte des langues du produit tranquille : %s', (texte) => {
    expect(romanisedLanguage(texte)).toBeUndefined();
  });

  // Un message qui porte deux marqueurs qui ne s accordent pas n est ni l un ni
  // l autre. Sans cette regle, l ordre des mots deciderait de la langue.
  it('annule quand deux langues se disputent le message', () => {
    expect(romanisedLanguage('privet konnichiwa')).toBeUndefined();
    expect(romanisedLanguage('kalimera spasibo')).toBeUndefined();
  });

  it('n emploie que des codes ISO-2 et des marqueurs assez longs', () => {
    for (const [langue, mots] of Object.entries(ROMANISED_MARKERS)) {
      expect(langue).toMatch(/^[a-z]{2}$/);
      for (const m of mots) {
        expect(m).toMatch(/^[a-z]+$/);
        // Sous cinq lettres, un mot romanise entre en collision avec trop de
        // choses. C est ce qui tient `net`, `poka` et `davai` hors de la table.
        expect(m.length).toBeGreaterThanOrEqual(5);
        // Un marqueur ne peut pas etre dans les deux etages : il deciderait
        // seul tout en pretendant avoir besoin d un second.
        expect(Object.values(ROMANISED_WEAK_MARKERS).flat()).not.toContain(m);
      }
    }
  });
});

/**
 * Le bulgare en lettres latines, et le second etage qu il a impose.
 *
 * Ce que la detection rendait avant, mesure ligne par ligne : "mnogo dobre igra"
 * rien, "mnogo smeshno" pl, "az sam tuk" id, "ai stiga be" sv. Trois etiquettes
 * fausses et un silence, et sur les trois fausses le lecteur de CETTE langue
 * perdait la ligne comme "deja dans ta langue".
 *
 * Ces quatre lignes ont ete ecrites la veille des marqueurs, donc elles sont la
 * seule mesure de rappel qui ne soit pas de l ajustement.
 */
describe('romanisedLanguage, bulgare latinise', () => {
  it.each([
    ['mnogo dobre igra', 'les deux mots que le paradigme grammatical rate'],
    ['mnogo smeshno', 'deux mots, et smeshno appartient aussi au russe'],
    ['az sam tuk', 'trois mots faibles, aucun decisif seul'],
  ])('prend %s (%s)', (texte) => {
    expect(romanisedLanguage(texte)).toBe('bg');
  });

  // La quatrieme des lignes tenues a l ecart, celle qui reste ratee. Elle ne
  // porte qu un seul marqueur faible et la regle en demande deux, ce qui est le
  // prix de zero faux positif et non un oubli.
  it('laisse passer une ligne a un seul marqueur faible', () => {
    expect(romanisedLanguage('ai stiga be')).toBeUndefined();
  });

  it.each(['kakvo stava tuka', 'zashto pravish taka', 'vsichko e nared', 'kolko e chasa'])(
    'un marqueur fort suffit sur %s',
    (texte) => {
      expect(romanisedLanguage(texte)).toBe('bg');
    },
  );

  // Le temoin du second etage : UN seul marqueur faible ne decide rien, sinon
  // `dobre` prendrait le polonais et `sam` prendrait l anglais.
  it.each(['bardzo dobre zagranie', 'sam is streaming today', 'sega'])(
    'un seul marqueur faible ne decide rien : %s',
    (texte) => {
      expect(romanisedLanguage(texte)).toBeUndefined();
    },
  );

  // La collision nommee dans la table. `mnogo` et `smeshno` s ecrivent pareil
  // dans les deux langues, donc un marqueur `ru` fort doit continuer a trancher.
  it('un marqueur russe fort bat le second etage', () => {
    expect(romanisedLanguage('ochen mnogo ludey tut')).toBe('ru');
    expect(romanisedLanguage('spasibo bylo smeshno')).toBe('ru');
  });

  // Le meme mot deux fois n est pas deux marqueurs. Sans la deduplication,
  // "tuk tuk" suffirait et la regle des deux ne voudrait rien dire.
  it('ne compte pas deux fois le meme marqueur', () => {
    expect(romanisedLanguage('tuk tuk tuk')).toBeUndefined();
  });
});

// La terminaison d'adjectif russe -ый/-ий/-ой translitteree -yy, apres une
// consonne que le finnois ne met pas devant -yy en fin de mot. Mesure avant la
// regle sur un banc de reglage de 50 lignes ecrit pour elle : 8 lignes ainsi
// faites sortaient `fi` comme reponse sure, par la regle finnoise `yy`.
describe('romanisedLanguage, adjectif russe en -yy', () => {
  it.each([
    'eto byl novyy rekord',
    'krasivyy hod',
    'dobryy vecher',
    'staryy strim byl luchshe',
    'zlyy streamer segodnya',
    'polnyy proval',
  ])('marque %s comme ru', (texte) => {
    expect(romanisedLanguage(texte)).toBe('ru');
  });

  // Le finnois finit en -yy apres t, k, s (loytyy, nakyy, pysyy), et en -yy
  // seul sur trois lettres (syy, kyy, myy) : rien de cela ne doit sortir ru.
  it.each(['se loytyy sielta', 'nakyy hyvin', 'pysyy kotona', 'mika syy', 'myy kaiken', 'syntyy uusi'])(
    'laisse %s au detecteur',
    (texte) => {
      expect(romanisedLanguage(texte)).toBeUndefined();
    },
  );
});
