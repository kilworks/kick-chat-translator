import { describe, expect, it } from 'vitest';
import { LANG_MIXED } from './langMixedCorpus';
import { confidentLanguage } from './langDetect';

/**
 * Le banc des lignes melangees, et la mesure qui ferme la question de
 * `SHORT_TEXT_MAX`.
 *
 * Pourquoi ce banc existe et pourquoi son chiffre se lit a l'envers des deux
 * autres est ecrit en entier en tete de `langMixedCorpus.ts` : sur une ligne qui
 * contient deux langues, la bonne reponse du chemin sur est le SILENCE, donc le
 * nombre a faire baisser est celui des lignes NOMMEES.
 *
 * LA MESURE, relevee en deplaçant la borne dans une copie de `langDetect.ts` et
 * en relançant les trois bancs a chaque cran. Elle n'est pas rejouee en CI parce
 * qu'elle demande de recompiler le module avec une constante differente ; la
 * recette est dans le protocole du handoff, section 4.2, et tient en cinq
 * minutes.
 *
 *   borne | melangees nommees | chat muet | chat justes | Tatoeba justes/faux
 *      20 |      10 / 50      |    74 %   |     103     |      2348 / 15
 *      25 |      16 / 50      |    71 %   |     115     |      2367 / 17
 *      30 |      25 / 50      |    69 %   |     121     |      2395 / 17
 *      40 |      34 / 50      |    69 %   |     121     |      2455 / 17
 *     999 |      34 / 50      |    69 %   |     121     |      2587 / 24
 *
 * (Le corpus comptait 50 lignes a cette mesure et en compte 60 depuis, la
 * derniere famille ayant ete ajoutee par le resultat negatif ci-dessous. Les
 * dix ajoutees sont nommees a chaque cran de ce tableau, donc les ecarts ne
 * bougent pas et le classement encore moins.)
 *
 * CE QUE LA TABLE DIT, et c'est la reponse a une question qui trainait depuis
 * trois passes.
 *
 * Passer de 20 a 30 achete 18 lignes de chat contre 15 lignes melangees nommees
 * a tort, et fait monter les erreurs de Tatoeba de 15 a 17. Ce n'est pas un bon
 * echange : une ligne melangee nommee, c'est soit un message efface pour "deja
 * dans ta langue" alors que la moitie ne l'est pas, soit une langue source
 * imposee au moteur qui ne couvre que la moitie du texte.
 *
 * Passer de 30 a 40 ne rapporte RIEN du tout sur le chat, 121 lignes et 69 % de
 * silence des deux cotes, et fait passer les melangees de 25 a 34. C'est une
 * perte seche, et c'est le resultat le plus net du tableau.
 *
 * Lever la borne entierement rapporte beaucoup sur Tatoeba, 2348 a 2587, et rien
 * de plus sur le chat. C'est exactement le piege que ce banc existe pour montrer:
 * le corpus de prose applaudit une decision que le registre reel paie.
 *
 * La borne reste donc a 20, et elle n'est plus une decision heritee de huit
 * lignes de mesure mais de cinquante.
 */

const SOUS_LA_BORNE = 20;
const nommees = LANG_MIXED.filter((t) => confidentLanguage(t) !== undefined);

describe('les lignes qui changent de langue', () => {
  // Le chiffre de reference. Il doit BAISSER, jamais monter.
  it('en nomme huit sur soixante, et c est le cout accepte du lexique', () => {
    // 10 avant la revue linguiste (2026-11-04) : `salut` et `hola` ne votent plus,
    // le roumain et le catalan les ecrivent aussi.
    expect(nommees.length).toBe(8);
  });

  // La preuve que c'est bien la borne qui fait le travail et pas autre chose :
  // toute ligne melangee nommee est une ligne courte. Aucune ligne longue ne
  // passe, parce que le lexique ne la regarde pas.
  it('ne nomme que des lignes sous la borne de vingt caracteres', () => {
    const longues = nommees.filter((t) => t.length > SOUS_LA_BORNE);
    expect(longues).toEqual([]);
  });

  // Les huit sont des salutations suivies d'un mot d'anglais de chat, le melange
  // le plus court et le plus frequent. C'est la limite connue du lexique : sur
  // `merci bro`, deux mots dont un francais, il n'y a pas de bonne reponse
  // evidente, et nommer le francais est defendable. Sur `merci bro that was
  // insane` il n'y en a plus, et c'est la borne qui l'empeche.
  it('nomme la salutation courte et rien de plus long', () => {
    expect(nommees).toEqual([
      'merci bro',
      'danke man',
      'gracias dude',
      'grazie mate',
      'tack man',
      'kiitos bro',
      'obrigado man',
      'ciao all',
    ]);
  });

  // Le cas qui a fixe la borne a l'origine, garde nommement : il doit rester
  // muet. Un lecteur francophone qui recoit cette ligne en `sl=fr` la perd.
  it('se tait sur la ligne qui a fixe la borne', () => {
    expect(confidentLanguage('merci bro that was insane')).toBeUndefined();
  });

  // Et la meme chose dans l'autre sens, anglais d'abord.
  it('se tait quand la langue etrangere arrive en fin de ligne', () => {
    expect(confidentLanguage('he is cracked bardzo dobrze')).toBeUndefined();
    expect(confidentLanguage('chat is going crazy que risa')).toBeUndefined();
  });

  // RESULTAT NEGATIF, ecrit ici pour que la meme idee ne soit pas retentee.
  //
  // La borne de longueur remplace de la CONFIANCE, donc une regle qui exige DEUX
  // mots du lexique s'accordant sur la meme langue devrait pouvoir s'en passer :
  // `merci bro that was insane` n'a qu'un mot francais, une vraie phrase
  // francaise en a plusieurs. Mesuree, elle donnait Tatoeba 2348 a 2382 justes
  // avec ses 15 erreurs inchangees, le chat 103 a 107, le chemin brut 932 a 925
  // erreurs, et seulement une ligne melangee de plus sur les cinquante d'alors.
  // Ces chiffres-la disaient oui.
  //
  // Elle a ete ECARTEE parce qu'un test qui existait deja disait non, et il
  // avait raison : `tamam kanka good game` porte DEUX mots turcs et deux mots
  // anglais. Un chat ecrit `tamam kanka`, `muchas gracias` et `vielen dank`
  // aussi naturellement qu'un mot seul, donc compter les mots ne separe pas une
  // phrase etrangere d'un fragment etrangier. Les dix lignes de cette famille
  // ont ete ajoutees au corpus apres coup : la regle les nommait toutes les dix.
  //
  // Une variante qui ecartait d'abord les mots "sociaux", salutations et
  // remerciements, sur l'idee qu'eux seuls se font code-switcher, a ete mesuree
  // aussi et l'idee est fausse : une vraie ligne melangee porte des mots de
  // structure dans sa moitie etrangere, `niet te geloven`, `bardzo dobrze`,
  // `vraiment dommage`. Elle faisait passer les melangees de 10 a 22.
  // L'anglais a une voix dans le lexique depuis, et ce banc est ce qui a permis
  // de le decider. Vingt-neuf des soixante lignes d'ici portent `that`, donc la
  // crainte etait qu'elles deviennent anglaises ; c'est l'inverse qui se passe.
  // Leur moitie etrangere vote pour sa langue, l'anglais vote pour la sienne,
  // les deux se contredisent et la ligne rend `undefined`. Le compte est reste a
  // dix, et ce sont exactement les memes dix.
  it('ne devient pas anglais quand l anglais entre dans le lexique', () => {
    expect(confidentLanguage('merci bro that was insane')).toBeUndefined();
    expect(confidentLanguage('gracias man that was sick')).toBeUndefined();
    expect(confidentLanguage('that was actually insane muito bom')).toBeUndefined();
  });

  it('reste muet sur deux mots etrangers suivis d anglais', () => {
    expect(confidentLanguage('tamam kanka good game')).toBeUndefined();
    expect(confidentLanguage('muchas gracias that was great')).toBeUndefined();
    expect(confidentLanguage('vielen dank that was huge')).toBeUndefined();
  });
});
