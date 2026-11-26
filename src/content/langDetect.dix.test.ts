import { describe, expect, it } from 'vitest';
import { confidentLanguage, detectLanguage } from './langDetect';
import { LANG_CHAT_DIX } from './langChatDixCorpus';

/**
 * Le banc des cinq langues majoritaires qui ne s'ecrivent pas en latin.
 *
 * Le produit traduit vers 42 langues et il en PARLE dix : son interface et sa
 * fiche de stores existent en en, ar, es, fr, ja, ko, pt, ru, tr et zh. Le banc
 * de detection construit une passe plus tot en couvrait cinq, et les cinq
 * absentes etaient exactement les non latines, si bien que tous les chiffres
 * publies sur la detection etaient des chiffres latins.
 *
 * Ce fichier est ici et pas dans un scratchpad ignore par git parce que c'est
 * exactement ce qui est arrive a la grille des 41 cas : mesuree, jamais
 * commitee, perdue, puis remesuree. Un fichier de tests ne pese rien dans le
 * bundle livre, `audit-poids` le verifie a chaque passe.
 *
 * La moitie non latine est decidee par l'ECRITURE et pas par franc, donc elle se
 * tient a un plancher net : vingt-cinq sur vingt-cinq. La moitie latine, decidee
 * par franc, vaut entre 1 sur 4 et 4 sur 5 selon la langue, et un plancher y
 * serait du bruit ; elle est couverte cas par cas dans `langDetect.test.ts`.
 */
const BANC = LANG_CHAT_DIX;

describe('les cinq langues majoritaires que l ecriture decide', () => {
  it.each(Object.keys(BANC))('lit %s sur vingt-cinq lignes de chat', (langue) => {
    const lignes = BANC[langue]!;
    expect(lignes).toHaveLength(25);
    const rates = lignes.filter((t) => detectLanguage(t) !== langue);
    expect(rates).toEqual([]);
  });

  // Ces quatre-la sortent d'une table, donc elles partent au moteur comme langue
  // source. C'est ce qui les separe du chinois juste en dessous.
  it.each(Object.keys(BANC))('declare %s comme langue source sure', (langue) => {
    const lignes = BANC[langue]!;
    const sansSl = lignes.filter((t) => confidentLanguage(t) !== langue);
    expect(sansSl).toEqual([]);
  });
});

/**
 * Le chinois est a part, et volontairement.
 *
 * `detectByScript` renvoie le han pur a franc plutot que de trancher, parce que
 * du han sans kana peut etre japonais. Consequence mesuree : 24 lignes sur 25
 * sont identifiees zh, et ZERO ne devient une langue source sure, la reponse
 * venant de franc et non d'une table. Les quatre langues ci-dessus sont a 25 sur
 * 25 sur les deux. L'asymetrie est une decision, ce test est la pour qu'elle
 * reste visible si quelqu'un touche a la regle du han.
 */
const CHINOIS = [
  '这是什么情况',
  '谢谢主播',
  '打得太好了',
  '有人在看吗',
  '声音太小了',
  '我第一次来',
  '这不可能吧',
  '太搞笑了',
  '想再看一遍',
  '中国人有吗',
  '画面卡住了',
  '加油你可以的',
  '今天玩得不错',
  '什么时候开始',
  '完全看不懂',
  '真的假的',
  '太厉害了',
  '我也这么觉得',
  '这局能赢',
  '你是哪里人',
  '谢谢分享',
  '好久不见',
  '别走啊',
  '我已经看了一个小时了',
];

describe('le chinois passe par franc, pas par la table', () => {
  it('est identifie sur chaque ligne', () => {
    expect(CHINOIS.filter((t) => detectLanguage(t) !== 'zh')).toEqual([]);
  });

  // Ce test disait "jamais une langue source sure", et ce n'est plus vrai
  // depuis que la regle d'ecriture separe simplifie et traditionnel. Le
  // changement est voulu : franc ne portait aucun modele pour le han, il rendait
  // `cmn` sur tout, et les 120 lignes traditionnelles du banc partaient en `zh`,
  // drapeau de la Chine compris, cent pour cent d'entre elles.
  //
  // Ce qui reste vrai et qui compte : une ligne n'est nommee que quand son
  // ecriture la nomme. 9 de ces 24 portent un caractere que seule l'ecriture
  // simplifiee emploie, les 15 autres sont ecrites avec ce que les deux
  // ecritures partagent et restent sans reponse.
  //
  // Elles etaient 7 jusqu'a ce qu'un corpus de chat non latin montre que le
  // chinois traditionnel tombait a 4 lignes sur 10 en registre court : 氣, 灣 et
  // 嗎 manquaient simplement aux deux listes. Les ajouter nomme deux lignes de
  // plus ici, et c'est le meme mouvement des deux cotes.
  //
  // Le prix a ete mesure au moteur reel avant d'etre accepte : sur quatre lignes
  // dont trois que la regle nomme maintenant, `sl=zh-TW` et `sl=auto` rendent
  // exactement la meme traduction. Annoncer l'ecriture ne coute rien.
  it('ne nomme que ce que son ecriture nomme', () => {
    const nommees = CHINOIS.filter((t) => confidentLanguage(t) !== undefined);
    expect(nommees).toHaveLength(8);
    expect([...new Set(CHINOIS.map((t) => confidentLanguage(t)))]).toEqual(['zh', undefined]);
  });

  // Le prix du renvoi a franc : sous trois caracteres han, plus personne ne
  // repond. Deux caracteres est une phrase entiere en chinois.
  it('et se tait sous trois caracteres', () => {
    expect(detectLanguage('稳了')).toBeUndefined();
  });
});
