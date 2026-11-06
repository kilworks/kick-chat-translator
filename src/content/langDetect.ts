import { franc } from 'franc-min';
import { francToIso2, isSupportedLang, normalizeLang } from '~/shared/languages';
import { isLaughter, laughterLanguage } from '~/shared/laughter';
import { isArabizi } from '~/shared/arabizi';
import { romanisedLanguage } from '~/shared/romanised';

const COMMON_SHORT_TOKENS = new Set([
  'lol',
  'lmao',
  'lmfao',
  'omg',
  'wtf',
  'gg',
  'ggs',
  'ez',
  'wp',
  'kek',
  'rip',
  'bruh',
  'bro',
  'sus',
  'yo',
  'hi',
  'hey',
  'haha',
  'yes',
  // pas `no` : espagnol, italien et portugais l'ecrivent pareil (`no no no no`).
  'ok',
  'okay',
  'nice',
  'good',
  'bad',
  'pog',
  'pogchamp',
  'kappa',
  'omegalul',
  'monkas',
]);

/**
 * Chat words that identify their language on their own.
 *
 * franc is unreliable below ~20 characters: it returns 'und', the ASCII check
 * below then calls the message English, and `ignoreEnglish` silently drops it.
 * A short foreign message is therefore the case most likely to be missed, so
 * these words are checked first. Entries must be unambiguous against common
 * English and against each other, which is why near-twins across Spanish and
 * Portuguese ("gente", "vamos", "cara") are deliberately absent.
 *
 * La table a d'abord ete faite de salutations et de politesse, hola, merci,
 * danke, grazie, obrigado. C'est ce qu'on ecrit en pensant a du chat, et ce
 * n'est pas ce qu'un message quelconque contient. Mesure de ce que ca coutait :
 * sur onze lignes que la detection ne savait pas nommer, la moitie etait du
 * portugais et du turc ordinaires, "nao acredito nisso", "vamos ganhar essa",
 * "ne oluyor burada", sans un seul mot de la table. Un lecteur qui restreint ses
 * sources a `pt` perdait alors la moitie de son portugais, et pareil en turc.
 *
 * Le second jeu d'entrees est donc fait de mots de STRUCTURE, ceux qui reviennent
 * dans n'importe quelle phrase. Ils suivent la meme regle et c'est elle qui
 * decide des paires es/pt, ou l'orthographe separe nettement : nao contre no,
 * hoje contre hoy, agora contre ahora, pode contre puede, estao contre estan,
 * essa contre esa.
 */
const SHORT_WORD_LANG = new Map<string, string>([
  // pas `hola` ni `hostia` : le catalan les ecrit (`hola a tots`, `hòstia` sans accent).
  // pas `vale` : le portugais `vale a pena`, l italien `vale`.
  ['gracias', 'es'], ['buenas', 'es'], ['buenos', 'es'], ['adios', 'es'],
  ['adiós', 'es'], ['venga', 'es'], ['joder', 'es'], ['oye', 'es'],
  ['chaval', 'es'], ['mucho', 'es'], ['muchas', 'es'], ['siempre', 'es'],
  // Les mots rioplatenses de la table exclusive, ici aussi : sans eux `che boludo`
  // se taisait la-bas puis sortait italien ici par `che`.
  ['boludo', 'es'], ['boluda', 'es'], ['pibe', 'es'], ['piba', 'es'], ['laburo', 'es'],
  ['entonces', 'es'], ['también', 'es'], ['tambien', 'es'], ['ahora', 'es'],

  // pas `salut` : c'est le bonjour roumain (`salut frate`) et la sante catalane.
  ['bonjour', 'fr'], ['bonsoir', 'fr'], ['merci', 'fr'], ['oui', 'fr'],
  ['ouais', 'fr'], ['voilà', 'fr'], ['voila', 'fr'], ['putain', 'fr'],
  // mdr et ptdr sont des rires et vivent dans `laughter.ts` : ici ils votaient
  // fr meme a cote de mots d'une autre langue (`mdr der typ`).
  ['quoi', 'fr'], ['alors', 'fr'], ['toujours', 'fr'], ['jamais', 'fr'],
  ['beaucoup', 'fr'], ['très', 'fr'], ['pourquoi', 'fr'], ['enfin', 'fr'],

  // `mano` a ete retire de cette ligne. C'est du portugais bresilien courant et
  // il mesurait propre quand il est entre, mais le crible le donne aujourd'hui a
  // lt=10, es=2, it=2, pt=1 : le lituanien l'ecrit DIX FOIS PLUS que le
  // portugais, `mano` y voulant dire "mon". Mesure de son retrait : zero ligne
  // juste perdue, sur aucun des huit bancs, et DEUX erreurs en moins,
  // `lt -> pt` et `es -> pt`. Le compteur d'erreurs du chemin sur passe de 15 a
  // 13, et c'est la premiere fois qu'il bouge depuis la table des portes.
  //
  // La table des lettres exclusives, lue avant le lexique depuis `528c3af`,
  // sauvait deja les lignes lituaniennes portant un `ė`. Celles qui n'en
  // portent pas tombaient toujours.
  ['obrigado', 'pt'], ['obrigada', 'pt'], ['valeu', 'pt'], ['saudade', 'pt'],
  ['você', 'pt'], ['voce', 'pt'], ['então', 'pt'], ['entao', 'pt'], ['muito', 'pt'],
  ['muita', 'pt'], ['beleza', 'pt'], ['caralho', 'pt'], ['porra', 'pt'], ['rapaz', 'pt'],
  ['também', 'pt'], ['tambem', 'pt'],

  // pas `hallo` : neerlandais, danois et norvegien l'ecrivent. pas `gerne` : danois.
  ['danke', 'de'], ['tschüss', 'de'], ['bitte', 'de'], ['nicht', 'de'],
  ['doch', 'de'], ['geil', 'de'], ['krass', 'de'], ['vielen', 'de'],
  ['wirklich', 'de'], ['natürlich', 'de'], ['warum', 'de'], ['weil', 'de'], ['aber', 'de'],
  ['immer', 'de'], ['nein', 'de'],

  ['ciao', 'it'], ['grazie', 'it'], ['prego', 'it'], ['allora', 'it'], ['perché', 'it'],
  ['perche', 'it'], ['però', 'it'], ['quindi', 'it'], ['davvero', 'it'], ['ragazzi', 'it'],
  ['cazzo', 'it'], ['magari', 'it'], ['comunque', 'it'], ['anche', 'it'], ['adesso', 'it'],
  ['oggi', 'it'],

  ['selam', 'tr'], ['merhaba', 'tr'], ['tamam', 'tr'], ['güzel', 'tr'], ['guzel', 'tr'],
  ['kanka', 'tr'], ['tesekkur', 'tr'], ['evet', 'tr'],   ['hayir', 'tr'], 
  // Mots de structure. Meme regle que ci-dessus : chacun est separe de son
  // jumeau dans l'autre langue par l'orthographe, pas par le contexte.
  ['hace', 'es'], ['alguien', 'es'], ['puede', 'es'], ['estan', 'es'], ['están', 'es'],
  ['nadie', 'es'], ['eso', 'es'], ['esa', 'es'],

  ['nao', 'pt'], ['não', 'pt'], ['hoje', 'pt'], ['agora', 'pt'], ['pode', 'pt'],
  ['estao', 'pt'], ['estão', 'pt'], ['essa', 'pt'], ['esse', 'pt'], ['isso', 'pt'],
  ['alguem', 'pt'], ['alguém', 'pt'],

  ['vraiment', 'fr'], ['rien', 'fr'], ['mec', 'fr'],

  ['jemand', 'de'], ['denn', 'de'], ['ist', 'de'],

  ['qualcuno', 'it'], ['questo', 'it'], ['bene', 'it'],

  ['burada', 'tr'], ['oluyor', 'tr'], ['bir', 'tr'], ['için', 'tr'], ['icin', 'tr'],
  ['degil', 'tr'],

  // L'ANGLAIS, et il est entre en dernier parce qu'il est le cas particulier.
  //
  // Ajouter l'anglais a cette table ne change pas seulement une detection, ca
  // change ce que `ignoreEnglish` EFFACE : une ligne nommee `en` pour un lecteur
  // anglophone disparait. C'est correct quand la ligne est vraiment anglaise, et
  // c'est pour ca que chaque entree est un mot que l'anglais seul ecrit, mesure
  // sur les 5490 lignes des trois corpus.
  //
  // Le vote unanime fait ici un travail qu'il ne fait nulle part ailleurs. Vingt
  // -neuf des soixante lignes melangees portent `that`, et elles ne deviennent
  // pas anglaises pour autant : leur moitie etrangere vote pour sa langue, les
  // deux votes se contredisent et la ligne rend `undefined`. Mesure : les lignes
  // melangees nommees restent a dix, exactement les memes. Donner une voix a
  // l'anglais rend le detecteur PLUS silencieux sur le melange, pas moins.
  //
  // DEHORS : `what` prend une ligne slovaque, `have` trois danoises, `was` huit
  // allemandes et trois neerlandaises, `like` trois norvegiennes, `just` quatre
  // langues, `been` une allemande, `which` une japonaise. `stream` et `chat`
  // sont dans toutes les langues du corpus de chat, ce qui est exactement ce
  // qu'on attend d'un mot de jargon de plateforme.
  ['you', 'en'], ['that', 'en'], ['this', 'en'], ['with', 'en'], ['they', 'en'],
  ['about', 'en'], ['there', 'en'], ['were', 'en'], ['would', 'en'], ['could', 'en'],
  ['should', 'en'], ['because', 'en'], ['something', 'en'], ['everyone', 'en'],
  ['nothing', 'en'], ['really', 'en'], ['watching', 'en'],

  // Une troisieme couche de lexique, et elle vise le SILENCE plutot que les
  // langues sans regle : les lignes de chat qui ne portent aucun marqueur et ne
  // sont que des phrases ordinaires. `il est trop fort`, `wat gebeurt er nou`,
  // `mi folyik itt` n'ont ni lettre propre ni terminaison propre.
  //
  // Les mots sont choisis pour leur frequence dans la langue, pas dans le corpus
  // de chat, et c'est la precaution qui compte : ce corpus est ecrit par ce
  // projet, donc y prendre des mots puis y mesurer le gain ne mesurerait rien.
  // TATOEBA, lui, est independant et emploie les memes mots outils, donc c'est
  // son chiffre qui fait foi ici.
  //
  // DEHORS : `dans` est la danse en norvegien, `viens` est `un` en letton, `sa`
  // est tagalog sur 33 lignes, `kan` couvre cinq langues, `deje` est un
  // subjonctif espagnol, `volumen` est allemand, `vad` est `sauvage` en hongrois,
  // `godt` est norvegien autant que danois, `mis` est espagnol, `ingen` couvre
  // les trois scandinaves. `vamos` et `creo` mesurent propres sur les deux
  // corpus mais apparaissent sur le banc MELANGE, ce qui suffit a les ecarter.
  ['est', 'fr'], ['trop', 'fr'], ['chez', 'fr'], ['avec', 'fr'], ['sont', 'fr'],
  ['fait', 'fr'], ['comme', 'fr'],
  // pas `wat` : c'est le `what` du chat anglais (`wat lol`). `gebeurt` le remplace
  // dans la phrase qui l'avait fait entrer, `wat gebeurt er nou`.
  ['gebeurt', 'nl'], ['het', 'nl'], ['een', 'nl'], ['nou', 'nl'], ['zet', 'nl'],
  ['goed', 'nl'], ['maar', 'nl'], ['ook', 'nl'], ['voor', 'nl'], ['gaat', 'nl'],
  ['deze', 'nl'],
  ['här', 'sv'], ['hur', 'sv'], ['hon', 'sv'], ['ska', 'sv'], ['vill', 'sv'],
  ['riktigt', 'sv'],
  ['čo', 'sk'], ['keď', 'sk'],
  ['opp', 'no'], ['nettopp', 'no'], ['litt', 'no'],
  ['folyik', 'hu'], ['valaki', 'hu'], ['hangot', 'hu'], ['csak', 'hu'], ['hogy', 'hu'],
  ['siin', 'et'], ['toimub', 'et'], ['keegi', 'et'], ['täna', 'et'], ['kuidas', 'et'],
  ['täällä', 'fi'], ['tapahtuu', 'fi'], ['onko', 'fi'], ['ketään', 'fi'], ['paljon', 'fi'],
  // pas `sker` : le suedois l'ecrit (`vad sker`).
  ['nogen', 'da'], ['rigtig', 'da'],
  ['qué', 'es'], ['pasando', 'es'], ['sube', 'es'], ['esto', 'es'], ['increíble', 'es'],
  ['che', 'it'], ['facendo', 'it'], ['alza', 'it'], ['giocando', 'it'], ['appena', 'it'],
  ['arrivato', 'it'], ['sfortuna', 'it'], ['manca', 'it'], ['niente', 'it'], ['vede', 'it'],
  ['întâmplă', 'ro'], ['cineva', 'ro'], ['joacă', 'ro'], ['tocmai', 'ro'], ['intrat', 'ro'],
  ['cred', 'ro'], ['blochează', 'ro'], ['durează', 'ro'],

  // Les vingt langues latines que la table ne couvrait pas. Le lexique etait la
  // seule chose capable de servir un chat latin et il ne parlait que six langues
  // sur vingt-six ; c'est ce que le banc de chat a rendu impossible a ignorer.
  //
  // Meme regle que ci-dessus et meme discipline que MOTS_RUSSES : chaque entree
  // est la parce que les langues concurrentes ecrivent AUTRE CHOSE, et la mesure
  // ne fait qu'opposer un veto. Criblees contre les 5040 lignes de Tatoeba ET
  // les 390 lignes de chat, 5430 au total, zero occurrence ailleurs exigee.
  //
  // Les variantes sans diacritiques sont la exprès. Un chat sur telephone ecrit
  // `czesc`, `vielä` devient `viela`, `mulțumesc` devient `multumesc` ; sans
  // elles la table ne sert que la moitie des gens qui ecrivent ces langues.
  //
  // CE QUE LE CRIBLE A REJETE, et il a bien travaille :
  //   mig dig sig  proposes pour le danois, ce sont des mots SUEDOIS, 9, 2 et 7
  //                lignes. Ils ne servent que derriere la porte ø/æ, qui a deja
  //                exclu le suedois, et c'est exactement pourquoi la regle de
  //                paire existe.
  //   meg   propose pour le norvegien : NEUF lignes hongroises.
  //   som   propose pour le slovaque : danois, norvegien et suedois.
  //   ako   propose pour le tagalog : slovaque, 5 lignes.  aqui : portugais.
  //   tak   danois, mais aussi tcheque, polonais et malais.  moi : francais.
  //   este  roumain, mais aussi espagnol et portugais.  nic : tcheque.
  //
  // CE QUE LA MESURE A LAISSE PASSER ET QUI SORT QUAND MEME, protocole 4.6 du
  // handoff : 120 lignes ne prouvent pas une absence.
  //   echt  mesure propre, c'est de l'allemand courant.
  //   heel  mesure propre, c'est de l'anglais.   tots  pareil.
  //   nem   mesure propre pour le hongrois, c'est du portugais courant.
  //   qua   mesure propre pour le vietnamien, c'est de l'italien.
  //   roi   idem, c'est du francais.   chao : espagnol.   dito : italien.
  //   kdo   propose pour le slovene, c'est du tcheque.
  //   sveiki  propose pour le letton, c'est aussi du lituanien.
  //   vel   propose pour le lituanien, c'est du danois et du norvegien.
  //   deg seg  propres a la mesure, ce sont des mots suedois. Ils restent dans
  //            la regle de paire et n'entrent pas ici.
  //   hvorfor  danois ET norvegien, donc il ne nomme ni l'un ni l'autre.
  //   cam on   deux mots : cette table est indexee par TOKEN, une entree a
  //            espace ne peut jamais correspondre. Piege a ne pas reintroduire.
  ['niet', 'nl'], ['gewoon', 'nl'], ['niks', 'nl'], ['altijd', 'nl'], ['iemand', 'nl'],
  ['waarom', 'nl'], ['zie', 'nl'], ['wel', 'nl'],

  ['och', 'sv'], ['inte', 'sv'], ['mycket', 'sv'], ['tack', 'sv'], ['varfor', 'sv'],
  ['varför', 'sv'], ['nagon', 'sv'], ['någon', 'sv'], ['aldrig', 'sv'],

  ['hvad', 'da'], ['meget', 'da'], ['altid', 'da'], ['noget', 'da'],

  ['hva', 'no'], ['mye', 'no'], ['veldig', 'no'], ['takk', 'no'], ['noen', 'no'],

  ['kiitos', 'fi'], ['tosi', 'fi'], ['viela', 'fi'], ['vielä', 'fi'], ['miksi', 'fi'],
  ['kaikki', 'fi'], ['mutta', 'fi'], ['mita', 'fi'], ['mitä', 'fi'],

  ['aitah', 'et'], ['aitäh', 'et'], ['väga', 'et'], ['tere', 'et'], ['miks', 'et'],
  ['jalle', 'et'], ['jälle', 'et'], ['praegu', 'et'], ['midagi', 'et'],

  ['bardzo', 'pl'], ['dzieki', 'pl'], ['dzięki', 'pl'], ['czesc', 'pl'],   ['jeszcze', 'pl'], ['wszystko', 'pl'], ['dlaczego', 'pl'], ['ktos', 'pl'], 
  ['jsem', 'cs'], ['neni', 'cs'], ['není', 'cs'], ['dekuju', 'cs'],   ['jeste', 'cs'], ['vzdycky', 'cs'], ['vždycky', 'cs'],
  // pas `proc` sans hacek : c'est le jargon de jeu anglais (`did it proc`).
  ['proč', 'cs'],

  // pas `vždy` : le tcheque l'ecrit aussi.
  ['dakujem', 'sk'], ['ďakujem', 'sk'], ['ešte', 'sk'], ['preco', 'sk'],
  ['prečo', 'sk'],

  ['foarte', 'ro'], ['multumesc', 'ro'], ['acum', 'ro'], ['nimic', 'ro'],
  ['cand', 'ro'], ['când', 'ro'], ['iarasi', 'ro'], ['bine', 'ro'],

  ['khong', 'vi'], ['không', 'vi'], ['duoc', 'vi'], ['được', 'vi'], ['rồi', 'vi'],
  ['quá', 'vi'],

  ['banget', 'id'], ['gak', 'id'], ['nggak', 'id'], ['gimana', 'id'], ['udah', 'id'],
  ['aja', 'id'], ['nih', 'id'], ['dong', 'id'], ['sih', 'id'],

  // pas `betul` ni `memang` : l'indonesien les ecrit tous les jours.
  ['macam', 'ms'], ['sikit', 'ms'], ['tengok', 'ms'], ['awak', 'ms'],
  ['jugak', 'ms'], ['nak', 'ms'],

  ['nagyon', 'hu'], ['koszi', 'hu'], ['köszi', 'hu'], ['szia', 'hu'], ['miert', 'hu'],
  ['miért', 'hu'], ['mindig', 'hu'], ['megint', 'hu'], ['semmi', 'hu'],

  ['molt', 'ca'], ['aixo', 'ca'], ['això', 'ca'], ['perque', 'ca'], ['perquè', 'ca'],
  ['amb', 'ca'], ['gracies', 'ca'], ['gràcies', 'ca'],
  ['són', 'ca'], ['què', 'ca'], ['més', 'ca'], ['també', 'ca'],
  ['aquest', 'ca'], ['aquesta', 'ca'], ['aquests', 'ca'], ['dels', 'ca'], ['avui', 'ca'],
  ['ahir', 'ca'], ['demà', 'ca'], ['seva', 'ca'], ['meva', 'ca'],
  ['nosaltres', 'ca'], ['vosaltres', 'ca'], ['tothom', 'ca'], ['ningú', 'ca'], ['ningu', 'ca'], ['tambe', 'ca'], ['gaire', 'ca'],

  ['zelo', 'sl'], ['hvala', 'sl'], ['zakaj', 'sl'], ['spet', 'sl'], ['tukaj', 'sl'],
  ['kaj', 'sl'], ['lahko', 'sl'], ['nekaj', 'sl'], ['ampak', 'sl'], ['nisem', 'sl'],
  ['kdaj', 'sl'], ['prav', 'sl'], ['tudi', 'sl'], ['ker', 'sl'], ['zdaj', 'sl'],
  // pas `vse` : le russe en lettres latines et le tcheque sans hacek l'ecrivent.
  ['saj', 'sl'], ['sva', 'sl'], ['bova', 'sl'],
  ['vedno', 'sl'], ['danes', 'sl'],

  ['labai', 'lt'], ['aciu', 'lt'], ['ačiū', 'lt'], ['labas', 'lt'], ['kodel', 'lt'],
  ['nieko', 'lt'], ['dabar', 'lt'], ['visada', 'lt'],

  ['loti', 'lv'], ['paldies', 'lv'], ['kapec', 'lv'],   ['tagad', 'lv'], ['vienmer', 'lv'], ['atkal', 'lv'],

  ['ang', 'tl'], ['naman', 'tl'], ['mga', 'tl'], ['siya', 'tl'], ['talaga', 'tl'], ['salamat', 'tl'], ['grabe', 'tl'],
  ['sobrang', 'tl'], ['yan', 'tl'], ['wala', 'tl'],

  // Quatrieme couche, meme methode, meme crible. Les rejets de ce tour :
  // `igen` est suedois sur quatre lignes, `ingenting` aussi, `taas` est
  // estonien, `zvuk` est tcheque autant que slovaque. `happened` et `crazy`
  // mesurent propres sur les deux corpus et apparaissent sur le banc MELANGE.
  // Les mots proprement malais, `tiada teruk nampak berlaku`, ne sont PAS ici :
  // ils vont dans la porte malais-indonesien, ou ils ne risquent pas de voler
  // une ligne indonesienne, parce que l'indonesien emploie certains d'entre eux.
  // pas `prave` ni `vyborne` : le tcheque `právě`, `výborně` sans accents. pas `hra` :
  // le jeu en tcheque.
  ['niekto', 'sk'], ['práve', 'sk'], ['výborne', 'sk'],
  ['hrá', 'sk'],
  ['endnu', 'da'], ['elendigt', 'da'],
  ['believe', 'en'], ['anyone', 'en'], ['today', 'en'],
  ['noch', 'de'], ['wieder', 'de'], ['keine', 'de'], ['gerade', 'de'],
  ['hoe', 'nl'], ['nog', 'nl'], ['geen', 'nl'], ['zijn', 'nl'], ['heeft', 'nl'],
  ['keer', 'nl'], ['vandaag', 'nl'],
  ['tänään', 'fi'], ['tanaan', 'fi'], ['hyvin', 'fi'], ['mikä', 'fi'], ['mika', 'fi'],
  ['mitään', 'fi'], ['mitaan', 'fi'],
  ['igjen', 'no'], ['lenge', 'no'], ['sjanse', 'no'],
]);

/**
 * Longest message still treated as "short" for detection purposes.
 *
 * Monte a 30, mesure, et redescendu. Le gain etait reel : sur 13 lignes
 * etrangeres de 23 a 31 caracteres portant un mot de la table, 10 lues juste a
 * 20 et 12 a 30, et sur 8 lignes anglaises portant elles aussi un mot de la
 * table le degat restait a 2, un veto sur un `eng` explicite de franc payant
 * l'ecart. Ce que ce banc-la ne pouvait pas voir, c'est le message qui change de
 * langue en cours de route. Sur 8 lignes melangees, passer de 20 a 30 fait
 * passer les lignes tuees avant l'appel de 3 a 6 et les `sl` declares sur une
 * seule moitie de 0 a 4 : "merci bro that was insane" part alors au moteur en
 * `sl=fr` et disparait pour un lecteur francophone. Le veto ne rattrape rien la,
 * franc ne rend `eng` sur aucune des 8.
 *
 * La borne tient donc a 20 parce que le melange de langues est plus frequent
 * dans un chat que la phrase etrangere de 25 caracteres, pas parce que 20 aurait
 * ete mesure comme optimal.
 */
const SHORT_TEXT_MAX = 20;

/** Mots que seul l'anglais ecrit ainsi ; les jetons de chat universels (gg, ez,
 * lol, bro) n'y sont pas, ils ne disent rien de la phrase. */
/** `the` ou une entree anglaise du lexique : des mots qu'aucune des 42 autres
 * n'ecrit, contrairement a `is` (neerlandais, hongrois) ou `we` (neerlandais). */
function porteUnMotAnglais(text: string): boolean {
  return text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .some((t) => t === 'the' || SHORT_WORD_LANG.get(t) === 'en');
}

const ANGLAIS_AUTOUR_DU_RIRE = new Set([
  'way', 'what', 'that', 'the', 'this', 'you', 'your', 'she', 'they', 'we',
  'lets', 'guys', 'dude', 'why', 'how', 'yeah', 'yep', 'are', 'not', 'dont',
  'cant', 'just', 'like', 'really', 'damn', 'insane', 'crazy', 'and', 'but',
  'with', 'of', 'it', 'is', 'wait', 'look', 'funny',
]);
// Dehors parce qu'une langue a rire les ecrit aussi : he (espagnol), am, im, was
// (allemand), nah (indonesien), wow (partout).

/** Unanimous vote from the lexicon, or undefined when the words disagree. */
function detectByShortWords(text: string, rireMalgreInconnus = false): string | undefined {
  let vote: string | undefined;
  const tokens = text.toLowerCase().split(/[^\p{L}]+/u);
  // Un rire ne vote plus quand la phrase autour est anglaise : `kkkk no way bro`
  // sortait `pt` et `wkwkwk what` `id`, donc sl faux pour tous et la ligne sautee
  // pour le lecteur bresilien ou indonesien. Seul le vote du rire tombe : un mot
  // de la table vote toujours.
  const anglais = tokens.some((t) => ANGLAIS_AUTOUR_DU_RIRE.has(t));
  // Meme chose pour tout mot que la table ne connait pas : le rire est une
  // habitude de clavier, pas une langue, et `kkkk was zum` ou `jajaja helal`
  // sortaient pt et es. Il ne vote donc que seul ou a cote de mots de la table.
  const inconnu = tokens.some((t) => t && !SHORT_WORD_LANG.has(t) && !isLaughter(t));
  for (const token of tokens) {
    // Une forme de rire est un fait sur le texte au meme titre qu'un mot de la
    // table : `jajaja` est espagnol, `kkkk` bresilien, `wkwk` indonesien. C'est
    // ce qui permet a `confidentLanguage` de s'en servir, alors qu'il refuse la
    // reponse de franc. `haha`, `lol` et `xd` ne marquent rien et ne votent pas.
    const lang = token
      ? (SHORT_WORD_LANG.get(token) ?? (anglais || (inconnu && !rireMalgreInconnus) ? undefined : laughterLanguage(token)))
      : undefined;
    if (!lang) continue;
    if (vote && vote !== lang) return undefined;
    vote = lang;
  }
  return vote;
}

/**
 * Une lettre qu'une seule des 43 ecrit vaut une ecriture entiere.
 *
 * Le pre-controle d'ecriture ne sert que les alphabets complets, donc les 27
 * langues latines n'avaient pour tout recours que franc, dont `confidentLanguage`
 * refuse la reponse. Mais une LETTRE qu'une seule langue de la liste emploie
 * identifie cette langue aussi surement qu'une ecriture entiere, et c'est une
 * recherche et non une statistique : sa place est donc sur le chemin sur.
 *
 * S'applique a toute longueur, contrairement au lexique de mots courts borne a
 * 20 caracteres, et passe AVANT lui. L'ordre est mesure et non suppose, le
 * detail est sur l'appel dans `detectByLookup`.
 *
 * CE QUI EST DEHORS, et c'est la moitie du travail. Une lettre partagee par deux
 * langues de la liste ne prouve rien :
 *   ä    allemand, suedois, finnois, estonien, slovaque.
 *   ô    francais autant que slovaque.  õ  portugais autant qu'estonien.
 *   ą ę  polonais autant que lituanien : MESURE, 20 et 6 lignes lituaniennes.
 *   ø æ  danois ET norvegien, donc ils separent du suedois sans separer les deux
 *        l'un de l'autre. Il leur faut du lexique.
 *   c s z a carons  tcheque, slovaque, slovene, croate.  ö ü  une demi-douzaine.
 *
 * Le polonais ne prend PAS ł, et c'est la seule correction que le banc a imposee
 * a la table telle qu'elle avait ete concue. La lettre est bien polonaise seule,
 * mais elle voyage dans les noms propres : une ligne slovaque du corpus parle
 * des enfants de Łazarz, ne porte aucune lettre slovaque exclusive, et le vote
 * ci-dessous ne la sauve donc pas. Un nom propre n'est pas un fait sur la langue
 * de la phrase. Le remplacement mesure fait mieux des deux cotes : żźćśń prend
 * 70 lignes polonaises contre 48 pour ł, et zero ailleurs.
 *
 * Le turc `ı` est le i sans point U+0131 et non le i ordinaire ; verifie, `/ı/iu`
 * ne rend vrai ni sur `I` ni sur `i`, donc le drapeau `i` est sans danger ici et
 * il rattrape `Ğ`. Le roumain s'ecrit ici avec la virgule souscrite U+0219 et
 * U+021B, distincte de la cedille turque, donc les deux jeux ne se croisent pas.
 * Le catalan s'identifie par le point volat `l·l`, une sequence et non une lettre.
 *
 * QUATRE LANGUES ONT ETE AJOUTEES UNE PASSE PLUS TARD, et le fait qu'elles
 * aient ete oubliees est plus instructif que leur gain. La table avait ete
 * concue en cherchant les diacritiques exotiques, ceux qu'on remarque, et elle
 * avait saute les plus ordinaires parce qu'ils sont familiers :
 *   ñ  espagnol. Aucune autre des 43 ne l'ecrit, le catalan dit ny et le
 *      portugais nh. RESERVE ecrite : le tagalog l'admet officiellement dans
 *      les emprunts espagnols et les noms propres. Zero ligne mesuree sur les
 *      deux corpus, mais c'est la seule entree de cette table dont
 *      l'exclusivite repose sur un usage et non sur un alphabet.
 *   ß  allemand seul.      œ û  francais seuls.
 *   ā ē ī  letton, et ce sont les plus gros du lot : 72, 45 et 52 lignes sur
 *      120, contre 33 pour le jeu ģķļņ qui etait deja la. La langue la moins
 *      bien servie de la table l'etait parce qu'on avait pris ses lettres rares
 *      et laisse ses lettres frequentes.
 * `ū` reste dehors, le lituanien l'ecrit aussi, onze lignes.
 *
 * Ces quatre-la ont vide la liste des langues que le chemin sur ne sait jamais
 * nommer : vingt-six au depart de ce chantier, zero depuis. Chercher ce qui
 * manque dans une table vaut mieux que raffiner ce qui y est deja.
 *
 * `da fi no sl et` n'ont aucune lettre exclusive et ne sont pas dans la table :
 * ils attendent du lexique.
 */
const LETTRES_EXCLUSIVES: ReadonlyArray<readonly [RegExp, string]> = [
  [/[řěů]/iu, 'cs'],
  [/[ľĺŕ]/iu, 'sk'],
  [/[żźćśń]/iu, 'pl'],
  [/[őű]/iu, 'hu'],
  // La plus protectrice du fichier, et c'est l'ablation qui l'a montre : la
  // retirer coute 42 lignes justes sur Tatoeba ET ajoute une erreur, `lt -> pt`
  // passe de 1 a 2 et `Ar ji mano draugė?` part au portugais. Une regle qui
  // empeche une faute en plus d'en gagner quarante-deux.
  [/[ėįų]/iu, 'lt'],
  [/[ģķļņāēī]/iu, 'lv'],
  // Le s cedille U+015F est turc et rien d'autre dans les 43 : le roumain ecrit
  // sa propre lettre avec la virgule souscrite U+0219, juste en dessous, et le
  // crible ne trouve pas UNE ligne roumaine qui porte la forme turque. 53 lignes
  // gratuites qui attendaient dans la table depuis le debut.
  // Les claviers roumains anciens ecrivent encore les lettres a cedille, `aşa`,
  // `mulţumesc`, et `aşa este` partait au turc. Le turc n'ecrit jamais `ţ`, qui
  // rejoint le roumain ; `ş` reste turc, et les mots roumains qui le portent votent
  // roumain pour que la ligne se taise. Sortir `ş` du jeu coutait 7 lignes Tatoeba
  // et 5 de chat turques, pour rien de plus juste.
  [/[ığş]/iu, 'tr'],
  [/[șțţ]/iu, 'ro'],
  [/(^|[^\p{L}])(şi|aşa|ştiu|ştii|aştept)([^\p{L}]|$)/iu, 'ro'],
  [/l·l/iu, 'ca'],
  // Le vietnamien empile un ton sur une voyelle qui porte deja un accent, et
  // Unicode precompose le resultat. Aucune des 42 autres n'ecrit ces caracteres,
  // et la table n'en avait que trois. Le crible en a rendu trente-deux de plus,
  // sur 437 lignes des quatre corpus.
  //
  // DEHORS : `ù`, que l'italien ecrit dans `piu`. C'est le seul de la liste que
  // le crible signale partage, et c'est exactement le genre de caractere qu'une
  // relecture a l'oeil aurait laisse entrer.
  [
    /[ơưđạấốếờủảợậệớộắữởểịầừặũềựẽọứụỏửổẹằ]/iu,
    'vi',
  ],
  [/ñ/iu, 'es'],
  [/ß/iu, 'de'],
  [/[œû]/iu, 'fr'],
  // Trois SEQUENCES et non des lettres, comme le point volat catalan plus haut.
  // Elles servent les langues qui n'ont aucune lettre a elles : le finnois
  // double son y la ou l'estonien n'en a pas du tout, l'estonien double son o
  // barre la ou le finnois ecrit yö, et la terminaison portugaise -ção n'existe
  // nulle part ailleurs dans les 43.
  // Jamais apres a ni e : l'harmonie vocalique interdit `ayy` au finnois et il
  // n'ecrit pas `eyy`, alors que l'anglais etire ainsi heyy, okayy, yayy.
  // En fin de mot, seulement derriere une voyelle anterieure deja dans le mot
  // (`löytyy`, `näkyy`, `pysyy`) ou dans `syy` et `myy` : l'anglais etire aussi
  // `whyy`, `guyy`, `babyy`, et l'harmonie vocalique finnoise l'en separe.
  [/(?<![ae])yy(?!([^\p{L}]|$))|[äöy]\p{L}*yy([^\p{L}]|$)|(^|[^\p{L}])(syy|myy)([^\p{L}]|$)/iu, 'fi'],
  // L'harmonie vocalique finnoise : le finnois met un ä dans ses terminaisons la
  // ou l'estonien ne le fait pas, et aucune autre des 43 n'a ces suites en fin
  // de mot. C'est de la morphologie et non du lexique, donc ca porte sur
  // n'importe quelle phrase et pas seulement sur celles qui emploient un mot
  // connu, ce qui est exactement ce qui manque a une langue agglutinante.
  // DEHORS : -ään prend une ligne estonienne, -nud et -maks proposes pour
  // l'estonien en prennent une turque et une finnoise.
  [/(ssä|llä|ttä|vät|istä)([^\p{L}]|$)/iu, 'fi'],
  [/öö/iu, 'et'],
  // `ção` a ete elargi en `ão`, et `cê` et `ía` l'ont rejoint. Les trois sortent
  // du crible a sequences interroge PAR PAIRE, `porte-candidats.mjs es+pt`, qui
  // demande ce qu'une langue ecrit et que l'autre n'ecrit jamais.
  //
  // Mesure sur les quatre corpus, et le "aucune" est sur les QUARANTE-TROIS
  // langues, pas seulement sur la paire :
  //   ão   pt=31, aucune autre langue      (`ção` n'en voyait qu'une partie)
  //   cê   pt=16, aucune autre             (`você`, `cê`)
  //   ía   es=10, aucune autre             (l'imparfait et le conditionnel)
  //
  // DEHORS : `más` es=10 mais hu=2, `qué` es=14 mais fr=1, `él` es=10 mais
  // fr=4 et hu=13. `nh` et `lh` portugais sont a vi=61 et sk=2.
  [/ão/iu, 'pt'],
  [/ía/iu, 'es'],
  // ET CINQ AUTRES du meme crible, dont TROIS EN ASCII PUR, ce qui est rare et
  // precieux : elles repondent encore quand le clavier a mange les diacritiques,
  // la ou toutes les regles a lettre se taisent.
  //   cz   pl=38, aucune autre langue. Le tcheque ecrit `č`, pas `cz`.
  //   prz  pl=20, aucune autre. Le prefixe polonais.
  //   să   ro=30, aucune autre.   că  ro=29, aucune autre.
  //
  // DEHORS : `în` roumain, ro=29 et zero mesure, mais le francais l'ecrit dans
  // `chaîne` et `traîne`. Le corpus n'en contient pas, ce qui ne prouve rien.
  //
  // DEHORS AUSSI, et c'est le banc des lignes melangees qui l'a attrape :
  // `you` pour l'anglais, en=33 et bruit nul partout ailleurs. Il nomme
  // `grazie bro you are cracked` et `mille grazie bro you are insane`
  // ANGLAISES, alors que ce sont des lignes a deux langues dont la bonne
  // reponse est le silence. Un marqueur anglais propre reste un mauvais
  // marqueur : l'anglais est la langue avec laquelle tout le monde melange.
  // pas `czech` : l'anglais l'ecrit (`the czech guy`).
  [/cz(?!ech)/iu, 'pl'],
  [/prz/iu, 'pl'],
  [/să/iu, 'ro'],
  [/că/iu, 'ro'],
  // DEUXIEME RECOLTE du meme crible, plancher descendu de 20 lignes a 8.
  //   ijn  nl=19, aucune autre.  `mijn`, `zijn`.
  //   jse  cs=15, aucune autre.  `jsem`, `jsou`.
  //   för  sv=19, aucune autre.  Le danois et le norvegien ecrivent `for`.
  //   ał   pl=18, aucune autre.  Le passe polonais. `ł` seul est rejete parce
  //        qu'il voyage dans les noms propres ; `ał` n'y voyage pas.
  //   wy   pl=16, aucune autre.
  //
  // DEHORS, tous a bruit mesure nul et tous refuses au critere (a) :
  //   gio  it=16, mais le portugais ecrit `relógio` et `colégio`.
  //   oor  nl=15, mais l'anglais ecrit `door`, `floor`, `poor`.
  //   ân   ro=17, mais le francais ecrit `âne`.
  // Ces deux-la ont REMPLACE une entree plus etroite, et l'ablation l'a montre
  // en les donnant toutes les quatre a zero : deux paires qui se couvrent.
  //   `ijn` non borne remplace `ijn([^\p{L}]|$)`, qui ne voyait que la fin de mot.
  //   `jse` remplace la porte a trois mots `že|jeho|dnes` cs/sk, qui ne valait
  //         plus qu'une ligne et que ce trigramme prend en trois caracteres.
  // Meme resultat sur les huit bancs avec deux entrees de moins.
  [/jse/iu, 'cs'],
  // LE CRIBLE DE PAIRE, deuxieme famille. `paire-sequences.mjs` a ete ecrit pour
  // le tri danois-norvegien ou il a valu trente-deux lignes, et il se relance sur
  // n'importe quelle paire proche. Quatre entrees en sortent, et les quatre sont
  // une regle d'orthographe qu'on sait enoncer :
  //
  //   jsi jsou   le verbe etre tcheque. Le slovaque ecrit `si` et `sú`.
  //   iť sť      la desinence slovaque, `robiť` et `radosť`. Le tcheque ecrit
  //              `dělat` et `radost`, sans le caron.
  //   fue        le passe espagnol de `ser` et `ir`, plus `fuego` et `fuerte`.
  //              Le portugais ecrit `foi`, `fogo`, `forte`.
  //   oet        le neerlandais `moet`, `zoet`. Le danois ecrit `må`.
  //
  // `jsi` A EXIGE SA BORNE ET C'EST LE BANC SANS DIACRITIQUES QUI L'A DIT. En
  // plein texte il vit dans le slovaque `najhlúpejšia` et le slovene
  // `najlepši`, qui depouilles de leurs signes donnent `najhlupejsia` et
  // `najlepsi`. Six lignes partaient au tcheque et aucun autre banc ne le
  // voyait. Borne des deux cotes, la forme garde ses dix-sept lignes Tatoeba et
  // ne casse plus rien.
  //
  // DEHORS, et le crible les proposait tous les quatre : `jst` (le slovene
  // l'ecrit), `ať` (une ligne tcheque), `jog` (c'est le droit en hongrois),
  // `fala` (c'est la vague en polonais), `quer` (le francais `manquer`),
  // `aqui` (l'espagnol `aquí` depouille), `grad` (l'espagnol `agradar`),
  // `egun` (le portugais `segundo`). Les huit mesurent propre et les huit sont
  // faux : le corpus ne peut pas refuser ce que la langue ecrit et que lui ne
  // contient pas.
  [/(^|[^\p{L}])(jsi|jsou)([^\p{L}]|$)/iu, 'cs'],
  [/(iť|sť)/iu, 'sk'],
  // `fuer` est le für allemand tape sans u trema, aucun mot espagnol n'y finit.
  // pas `fuel` non plus, l'anglais.
  [/fue(?!l|r([^\p{L}]|$))/iu, 'es'],
  [/oet/iu, 'nl'],
  [/för/iu, 'sv'],
  [/ał/iu, 'pl'],
  // Borne : le prefixe `wy-` et la finale `-wy` polonais. Au milieu d'un mot c'est
  // l'anglais `lawyer`, et `wyd` est le `what you doing` du chat.
  [/(^|[^\p{L}])wy(?!d([^\p{L}]|$))|wy([^\p{L}]|$)/iu, 'pl'],
  // TROISIEME RECOLTE, la paire finno-estonienne interrogee directement.
  //   tää  fi=21, aucune autre. C'est la terminaison verbale `-tää`, `tietää`,
  //        `ymmärtää`, `näyttää` : de la morphologie, pas un mot.
  //   llä  fi=14, aucune autre. La table avait deja `llä` en FIN DE MOT dans
  //        les terminaisons ; non bornee elle voit aussi `llähän`, `llämme`.
  //   õi   et=15, aucune autre. Le portugais, seule autre langue a ecrire `õ`,
  //        ecrit `õe` et `ões`, jamais `õi`.
  //
  // DEHORS : `hän` fi=20 mais de=1 et sv=2. `sä` fi=14, de=1 sv=4. `taa` fi=14,
  // nl=4. `nud` estonien etait deja dans la liste des rejets, une ligne turque.
  [/tää/iu, 'fi'],
  [/llä/iu, 'fi'],
  [/õi/iu, 'et'],
  // QUATRIEME RECOLTE, les paires restantes interrogees une par une. Presque
  // tout ce qu'elles rendent est deja couvert par une lettre exclusive : `ře`
  // et `ěl` tcheques portent `ř` et `ě`, `iņ` et `kā` lettons portent `ņ` et
  // `ā`. Trois seulement sont libres, et ce sont trois langues faibles.
  //   wir  de=12, aucune autre, et en ASCII. Le neerlandais ecrit `wij`.
  //   gov  sl=13, aucune autre, ASCII aussi. `govori`. Le tcheque et le
  //        slovaque ecrivent `hovor`.
  //
  // DEHORS PAR L'ABLATION : `més` catalan, ca=9 et bruit nul, mais ZERO sur les
  // huit bancs. Les lignes catalanes qui le portent sont deja prises par le
  // point volat ou par la porte `é`. Un marqueur propre sur une langue faible
  // n'est pas automatiquement un marqueur utile.
  // Bornes a gauche et resserrees apres coup : l'anglais ecrit `wire`, `wiring`,
  // `swirl`, et `gov`, `government`. Le slovene ecrit `govor-` dans tout le verbe.
  [/(^|[^\p{L}])wir(?!e|ing)/iu, 'de'],
  [/govor/iu, 'sl'],
  // CINQUIEME RECOLTE, et c'est la paire scandinave interrogee directement, ce
  // qui n'avait jamais ete fait : `porte-candidats.mjs da+no`. Le diagnostic
  // disait que 70 lignes danoises avaient la porte OUVERTE sans mot pour
  // trancher, donc le manque etait la.
  //   gje  no=9, aucune autre langue. `gjerne`, `gjøre`, `gjennom`. Le danois
  //        ecrit `gøre`, sans le j.
  //   æl   da=5, aucune autre. `æble`, `ældre`. Le norvegien ecrit `eple` et
  //        `eldre` : c'est le `æ` danois contre le `e` norvegien, la meme
  //        alternance que le `g` contre le `k` deja prise par `øj` et `øg`.
  //
  // Elles entrent comme EXCLUSIVES et non comme mots de tri : aucune autre des
  // quarante-trois ne les ecrit, donc elles n'ont pas besoin que la porte
  // nordique se soit ouverte d'abord.
  //
  // DEHORS : `noe` no=8 et bruit nul mesure, mais le neerlandais ecrit
  // `noemen`. `igj` no=6 est contenu dans `gjerne`... non, dans `igjen`, qui
  // porte deja `gje`. `igt` da=8 prend onze lignes suedoises.
  // `gje` remplace `gjen([^\p{L}]|$)`, qui ne voyait que la fin de mot et donc
  // que `igjen` : troisieme fois qu'une sequence non bornee retire une entree
  // plus etroite sans rien perdre, apres `ijn` et `jse`.
  [/gje/iu, 'no'],
  // `jø` est la meme alternance que `gje`, un cran plus loin : le norvegien
  // ecrit `gjøre`, `kjøre`, `sjø`, le danois `gøre`, `køre`, `sø`, sans le j.
  [/jø/iu, 'no'],
  [/æl/iu, 'da'],
  // SIXIEME ET DERNIERE RECOLTE, les paires des langues encore faibles.
  //   agy  hu=13, aucune autre. `nagy`, `agyon`. Le hongrois est a 52 sur 120.
  //   niy  tl=14, aucune autre. `niya`, `kaniya`, `niyang`. La table avait deja
  //        `niya` en MOT ; non bornee la sequence voit aussi les formes flechies.
  [/agy/iu, 'hu'],
  // pas devant -or : le present turc tape sans i sans point (`kullaniyorsun`).
  [/niy(?!or)/iu, 'tl'],
  // LES MOTS OUTILS EXCLUSIFS, et c'est une passe que personne n'avait faite.
  //
  // Le lexique `SHORT_WORD_LANG` est un vocabulaire de CHAT et il est borne a
  // vingt caracteres. Ces mots-ci sont des mots grammaticaux a tres haute
  // frequence qu'UNE SEULE des quarante-trois ecrit, donc ils n'ont besoin ni
  // de la borne ni d'une porte : ils sont de la meme nature qu'une lettre
  // exclusive, et c'est pour ca qu'ils entrent dans cette table-ci.
  //
  //   ik hij mijn  nl=32, 14, 8. L'allemand ecrit `ich`, l'anglais `I`.
  //   ist zu       de=22, 14.    Le neerlandais ecrit `is`.
  //   jag att      sv=22, 24.    Le danois et le norvegien ecrivent `jeg`, `at`.
  //   est          fr=26.        L'italien ecrit `è`, l'espagnol `es`, le
  //                              roumain `este`.
  //
  // DEHORS, et c'est la COLONNE MELANGE du crible qui les a attrapes, seule :
  // `inte` suedois sur 21 lignes et `the` anglais sur 38, tous deux a bruit nul
  // dans les quarante-deux autres langues, touchent chacun une ligne melangee.
  // Deuxieme fois que ce banc refuse un marqueur parfait, apres `you`.
  // Celle-ci a tue `(lijk|heid|sje)`, la terminaison neerlandaise, qui avait
  // ete signalee une passe plus tot comme "le prochain candidat au retrait si la
  // table doit maigrir" : elle valait zero sur trois corpus et une ligne sur le
  // quatrieme. Elle vaut zero partout maintenant. Cinquieme fois qu'un ajout
  // tue une entree ailleurs dans le fichier.
  // `ik` seul n'y est plus : c'est le `I know` du chat anglais (`ik bro`,
  // `ik that was insane`). Il revient suivi d'un verbe a la premiere personne,
  // ce que l'anglais n'ecrit jamais apres lui.
  [/(^|[^\p{L}])(hij|mijn|het|een|heb|zijn)([^\p{L}]|$)/iu, 'nl'],
  [/(^|[^\p{L}])ik[^\p{L}]+(ben|heb|weet|denk|ga|wil|kan|moet|vind|snap|zie|hoop|zou|kom|wist)([^\p{L}]|$)/iu, 'nl'],
  [/(^|[^\p{L}])(ist|zu|habe|mir|und)([^\p{L}]|$)/iu, 'de'],
  // `hon` a ete retire de cette liste par l'audit de collisions de clavier.
  // Il vaut 3 lignes suedoises sur du texte normal et coute DEUX erreurs sur du
  // texte depouille : le vietnamien ecrit `hơn`, qui devient `hon`. Sur cette
  // branche la colonne `wrong` coute plus cher que la colonne `right`, donc
  // trois contre deux se tranche dans ce sens-la.
  //
  // LES QUATRE AUTRES COLLISIONS TROUVEES PAR LE MEME AUDIT SONT GARDEES, parce
  // que leur rapport va dans l'autre sens :
  //   het nl  rejoint par le hongrois `hét`  : -6 lignes, +0 erreur. Garde.
  //   nang tl rejoint par le vietnamien      : -1 ligne,  +0 erreur. Garde.
  //   niy tl  rejoint par le turc            : -2 lignes et -2 du corpus
  //           AVEUGLE contre 1 erreur. Garde.
  //   ist de  rejoint par deux lignes slovaques : -4 lignes contre 1 erreur.
  //           Garde, et c'est le plus discutable des quatre.
  [/(^|[^\p{L}])(jag|att|ett|och)([^\p{L}]|$)/iu, 'sv'],
  [/(^|[^\p{L}])(est|ici|nous|cette|une|deux)([^\p{L}]|$)/iu, 'fr'],
  // `pour` sauf devant ce que le verbe anglais prend (`pour one out`, `pour it`).
  [/(^|[^\p{L}])pour(?![^\p{L}]+(one|it|some|out|the|my|your|them)([^\p{L}]|$))([^\p{L}]|$)/iu, 'fr'],
  // DEUXIEME LOT DE MOTS OUTILS, quarante-huit candidats cribles d'un coup et
  // tous EXCLUSIFS avec zero ligne melangee. Dix sont refuses au critere (a) :
  //   dat hat bin till  de l'anglais courant, `dat boi`, `a hat`, `a bin`.
  //   asta   de l'espagnol et de l'italien, la hampe.
  //   oma    du finnois autant que de l'estonien.
  //   ele ela  du roumain, "elles".
  //   mane   de l'anglais et de l'italien.  dito  de l'italien, le doigt.
  // Tous les dix mesurent propre sur les 5490 lignes, et tous les dix sont
  // refuses quand meme : c'est le critere (a) qui decide, la mesure qui veto.
  //
  // ET TROIS DE PLUS, refuses par le BANC DU CLAVIER et par lui seul. C'est une
  // forme de collision que rien d'autre ne voit :
  //   aqui  n'est portugais que parce que l'espagnol et le catalan ecrivent
  //         `aquí`. Diacritiques tombees, c'est la MEME CHAINE, et il volait
  //         `que esta pasando aqui` et `primer cop aqui`.
  //   lai   n'est letton que parce que le vietnamien ecrit `lại`. Il volait
  //         `lai nhu cu`.
  //   aici  roumain, meme famille, retire par prudence avec les deux autres.
  //
  // REGLE A RETENIR : un mot qui n'est exclusif que GRACE A SON ACCENT n'est
  // pas exclusif du tout, parce que la moitie du chat s'ecrit sans accents. Le
  // banc `chat1-SANS-DIACRITIQUES` est le seul endroit ou ca se voit, et il
  // n'existe que depuis `013a2ca`.
  // SIX ENTREES SONT MORTES SOUS CE LOT, et c'est le plus gros nettoyage que
  // l'ablation ait declenche :
  //   ijn nl        tuee par `zijn`, qui la contient.
  //   nav tev lv    et  minha pt    zero des leur arrivee, gardees une minute.
  //   tas tik lv/lt tuee par `yra|jis`, qui nomment le lituanien avant la porte.
  //   ce au ro/fr   et  î ro/fr     tuees par les mots roumains et francais.
  // Les deux dernieres sont des PORTES : un lot de mots outils exclusifs rend
  // inutile la porte qui servait a trier les deux memes langues. C'est le sens
  // de la marche, une porte est un pis-aller quand aucune des deux langues n'a
  // de marqueur propre.
  //
  // Les retirer toutes les six coute UNE ligne sur Tatoeba et une au clavier,
  // pas zero : elles se couvrent entre elles quelque part. Six entrees contre
  // une ligne, le retrait tient.
  [/(^|[^\p{L}])(sunt|fost|foarte|poate|pentru)([^\p{L}]|$)/iu, 'ro'],
  [/(^|[^\p{L}])(seda|siin|keegi|mida)([^\p{L}]|$)/iu, 'et'],
  [/(^|[^\p{L}])(yra|jis)([^\p{L}]|$)/iu, 'lt'],
  // `kung` sauf dans `kung fu` et `kung pao`.
  [/(^|[^\p{L}])(nang|ito|wala|alam|kung(?![^\p{L}]+(fu|pao)([^\p{L}]|$))|lahat)([^\p{L}]|$)/iu, 'tl'],
  // TROISIEME LOT, et il PROMEUT des mots qui ne servaient que derriere une
  // porte. `sono` est dans le jeu italien et `lahko zelo zakaj nekaj ampak`
  // dans le jeu slovene, donc ils ne se declenchaient que si une lettre
  // partagee avait d'abord ouvert. Le crible les donne exclusifs sur les
  // quarante-trois, donc ils n'ont pas besoin de la porte.
  //
  // C'est l'inverse du mouvement habituel : d'habitude un mot impossible en
  // plein air devient propre DERRIERE une porte. Ceux-ci etaient deja propres
  // en plein air et personne ne l'avait verifie.
  //
  // DEHORS : `molto` italien, it=4, refuse par la colonne MELANGE du crible,
  // une ligne. `ako` slovaque, qui est du tagalog sur treize lignes contre six.
  // `bol` slovaque, sk=3 et bruit nul, mais ZERO sur les huit bancs : ses trois
  // lignes sont deja prises par `ľ` ou par la porte `š`.
  [/(^|[^\p{L}])(sono|quello|allora)([^\p{L}]|$)/iu, 'it'],
  [/(^|[^\p{L}])(lahko|zelo|zakaj|nekaj|ampak)([^\p{L}]|$)/iu, 'sl'],
  // LE TAGALOG, la derniere langue de la matrice sans un seul marqueur.
  //
  // Il s'ecrit en latin nu, sans un diacritique, donc aucune passe de lettres ne
  // pouvait l'atteindre et il est reste a 28 lignes sur 120 pendant tout le
  // chantier. C'est la passe a MOTS du crible qui l'a rendu, et le chiffre etait
  // la depuis le debut : `ang` sur 56 lignes des quatre corpus et ZERO ailleurs.
  //
  // Ce sont des marqueurs grammaticaux et non du vocabulaire, ce qui est ce
  // qu'on veut : `ang` marque le sujet, `ng` le complement, `mga` le pluriel.
  // Une phrase tagalog en porte un presque toujours, quel que soit le sujet dont
  // elle parle. C'est la meme nature que la terminaison finnoise au-dessus, pas
  // celle d'une entree de lexique.
  //
  // CE QUI EST DEHORS, et le crible les donnait a bruit zero : `may`, que
  // l'anglais ecrit, `mo`, que l'italien familier ecrit, et `hindi`, qui est le
  // nom d'une langue dans une phrase anglaise. Le critere (a) les refuse tous
  // les trois malgre une mesure propre, exactement comme `тут` et `echt`.
  [/(^|[^\p{L}])(ang|ng|mga|siya|niya)([^\p{L}]|$)/iu, 'tl'],
  // La ponctuation inversee, qui n'est pas une lettre du tout et qui est le
  // marqueur le plus large de cette table : 27 lignes espagnoles et zero
  // ailleurs. L'espagnol etait a zero sur ce chemin il y a deux passes.
  [/[¿¡]/u, 'es'],
  // Terminaisons. Elles portent sur n'importe quelle phrase, contrairement a un
  // mot de lexique qui ne porte que sur celles qui l'emploient, et c'est ce qui
  // les rend interessantes pour les langues sans lettre propre.
  //   -ción  espagnol, contre -ção portugais et -zione italien : les trois
  //          langues ecrivent le meme suffixe latin de trois facons.
  //   -eux   francais, onze lignes, la plus grosse de ce groupe.
  //   -lijk -heid  neerlandais.  -cchi -zione -issimo  italien.
  // DEHORS : -cion sans accent est aussi portugais et catalan, -mente est
  // italien autant qu'espagnol et portugais, -ndo aussi, -gli prend trois lignes
  // lettones, -ait trois estoniennes, -ez et -ons une douzaine de langues.
  [/ción([^\p{L}]|$)/iu, 'es'],
  [/eux([^\p{L}]|$)/iu, 'fr'],
  [/(zione|issimo|cchi|glia)([^\p{L}]|$)/iu, 'it'],
  // Un second groupe de terminaisons, et il n'a pas le meme STATUT que le
  // premier, ce qui vaut d'etre dit plutot que noye.
  //
  // Les entrees ci-dessus ont ete choisies en sachant ce que la langue ecrit, et
  // la mesure n'a fait que les valider. Celles-ci ont ete TROUVEES par une
  // recherche : extraire les n-grammes de fin de mot des lignes encore muettes
  // d'une langue, garder ceux qui n'apparaissent dans aucune autre. C'est une
  // selection PAR la mesure, ce que le protocole interdit d'habitude, parce
  // qu'une absence sur 5490 lignes ne prouve pas une absence.
  //
  // Deux garde-fous ont ete appliques et ils sont la raison pour laquelle ce
  // groupe existe quand meme. D'abord l'extraction s'est faite sur la seule
  // moitie de reglage et la couverture a ete verifiee sur l'autre : elle
  // transfere a 75-80 %, donc ce sont des regularites et non des lignes apprises
  // par coeur. Ensuite, sur les motifs que la recherche a proposes, n'ont ete
  // gardes que ceux qu'on peut NOMMER : -nho diminutif, -eiro agentif, -dade
  // nominalisateur, -iamo premiere personne du pluriel, -simo superlatif, -ným
  // instrumental, -tste superlatif, -knya -nmu -anku possessifs. Tout ce qui
  // n'etait qu'une queue de mot est sorti, -mio, -gitu, -kde, -woon, -não.
  //
  // La recherche a aussi propose -nha, -chi, -aat, -lich et -lige, que
  // l'exposition complete a rejetes : deux lignes vietnamiennes, quatre
  // francaises, quatre finnoises, deux neerlandaises, sept langues.
  // `nho|nha` a ete RESSERRE en `inho|inha`, le diminutif. Le vietnamien ecrit
  // `nhà` et `nhớ` ; diacritiques tombees ce sont `nha` et `nho`, et le banc
  // Tatoeba depouille montrait `vi -> pt` NEUF fois, le plus gros bloc d'erreurs
  // qu'il restait dessus.
  //
  // Mesure des deux formes : supprimer `nho|nha` coute 6 lignes et une du corpus
  // aveugle pour les memes 9 erreurs. Les resserrer en `inho|inha` en coute
  // DEUX et rien ailleurs. **Resserrer plutot que supprimer**, quand la
  // collision vient de la forme courte et que la longue est sans ambiguite.
  [/(inho|inha|eiro|eira|dade)([^\p{L}]|$)/iu, 'pt'],
  // `ssimo` et non `simo` : le superlatif italien double le s, bellissimo,
  // prossimo, massimo. Le s simple prenait l'espagnol tape sans accent,
  // buenisimo, et l'envoyait au moteur avec sl=it.
  // pas `hitto`, le juron finnois du chat.
  // ni `ghetto` ni le mot `ditto`, de l'anglais.
  [/(iamo|ssimo|glio|(?<!hi|ghe|(?:^|[^\p{L}])di)tto|nno)([^\p{L}]|$)/iu, 'it'],
  // `-knya -nmu -anku` sont sortis : le malais les ecrit aussi (`baiknya`, `kawanku`).
  // `-ným` aussi : l'instrumental tcheque (`s krásným`, `s jiným`).
  // LA SEULE ENTREE DU FICHIER QUI AIT JAMAIS RAPPORTE NEGATIF QUELQUE PART.
  // L'ablation l'avait trouvee sans pouvoir la nommer : +8 lignes sur Tatoeba,
  // +1 sur le corpus de reglage, et **-1 sur le corpus AVEUGLE**.
  //
  // Ce n'etait pas une erreur, la colonne des fausses ne bougeait pas : elle
  // faisait TAIRE une ligne. Elle repondait `nl`, un autre signal disait autre
  // chose, le vote n'etait plus unanime et tout le monde se taisait.
  //
  // `unanimite.mjs` a nomme le desaccord, parce qu'il compte les lignes ou deux
  // entrees votent different au lieu d'en retirer une a la fois : la paire est
  // `nl x tr`, et le mot est `saat`, l'heure en turc. C'est la seule facon
  // d'ecrire `aat` que le turc produise et le neerlandais jamais.
  //
  // Exiger une lettre avant, et pas un `s`, rend la ligne aveugle sans rien
  // couter : `gaat`, `staat`, `laat`, `praat` gardent leurs neuf lignes,
  // Tatoeba ne bouge pas d'une ligne, et les neuf bancs sont identiques sauf
  // celui qui gagne. Supprimer `aat` tout court avait ete mesure aussi et
  // coutait deux lignes Tatoeba pour le meme gain : RESSERRER PLUTOT QUE
  // SUPPRIMER, quand la collision vient de la forme la plus courte.
  // Pas sur une ligne a ii, que le neerlandais n'ecrit pas et le finnois partout :
  // `kiitti kun streamaat` sortait nl par `-aat`.
  [/^(?!.*ii).*(tste|[^s]aat|aal)([^\p{L}]|$)/iu, 'nl'],
  [/lich([^\p{L}]|$)/iu, 'de'],
  [/lige([^\p{L}]|$)/iu, 'da'],
  [/ait([^\p{L}]|$)/iu, 'fr'],
  [/(eix|itat)([^\p{L}]|$)/iu, 'ca'],
  // pas `ninja`.
  [/(nje|(?<!ni)nja|čno|vno)([^\p{L}]|$)/iu, 'sl'],
  // `iya` a ete retire de cette liste : le turc ecrit `tatlıya`, et le i sans
  // point depouille donne `tatliya`, qui se termine par `iya`. Retirer `iya`
  // coute ZERO ligne sur les neuf bancs et retire une erreur. Gratuit.
  [/(yong|oong)([^\p{L}]|$)/iu, 'tl'],
  // Un troisieme groupe, extrait de TATOEBA seul et valide sur le corpus de chat
  // AVEUGLE, qui est la bonne facon de faire depuis qu'on sait que le lexique
  // memorise et que la morphologie non. La bande de plus de vingt caracteres
  // rend le meme rappel sur un corpus inconnu que sur celui de reglage, parce
  // qu'elle n'est servie que par des regles de cette forme.
  //   -ött -ában -ünk -ára -ért  suffixes de cas hongrois. Six, cinq et quatre
  //        lignes chacun, et ce sont de vraies desinences, pas des queues de mot.
  //   -szik  classe verbale hongroise.
  //   -ould -not -ity -day  anglais. `would could should`, `not cannot`.
  //   -aar -eken -iets  neerlandais.  -oir  infinitif francais.
  //   -eht -ufen  allemand.  -nys -uest  catalan.
  //
  // RESERVE sur -aar, la seule de ce groupe, et de la meme nature que celle de
  // `ñ` plus haut : l'allemand ecrit Haar et Paar. Zero ligne mesuree sur 135,
  // et le pari est que ces noms sont rares dans un chat la ou le neerlandais
  // ecrit maar, naar, waar, daar dans presque chaque phrase. Vingt-deux lignes
  // en face, c'est le plus gros marqueur du groupe.
  //
  // DEHORS malgre une mesure propre, protocole 4.6 : -mma est `mamma` en
  // italien, -tude est anglais autant que francais, -hte est `echte` en
  // neerlandais, -tic est anglais et francais.
  //
  // -ekt A ETE RETIRE APRES COUP et c'est le seul motif de cette table qu'un
  // corpus ait attrape apres son entree. Il mesurait propre sur les 5490 lignes
  // de Tatoeba et du premier chat, trois lignes neerlandaises et rien ailleurs.
  // Le corpus de reglage `langChatCorpus3`, ecrit ensuite, l'a fait tomber en
  // quatre lignes d'un coup : `perfekt` est allemand, suedois, norvegien et
  // danois, comme `direkt`, `korrekt` et `objekt`. Une absence sur 5490 lignes
  // ne prouve toujours rien, et c'est exactement ce que le protocole 4.6 dit.
  [/(ött|ában|ünk|ára|ért|szik)([^\p{L}]|$)/iu, 'hu'],
  [/(aar|eken|iets)([^\p{L}]|$)/iu, 'nl'],
  // `day` exige maintenant une LETTRE devant lui. Le vietnamien ecrit `dạy`,
  // `đây` et `dây` ; depouilles ce sont trois fois `day`, en mot isole, et le
  // banc Tatoeba nu montrait `vi -> en` trois fois.
  //
  // Les deux formes ont ete mesurees : retirer `day` coute 4 lignes et UNE du
  // corpus aveugle, le resserrer en coute 3 et rien du chat. `today`,
  // `birthday`, `someday` passent toujours, le `day` nu ne passe plus, et c'est
  // lui seul que le vietnamien produit.
  [/(ould|not|ity|\p{L}day)([^\p{L}]|$)/iu, 'en'],
  [/(eht|ufen)([^\p{L}]|$)/iu, 'de'],
  // `aquest` et non `-uest` : l'anglais ecrit `quest`, `guest`, `request`.
  [/(nys|aquest)([^\p{L}]|$)/iu, 'ca'],
  // LE CATALAN EN PLEIN AIR, et le diagnostic qui a dit ou chercher.
  //
  // `porte-partagee-diagnostic.mjs` pose aux portes partagees la question que
  // `porte-diagnostic.mjs` posait deja aux deux portes ecrites a la main, et il
  // y a une cause de silence de plus parce qu'une porte partagee nomme plus de
  // deux langues : aucune porte ne s ouvre, une porte s ouvre sans que le jeu
  // reponde, ou le jeu repond en meme temps que celui d un rival.
  //
  // Sur le catalan, 155 lignes : 48 nommees, **63 sans aucune porte**, 42 porte
  // ouverte sans mot, 2 avec un rival. **La moitie du probleme catalan n est pas
  // derriere une porte du tout.** `Bon dia!`, `Tinc dues filles.`, `No vull
  // tornar.` ne portent aucune lettre accentuee, donc aucun jeu de porte, si gros
  // soit-il, ne peut les atteindre. C est ici qu'elles se prennent.
  //
  // Les dix mots sont tous mesures EXCLUSIFS sur les 5430 lignes etiquetees.
  // `estic` contre `estoy`, `seva` contre `suya`, `dues` contre `dos`, `els`
  // contre `los`, `tinc` et `vaig` contre `tengo` et `voy`.
  //
  // CINQ VENAIENT DU JEU DE PORTE ET SONT PROMUS, `amb aquest aquesta molt`, plus
  // `vam` qui est sorti en route. Ils y etaient inutiles par construction : le jeu
  // de porte ne se consulte que si la ligne porte une lettre accentuee, et une
  // ligne catalane qui en porte une est deja servie. Ils sont retires du jeu en
  // meme temps, sinon la table exclusive, qui passe avant, en fait du code mort.
  //
  // `vam` EST DEHORS et seul le banc clavier le refuse : le slovaque `vám` prive
  // de son accent donne `vam`, et deux lignes partaient au catalan. Il valait deux
  // lignes Tatoeba, il en coutait deux fausses ailleurs.
  //
  // `gaire` est dehors aussi, pour la raison inverse : correct, exclusif, et zero
  // ligne sur les dix bancs.
  [/(^|[^\p{L}])(estic|seva|dues|els|tinc|vaig|volem|amb|aquesta|molt)([^\p{L}]|$)/iu, 'ca'],
  // CINQ AUTRES LANGUES PRENNENT LE MEME CHEMIN QUE LE CATALAN, et le crible les
  // a rendues d'un coup : `langue-candidats.mjs` cherche, pour UNE langue contre
  // les quarante et une autres, ce que ses lignes MUETTES ecrivent et que
  // personne ne reprend. Il ne sert a rien de le lancer sur une langue qui va
  // bien ; le diagnostic dit laquelle en a besoin et combien de lignes n'ouvrent
  // aucune porte : it 82, sl 52, es 50, pt 48, fr 45.
  //
  // `che` et `ele` viennent du jeu de porte, ou ils ne pouvaient rien faire pour
  // une ligne sans accent, et ils y sont retires en meme temps. Cinquieme et
  // sixieme promotions de ce genre, apres les cinq mots catalans.
  //
  // REFUSES, ET C'EST LA MEME LISTE QU'AILLEURS : le corpus les rend propres, la
  // langue ne les rend pas.
  //   non   seize lignes italiennes, et c'est le mot francais. Le plus gros
  //         candidat du tour, et le seul que son propre corpus ne pouvait pas
  //         refuser. Le mettre dans les deux jeux ne le sauve pas non plus :
  //         les deux voteraient a chaque ligne et le vote cesserait d etre
  //         unanime, ce qui est du silence achete au prix du bruit.
  //   los   l'allemand ecrit `los`.        onde  l'italien ecrit `onde`.
  //   aqui  c'est `aquí` sans son accent.  hi    c'est le bonjour anglais.
  //   bila  c'est `quand` en malais.       encore  l'anglais l'ecrit aussi.
  //   nå    le danois l ecrit.
  // pas `mia` : l'espagnol tape `madre mia` sans accent.
  [/(^|[^\p{L}])(che|tutti)([^\p{L}]|$)/iu, 'it'],
  // Les verbes irreguliers italiens a diphtongue, `vuoi`, `puoi`, `vuole`, et
  // l'interrogatif `chi`. La diphtongue `uo` elle-meme est impossible en plein
  // air, l'espagnol ecrit `cuota`, le portugais `quota`, le finnois `vuosi`,
  // mais ces quatre formes-la ne sont a personne d autre.
  //
  // `lei` est dehors bien qu'il mesure exclusif : le norvegien ecrit `lei av`,
  // et le corpus ne le contient pas.
  [/(^|[^\p{L}])(chi|vuoi|puoi|vuole)([^\p{L}]|$)/iu, 'it'],
  // pas `iz` : le russe en lettres latines l'ecrit (`ya iz Kazani`).
  [/(^|[^\p{L}])(ima)([^\p{L}]|$)/iu, 'sl'],
  [/(^|[^\p{L}])(tengo|tiempo|mismo)([^\p{L}]|$)/iu, 'es'],
  // L'espagnol rioplatense, que le chat de Kick ecrit beaucoup, ecrit aussi `che`
  // (`che boludo`) : ses mots a lui votent espagnol et la ligne se tait au lieu de
  // partir en italien. Retirer `che` aurait coute l'italien entier.
  [/(^|[^\p{L}])(boludo|boluda|pibe|piba|chabón|chabon|laburo)([^\p{L}]|$)/iu, 'es'],
  // pas `ele` : c'est le `elles` roumain, deja refuse plus haut pour cette raison.
  [/(^|[^\p{L}])(ela)([^\p{L}]|$)/iu, 'pt'],
  [/(^|[^\p{L}])joue([^\p{L}]|$)/iu, 'fr'],
  // LA PAIRE MALAIS-INDONESIEN EN PLEIN AIR, et c'est la meme promotion que le
  // catalan, appliquee a la langue la plus basse du tableau.
  //
  // `gue`, `banget`, `udah`, `awak` vivaient derriere la porte ms/id, ou il faut
  // d'abord qu'un mot PARTAGE se declenche. Or le chat familier de Jakarta
  // n'ecrit pas les mots partages : il ecrit `gue`, et `gue` seul suffit a
  // nommer la langue. Quatorze lignes muettes du corpus de la paire le portent.
  //
  // Le critere qui separe les deux listes est le seul qui compte ici : un mot
  // que LES DEUX langues ecrivent va au declencheur, un mot que seule une des
  // deux ecrit va en plein air. `awak` contre `kamu`, `petang` contre `sore`,
  // `bahawa` contre `bahwa`, qui est la meme difference orthographique que
  // `kerana` contre `karena` deja dans le fichier.
  //
  // ONZE MOTS PARTAGES SUR QUATORZE SONT MORTS et ils sont sortis : `semalam`,
  // `datang`, `tengah`, `perlu`, `harga`, `anak`, `waktu`, `dua`, `kembali`,
  // `pasti`, `selalu`. Les retirer tous ensemble donne EXACTEMENT les memes
  // chiffres sur les dix bancs, donc ce ne sont pas onze couplages caches,
  // c'est onze fois le meme mot deja couvert par un autre sur la meme ligne.
  //
  // DEHORS : `mau` est `mauvais` en portugais, `cara` est le visage en espagnol,
  // en portugais et en italien, `kereta` est le train en indonesien, `bila` est
  // `quand` en malais et un mot slovene. Les cinq mesurent propre et les cinq
  // sont faux.
  [/(^|[^\p{L}])(gue|banget|udah)([^\p{L}]|$)/iu, 'id'],
  [/(^|[^\p{L}])(awak|petang|bahawa|bolehkah)([^\p{L}]|$)/iu, 'ms'],
  // LE SLOVAQUE, et ces huit mots sont tous la MEME difference orthographique
  // ecrite six fois. C'est ce qui separe le mieux deux langues proches, et le
  // fichier le dit depuis les jeux de porte : la meme forme du meme mot ecrite
  // deux fois vaut mieux qu un vocabulaire distinct.
  //
  //   sme     contre `jsme`      môj     contre `můj`
  //   zajtra  contre `zítra`     vonku   contre `venku`
  //   práve   contre `právě`     správne contre `správně`
  //
  // `ktorý` contre `který` et `môžem` contre `můžu` sont la meme regle et sont
  // sortis a l'ablation : corrects, et zero ligne sur les dix bancs.
  //
  // `ste`, `dnes`, `tam` et `tu` sont dehors : le slovene ecrit le premier, le
  // tcheque les trois autres. `kde` et `pri` aussi, le tcheque et le slovene les
  // ecrivent, et seul le corpus les rendait propres.
  // pas `sme` : le slovene l'ecrit (`ne sme`, "il ne doit pas").
  [/(^|[^\p{L}])(môj|zajtra|vonku|práve|správne)([^\p{L}]|$)/iu, 'sk'],
  // Trois langues de plus, meme crible, memes mots outils : `kui` "quand",
  // `selle` "de ceci" et `mulle` "a moi" pour l estonien ; `tavo` "ton",
  // `reikia` "il faut" et `patinka` "plait" pour le lituanien ; `iyon`, `mong`
  // et `maraming` pour le tagalog.
  //
  // DEHORS : `oma` est estonien ET finnois, `dito` est un doigt en italien,
  // `hindi` est le tagalog pour "non" et le nom dune langue partout ailleurs,
  // `mo` et `pa` sont trop courts pour appartenir a qui que ce soit.
  // pas `mulle` : le finnois parle l'ecrit (`anna mulle`).
  [/(^|[^\p{L}])(kui|selle)([^\p{L}]|$)/iu, 'et'],
  [/(^|[^\p{L}])(tavo|reikia|patinka)([^\p{L}]|$)/iu, 'lt'],
  [/(^|[^\p{L}])(iyon|mong|maraming)([^\p{L}]|$)/iu, 'tl'],
  // Quatre langues de plus. `nem` et `egy` sortent du jeu de porte hongrois, ou
  // ils ne servaient qu'une ligne accentuee sur deux ; ce sont les deux mots
  // les plus frequents de la langue et ils valent quatorze et sept lignes en
  // plein air.
  //
  // DEHORS : `volt` est un volt partout, `imam` est un imam, `bi` et `ez` sont
  // trop courts, `bila` est le malais pour "quand".
  // `nem` est sorti, comme la liste plus haut le demandait deja : c'est du
  // portugais courant, et `nem fodendo` partait avec sl=hu.
  [/(^|[^\p{L}])(egy|mindent)([^\p{L}]|$)/iu, 'hu'],
  [/(^|[^\p{L}])(vsi|dober|svojo|kdor)([^\p{L}]|$)/iu, 'sl'],
  // pas `velmi` : le slovaque `veľmi` sans son caron. pas `taas` : l'estonien
  // l'ecrit aussi, la liste du lexique le disait deja.
  [/(^|[^\p{L}])(tady|líbí)([^\p{L}]|$)/iu, 'cs'],
  [/(^|[^\p{L}])(sinne)([^\p{L}]|$)/iu, 'fi'],
  // LES SIX DERNIERES LANGUES QUE LE CRIBLE EN PLEIN AIR N AVAIT PAS VUES, et
  // ce sont les plus hautes du tableau, ce qui explique pourquoi elles etaient
  // passees apres : on cherche d'abord la ou il manque le plus.
  //
  // La moitie vient des jeux de porte, ou elle ne servait quune ligne accentuee
  // sur deux : `nicht` et `auf`, `jag` et `och`, `jest`, `heeft`. Ce sont les
  // mots les plus frequents de leurs langues et ils valent sept, six, vingt-deux,
  // huit, treize et cinq lignes en plein air.
  //
  // `ich` EST DEHORS malgre trente-cinq lignes allemandes : une ligne slovaque
  // le porte, et sur ce chemin une fausse coute plus cher que trente justes.
  // `inte` est dehors aussi, et pour une raison que seul le banc des lignes
  // MELANGEES voit : il repond sur une ligne a deux langues, ce qui est
  // exactement ce que le chemin sur ne doit pas faire.
  [/(^|[^\p{L}])(nicht|auf|auch|jetzt|nach|wann)([^\p{L}]|$)/iu, 'de'],
  [/(^|[^\p{L}])(jest|jestem|tego)([^\p{L}]|$)/iu, 'pl'],
  [/(^|[^\p{L}])(dat|aan|heeft|weer)([^\p{L}]|$)/iu, 'nl'],
  [/(^|[^\p{L}])(acest|vrei)([^\p{L}]|$)/iu, 'ro'],
  [/(^|[^\p{L}])kadar([^\p{L}]|$)/iu, 'tr'],
  // Quatrieme groupe, et la difference avec le troisieme est la SOURCE : ces
  // motifs-la ont ete extraits du registre chat et non de la prose. Le groupe
  // precedent avait rapporte 76 lignes sur Tatoeba et une seule a l'aveugle,
  // parce qu'une regle tiree de la prose lit des formes flechies et que le chat
  // en ecrit peu. Celui-ci est extrait du corpus de reglage `langChatCorpus3`,
  // jamais du corpus aveugle, et mesure sur ce dernier.
  //   -ijn   neerlandais, seize lignes, le plus gros du lot : zijn, mijn, klein.
  //   -ght   anglais : right, night, thought.   -ople : people, couple.
  //   -tou   preterit portugais : voltou, gostou, estou.
  //   -gjen  norvegien, la ou le danois ecrit igen sans j.
  //   -stà   catalan, la ou l'italien ecrit sta sans accent.
  //   -ämä -eveel  finnois et neerlandais.
  // DEHORS : -indo est `lindo` en espagnol, -seen est de l'anglais, -tic est
  // anglais et francais, -hora -utti -jtra -gain sont des queues de mots.
  [/eveel([^\p{L}]|$)/iu, 'nl'],
  [/(ght|ople)([^\p{L}]|$)/iu, 'en'],
  [/tou([^\p{L}]|$)/iu, 'pt'],
  [/stà([^\p{L}]|$)/iu, 'ca'],
  [/ämä([^\p{L}]|$)/iu, 'fi'],
];

/**
 * Quand la lettre ne nomme pas une langue mais une PAIRE, un mot tranche dedans.
 *
 * ø et æ sont la ou s'arretait la table du dessus : elles appartiennent au
 * danois ET au norvegien, donc elles ne nomment personne et elles etaient
 * ecartees pour ca. Mesure sur le corpus entier : elles ne touchent aucune des
 * quarante autres langues, 55 lignes danoises et 34 norvegiennes et rien
 * d'autre. Ce n'est donc pas un signal faible, c'est un signal FORT sur un
 * ensemble de deux, et il suffit d'un second tour pour choisir dedans.
 *
 * C'est la forme de `cantonaisOuChinois` et de `cyrilliqueQuelleLangue` : une
 * porte, puis une decision a l'interieur.
 *
 * CE QUE LA PORTE OFFRE GRATUITEMENT, et c'est ce qui rend la regle possible :
 * elle a deja exclu le suedois. mig, dig, sig et av sont inutilisables en
 * general parce que le suedois les ecrit aussi, neuf et trois lignes suedoises
 * du banc ; derriere la porte ils redeviennent des marqueurs propres. Un mot
 * ambigu dans les 43 peut etre net dans une paire.
 *
 * Les paires retenues opposent deux orthographes du meme mot, ce qui est plus
 * sur qu'un mot present d'un cote et absent de l'autre :
 *   meg deg seg  contre  mig dig sig       hva contre hvad
 *   av contre af         etter contre efter    noe noen contre noget nogen
 *
 * CE QUI EST DEHORS : `ikke` et `jeg` s'ecrivent pareil des deux cotes, 6 et 11
 * lignes danoises contre 11 et 13 norvegiennes, et ils sont ici comme temoins de
 * ce que les deux langues partagent vraiment. `fordi` et `bare` sont communs
 * aussi. Les deux jeux dans la meme ligne, ou aucun, rendent `undefined` : meme
 * vote unanime que partout ailleurs dans ce fichier.
 *
 * CE QUE CA NE FAIT PAS. La porte ne voit que 26 lignes danoises sur 60 et 18
 * norvegiennes sur 60, donc la regle laisse passer la majorite des deux langues.
 * Sortir de la liste a zero et fermer la paire sont deux choses differentes, et
 * c'est la meme lecon que le catalan une passe plus tot : `no -> sv` tombe de 48
 * a 41 et `da -> sv` de 44 a 42, ce qui est un progres et pas une fermeture.
 */
const LETTRES_DANO_NORVEGIENNES = /[øæ]/iu;
const MOTS_NORVEGIENS =
  /(^|[^\p{L}])(meg|deg|seg|hva|noe|noen|etter|av|ikkje|veldig|vært|dere|ble)([^\p{L}]|$)/iu;
const MOTS_DANOIS =
  /(^|[^\p{L}])(mig|dig|sig|hvad|noget|nogen|efter|af|meget|hende|været|gik)([^\p{L}]|$)/iu;
// LES SEQUENCES, et elles valent SEPT des DIX lignes de ce tour a elles seules.
//
// Ce qui separe ces deux langues est le plus souvent une LETTRE dans un mot et
// pas un mot entier : le danois ecrit `g` la ou le norvegien ecrit `k`, et `øj`
// la ou le norvegien ecrit `øy`. `bøger` contre `bøker`, `sprog` contre
// `språk`, `rigtig` contre `riktig`, `høj` contre `høy`.
//
// LA MESURE QUI COMPTE, et c'est la lecon : le tour a d'abord ete ecrit comme
// une liste de onze MOTS, `veldig skjer jente rigtig pige sådan bøger sprog og
// vil skal`, plus ces quatre sequences. Onze mots et quatre sequences valent
// +10 lignes. Sans les sequences, +3. En retirant les NEUF mots qui ne
// rapportent rien seuls, +10 encore : deux mots et quatre paires de lettres
// font tout.
//
// Une sequence porte sur n'importe quel mot, un mot ne porte que sur lui-meme.
// C'est exactement ce que la terminaison finnoise apporte au finnois, mesure
// ici une deuxieme fois sur une autre famille.
//
// DEHORS : `kj` et `skj`, proposes comme norvegiens, prennent chacun une ligne
// danoise, et `gj` en prend trois. Le seuil est ZERO ici, pas trois : le tri se
// fait entre DEUX langues, donc une ligne de l'autre cote n'est pas du bruit,
// c'est une erreur.
//
// DEUXIEME TOUR, ET IL VAUT TRENTE-DEUX LIGNES, le plus gros gain unitaire du
// chantier depuis le repli cyrillique. Ce qui a change est le DIAGNOSTIC et pas
// la methode : `porte-diagnostic.mjs` dit que 34 lignes norvegiennes n'ouvrent
// pas la porte mais que QUARANTE-SIX l'ouvrent sans que rien ne tranche
// derriere. Ce ne sont pas les memes lignes et ce ne sont pas les memes
// corrections : ici le declencheur va bien, c'est le TRI INTERIEUR qui manque.
//
// `nordique-tri.mjs` cherche donc les sous-chaines de deux a quatre lettres
// qu'une des deux langues ecrit et que l'autre n'ecrit JAMAIS, sur les 155
// lignes de chacune, tous corpus confondus. Le seuil reste zero.
//
// LES QUATORZE QUI RESTENT SONT TOUTES UNE REGLE D'ORTHOGRAPHE, et c'est la
// seule raison de leur faire confiance au-dela du corpus qui les a rendues :
//
//   ei / ej     `nei` contre `nej`, `deilig` contre `dejlig`
//   itt         `mitt ditt sitt litt` contre `mit dit sit lidt`
//   inn         `inn finne kvinne` contre `ind finde kvinde`, nn contre nd
//   opp         `opp oppgave` contre `op opgave`, en tete de mot seulement
//   het / hed   `mulighet` contre `mulighed`
//   ike         `like slike` contre `lide slige`
//   igt         `rigtigt vigtigt` contre `riktig viktig`, gt contre kt
//   ede         `snakkede elskede` contre `snakket elsket`, en fin de mot
//   ud          `ud udenfor` contre `ut utenfor`, en tete de mot
//   bliv        `blive bliver` contre `bli blir`
//   æb / øb     `æble` contre `eple`, `købe` contre `kjøpe`
//   kø          `køre køkken` contre `kjøre kjøkken`, le j norvegien
//   uge         `uge bruge` contre `uke bruke`
//   dst         `bedst sidst` contre `best sist`
//
// DEUX ANCRAGES SONT LA PARCE QUE LA FORME NUE PERDAIT. `opp` nu est dans le
// danois `stoppe`, `ud` nu est dans `studere` que les deux ecrivent, `ede` nu
// est dans le norvegien `stedet`. Les trois mesurent propre sur les 310 lignes
// du banc, et les trois sont des accidents de corpus : la borne est ce qui les
// rend vraies. RESSERRER PLUTOT QUE SUPPRIMER, troisieme fois sur cette branche.
//
// TROIS SONT SORTIES A L'ABLATION, mot a mot, parce qu'elles ne gagnent rien :
// `uke`, `kje` et `igen`. Les trois sont des regles correctes et les trois sont
// deja couvertes par une autre entree de la liste. Une regle vraie qui ne
// rapporte rien reste du poids mort, et le tour en a produit trois sur dix-sept.
//
// CE QUI EST DEHORS ET QUE LE CRIBLE PROPOSE ENCORE, parce que le corpus ne
// peut pas le refuser et que la langue, elle, le refuse : `unn` (le danois
// ecrit `kunne`), `vel`, `ja`, `nak`, `usk`, `bed`, `gam`, `være` (les deux les
// ecrivent), `lik` (le danois `politik`), `sj` (le danois `sjov`), `nu` (le
// norvegien `minutt`), `tag` (`vintage`), `oge` (`toget` des deux cotes),
//  `nden` (le norvegien `stranden`), `ade` et `igen` (le suedois les ecrit).
// **Le corpus ne peut pas refuser ce qu'il ne contient pas**, et c'est la seule
// chose que cette liste sert a dire au prochain passage.
const SEQUENCES_NORVEGIENNES = /øy|øk|ei|itt|inn|het|ike|(^|[^\p{L}])opp/iu;
const SEQUENCES_DANOISES = /øj|øg|ej|igt|bliv|æb|øb|kø|uge|dst|hed|ede([^\p{L}]|$)|(^|[^\p{L}])ud/iu;

/**
 * Le meme mecanisme a un cran de plus : une lettre qui nomme un TRIO.
 *
 * `ø` et `æ` nomment la paire danois-norvegien parce que le suedois ne les
 * ecrit pas. `å`, lui, est ecrit par les trois, donc il nomme le trio. Mesure
 * sur les deux corpus : les trois et personne d'autre, 28 lignes danoises, 40
 * norvegiennes et 48 suedoises.
 *
 * Deux etages, et l'ordre compte. Une ligne qui porte ø ou æ n'est pas suedoise
 * quoi qu'elle porte d'autre, donc elle va directement au tri danois-norvegien
 * ou mig, dig et sig sont surs. Une ligne qui n'a que å peut etre suedoise, donc
 * il faut d'abord sortir le suedois, et seulement apres se servir de mots qui
 * lui seraient ambigus.
 *
 * Ce qui separe le suedois de ses deux voisins est une orthographe differente du
 * meme mot, la forme la plus sure : jag contre jeg, inte contre ikke, och contre
 * og, är contre er, från contre fra. Mesure derriere la porte : jag 8 lignes
 * suedoises et zero des deux autres, inte 13 et zero, och 7 et zero, är 13 et
 * zero ; jeg 35 danoises et norvegiennes et zero suedoise, ikke 17 et zero.
 *
 * CE QUI EST DEHORS : `og` prend une ligne suedoise sur les cinquante, et `er`
 * en prend dix-neuf, parce que le suedois l'ecrit aussi. `till` prend une ligne
 * norvegienne. Aucun des trois n'entre, pour une ligne comme pour dix-neuf.
 */
const A_ROND_SCANDINAVE = /å/iu;
const MOTS_SUEDOIS = /(^|[^\p{L}])(jag|och|inte|är|från)([^\p{L}]|$)/iu;
// `hun` est venu du crible interroge sur la paire : le suedois ecrit `hon`,
// donc il nomme bien le COUPLE et pas le trio. `dette` est arrive avec lui et
// a ete coupe par l'ablation, zero sur les huit bancs.
//
// `hvor` a ete propose avec eux et RETIRE : il est deja dans `MOTS_NORVEGIENS`,
// donc il ouvrait la porte sur une ligne danoise puis decidait norvegien tout
// seul. Deux lignes Tatoeba et deux de chat sont parties au norvegien,
// `Hvor gjorde han det?` et `hvor lang tid endnu`.
//
// C'est le meme defaut que les portes de sequence ASCII refusees plus haut, le
// declencheur qui vit dans le mot qui tranche, sous une autre forme : ici il
// EST le mot qui tranche. **Un declencheur ne doit appartenir a aucun des deux
// jeux places derriere lui**, et c'est verifiable a l'oeil en trente secondes.
// DEUXIEME TOUR DU DECLENCHEUR, et il a coute un mot qui etait la depuis le
// debut.
//
// `porte-diagnostic.mjs` comptait encore 22 lignes norvegiennes sans aucun
// declencheur apres le tour de sequences. Quatre mots que les deux ecrivent et
// que le suedois non entrent ici : `bare` contre `bara`, `selv` contre `själv`,
// `mange` contre `många`, `hvem` contre `vem`.
//
// `hvem` ET `hvor` ETAIENT DANS LE JEU NORVEGIEN ET LE DANOIS LES ECRIT. Ils y
// etaient faux depuis le premier jour et ils n'avaient jamais rien coute, parce
// que la porte ne s'ouvrait pas sur les lignes ou ca se voyait. `mange` la fait
// s'ouvrir, et `hvor mange er her nu`, qui est du danois, est parti au
// norvegien.
//
// **ELARGIR UN DECLENCHEUR REND RETROACTIVEMENT FAUX CE QUI EST DERRIERE.**
// Troisieme fois sur cette branche, apres `hvor` lui-meme au tour precedent et
// `je` du cote malais. Les deux interrogatifs passent au declencheur, ou ils
// sont justes : ils nomment la PAIRE et pas une des deux langues.
//
// ONZE MOTS SUR DIX-HUIT SONT MORTS et sortent : `skal`, `også`, `hvordan`,
// `ham`, `hvorfor`, `fordi`, `hvis`, `nok`, `hvor`, `aldri`, `sådan`. Les
// retirer ensemble donne exactement les memes chiffres sur les dix bancs.
//
// LE REGISTRE CHAT SCANDINAVE A ETE ESSAYE ET IL NE DONNE RIEN, et ce resultat
// negatif vaut plus que le tour qui ne sera pas fait.
//
// Le danois est la langue la plus MUETTE du produit sur du chat, 20 lignes sur
// 25, et le norvegien la suit a 16. `langue-candidats.mjs da 1 chat` rend leurs
// lignes muettes, et elles se lisent en une minute : `det kan jeg ikke tro`,
// `hvor mange er her nu`, `han er endelig tilbage`. Les paires sautent aux yeux,
// `nu` contre `nå`, `tilbage` contre `tilbake`, `herude` contre `her ute`.
//
// Sept entrees ecrites la-dessus, `ute`, `bake`, `ude`, `bage`, `nå`, `bra`,
// `nu`, et l'ablation les refuse toutes :
//   CINQ ne bougent QUE le corpus de reglage, celui dont les lignes ont servi
//        a les ecrire. Elles ne mesurent que leur propre source.
//   `nu` idem, une ligne, la sienne.
//   `nå` transfere d'une ligne Tatoeba, et il est refuse quand meme : le danois
//        ecrit `nå ja` tous les jours, et seul le corpus le rendait propre.
//
// CE QUE CA DIT DU REGISTRE. Une ligne de chat scandinave de six mots porte une
// paire minimale et rien d'autre. Lire ces paires dans le corpus de reglage et
// les ecrire en regles, c'est apprendre vingt-cinq lignes par coeur : le banc
// aveugle ne bouge pas et il a raison de ne pas bouger. **Ce qui manque ici
// n'est pas une regle, c'est du chat scandinave en quantite.**
//
// LE TRI INTERIEUR, LUI, EST EPUISE, et c'est un resultat negatif a ne pas
// refaire : `paire-sequences.mjs` ne rend plus que des sequences que le danois
// ecrit et que le corpus ne montre pas. `vel` vit dans `ja vel`, `sn` dans
// `snakke`, `unn` dans `kunne`, `oen` dans `skoen`, `ært` dans `lært`, et les
// cinq mesurent zero du cote danois. Le relancer apres un corpus neuf, pas
// avant.
const MOTS_DANO_NORVEGIENS =
  // pas `bare` : c'est un mot anglais (`bare minimum like always` sortait no).
  /(^|[^\p{L}])(jeg|ikke|til|vil|hun|selv|mange|hvem)([^\p{L}]|$)/iu;

/** Le tri interieur, appele une fois le suedois ecarte d'une facon ou d'une autre. */
function norvegienOuDanois(text: string): string | undefined {
  const no = MOTS_NORVEGIENS.test(text) || SEQUENCES_NORVEGIENNES.test(text);
  const da = MOTS_DANOIS.test(text) || SEQUENCES_DANOISES.test(text);
  if (no && !da) return 'no';
  if (da && !no) return 'da';
  return undefined;
}

/**
 * LA PORTE SANS LETTRE, et c'est ce que la paire scandinave attendait.
 *
 * Trois tours de regles de lettres n'ont pas bouge `no -> sv` ni `da -> sv`
 * d'une seule ligne, et la raison est structurelle : ni le danois ni le
 * norvegien n'ecrit une lettre que la table couvre, et leurs trois lettres a
 * eux, `å ø æ`, ne sont pas sur toutes leurs lignes.
 *
 * Le crible a sequences, `porte-candidats.mjs`, a rendu le chemin : `jeg` sur
 * 39 lignes norvegiennes et 35 danoises, `ikke` sur 28 et 25, et RIEN ailleurs.
 * Un MOT peut nommer une paire exactement comme une lettre, et le suedois ecrit
 * `jag` et `inte` a la place. Le bruit polonais de trois lignes que le crible
 * signale sur `jeg` est `jego`, et la borne de mot l'ecarte deja.
 *
 * Donc : une ligne qui porte un mot dano-norvegien et aucun mot suedois va au
 * tri interieur, qu'elle porte une lettre scandinave ou non. `å` reste le seul
 * cas ou il faut ecarter le suedois avant, parce qu'il l'ecrit aussi.
 */
function danoisOuNorvegien(text: string): string | undefined {
  if (LETTRES_DANO_NORVEGIENNES.test(text)) return norvegienOuDanois(text);
  const sv = MOTS_SUEDOIS.test(text);
  const dn = MOTS_DANO_NORVEGIENS.test(text);
  if (A_ROND_SCANDINAVE.test(text)) {
    if (sv && !dn) return 'sv';
    if (dn && !sv) return norvegienOuDanois(text);
    return undefined;
  }
  // Sans lettre scandinave, les sequences du tri sont aussi de l'anglais (`like`,
  // `winner`, `their`) : une ligne qui porte un mot que seul l'anglais ecrit se tait.
  if (dn && !sv && !porteUnMotAnglais(text)) return norvegienOuDanois(text);
  return undefined;
}

/**
 * LES PORTES PARTAGEES, en table plutot qu'une fonction par lettre.
 *
 * Une lettre ecrite par deux ou trois langues nomme une PAIRE et pas une langue,
 * et il suffit d'un second tour pour choisir dedans. Le fichier en a quatre
 * ecrites a la main plus haut, le nordique, le malais-indonesien, le scandinave
 * a trois et l'estonien-portugais, chacune avec sa logique propre.
 *
 * Celles-ci sont toutes de la meme forme, donc elles sont des DONNEES : une
 * lettre, la liste des langues qui l'ecrivent, et un jeu de mots par langue. Le
 * jeu de mots est partage entre les portes, donc ajouter une porte ne coute
 * qu'une ligne.
 *
 * CE QUE LA PORTE OFFRE, et c'est la raison d'etre de tout le mecanisme : elle
 * rend propres des mots impossibles en plein air. `der`, `die`, `das`, `ich`,
 * `ist` sont ecrits par le neerlandais et d'autres ; derriere `ä` il n'y a plus
 * de neerlandais. `att`, `det`, `som`, `har`, `med` sont danois et norvegiens ;
 * ni l'un ni l'autre n'ecrit `ä`. `som` seul touche onze lignes scandinaves en
 * plein air et aucune derriere `š`. `tak` est tcheque, polonais et malais, et
 * derriere `ó` il ne reste que le polonais.
 *
 * LE VOTE : une porte qui ne designe pas exactement une langue ne tranche pas,
 * et l'on passe a la porte suivante. Une ligne qui porte `ä` et `š` est donc
 * examinee deux fois, ce qui est correct : ce sont deux indices independants.
 *
 * MESURE derriere les deux plus grosses portes, sur les corpus de reglage :
 *   ä  fi=102 sv=77 et=53 de=15 sk=3, 160 lignes muettes avant la regle
 *   š  lt=57 lv=44 cs=38 sl=36 sk=31 et=1, 99 muettes
 *
 * Ce qui tranche le mieux entre deux langues proches est la MEME forme du meme
 * mot ecrite deux fois : `jsem` contre `som` contre `sem`, `jsou` contre `sú`,
 * `byl` contre `bol`, `ještě` contre `ešte`, `una` contre `uma`, `també` contre
 * `também`. Mieux qu'un vocabulaire distinct, qui a plus de chances d'exister
 * des deux cotes.
 *
 * CE QUI EST DEHORS : `je`, `to`, `na` sont communs a plusieurs slaves ; `ir`,
 * `kad`, `bet` sont lituaniens ET lettons ; `ja` et `oli` finnois ET estoniens ;
 * `que` francais, portugais ET catalan ; `para` et `está` espagnols ET
 * portugais. Le slovaque n'a pas de jeu derriere `ä`, ses trois lignes y restent
 * muettes, et c'est le comportement attendu d'une porte qui ne peut pas trancher.
 *
 * DEUXIEME TOUR, ET IL VAUT SOIXANTE-TREIZE LIGNES, le plus gros de la branche.
 * Il n'y avait rien a inventer : ces jeux avaient ete ecrits en meme temps que
 * la table des portes, a la main, et personne ne les avait rouverts depuis.
 *
 * `porte-partagee-diagnostic.mjs` compte ce qui attend derriere chaque porte, et
 * le chiffre disait ou aller :
 *
 *   sk 64 lignes   hu 52   sl 46   fi 41   es 38   fr 36   pt 30   it 19
 *
 * `porte-mots-candidats.mjs` les propose, et son seuil est le point qui compte :
 * il n'exige PAS qu'un mot soit exclusif sur les quarante-deux langues, seulement
 * que les autres langues DE CETTE PORTE-LA ne l'ecrivent pas. C'est ce que le
 * fichier dit depuis la premiere porte, `on`, `ei`, `ma`, `ta` et `ja` derriere
 * `õ`, et ce que le crible ne savait pas encore chercher.
 *
 * Trente-neuf mots sur quarante transferent, ce qui est le meilleur rapport du
 * chantier et s'explique : ce sont des mots OUTILS, `az` `én` `még` `most` pour
 * le hongrois, `moj` `kdo` `so` pour le slovene, `ça` `été` `fois` pour le
 * francais, `ele` `tudo` `só` `foi` pour le portugais, `čo` `niečo` pour le
 * slovaque. Un mot outil ne memorise pas un corpus, il decrit une langue.
 *
 * Le seul mort est `tienes`, et il est instructif : conjugue a la deuxieme
 * personne, donc plus rare que l'infinitif ou la troisieme, alors que `yo`,
 * `qué` et `ese` a cote de lui rapportent chacun. La frequence d'une forme
 * compte autant que l'exclusivite du mot.
 *
 * REFUSES PARCE QU'UN RIVAL DE LA MEME PORTE LES ECRIT, et le crible les nomme :
 * `je` (cs sk sl fr), `to` (cs lt lv pl sl), `na` (cs pl pt sl), `si` (ca cs es
 * fr it sl), `on` et `ei` (et, derriere `ä`), `para` et `está` (es et pt),
 * `me`, `no`, `el` (ca es pt fr), `il` (it et fr), `van` (nl et hu), `non` qui
 * est italien ET francais et que seule l'absence du corpus rendait propre.
 *
 * TROISIEME TOUR, huit mots pour dix-neuf lignes, et le crible les a rendus en
 * un seul passage sur les dix langues qui restaient. Le lituanien `aš` "je",
 * `čia` "ici" et `prieš` "avant" ; le roumain `în`, `cu` et `aici` ; l estonien
 * `ära`, la particule de defense, et `välja` "dehors".
 *
 * Les dix autres langues ne rendent que des mots pleins a une ou deux lignes,
 * `häivy`, `isäni`, `čaj`, `tisoč`, `genellikle`, ou des mots qu'un rival de la
 * meme porte ecrit : `on` et `oli` entre finnois et estonien, `je` et `se` entre
 * slovene et tcheque, `du` entre suedois et allemand, `på` et `om` entre suedois
 * et nordique. **Le crible de portes est proche de son fond**, et ce qui reste
 * derriere les portes est ce que deux voisines ecrivent pareil.
 */
const JEUX_DE_PORTE: Readonly<Record<string, RegExp>> = {
  fi: /(^|[^\p{L}])(että|mutta|niin|kun|myös|vain|hän|ole|olen|täällä|tänään|mikä|mitä|kaikki|miksi|hänen|meitä|tämän|koskaan)([^\p{L}]|$)/iu,
  sv: /(^|[^\p{L}])(och|inte|är|jag|att|det|som|för|har|med|den|till|hur|här|hon|vill)([^\p{L}]|$)/iu,
  et: /(^|[^\p{L}])(see|ta|ma|kas|aga|siis|väga|miks|midagi|praegu|kõik|ära|välja)([^\p{L}]|$)/iu,
  de: /(^|[^\p{L}])(der|die|das|ich|ist|und|mit|für|ein|eine|sich|nur|aber|noch|wieder)([^\p{L}]|$)/iu,
  cs: /(^|[^\p{L}])(jsem|jsou|není|ještě|vždycky|proč|byl|jako|dobře)([^\p{L}]|$)/iu,
  sk: /(^|[^\p{L}])(som|sú|veľmi|ešte|prečo|vždy|bol|ako|dobre|čo|niečo|chcem)([^\p{L}]|$)/iu,
  sl: /(^|[^\p{L}])(sem|lahko|nekaj|ampak|kaj|tudi|ker|zdaj|zelo|zakaj|moj|moja|kdo|hočem|so)([^\p{L}]|$)/iu,
  lt: /(^|[^\p{L}])(yra|labai|kaip|tai|jis|ką|dabar|nieko|taip|aš|čia|prieš)([^\p{L}]|$)/iu,
  lv: /(^|[^\p{L}])(ļoti|viņš|viņa|kāds|paldies|tagad|arī|nav)([^\p{L}]|$)/iu,
  hu: /(^|[^\p{L}])(hogy|csak|mint|nagyon|mindig|megint|semmi|miért|jó|az|már|én|ön|még|most|ezt|engem|tényleg)([^\p{L}]|$)/iu,
  pl: /(^|[^\p{L}])(się|nasz|bardzo|jeszcze|wszystko|dlaczego|który)([^\p{L}]|$)/iu,
  vi: /(^|[^\p{L}])(với|của|một|không|được|rồi|quá|này|tôi)([^\p{L}]|$)/iu,
  es: /(^|[^\p{L}])(pero|muy|con|los|las|una|esto|esa|siempre|qué|yo|ese|ayer)([^\p{L}]|$)/iu,
  pt: /(^|[^\p{L}])(uma|não|você|muito|isso|essa|também|tudo|só|foi|ainda|esse|um|pfv)([^\p{L}]|$)/iu,
  ca: /(^|[^\p{L}])(això|què|també|més|són|una|és|sóc|després|ací)([^\p{L}]|$)/iu,
  fr: /(^|[^\p{L}])(est|avec|pour|dans|tout|comme|très|sont|fait|ça|été|étais|fois|mois)([^\p{L}]|$)/iu,
  tr: /(^|[^\p{L}])(bir|için|değil|çok|var|bu|şey|daha)([^\p{L}]|$)/iu,
  it: /(^|[^\p{L}])(allora|quindi|comunque|anche|adesso|perché|però|davvero|questo|sono|più|niente|una|molto|mio)([^\p{L}]|$)/iu,
  ro: /(^|[^\p{L}])(foarte|acum|nimic|când|care|pentru|sunt|cred|joacă|cineva|în|cu|aici)([^\p{L}]|$)/iu,
  nl: /(^|[^\p{L}])(niet|het|een|wat|voor|zijn|geen|hoe|nog|gewoon|maar)([^\p{L}]|$)/iu,
};

const PORTES_PARTAGEES: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  // Sortie du crible `porte-candidats.mjs` et non d'une relecture a l'oeil : la
  // plus large porte libre du fichier, 160 lignes sur les quatre corpus, et les
  // quatre langues qui l'ecrivent avaient deja leur jeu de mots. Meme famille
  // que `š` juste en dessous, a ceci pres que le letton ne l'ecrit pas.
  [/č/iu, ['sl', 'sk', 'cs', 'lt']],
  [/ä/iu, ['fi', 'sv', 'et', 'de']],
  [/š/iu, ['cs', 'sk', 'sl', 'lt', 'lv']],
  // Les quatre autres portes libres que le crible a rendues. Le roumain domine
  // `ă` a 103 lignes contre 7, le polonais domine `ą` et `ę`, et `ū` est la
  // seule des cinq ou les deux langues sont du meme ordre.
  [/ă/iu, ['ro', 'vi']],
  // `ą` a ete retiree ici : elle valait une ligne du corpus aveugle jusqu'a ce
  // que `cz` et `prz` nomment le polonais avant qu'elle ne soit consultee. Meme
  // chose pour `ã` pt/vi, tuee par `ão`. Troisieme et quatrieme fois qu'un ajout
  // tue une entree ailleurs dans le fichier sans qu'aucun total ne le signale.
  [/ę/iu, ['pl', 'lt']],
  [/ū/iu, ['lv', 'lt']],
  // DEUX PORTES A MOT ONT ETE RETIREES D'ICI, `il` fr/it et `per` ca/it. Elles
  // sont mortes le jour ou le francais et l'italien ont recu leurs propres mots
  // outils exclusifs, `est pour ici nous cette une deux` et `sono quello
  // allora`. Troisieme et quatrieme porte retiree pour cette raison, apres
  // `tas|tik` lv/lt et `ce|au` ro/fr.
  //
  // C'est la regle generale du fichier, ecrite ici une fois pour toutes : une
  // porte est un PIS-ALLER pour quand aucune des deux langues n'a de marqueur
  // propre. Donnez-en un aux deux et la porte cesse de gagner sa ligne. Elles
  // ne meurent pas d'etre mauvaises, elles meurent d'avoir ete remplacees.
  //
  // LES PORTES A MOT, troisieme passe du crible.
  //
  // Un TOKEN entier n'a pas le defaut des sequences ASCII juste en dessous : il
  // ne peut pas se declencher a l'interieur du mot qui tranche, parce que le
  // decoupage est le meme des deux cotes. C'est ce qui les rend utilisables la
  // ou `sz` et `dz` ne l'etaient pas.
  //
  // Mesure du crible, sur les quatre corpus :
  //   il            fr=37 it=21   bruit ZERO
  //   para por está es/pt          bruit 1
  //   co jak        cs/pl          bruit ZERO
  //   tas tik       lv/lt          bruit ZERO
  //   ce au         ro/fr          bruit ZERO
  //
  // DEHORS : `bet`, que le crible donne a bruit zero pour le lituanien et le
  // letton. C'est de l'anglais de chat courant, et le corpus n'en contient
  // simplement pas. Critere (a), comme `may` pour le tagalog.
  [/(^|[^\p{L}])(para|por|está|vez)([^\p{L}]|$)/iu, ['es', 'pt']],
  [/(^|[^\p{L}])(co|jak)([^\p{L}]|$)/iu, ['cs', 'pl']],
  // Descente du plancher du crible de huit lignes a quatre, deuxieme recolte.
  //
  // `že jeho dnes` vise `sk -> cs`, 18 lignes, et c'est la seule paire slave
  // encore ouverte. `oli` vise le couple finno-estonien, que rien ne separait en
  // plein air. `per` est catalan et italien, l'espagnol ecrit `por` et le
  // francais `par`.
  //
  // DEHORS PAR LE CRITERE (a), et c'est le meme filtre a chaque fois :
  //   cosa    donne a bruit zero pour ca/it, mais l'espagnol l'ecrit.
  //   die     de=18 nl=3, mais `die` EST dans le jeu allemand. Circulaire.
  //   ole     fi=8 et=3, mais `ole` EST dans le jeu finnois. Circulaire.
  //   mig sig sv/da, mais tous deux sont des mots qui TRANCHENT au nord.
  //   bet ar  lituanien et letton, mais `bet` est de l'anglais de chat.
  //
  // DEHORS PAR L'ABLATION, et c'est nouveau : `porte-ablation.mjs` mesure ce que
  // CHAQUE entree rapporte seule, en la retirant. `oli` pour fi/et et `jau` pour
  // lv/lt rapportent ZERO sur les quatre corpus, alors que le lot ou ils se
  // trouvaient rapportait +4. Un total de lot ne dit pas qui l'a gagne, et ces
  // deux-la seraient partis en production comme poids mort.
  // PAS DE SEQUENCE ASCII ICI, et c'est un resultat mesure, pas un oubli.
  //
  // Le deuxieme passage du crible a rendu `sz` hongrois-polonais et `dz`
  // polonais-letton-slovaque, tous deux propres sur les quatre corpus. Le banc
  // des lignes melangees les a refuses, et la raison vaut pour toute sequence
  // ASCII : LE DECLENCHEUR PEUT VIVRE DANS LE MOT QUI TRANCHE. `bardzo` porte
  // `dz` et il EST le mot polonais du jeu, donc la porte s'ouvre sur le mot
  // qu'elle consulte ensuite. Les deux indices censes etre independants n'en
  // font qu'un, et la porte degenere en une entree de lexique sans la borne de
  // vingt caracteres qui tient le lexique. Mesure : trois lignes melangees
  // nommees `pl` par `dz`, dont `he is cracked bardzo dobrze`.
  //
  // `sz` a le meme defaut, `nasz`, `jeszcze` et `wszystko` le portent, et il ne
  // rapportait que deux lignes. Le corpus melange ne contient simplement aucune
  // ligne qui l'expose, ce qui ne prouve rien : c'est la lecon du corpus 3.
  //
  // Une porte a lettre accentuee n'a pas ce probleme : `ä` ne vit pas dans
  // `nicht`. Une porte de sequence demanderait de verifier que le declencheur
  // tombe HORS du mot trouve, et ca n'a pas paru valoir deux lignes.
  [/ü/iu, ['tr', 'de', 'et', 'hu']],
  [/ó/iu, ['hu', 'pl', 'vi', 'es', 'pt', 'ca', 'sk']],
  [/ú/iu, ['sk', 'hu', 'vi', 'es', 'pt', 'ca', 'cs']],
  [/ç/iu, ['tr', 'pt', 'fr', 'ca']],
  // La plus grosse de toutes : dix langues ecrivent le e accent aigu, et il y a
  // 145 lignes muettes derriere. Dix, c'est beaucoup pour une porte, mais les
  // jeux de mots ne se croisent pas et une porte qui ne tranche pas ne coute
  // rien : elle passe la main a la suivante.
  [/é/iu, ['fr', 'hu', 'ca', 'es', 'pt', 'cs', 'sk', 'it', 'nl', 'vi']],
  [/í/iu, ['sk', 'cs', 'es', 'hu', 'ca', 'pt', 'vi']],
  [/ö/iu, ['sv', 'hu', 'tr', 'de', 'fi']],
  // CINQ PORTES RETIREES PAR L'ABLATION, et c'est le resultat le plus utile
  // qu'elle ait donne : `[ďťň]` sk/cs, `ô` vi/sk/fr, `ê` pt/vi/fr, `â`
  // ro/vi/fr/pt et `ò` it/vi/ca rapportaient chacune ZERO sur les quatre
  // corpus. Trois d'entre elles etaient vivantes quand elles sont entrees et
  // sont mortes deux commits plus tard, quand les trente-cinq lettres
  // vietnamiennes ont nomme `vi` avant que la porte ne soit consultee.
  //
  // Un ajout peut donc TUER une entree existante ailleurs dans le fichier, et
  // rien dans les totaux ne le signale. Relancer l'ablation apres chaque lot.
  [/ý/iu, ['sk', 'cs', 'vi']],
  [/è/iu, ['it', 'ca', 'fr']],
  [/à/iu, ['fr', 'vi', 'ca', 'it']],
];

function porteQuelleLangue(text: string): string | undefined {
  // Une lettre accentuee dans une ligne anglaise est un nom propre, `pokémon`,
  // `mbappé`, et le jeu ouvert lisait alors `most` hongrois.
  if (porteUnMotAnglais(text)) return undefined;
  for (const [porte, langues] of PORTES_PARTAGEES) {
    if (!porte.test(text)) continue;
    const vus = langues.filter((l) => JEUX_DE_PORTE[l]!.test(text));
    if (vus.length === 1) return vus[0];
  }
  return undefined;
}

/**
 * L'estonien et le portugais, que le o barre reunit et que tout le reste separe.
 *
 * `õ` est la seule lettre que l'estonien pourrait avoir en propre, et il la
 * partage avec le portugais, qui l'ecrit dans põe, limões, corações. Elle etait
 * donc DEHORS de la table des lettres exclusives, comme ø et æ avant la regle de
 * paire. Mesure sur les deux corpus : 42 lignes estoniennes et UNE portugaise,
 * et rien d'autre nulle part. C'est la porte la plus deseequilibree du fichier,
 * et c'est ce qui la rend facile : les deux langues n'ont aucun mot commun.
 *
 * Meme forme que les trois autres portes, et c'est la quatrieme fois qu'elle
 * sert : le nordique, le malais-indonesien, le scandinave a trois, celle-ci.
 * Une lettre qui nomme un petit ensemble vaut mieux qu'une lettre qui ne nomme
 * personne, et il suffit d'un second tour pour choisir dedans.
 *
 * Derriere la porte, `on`, `ei`, `ma`, `ta`, `ja` et `see` redeviennent
 * utilisables alors qu'ils sont impossibles en plein air : `on` est anglais,
 * `ja` est allemand, neerlandais et finnois, `ta` est une demi-douzaine de
 * langues. C'est exactement ce que les trois autres portes offrent deja.
 */
const O_BARRE = /õ/iu;
const MOTS_ESTONIENS =
  /(^|[^\p{L}])(on|ei|ja|see|ta|ma|kõik|väga|miks|midagi|praegu|jälle|kas|aga|siis|nii|kui)([^\p{L}]|$)/iu;
const MOTS_PORTUGAIS =
  /(^|[^\p{L}])(que|não|nao|de|para|uma|com|isso|você|voce|mais|muito|está|esta)([^\p{L}]|$)/iu;

function estonienOuPortugais(text: string): string | undefined {
  if (!O_BARRE.test(text)) return undefined;
  const et = MOTS_ESTONIENS.test(text);
  const pt = MOTS_PORTUGAIS.test(text);
  if (et && !pt) return 'et';
  if (pt && !et) return 'pt';
  return undefined;
}

/**
 * Le malais et l'indonesien, la derniere paire de la matrice a n'avoir rien.
 *
 * `id -> ms` et `ms -> id` valent 49 et 38 lignes, le plus gros bloc restant, et
 * aucune des deux langues n'etait traitee nulle part. Elles ne se separent pas
 * par une lettre : elles s'ecrivent avec le meme alphabet latin nu, sans un seul
 * diacritique. Il ne reste que le lexique.
 *
 * Meme forme que le danois et le norvegien, et pour la meme raison : ce qui les
 * nomme d'abord, c'est la PAIRE. Une quinzaine de mots outils leur sont communs
 * et n'existent dans aucune des quarante autres langues, yang, tidak, dengan,
 * untuk, saya, ini, itu. Une ligne qui en porte un est malaise ou indonesienne,
 * point, et un second tour choisit dedans.
 *
 * CE QUE LA PORTE OFFRE, et c'est la meme chose qu'au nord : elle rend
 * utilisables des mots qui ne le seraient pas en plein air. `uang` touche une
 * ligne vietnamienne du banc et `mobil` une ligne italienne, donc aucun des deux
 * ne pourrait entrer dans `SHORT_WORD_LANG` ; derriere une porte qui exige deja
 * un mot outil malais-indonesien, ils ne coutent rien, et la mesure de bout en
 * bout le confirme, aucune confusion n'apparait nulle part.
 *
 * LES PAIRES qui tranchent opposent deux formes du meme mot, ce qui est plus sur
 * qu'une presence contre une absence :
 *   bisa contre boleh      coba contre cuba       karena contre kerana
 *   besok contre esok      kamar contre bilik     mau contre mahu
 *   saja contre sahaja     kamu contre awak       kayak contre macam
 *
 * CE QUI EST DEHORS :
 *   akan   mot outil des deux, mais c'est aussi du turc.
 *   anda   c'est de l'espagnol.   ada  c'est du turc, une ile.
 *   tak    dix lignes malaises, mais aussi tcheque, polonais, anglais et cinq
 *          autres. C'est le mot le plus frequent du malais familier et il est
 *          inutilisable.
 *   boleh  propose pour le malais, l'indonesien l'ecrit aussi, 2 contre 6.
 *   saja   propose pour l'indonesien, une ligne malaise le porte.
 *   kereta c'est bien la voiture en malais, mais l'indonesien dit kereta api
 *          pour le train. Mesure propre, sorti quand meme.
 *   lu gue  pronoms de l'indonesien de Jakarta, et `lu` touche vingt-trois
 *          autres langues. Le mot le plus typique du registre vise est le plus
 *          impossible a employer.
 *
 * CE QUE CA NE FAIT PAS, et le chiffre est petit exprès pour qu'on ne le
 * survende pas : la paire ne se ferme pas. `id -> ms` passe de 49 a 48. La prose
 * de Tatoeba dans ces deux langues est ecrite presque entierement avec ce
 * qu'elles partagent, et ce qui les separe vit dans le registre familier, que ce
 * corpus n'a pas. Le gain reel est ailleurs : treize lignes que le chemin sur ne
 * savait pas nommer, et qu'il nomme sans se tromper une seule fois.
 */
// `lagi` est entre au tour du corpus de paire, et c'est le SEUL des neuf mots
// partages que le crible rendait a en valoir la peine : les huit autres,
// `kamu sini makan sedang tahu bahasa berapa sekarang`, sont propres, partages,
// et rapportent ZERO ligne sur les cinq corpus. Mesure par ablation, mot a mot.
//
// Ce que ce zero dit vraiment, et c'est le resultat du tour : le declencheur
// n'est PAS ce qui bloque la paire. Les mots que ce crible peut rendre viennent
// des corpus paralleles, qui sont en registre neutre ; les mots partages du
// registre familier n'y sont pas, donc il ne peut pas les proposer. Voir
// `langChatPaire.test.ts`.
//
// CETTE CONCLUSION ETAIT FAUSSE, ET C'EST LE CRIBLE QUI L'ETAIT, PAS LA PORTE.
// `porte-diagnostic.mjs` compte la seule chose qui tranche : sur les trente
// lignes malaises du corpus de reglage, VINGT-QUATRE avaient la porte FERMEE.
// Le jeu malais derriere n'y etait pour rien, il n'etait jamais consulte.
// Le declencheur etait bien ce qui bloquait ; ce qui manquait etait un crible
// qui cherche dans le registre familier au lieu des corpus paralleles, et
// c'est `paire-declencheur.mjs`.
//
// `aku` PORTE LE TOUR A LUI SEUL. "je, moi", les deux langues l'ecrivent, il
// ouvre quatorze des trente-six lignes fermees, et il ne touche AUCUNE des
// 5850 lignes etiquetees des autres langues. Il etait sous les yeux depuis le
// debut, et le test de la paire le cite meme en exemple de ce que le chat
// familier ecrit, deux paragraphes avant la liste ou il ne figure pas.
//
// TRENTE-QUATRE MOTS ONT ETE MESURES, CINQ SONT ICI. L'ablation mot a mot est
// sans appel : `aku` `pagi` `pergi` `habis` `sore` bougent un corpus qu'ils
// n'ont pas servi a choisir, les vingt-neuf autres ne bougent QUE le corpus de
// reglage. Et la version complete a trente-quatre mots donne exactement le
// meme chiffre que celle-ci sur les neuf autres bancs, aveugle compris : les
// vingt-neuf mots en trop achetaient seize lignes du corpus ou on les avait
// lus, et rien nulle part ailleurs. C'est le meme fond que le tour de lexique
// marginal de 5.18, atteint par un autre chemin.
//
// CE QUI EST REFUSE CE TOUR, avec ce que la langue ecrit ailleurs :
//   sana   le finnois ecrit "mot" et le turc "a toi"
//   bola   le portugais et l'espagnol ecrivent "balle"
//   exam   l'anglais et le roumain l'ecrivent
//   klinik l'allemand, le turc, le suedois et le danois l'ecrivent
//   bulan  le turc ecrit "celui qui trouve"
//   tadi   le turc `tadı` depouille de son point donne la meme chaine
//   ni     mesure : catalan, slovene, suedois et tagalog, treize lignes
//
// LA MORPHOLOGIE A ETE ESSAYEE ET ELLE NE MARCHE PAS, et c'etait la piste que
// la file de travail demandait, parce qu'un affixe ne memorise rien. Les neuf
// candidats sont dans `paire-declencheur.mjs` avec leurs chiffres : `-nya` est
// catalan et hongrois, `-kan` est suedois, `ber-` touche six langues, `se-` en
// touche dix-sept, et le seul propre, `-lah`, n'ouvre aucune ligne. Un affixe
// de trois lettres en ecriture latine est trop court pour appartenir a une
// langue. La porte de cette paire restera faite de mots.
//
// LA CONTRAINTE QUI BORNE LES DEUX JEUX DERRIERE, et elle se relit avant tout
// ajout : sur les 5850 lignes etiquetees hors de la paire, UNE SEULE ouvre
// cette porte, une ligne polonaise sur `pada`. Tant que ce chiffre reste a un,
// les deux jeux peuvent contenir des mots courts. Des qu'il monte, chacun
// devient un piege, et c'est exactement ce qui est arrive a `je` ci-dessous.
const MOTS_MALAIS_INDONESIENS =
  /(^|[^\p{L}])(yang|tidak|dengan|untuk|saya|ini|itu|dari|pada|sudah|mereka|dalam|lebih|orang|apa|lagi|tidur|siapa|baru|makan|sini|aku|pagi|pergi|habis|kena|sampai|bukan)([^\p{L}]|$)/iu;
const MOTS_INDONESIENS =
  /(^|[^\p{L}])(bisa|uang|mobil|coba|karena|besok|kamar|kayak|nggak|gak|gimana|aja|nih|dong|sih|kemarin|sore|gitu)([^\p{L}]|$)/iu;
// LES PARTICULES MALAISES, et c'est la porte qui les rend possibles.
//
// `tak`, `dah`, `je`, `weh` sont ce que le chat malaisien ecrit tout le temps et
// ils sont TOUS impossibles en plein air : `tak` est tcheque, polonais, anglais
// et cinq autres, `je` est francais, tcheque et slovene, `dah` vit dans le turc
// `daha`. Le fichier les avait ecartes pour cette raison.
//
// Derriere la porte malais-indonesien il n'y a plus ni tcheque ni francais ni
// slovene : il ne reste que deux langues, et l'indonesien ecrit `gak`, `udah`,
// `aja` a la place. Les memes mots redeviennent propres. C'est exactement ce que
// les portes a lettre font depuis `a7ac4c2`, applique a des particules.
//
// CE QUI A BLOQUE JUSQU'ICI, et c'est une limite de l'ablation mot a mot : le
// declencheur et le mot qui tranche sont COUPLES. Ajouter `kalah` au declencheur
// ouvre la porte sur une ligne malaise, mais si le jeu malais n'a rien derriere,
// la ligne reste muette et `kalah` mesure zero. Ajouter `tak` au jeu ne sert a
// rien tant que la porte reste fermee. Mesures separement, les deux moities
// rendent zero ; ensemble elles rendent six lignes du corpus aveugle.
//
// Le diagnostic qui l'a montre est `porte-diagnostic.mjs` : il separe "porte
// fermee" de "porte ouverte, aucun mot ne tranche". Vingt-quatre des vingt-huit
// lignes malaises muettes avaient la porte FERMEE.
//
// DEHORS : `kau`, que l'indonesien ecrit aussi, mesure sur
// `Kenapa kau tidak mempercayaiku?` qui partait au malais. `lah`, `tu`, `ni`,
// `korang` sont corrects et rapportent zero hors du corpus ou ils ont ete lus.
//
// `je` EST SORTI, ET C'EST LE DEFAUT LE PLUS INSTRUCTIF DE LA PAIRE. Il etait
// sur lui-meme, ecrit ici comme tel, et rien dans le fichier ne le rendait
// faux. C'est l'elargissement du DECLENCHEUR qui l'a rendu faux : `aku` ouvre
// la porte sur `To je ta najhlupejsia vec, aku som kedy povedal.`, une ligne
// slovaque privee de ses diacritiques, ou `akú` donne `aku`. Derriere la porte
// ainsi ouverte, `je` a nomme le malais.
//
// LA REGLE A EN RETENIR : elargir un declencheur rend RETROACTIVEMENT moins
// surs tous les mots derriere lui. Le fichier disait deja que les deux moities
// sont couplees pour le GAIN ; elles le sont aussi pour le RISQUE, et c'est ce
// sens-la qui coute des lignes. Relire les deux jeux a chaque fois que la
// porte bouge.
//
// Deux formes ont ete mesurees, 4.6. Garder `je` en exigeant la fin de phrase,
// ce que le malais en fait et pas le francais ni le tcheque, donne exactement
// le meme chiffre sur le corpus AVEUGLE que de le supprimer, et une ligne de
// plus sur le corpus de reglage, qui ne prouve rien. A resultat egal la forme
// simple gagne, donc il est simplement supprime.
// TROISIEME TOUR DU TRI, et il rend deux mots pour quatre mesures. Le crible de
// sequences porte a la paire, `paire-sequences.mjs ms id`, ne trouve presque
// rien : la prose de Tatoeba dans ces deux langues est ecrite avec ce qu'elles
// partagent, et les sequences propres du corpus sont des mots que les deux
// ecrivent, `perlu`, `burung`, `anak`, `cara`. Le corpus les rend exclusifs par
// absence, pas par la langue.
//
// Ce qui passe est une difference orthographique attestee : `lelaki` contre
// `laki-laki`, et `gitu` que l'indonesien familier ecrit et que le malais non.
// `rosak` contre `rusak` et `wang` contre `uang` sont corrects aussi et sortent
// a l'ablation, chacun deja couvert sur ses propres lignes.
//
// Le bloc `id -> ms` de la matrice reste donc ouvert et il faut le dire ainsi :
// ce n'est pas une regle qui manque, c'est un corpus. Les deux langues se
// separent dans le registre familier, que Tatoeba ne contient pas, et les deux
// corpus de paire le montrent en passant de 48 a 65 % pendant que la matrice ne
// bouge pas.
// Pas `dah` : l'indonesien familier l'ecrit aussi (`udah`, `dah`).
const MOTS_MALAIS =
  // pas `betul` ni `memang` : l'indonesien les ecrit tous les jours.
  /(^|[^\p{L}])(kerana|sahaja|cuba|esok|bilik|mahu|jom|tengok|macam|sikit|jugak|nak|tiada|teruk|nampak|berlaku|tak|weh|lelaki)([^\p{L}]|$)/iu;

function malaisOuIndonesien(text: string): string | undefined {
  if (!MOTS_MALAIS_INDONESIENS.test(text)) return undefined;
  const id = MOTS_INDONESIENS.test(text);
  const ms = MOTS_MALAIS.test(text);
  if (id && !ms) return 'id';
  if (ms && !id) return 'ms';
  return undefined;
}

/**
 * Vote unanime, comme pour le lexique : deux jeux exclusifs de langues
 * DIFFERENTES dans la meme ligne, c'est une citation ou un pseudo, donc rien.
 *
 * La comparaison porte bien sur la langue et pas sur le nombre de
 * correspondances, et ca n'a pas toujours ete le cas. La version d'origine
 * rendait `undefined` des la DEUXIEME entree touchee, quelle qu'elle soit, ce
 * qui etait sans effet tant qu'une langue n'avait qu'une entree. Des que
 * l'italien en a eu deux, `-issimo` et `-simo`, une ligne portant les deux est
 * devenue muette alors que les deux disaient italien. Le test du banc latin sur
 * `sta giocando malissimo` l'a attrape.
 */
/**
 * Ce que la table ne doit pas lire, retire avant de la consulter.
 *
 * L'etirement d'abord : `heyyy` et `okayyy` portaient le `yy` finnois, et un
 * `yy` de trois lettres ou plus n'est jamais finnois, c'est un cri. Ramener la
 * serie a une lettre garde le `yy` du finnois ecrit, qui n'en a jamais trois.
 * Puis trois mots de chat anglais qui tombaient sur une terminaison : `wait` et
 * `bait` sur le `-ait` francais, `lich` (World of Warcraft) sur le `-lich`
 * allemand, qui n'existe jamais seul. Et `fight`, `night`, `goodnight`, que tout
 * le chat emprunte et que le `-ght` anglais lisait anglais (`daj, pokazi boss fight`).
 */
const ANGLAIS_DE_CHAT = /(^|[^\p{L}])(wait|bait|lich|fight|night|goodnight)(?=[^\p{L}]|$)/giu;

function detectByExclusiveLetter(raw: string): string | undefined {
  const text = raw.replace(/(\p{L})\1{2,}/gu, '$1').replace(ANGLAIS_DE_CHAT, '$1 ');
  let vote: string | undefined;
  for (const [lettres, lang] of LETTRES_EXCLUSIVES) {
    if (!lettres.test(text)) continue;
    if (vote && vote !== lang) return undefined;
    vote = lang;
  }
  return vote;
}

/**
 * L'ecriture arabe n'est pas une langue.
 *
 * Le pre-controle rendait `ar` pour tout ce qui s'ecrit dans le bloc arabe, et
 * il le rendait comme une reponse SURE, donc comme `sl` envoye au moteur.
 * Mesure sur douze lignes persanes : douze sur douze declarees arabes, avec
 * `sl=ar`. Le persan est une des 42 langues proposees et la fiche des stores
 * vend le sens droite-a-gauche par "arabe, hebreu, persan". Trois degats a la
 * fois : le moteur traduit depuis la mauvaise langue, le drapeau est faux, et
 * un lecteur arabophone voit chaque ligne persane sautee comme "deja dans ta
 * langue". franc, lui, sait : il rend `pes` sur sept de ces huit lignes, et il
 * n'etait jamais consulte puisque l'ecriture repondait avant lui.
 *
 * Ce qui separe les trois, ce sont des LETTRES, pas une statistique : le persan
 * ajoute pe, tcheh, jeh, gaf, keheh et farsi yeh au jeu arabe, et l'ourdou
 * ajoute encore tteh, ddal, rreh, noon ghunna, heh doachashmee, yeh barree et
 * heh goal par-dessus le persan. L'ourdou se teste donc EN PREMIER, sinon ses
 * lettres persanes le font passer pour du persan.
 *
 * Mesure de la regle : persan 11 sur 12, arabe 12 sur 12 sans un seul faux
 * positif, ourdou 4 sur 4. La ligne persane manquee, "salam be hame", ne
 * contient aucune lettre hors du jeu arabe et rien dans le texte ne permet de
 * la distinguer.
 *
 * L'ourdou rend `undefined` et non son code : il n'est pas dans les 42 langues
 * du produit, donc l'annoncer produirait un drapeau que rien ne sait dessiner.
 * Ce qui compte est qu'il ne soit plus annonce comme arabe.
 */
const LETTRES_PERSANES = /[پچژگکی]/u;
const LETTRES_OURDOUES = /[ٹڈڑںھےہ]/u;
/**
 * Le malais ecrit en jawi, qui est de l'ecriture arabe.
 *
 * Six des 120 lignes malaises du corpus ne sont pas en alphabet latin : Tatoeba
 * publie du `zsm` en jawi, et le pre-controle lisait leur ecriture correctement
 * pour en conclure `ar`. Cinq erreurs `ms -> ar` et une `ms -> fa`, soit six des
 * dix-huit erreurs restantes du chemin sur, sur une langue que le produit offre.
 *
 * Meme raisonnement que le persan juste au-dessus, meme forme : le jawi ajoute
 * des lettres au jeu arabe, donc ces lettres le nomment. nga, pa, ga et nya sont
 * mesurees sur les 5040 lignes et ne touchent que le malais, trois, deux, trois
 * et une ligne. ݢ et ۏ n'apparaissent nulle part dans le corpus mais sont jawi
 * seules et entrent au meme titre : une mesure a zero ne prouve pas une absence,
 * elle ne contredit rien.
 *
 * Le jawi se teste AVANT le persan et pas apres, parce qu'il emploie چ qui est
 * dans le jeu persan. Sans cet ordre, une ligne jawi portant un cheh ressort
 * persane, ce qui est exactement l'erreur `ms -> fa` mesuree.
 *
 * CE QUI EST DEHORS : چ, justement. Il est jawi ET persan, vingt-cinq lignes
 * persanes du banc contre une malaise, donc il est du mauvais cote du rapport.
 *
 * LA LIMITE, chiffree : trois des six lignes jawi ne portent aucune de ces
 * lettres et restent lues arabes. Le jawi partage l'essentiel de son jeu avec
 * l'arabe, exactement comme le chinois traditionnel partage l'essentiel du sien
 * avec le simplifie, et la meme phrase s'applique : ce qui reste demande de
 * sortir du niveau de la lettre.
 */
const LETTRES_JAWI = /[ڠڤڬڽݢۏ]/u;

/**
 * Le repli `ar` est une ELIMINATION et non une devinette, contrairement au repli
 * `ru` du cyrillique qui a ete retire. La difference est structurelle et vaut
 * d'etre ecrite, parce que les deux fonctions se ressemblent assez pour qu'on
 * veuille leur appliquer le meme correctif.
 *
 * Le persan, l'ourdou et le jawi sont l'arabe PLUS des lettres. L'arabe n'a donc
 * aucun marqueur positif a lui : il est ce qui reste quand aucune extension ne
 * se manifeste, et c'est une lecture. Le russe, lui, n'etait pas la base du
 * cyrillique, il en etait un membre parmi trois, et le nommer par defaut etait
 * une devinette. Rendre `undefined` ici ferait tomber l'arabe de 120 lignes a
 * presque rien sans corriger quoi que ce soit.
 */
/**
 * LES MOTS PERSANS, pour les lignes qui n'ont aucune lettre persane.
 *
 * Sept lignes persanes du banc s'ecrivent entierement avec le jeu arabe, donc
 * la classe de lettres ci-dessus ne peut rien pour elles et elles ressortaient
 * arabes. C'etait le plus gros bloc d'erreurs restant du chemin sur, sept sur
 * treize, et la lettre avait fait tout ce qu'elle pouvait.
 *
 * `arabe-candidats.mjs` est la passe a mots du crible, portee a l'ecriture
 * arabe. Ces six-la sont ecrits par le persan seul sur les 240 lignes arabes et
 * persanes du banc, bruit ZERO, et surtout on sait dire ce que l'arabe ecrit a
 * la place, ce qui est le critere (a) :
 *
 *   است   la copule. L'arabe n'en a pas, ou ecrit `يكون`.
 *   را    la marque d'objet. L'arabe n'a pas de particule equivalente.
 *   از    "de, depuis". L'arabe ecrit `من`.
 *   او    "il, elle". L'arabe ecrit `هو` ou `هي`.
 *   بود   "etait". L'arabe ecrit `كان`.
 *   هر    "chaque". L'arabe ecrit `كل`.
 *
 * CE QUI EST DEHORS malgre un bruit mesure a zero : `به` et `در`, parce que
 * l'arabe les ecrit bel et bien, `بِهِ` "avec lui" et `دُرّ` "perle", et que sans
 * voyelles ce sont les memes chaines. Le corpus n'en contient aucune, ce qui ne
 * prouve rien. `ام` est a deux lettres et l'arabe ecrit `أم` sans hamza assez
 * souvent pour que ce soit le meme token.
 *
 * L'ourdou passe AVANT et n'est pas concerne : il ecrit `ہے`, `سے`, `وہ`, `تھا`
 * et son `ہر` prend le he U+06C1, pas le U+0647 du persan.
 */
/**
 * LES MOTS DU JAWI, meme raisonnement que les mots persans juste en dessous, et
 * meme limite : trois des six lignes jawi du banc ne portent aucune des six
 * lettres jawi. Deux ressortaient arabes et une persane, parce qu'elle ecrit
 * `مريک` avec le keheh que le persan revendique.
 *
 * CE QUI DECIDE ICI N'EST PAS LA MESURE. Le banc ne contient que six lignes en
 * jawi, donc tout mot qui y apparait est "ecrit par ms seul" par construction,
 * et le crible ne peut rien dire. Seul le critere (a) tient :
 *
 *   ساي    saya, "je". L'arabe ecrit `أنا`, le persan `من`.
 *   تيدق   tidak, "ne pas". L'arabe ecrit `لا`, le persan `نه`.
 *   كامو   kamu, "tu". L'arabe ecrit `أنت`, le persan `تو`.
 *
 * DEHORS : `اين` pour `ini`, parce que l'arabe ecrit `أين` "ou" et que sans la
 * hamza c'est la meme chaine. `ايت` pour `itu`, meme probleme avec `آية`.
 * `دان` pour `dan`, qui est un mot persan. Les trois mesurent propre sur le
 * banc et les trois sont refuses, ce qui laisse une ligne jawi non couverte,
 * `هيدو اين.`, et c'est le prix a payer.
 *
 * Teste APRES les lettres jawi et AVANT le persan : c'est le meme ordre que
 * pour les lettres, et c'est lui qui recupere la ligne `ms -> fa`.
 */
const MOTS_JAWI = /(^|[^\p{L}])(ساي|تيدق|كامو)([^\p{L}]|$)/u;

// pas `او` : c'est aussi le `ou` arabe ecrit sans hamza.
const MOTS_PERSANS = /(^|[^\p{L}])(است|را|از|بود|هر)([^\p{L}]|$)/u;

/**
 * L'ARABE DOIT SE NOMMER LUI AUSSI, et c'est ce qui manquait ici.
 *
 * Cette fonction tranchait par elimination : si rien ne disait ourdou, jawi ni
 * persan, la reponse etait `ar`. Un defaut, pas une lecture. Il coutait les
 * QUATRE dernieres erreurs persanes du chemin sur, et elles ne sont pas
 * refermables par un mot persan de plus : `arabe-candidats.mjs` le dit
 * lui-meme, deux de ces lignes ne portent aucun mot candidat et les deux
 * autres n'ont que des mots deja refuses parce que l'arabe les ecrit aussi.
 *
 * Les quatre lettres sont la SYMETRIE EXACTE de LETTRES_PERSANES : ce sont
 * celles que l'orthographe arabe ecrit et que l'orthographe persane remplace.
 *
 *   ة  teh marbuta, le persan ecrit ه
 *   ى  alef maksura, le persan ecrit ی
 *   ي  yeh arabe U+064A, le persan ecrit ی U+06CC
 *   ك  kaf arabe U+0643, le persan ecrit ک U+06A9
 *
 * Mesure, `arabe-preuve.mjs` : les quatre lettres couvrent 110 des 120 lignes
 * arabes du banc et ZERO des 130 persanes. Les sept mots outils montent la
 * couverture a 117 sans ajouter une ligne de bruit. L'article defini `ال` a
 * ete mesure aussi : il n'ajoute AUCUNE couverture par-dessus les deux autres
 * et ramene trois lignes persanes, parce que `الهام` et `الامکان` sont des
 * mots persans qui commencent par ces deux lettres. Il est dehors.
 *
 * `من` EST DEHORS ET C'EST LE PIEGE DE CETTE PASSE. C'est "de, depuis" et
 * "qui" en arabe, et c'est le pronom "je" en persan, au caractere pres. Il
 * portait a lui seul dix-sept des dix-neuf lignes de bruit du premier essai.
 *
 * CE QUE LE CHANGEMENT COUTE, et il faut le lire dans ce sens : trois lignes
 * arabes ne portent aucune des deux preuves et deviennent MUETTES, c'est-a-dire
 * sures. Quatre lignes persanes cessent de sortir arabes. Sur ce chemin la
 * colonne fausse coute plus cher que la colonne juste, donc trois contre quatre
 * se tranche dans ce sens, comme `hon` pour le suedois deux campagnes plus tot.
 *
 * La ligne jawi `هيدو اين.` reste fausse : elle porte un ي, donc la preuve
 * arabe la nomme. C'est le meme prix qu'avant et il est deja ecrit plus haut.
 */
const LETTRES_ARABES = /[ةىيكإأؤئ]/u;
const MOTS_ARABES = /(^|[^\p{L}])(أن|لا|هل|هذه|هذا|عن|لم)([^\p{L}]|$)/u;
const ARTICLE_ARABE = /(^|[^\p{L}])ال\p{L}/u;

/**
 * LES MOTS DU CHAT ARABE, pour les lignes que rien ci-dessus ne nomme.
 *
 * Les salutations les plus courantes d'un chat arabe ne portent ni lettre ni
 * mot outil de l'arabe standard : `مرحبا`, `منور`, `شو صار`. Elles sortaient
 * d'ici sans reponse et franc y lisait du PERSAN (`pes`), donc un lecteur
 * persanophone voyait la salutation sautee comme "deja dans ta langue".
 * Mesure sur `LANG_CHAT_AR_FA` avant correction : arabe 19 justes, 13 muettes,
 * 8 fausses, dont 7 rendues `fa`.
 *
 * Meme critere (a) que les mots persans : on sait ce que le persan ecrit a la
 * place, et aucun n'a de vie persane courante.
 *
 *   مرحبا  "salut". Le persan dit `سلام` ; son `مرحبا` "bravo" est litteraire.
 *   صار    "c'est arrive", le `شو صار` / `وش صار` du chat. Le persan ecrit `شد`.
 *   وش     "quoi" du Golfe. Le persan ecrit `چی`.
 *   منور   "tu illumines le stream". Le persan dit `خوش اومدی`.
 *   نورت   meme formule, a la deuxieme personne. Aucun equivalent persan.
 *   حلو    "beau, bien". Le persan ecrit `خوب` ; son `حلوا` est un dessert.
 *   مش     la negation egyptienne et levantine. Le persan ecrit `نه`.
 *   عاش    "bravo, il a vecu". Le persan dit `ایول`.
 *   تسلم   "merci, que tu sois sauf". Le persan ecrit `تسلیم` avec un ی.
 *   هلا    "bienvenue". Le persan dit `سلام`.
 *
 * DEHORS, et ce sont les pieges du corpus : `ممتاز`, `تمام`, `خلاص` et `بس`.
 * Le persan les ecrit tous les quatre, `ممتاز بود`, `تمام شد`, `خلاص شدم`,
 * `بس کن`, et `تمام` et `بس` sont deja dans les lignes persanes de Tatoeba.
 * `شو` aussi, que le persan emprunte pour "show".
 *
 * La reponse n'est PAS sure : elle nourrit les filtres et le drapeau, comme
 * l'arabizi, et ne part pas au moteur comme `sl`. Le corpus est ecrit a la
 * main, par qui a choisi les mots ; annoncer `sl=ar` sur cette base n'a pas ete
 * mesure ailleurs.
 */
const MOTS_ARABES_CHAT =
  /(^|[^\p{L}])(مرحبا|صار|وش|منور|نورت|حلو|مش|عاش|تسلم|هلا)([^\p{L}]|$)/u;

/** Une ligne arabe de chat, en dehors de tout ce que le pre-controle sait lire. */
function arabeDeChat(text: string): boolean {
  if (LETTRES_OURDOUES.test(text) || LETTRES_JAWI.test(text) || LETTRES_PERSANES.test(text))
    return false;
  const lettres = [...text].filter((c) => /\p{L}/u.test(c));
  const arabes = lettres.filter((c) => /[\u0600-\u06ff]/u.test(c)).length;
  return arabes * 2 > lettres.length && MOTS_ARABES_CHAT.test(text);
}

function arabeOuPersan(text: string): string | undefined {
  if (LETTRES_OURDOUES.test(text)) return undefined;
  // Le Golfe et le Maghreb ecrivent leur v avec `ڤ` (`ڤيديو حلو`) : un mot arabe
  // de la ligne l'emporte sur la lettre jawi.
  if (LETTRES_JAWI.test(text) && !MOTS_ARABES.test(text) && !MOTS_ARABES_CHAT.test(text)) return 'ms';
  if (MOTS_JAWI.test(text)) return 'ms';
  if (LETTRES_PERSANES.test(text)) return 'fa';
  if (MOTS_PERSANS.test(text)) return 'fa';
  if (LETTRES_ARABES.test(text) || MOTS_ARABES.test(text) || ARTICLE_ARABE.test(text))
    return 'ar';
  return undefined;
}

/**
 * L'ecriture cyrillique n'est pas une langue non plus.
 *
 * Signale par kil en testant sur une chaine mongole : le pre-controle rendait
 * `ru` pour tout ce qui s'ecrit en cyrillique, et le rendait comme une reponse
 * SURE. Mesure : vingt lignes mongoles sur vingt declarees russes avec `sl=ru`,
 * huit lignes ukrainiennes sur huit, huit bulgares sur huit. Le degat est le
 * meme que pour le persan pris pour de l'arabe, et il est pire ici parce que
 * franc ne peut pas rattraper : franc-min ne porte pas le mongol du tout, sa
 * liste cyrillique est rus, ukr, bos, srp, uzn, azj, koi, bel, bul, kaz.
 *
 * Le mongol se reconnait a deux voyelles que le russe n'a pas, ө et ү, et a une
 * poignee de particules qui reviennent dans presque toutes ses phrases. Mesure
 * de la couverture : les lettres seules prennent 8 lignes sur 20, les lettres
 * plus les particules en prennent 17, et l'ensemble fait ZERO faux positif sur
 * douze lignes russes, huit ukrainiennes et huit bulgares.
 *
 * Le mongol rend `undefined` et non un code : il n'est pas dans les 42 langues
 * du produit. Ce qui compte est qu'il cesse de partir au moteur en `sl=ru`, ce
 * qui demandait de traduire du mongol depuis le russe ; avec `sl` vide le moteur
 * detecte seul et rend une vraie traduction.
 *
 * L'ukrainien, lui, est dans les 42, donc il prend son code. Ses lettres propres
 * sont i, yi, ye et ge, absentes du russe : 6 lignes sur 8 a la mesure.
 *
 * Le bulgare, signale lui aussi par kil, n'a pas de lettre exclusive : il
 * partage l'alphabet russe. Ce qui le separe est l'inverse, une ABSENCE, plus
 * deux signaux positifs. Le russe ecrit ы, э et ё, le bulgare aucun des trois ;
 * le bulgare ecrit ъ comme une voyelle ordinaire la ou le russe l'emploie a
 * peine ; et sa copule au present, съм si сме сте са, n'existe pas en russe, qui
 * n'en a pas au present du tout.
 *
 * Le chiffre de couverture du bulgare est le seul de ce fichier qui ait ete
 * mesure DEUX fois, et la difference vaut d'etre gardee. Une premiere liste,
 * etendue jusqu'a couvrir le banc qui avait servi a l'ecrire, donnait 20 sur 20 ;
 * la meme regle sur douze lignes bulgares ecrites APRES elle donnait 4 sur 12.
 * Le premier chiffre ne mesurait que l'ajustement. La liste a ensuite ete
 * completee par PARADIGME, la copule entiere et les interrogatifs entiers,
 * jamais par la liste des ratés, et le chiffre tenu a l'ecart est monte a 7 sur
 * 12. C'est celui-la qui compte.
 *
 * Ce qui ne bouge pas, et c'est le cote qui protege : zero faux positif sur
 * vingt-huit lignes russes, dix ukrainiennes et six mongoles, aucune n'ayant
 * servi a batir quoi que ce soit.
 */
const LETTRES_MONGOLES = /[өү]/iu;
const MOTS_MONGOLS = /(^|[^\p{L}])(байна|байгаа|юм|вэ|бэ|сайхан|байлаа)([^\p{L}]|$)/iu;
const LETTRES_UKRAINIENNES = /[іїєґ]/iu;
// LES MOTS UKRAINIENS, pour les lignes qui n'ecrivent aucune des quatre lettres.
//
// `Я це дуже добре знаю.` est ukrainienne, ne porte ni `і` ni `ї` ni `є` ni `ґ`,
// et tombait donc au test bulgare. C'etait la seule erreur cyrillique restante
// du chemin sur.
//
// Les trois entrent par le critere (a) autant que par le crible :
//   це    "ceci". Le russe ecrit `это`, le bulgare `това`. 12 lignes, 0 ailleurs.
//   дуже  "tres". Le russe ecrit `очень`, le bulgare `много`. 2 lignes, 0 ailleurs.
//   щоб   "pour que". Le russe ecrit `чтобы`, le bulgare `за да`. 3 lignes, 0 ailleurs.
//
// DEHORS : `треба`, qui est du serbe, et `добре` que le bulgare ecrit aussi,
// deux lignes bulgares contre une ukrainienne, ce qui est le mauvais sens.
// `знаю` est russe autant qu'ukrainien.
// ця, цей, знову, зараз : sans lettre propre, ni russes (эта, этот, снова, сейчас)
// ni bulgares (тази, този, пак, сега), коли (когда, кога). `ця мапа проклята` sortait bg.
const MOTS_UKRAINIENS = /(^|[^\p{L}])(це|дуже|щоб|ця|цей|знову|зараз|коли)([^\p{L}]|$)/iu;
const LETTRES_RUSSES = /[ыэё]/iu;
const ER_BULGARE = /ъ/iu;
/** L'article defini suffixe, que ni le russe ni l'ukrainien n'ont. */
const ARTICLE_BULGARE = /(ът|ата|ята)([^\p{L}]|$)/iu;
/** L'infinitif russe. Le bulgare n'en a pas, celui de l'ukrainien est -ти. */
// Pas -ють, qu'aucun infinitif russe ne porte, ni -плять : c'est le pluriel
// ukrainien (`знають`, `сплять`, `будуть`). -ить et -ять restent, bien que la
// troisieme personne ukrainienne les ecrive (`мама робить`) : les exclure rendait
// 9 lignes russes muettes et 5 fausses sur le chemin brut, ou franc les reprend.
const INFINITIF_RUSSE = /(?<!ю|пля|буду)ть([^\p{L}]|$)/iu;

/**
 * Les mots russes, symetriques de MOTS_BULGARES, et choisis par CONTRASTE.
 *
 * Aucun n'est ici parce qu'il est frequent en russe : chacun est ici parce que
 * le bulgare et l'ukrainien disent autre chose. spasibo contre blagodarya et
 * dyakuyu, eto contre tova et tse, ochen contre mnogo et duzhe, gde contre kade
 * et de. Zero faux positif sur les 240 lignes bulgares et ukrainiennes du banc.
 *
 * CE QUI EST DEHORS, en deux familles, parce qu'elles ne se rejettent pas pour
 * la meme raison et qu'un futur lecteur voudra savoir laquelle il rouvre.
 *
 * Rejetes par la MESURE, sur les 120 lignes de chaque langue :
 *   да     vingt-neuf lignes bulgares. C'est le mot que tout le monde dit.
 *   ли     dix lignes bulgares.   все  deux.   просто, как, него  une chacun.
 *   что    une ligne ukrainienne. C'etait pourtant le candidat le plus evident
 *          du lot, et il est dehors pour une seule ligne, ce qui est la regle.
 *   знаю   deux ukrainiennes.     думаю  une.
 *
 * Rejetes malgre une mesure PROPRE, et c'est le garde-fou qui compte : cent
 * vingt lignes ne prouvent pas une absence, donc un mot qui mesure zero mais qui
 * existe vraiment ailleurs reste dehors.
 *   тут    zero ligne ici, et c'est de l'ukrainien courant.
 *   уже    zero ici, et l'ukrainien l'ecrit a cote de вже.
 *   из     zero ici, et le bulgare l'emploie au sens de "a travers".
 *   наш    zero ici, et il est commun aux trois.
 *
 * AVERTISSEMENT DE METHODE, paye une fois. Un premier ecran de ces candidats a
 * ete fait avec un regex ou la classe des lettres avait perdu sa barre oblique,
 * donc `[^p{L}]` au lieu de la borne de mot : elle ne bornait plus rien et le
 * test devenait une recherche de sous-chaine. `кто` ressortait alors
 * "contamine" par deux lignes bulgares qui etaient докторе et директорите.
 * Quatre mots ont ete rejetes a tort et sont rentres apres verification. Tout
 * ecran de ce genre doit imprimer la source de son regex et echouer si elle ne
 * contient pas ce qu'elle doit contenir.
 */
// Pas `давай` : l'ukrainien l'ecrit lettre pour lettre (`давай давай` sortait ru).
const MOTS_RUSSES =
  /(^|[^\p{L}])(кто|нет|они|его|он|она|вчера|можно|это|очень|сейчас|только|когда|хорошо|меня|тебя|ничего|нужно|сколько|пока|больше|спасибо|привет|тоже|где|почему|здесь|сегодня|какой|вообще|лучше|понятно|молодец|смотрю|смотреть|происходит|отлично|отличная|вы|мы|всё|себя)([^\p{L}]|$)/iu;

/**
 * La terminaison d'adjectif masculin russe. L'ukrainien ecrit -ий et le bulgare
 * n'a pas de declinaison du tout. Mesure : 6 lignes russes, zero des deux
 * autres. Son jumeau -ий est DEHORS, il prend vingt lignes ukrainiennes.
 */
const ADJECTIF_RUSSE = /ый([^\p{L}]|$)/iu;
// `ще` et `го` sont sortis de la liste. `ще` est aussi ukrainien, ou il est
// partout (давай ще одну), et `го` est le go du chat russe (го катку) bien
// avant d'etre le pronom bulgare. Seuls, ils nommaient bg sur ces deux lignes.
// Une ligne bulgare qui les porte porte presque toujours un autre marqueur.
const UKRAINIEN_OU_BULGARE = /(^|[^\p{L}])ще([^\p{L}]|$)/iu;
const MOTS_BULGARES =
  // pas `много` : le russe l'ecrit pareil (`много денег`).
  /(^|[^\p{L}])(съм|си|сме|сте|са|какво|кой|кога|къде|защо|добре|това|няма|аз|мога|гледа|гледам|искам|този|започва|благодаря|страхотен|поздрави|дошли|се|има|нещо|тя|моля)([^\p{L}]|$)/iu;

/**
 * Le repli `ru` etait une DEVINETTE posee sur le chemin sans devinette.
 *
 * Cette fonction rendait `ru` pour toute ligne cyrillique qu'elle n'avait pas su
 * nommer autrement. Elle vit dans `detectByScript`, donc `confidentLanguage` la
 * prenait pour une lecture et l'envoyait au moteur comme langue source. C'etait
 * la source de 72 des 90 erreurs du chemin sur : 50 bulgares et 22 ukrainiennes
 * declarees russes, a elles seules les quatre cinquiemes du budget d'erreur.
 *
 * Ce que le banc a dit, et il a dit plus que corriger une erreur : le repli
 * `ru` etait AUSSI mauvais pour franc. En le retirant, `detectLanguage` gagne
 * sur les deux axes a la fois, 3325 a 3331 justes et 1024 a 975 faux. franc
 * modele rus, ukr et bul et il les separe mieux qu'une constante en dur. La
 * regle ne se taisait pas trop peu, elle parlait a la place de quelqu'un de
 * mieux renseigne.
 *
 * Le repli est donc `undefined`, et c'est l'idiome deja pose deux lignes plus
 * haut par le mongol : cyrillique sans marqueur reconnaissable, on se tait,
 * franc reprend la main.
 *
 * DEUX SIGNAUX POSITIFS rattrapent une partie du rappel perdu, et ils sont
 * choisis par exposition complete et non par commodite. Mesure sur la moitie de
 * reglage, 60 lignes par langue :
 *
 *   -ата -ят -ята   bulgare, l'article defini suffixe, que ni le russe ni
 *                   l'ukrainien n'ont. 0 faux positif.
 *   -ть             l'infinitif russe. Le bulgare n'a pas d'infinitif du tout
 *                   et celui de l'ukrainien est -ти. 0 ligne bulgare.
 *
 * CE QUI EST DEHORS, et c'est encore la moitie du travail. Chaque candidat a
 * ete mesure deux fois, sur la zone ambigue puis sur TOUTES les lignes, et les
 * deux mesures ne disent pas la meme chose :
 *   -ите   l'imperatif pluriel russe. La zone ambigue n'en montrait qu'une
 *          ligne russe, l'exposition complete en montre quatre. C'est le
 *          candidat qui aurait passe une mesure etroite.
 *   -ото   trois lignes russes.  -ого/-его  bulgare autant que russe, six
 *          lignes bulgares contre une russe, l'inverse de l'intuition.
 *   -та -то  presentes partout, dix a vingt-deux lignes de chaque langue.
 *   -ти    propose comme marqueur ukrainien, six lignes bulgares.
 *
 * Le `ть` russe touche six lignes ukrainiennes en exposition complete et n'en
 * touche aucune une fois le test ukrainien passe avant lui. Il DEPEND donc de
 * l'ordre des tests dans cette fonction, ce qui est vrai mais fragile : deplacer
 * le test ukrainien apres lui rendrait six lignes ukrainiennes russes.
 *
 * Moitie tenue a l'ecart, jamais lue avant que la regle soit ecrite : 32 erreurs
 * sur 180 lignes deviennent ZERO, et le rappel passe de 148 a 127 sur 180. Le
 * corpus entier dit la meme chose dans le meme sens, donc ce n'est pas un
 * reglage sur les donnees de reglage.
 */
function cyrilliqueQuelleLangue(text: string): string | undefined {
  if (LETTRES_MONGOLES.test(text) || MOTS_MONGOLS.test(text)) return undefined;
  if (LETTRES_UKRAINIENNES.test(text) || MOTS_UKRAINIENS.test(text)) return 'uk';
  if (
    !LETTRES_RUSSES.test(text) &&
    (ER_BULGARE.test(text) || MOTS_BULGARES.test(text) || ARTICLE_BULGARE.test(text))
  ) {
    return 'bg';
  }
  // Sans autre marqueur, `ще` laisse le choix entre ukrainien et bulgare, et le
  // russe ne l'ecrit pas : pas de reponse plutot que `ru` par `давай`.
  if (UKRAINIEN_OU_BULGARE.test(text)) return undefined;
  if (
    LETTRES_RUSSES.test(text) ||
    INFINITIF_RUSSE.test(text) ||
    ADJECTIF_RUSSE.test(text) ||
    MOTS_RUSSES.test(text)
  ) {
    return 'ru';
  }
  return undefined;
}

/**
 * Le han n'est pas une langue non plus, et c'est la troisieme fois.
 *
 * Meme forme que le persan pris pour de l'arabe et le mongol pris pour du russe,
 * a une difference pres qui change tout : ici les deux langues partagent
 * l'ECRITURE ENTIERE. Le chinois ecrit standard et le cantonais vernaculaire
 * s'ecrivent tous les deux en caracteres han, et la majorite d'une ligne
 * cantonaise est faite de caracteres que le chinois standard emploie aussi. Une
 * regle de proportion, celle que ce fichier applique partout ailleurs, ne peut
 * donc pas servir : il faut une regle de PRESENCE, un seul marqueur suffit.
 *
 * Une regle de presence produit des faux positifs par construction, donc elle se
 * mesure des deux cotes ou elle ne vaut rien. Banc dans
 * test/e2e/canto-bench.mjs, ecrit et non recolte : Kick n'a
 * pratiquement pas de chaine hongkongaise, et attendre qu'il y en ait une n'est
 * pas un plan. La moitie tenue a l'ecart a ete ecrite AVANT la regle.
 *
 * Ce que franc en dit : rien d'utilisable. Mesure directe, franc-min rend `cmn`
 * sur une phrase cantonaise complete et `und` sur une courte. Il n'a pas de
 * modele `yue`, donc le cantonais lui ressort mandarin, et `confidentLanguage`
 * refuse sa reponse de toute facon. Aucune bibliotheque legere ne fait mieux :
 * ELD ne porte pas `yue`, lingua non plus, cld3 est archive, et le seul modele
 * qui le porte vraiment, fastText lid.176, pese 917 Ko compresse contre un
 * budget de content script de 69 Ko. La table de caracteres est la seule voie.
 *
 * CE QUI EST DEHORS, et c'est la moitie du travail. Les candidats evidents sont
 * des pieges :
 *   係  vit dans 關係, mot courant du chinois standard. Le marqueur le plus
 *       frequent du cantonais est aussi celui qui casse le plus de lignes.
 *   晒  vit dans 晒太陽. 嗮, lui, est cantonais seul, donc c'est celui-la.
 *   喇  vit dans 喇叭. 咪 vit dans 咪表. 嘛, 啦, 好, 得, 返, 埋, 重, 邊, 度
 *       ont un sens cantonais ET un sens standard que la graphie ne separe pas.
 * Ce qui reste est un jeu ou chaque caractere est absent du chinois ecrit
 * moderne, pas seulement rare.
 *
 * Les marqueurs a deux caracteres portent leur propre risque, et il n'etait pas
 * theorique : le chinois s'ecrit sans espaces, donc 反而 suivi de 家裡 fabrique
 * 而家, et 依 suivi de 家長 fabrique 依家. Six lignes de chinois standard bâties
 * exprès sur ce defaut ont ete mises dans le seau qui protege, et elles ont pris
 * QUATRE marqueurs d'un coup : 而家, 依家, 食飯 et 咩.
 *
 * Les trois premiers sont sortis. Le cout est nul sur la moitie tenue a l'ecart
 * et de deux lignes sur celle d'ajustement, ou 依家幾點 et 食飯未 ne portaient
 * pas d'autre marqueur ; 我哋而家真係好攰 et 屋企人嗌我食飯 en portaient
 * d'autres et n'ont rien perdu. Un marqueur qui casse du chinois standard coute
 * plus cher qu'une ligne cantonaise manquee : le chinois standard marche
 * aujourd'hui.
 *
 * 咩 est reste, avec une garde. Son seul emploi en chinois standard est le cri
 * du mouton, et il est toujours redouble : 咩咩. La garde refuse le caractere
 * quand il touche son jumeau des deux cotes, ce qui laisse passer 咩事 et
 * 你估我唔知咩 et arrete 小羊咩咩叫. C'est la meme forme que l'absence de ы, э,
 * ё qui separe le bulgare du russe plus haut : un signal negatif, pas un
 * caractere de plus.
 *
 * 𨋢 est hors du plan multilingue de base. La boucle de detectByScript itere par
 * point de code, cette regle s'applique au texte entier, les deux le voient.
 *
 * DEUXIEME TOUR, ET IL A FALLU D ABORD COMPRENDRE SUR QUOI CETTE TABLE EST
 * BATIE. Mesure faite : des 36 marqueurs qu elle portait, NEUF n apparaissent
 * sur aucune ligne d aucun corpus, et 25 ne sont seuls a couvrir aucune ligne.
 * Cette table n a donc jamais ete choisie sur le gain mesure, contrairement au
 * lexique et aux terminaisons, et c est correct : une regle de PRESENCE se
 * choisit sur ce que la langue ecrit, et le corpus ne sert qu a opposer un veto.
 * Un marqueur qui rapporte zero sur 130 lignes cantonaises n est pas du poids
 * mort, c est un marqueur que 130 lignes ne suffisent pas a juger.
 *
 * Le critere est donc ecrit comme il est reellement applique :
 *   1. le caractere est cantonais et absent du chinois standard ecrit moderne
 *   2. zero occurrence sur zh, zh-tw, ja et les 39 autres langues des bancs
 *   3. zero mouvement sur les neuf bancs, zero faux positif sur canto-bench
 * Le 1 selectionne, les 2 et 3 opposent un veto. Jamais l inverse, protocole 4.6.
 * Le crible qui repond au 2 est test/e2e/canto-candidats.mjs.
 *
 * Douze caracteres passent : 瞓 dormir, 啱 juste, 嬲 fache, 攞 prendre, 搵
 * chercher, 唞 se reposer, 嚿 morceau, 冧 s ecrouler, 揼 frapper, 孭 porter sur
 * le dos, 喐 bouger, 嗌 crier. Cinq sont attestes sur le corpus cantonais, les
 * sept autres n y sont pas, et AUCUN DES DOUZE NE GAGNE UNE LIGNE : celles qu ils
 * touchent portaient deja un autre marqueur. C est la forme attendue.
 *
 * 嬲 EST LE SEUL QUI PORTE UN RISQUE CONNU, et il n est pas chinois : c est un
 * kanji japonais reel, なぶる. Il ne coute rien ici parce que le japonais de chat
 * porte des kana et que detectByScript les lit avant d arriver ici, mais c est le
 * premier a retirer si une ligne japonaise sans kana arrive un jour.
 *
 * CE QUI RESTE DEHORS A CE TOUR, avec la raison :
 *   嘈   mesure, une ligne zh-tw du banc le porte, 嘈雜 est du standard courant
 *   郁   standard courant, 濃郁 et 郁金香
 *   掂   standard courant, 掂量
 *   慳   existe en standard litteraire, 慳吝
 *   氹   Taipa s ecrit 氹仔, un texte zh-tw sur Macao le porte legitimement
 *   收皮 回收皮革 fabrique la meme chaine, c est le defaut de 而家 a l identique
 *   好耐 好耐用 fabrique la meme chaine
 *   細路 仔細路過 fabrique la meme chaine
 *   多過 差不多過了 fabrique la meme chaine
 *
 * DU COTE DES MOTS, deux entrees gagnent vraiment, et ce sont les seules du tour
 * qui bougent un chiffre : 鍾意, aimer, que le standard ecrit 喜歡, et le
 * demonstratif 呢 suivi d un classificateur. Les deux entrees 呢個 et 呢度 etaient
 * deja la, ecrites une par une ; c est un MECANISME et pas deux mots, donc la
 * classe le dit : 呢[個度啲隻件間排粒張本]. 呢 seul est impossible, c est la
 * particule finale la plus courante du chinois standard.
 */
const CARACTERES_CANTONAIS =
  /[唔嘅喺咗哋佢啲嘢冇嗰嚟㗎乜攰嘥噉喎嘞咁睇諗嗮畀冚瞓啱嬲攞搵唞嚿冧揼孭喐嗌]|(?<!咩)咩(?!咩)|\u{282E2}/u;
const MOTS_CANTONAIS =
  /點解|點樣|邊個|邊度|得閒|屋企|傾偈|靚仔|靚女|鍾意|呢[個度啲隻件間排粒張本]/u;

/**
 * Simplifie ou traditionnel, et pourquoi c'est une question d'ECRITURE.
 *
 * franc n'a aucun modele trigramme pour le han. Il resout l'ecriture entiere en
 * `cmn`, et `FRANC_MAP` envoie `cmn` comme `zho` sur `zh`. Consequence mesuree
 * sur les 120 lignes traditionnelles du banc : 120 sur 120 repondues `zh`, cent
 * pour cent, drapeau de la Chine compris. Ce n'etait pas une regle a corriger,
 * c'etait une regle absente.
 *
 * CE QUE CE CHIFFRE VAUT, ET IL FAUT LE DIRE AVANT DE LE LIRE. Le corpus
 * traditionnel est decoupe du corpus `cmn` de Tatoeba par jeu de caracteres,
 * parce que Tatoeba n'a pas d'export traditionnel separe. La regle ci-dessous
 * lit le meme jeu de caracteres. Le rappel sur ce banc-la est donc la meme
 * phrase dite deux fois, pas une capacite mesuree, et c'est acceptable parce que
 * la distinction EST un jeu de caracteres : il n'y a rien d'autre a lire.
 *
 * Ce qui se mesure vraiment est l'autre cote, et il est propre : zero
 * croisement, aucune des 120 lignes traditionnelles ne porte un marqueur
 * simplifie et aucune des 120 simplifiees ne porte un marqueur traditionnel ;
 * aucune des 40 autres langues du banc ne declenche quoi que ce soit ; et 15
 * lignes traditionnelles et 33 simplifiees ne portent aucun marqueur du tout et
 * restent sans reponse, ce qui est correct.
 *
 * LE JAPONAIS est le seul vrai piege et il vient du fait que le japonais a fait
 * sa propre simplification. 会, 学, 実, 体, 万, 与, 区, 医, 点, 来, 国 s'ecrivent
 * en japonais comme en chinois simplifie, donc ils sont DEHORS de la liste
 * simplifiee ; 結, 議 et 龍 s'ecrivent en japonais comme en traditionnel, donc
 * ils sont dehors de la liste traditionnelle. Mesure : sur 120 lignes japonaises
 * du banc, quatre portaient un marqueur traditionnel avant ce tri, et les quatre
 * portaient des kana, donc `kana > 0` les avait deja prises plus haut. Le tri
 * est la ceinture, le kana est la bretelle.
 *
 * Le cantonais passe AVANT, et ce n'est pas un detail : le cantonais s'ecrit en
 * caracteres traditionnels, 81 de ses 120 lignes declenchent la liste
 * traditionnelle. Inverser les deux tests rendrait `zh-tw` sur du cantonais.
 */
const CARACTERES_TRADITIONNELS =
  /[這們麼說來對樣學實發應經覺讀體萬與樂區醫點關會單賣輕轉邊團圖廣壓國兩驗歲聲總濟開聽權氣灣嗎]/u;
const CARACTERES_SIMPLIFIES =
  /[这们么说对样实发应经觉读乐卖轻转边团图广压两验岁声总济开关听权气湾吗]/u;

function cantonaisOuChinois(text: string): string | undefined {
  if (CARACTERES_CANTONAIS.test(text) || MOTS_CANTONAIS.test(text)) return 'yue';
  const traditionnel = CARACTERES_TRADITIONNELS.test(text);
  const simplifie = CARACTERES_SIMPLIFIES.test(text);
  // Les deux ensemble, c'est du texte mixte ou une citation, et on ne tranche
  // pas. Ni l'un ni l'autre, c'est une ligne ecrite avec les caracteres que les
  // deux ecritures partagent, et il n'y a rien dans le texte qui permette de
  // choisir. Dans les deux cas franc reprend la main et `confidentLanguage`
  // refusera sa reponse, ce qui est le comportement d'avant.
  if (traditionnel && !simplifie) return 'zh-tw';
  if (simplifie && !traditionnel) return 'zh';
  return undefined;
}

/** Unicode script → language mapping. More reliable than franc on short texts. */
function detectByScript(text: string): string | undefined {
  // Count non-ASCII, non-space chars by script range.
  let han = 0; // CJK ideographs — ambiguous between Chinese and Japanese
  let kana = 0; // hiragana / katakana — exclusive to Japanese
  let hangul = 0;
  let arabic = 0;
  let cyrillic = 0;
  // L'hebreu est aussi peu ambigu que l'arabe depuis son ecriture, et il
  // manquait. Mesure : franc-min ne le couvre pas du tout, il rend `und` sur une
  // phrase hebraique complete, donc `detectLanguage` rendait undefined et le
  // pipeline ecartait le message pour langue inconnue. L'hebreu est pourtant une
  // des 42 langues proposees et la fiche des stores annonce l'ecriture de droite
  // a gauche par "arabe, hebreu, persan".
  let hebrew = 0;
  let thai = 0;
  let devanagari = 0;
  // Le bengali et le tamoul manquaient, et c'etait le meme trou que l'hebreu
  // avant lui : deux ecritures sans la moindre ambiguite, deux des 43 langues du
  // produit, et rien ici pour les compter. La consequence n'etait pas un drapeau
  // faux, franc les nomme par son regex d'ecriture ; elle etait que
  // `confidentLanguage` restait muet sur les deux, donc le moteur ne recevait
  // jamais leur langue source alors qu'elle se lit a coup sur.
  let bengali = 0;
  let tamil = 0;
  // Le grec manquait, et c'est le meme trou que l'hebreu puis le bengali et le
  // tamoul avant lui : une ecriture sans la moindre ambiguite, une des 43 langues
  // du produit, et rien ici pour la compter. Onzieme ecriture ajoutee au meme
  // endroit pour la meme raison.
  let greek = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c <= 0x7f || /\s/.test(ch)) continue;
    if (c >= 0x3040 && c <= 0x30ff) kana++;
    else if ((c >= 0x3400 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff)) han++;
    // Syllables, plus the compatibility jamo Korean chat writes on their own
    // (ㅋㅋ, ㅠㅠ, ㅇㅇ). Sans eux, une ligne de jamo nus ne nourrit aucune ecriture
    // et le denominateur ci-dessous vaut zero, donc plus rien n'est lu. Ce
    // correctif-la etait le symptome ; la cause etait le denominateur, qui
    // comptait tout le non-ASCII et est corrige plus bas.
    else if ((c >= 0xac00 && c <= 0xd7af) || (c >= 0x3130 && c <= 0x318f)) hangul++;
    else if (c >= 0x0600 && c <= 0x06ff) arabic++;
    else if (c >= 0x0590 && c <= 0x05ff) hebrew++;
    else if (c >= 0x0400 && c <= 0x04ff) cyrillic++;
    else if (c >= 0x0e00 && c <= 0x0e7f) thai++;
    else if (c >= 0x0900 && c <= 0x097f) devanagari++;
    // L'ecriture bengalie sert aussi l'assamais, qui n'est pas dans les 43, donc
    // la rendre `bn` est exact pour tout ce que le produit peut afficher.
    // L'ecriture tamoule ne sert que le tamoul.
    else if (c >= 0x0980 && c <= 0x09ff) bengali++;
    else if (c >= 0x0b80 && c <= 0x0bff) tamil++;
    // Bloc grec, plus le grec etendu que le polytonique emploie. Le risque
    // connu est la lettre grecque isolee dans une ligne latine, alpha, delta,
    // sigma en notation scientifique ; le plancher de deux caracteres et la
    // majorite stricte plus bas s'en chargent, exactement comme pour
    // l'homoglyphe cyrillique.
    else if ((c >= 0x0370 && c <= 0x03ff) || (c >= 0x1f00 && c <= 0x1fff)) greek++;
  }
  // Le denominateur ne compte QUE les caracteres qui portent une ecriture
  // connue. Il comptait tout le non-ASCII, emoji compris, et un emoji ne
  // nourrit aucune des huit ecritures : il gonflait le denominateur sans
  // jamais pouvoir gagner la majorite.
  //
  // Mesure de ce que cela coutait, sur les cinq langues majoritaires que ce
  // pre-controle est le seul a servir : "да" plus deux emoji tombait a 2 sur 4,
  // donc pas de majorite stricte, donc `undefined` ; "رائع" plus quatre emoji
  // tombait pareil et franc reprenait la main pour repondre PERSAN sur de
  // l'arabe. Un chat sans emoji n'existe pas, donc ce n'etait pas un cas limite.
  const total =
    kana + han + hangul + arabic + hebrew + cyrillic + thai + devanagari + bengali + tamil + greek;
  // Le plancher reste a deux, et c'est lui qui empeche un seul caractere
  // etranger de voler une ligne latine : un homoglyphe cyrillique dans un mot
  // anglais compte 1, et a un plancher de 1 la ligne entiere devient russe.
  // Le prix est connu et accepte : un message CJK d'un seul caractere reste
  // muet.
  if (total < 2) return undefined;
  const pct = (n: number) => n / total > 0.5;
  // Any kana ⇒ Japanese (Chinese never uses it). Pure Han is ambiguous → defer to
  // franc so Chinese isn't mislabelled as Japanese.
  if (kana > 0) return 'ja';
  if (pct(hangul)) return 'ko';
  if (pct(han)) return cantonaisOuChinois(text);
  if (pct(arabic)) return arabeOuPersan(text);
  if (pct(hebrew)) return 'he';
  if (pct(greek)) return 'el';
  if (pct(cyrillic)) return cyrilliqueQuelleLangue(text);
  if (pct(thai)) return 'th';
  if (pct(devanagari)) return 'hi';
  if (pct(bengali)) return 'bn';
  if (pct(tamil)) return 'ta';
  return undefined;
}

/**
 * Detect language with hybrid approach: Unicode script check first (reliable
 * for CJK/Arabic/Cyrillic/etc.), then franc-min for Latin scripts.
 * Returns ISO-2 code or undefined when not confident enough.
 * Returns 'en' for short trivial chat tokens that franc cannot resolve.
 */
/**
 * The paths that read the text rather than guess at it: the trivial-token table,
 * the chat-word lexicon, and the Unicode script check. Everything here is a lookup,
 * so a hit is a fact about the text, not a probability.
 */
/**
 * Le hindi tape en lettres latines, que le chat indien ecrit couramment.
 *
 * Il ne nomme aucune langue ici, il en empeche une : `yaar`, `saal` et `baat`
 * tombaient sur les terminaisons neerlandaises `-aar` et `-aal`, et quatre
 * lignes de hinglish sur vingt-six partaient avec sl=nl. Deux mots distincts
 * de la liste, jamais un seul, parce que `hai` est aussi italien et
 * vietnamien. Les mots trop courts ou trop communs ailleurs sont dehors : se,
 * ko, ka, ki, wo, ye, tha, bas, kar, raha.
 */
const MOTS_HINGLISH = new Set([
  'yaar', 'yar', 'bhai', 'kya', 'kyu', 'kyun', 'nahi', 'nahin', 'hai', 'hain',
  'kitne', 'kitna', 'baat', 'saal', 'kamaal', 'kamal', 'accha', 'acha', 'achha',
  'bahut', 'bohot', 'matlab', 'mujhe', 'tujhe', 'abhi', 'arre', 'arey', 'haan',
  'dekho', 'chalo', 'bhi', 'toh', 'kuch', 'kaise', 'kaisa', 'sahi', 'bilkul',
  'mera', 'meri', 'tera', 'teri',
  // Verbes et mots de tous les jours : `sab kuch haar gaya` n'avait que kuch et
  // sortait nl par `-aar`. Seuls ils ne decident rien, il en faut deux.
  'gaya', 'gayi', 'raha', 'rahi', 'dekh', 'baar', 'phir', 'maza', 'haar', 'pehli',
  'sab', 'ko', 'fir', 'kal', 'aana', 'sabko', 'bhaiya', 'wala', 'wali',
  'karne', 'karna', 'baad',
]);

// Trois mots qu'aucune langue latine du produit n'ecrit, assez forts seuls :
// `yaar` au milieu d'une phrase anglaise sortait encore `nl`.
const MOTS_HINGLISH_FORTS = new Set(['yaar', 'bhai', 'kya']);

function estHinglish(text: string): boolean {
  const vus = new Set<string>();
  for (const jeton of text.toLowerCase().split(/[^\p{L}]+/u)) {
    if (MOTS_HINGLISH_FORTS.has(jeton)) return true;
    if (MOTS_HINGLISH.has(jeton)) vus.add(jeton);
  }
  return vus.size >= 2;
}

function detectByLookup(trimmed: string): string | undefined {
  // ASCII short message: probably English chat-speak
  const lower = trimmed.toLowerCase();
  if (trimmed.length < 12 && /^[a-z0-9\s!?.,'-]+$/.test(lower)) {
    const tokens = lower.split(/\s+/).filter(Boolean);
    if (tokens.every((t) => COMMON_SHORT_TOKENS.has(t.replace(/[^a-z0-9]/g, '')))) {
      return 'en';
    }
  }

  // Une langue qui n'est pas latine, tapee en lettres latines : aucune table
  // latine ci-dessous n'a le droit d'y repondre. Sinon `arigatou` sortait `pt`
  // par `-tou` et `zashto` `sl`. Le veto ne nomme rien : la ligne part sans
  // langue source, et `detectLanguage` donne toujours la sienne aux filtres.
  if (romanisedLanguage(trimmed) || estHinglish(trimmed)) return detectByScript(sansRire(trimmed));

  // Une lettre propre a une seule langue, a toute longueur, et AVANT le lexique.
  //
  // L'ordre inverse avait ete ecrit d'abord, au motif qu'un mot de chat connu
  // serait le signal le plus fort. Mesure : c'est faux, et d'une ligne. Une
  // lettre qu'une seule langue ecrit ne peut pas apparaitre dans le mot d'une
  // autre, alors qu'un mot de chat s'ecrit avec les lettres que tout le monde
  // partage et peut donc exister ailleurs. `Ar ji mano draugė?` est lituanien,
  // porte un ė qui ne laisse aucun doute, et le lexique y lisait `mano` et
  // repondait portugais. Les deux chemins gagnent cette ligne et n'en perdent
  // aucune ; `lt->pt` est la seule confusion qui bouge dans tout le banc.
  const byLetter = detectByExclusiveLetter(trimmed);
  if (byLetter) return byLetter;

  // Meme idee, mais la lettre nomme une paire au lieu d'une langue et un mot
  // choisit dedans. Apres la table, parce qu'une lettre qui nomme une seule
  // langue est un signal plus fort qu'une lettre qui en nomme deux.
  const nordique = danoisOuNorvegien(trimmed);
  if (nordique) return nordique;

  // Meme forme encore, et la derniere paire de la matrice a n'avoir eu aucune
  // regle. Apres le nordique, l'ordre entre les deux etant sans effet : les deux
  // portes ne peuvent pas s'ouvrir sur la meme ligne.
  const nusantara = malaisOuIndonesien(trimmed);
  if (nusantara) return nusantara;

  const balte = estonienOuPortugais(trimmed);
  if (balte) return balte;

  const porte = porteQuelleLangue(trimmed);
  if (porte) return porte;

  // Short Latin message: a known chat word beats franc, which guesses at this length.
  if (trimmed.length <= SHORT_TEXT_MAX) {
    const byWord = detectByShortWords(trimmed);
    if (byWord) return byWord;
  }

  // Unicode script pre-check: more reliable than franc on short texts.
  // CJK, Arabic, Cyrillic etc. are unambiguous from their script alone.
  return detectByScript(sansRire(trimmed));
}

/** Le rire d'une autre ecriture ne nomme pas la langue des mots qu'il suit :
 * `que golazo ㅋㅋㅋ` sortait ko. Seul, il garde son ecriture. */
function sansRire(text: string): string {
  return text.split(/\s+/).filter((t) => !isLaughter(t)).join(' ') || text;
}

/**
 * The language only when it was looked up rather than guessed, so it is safe to
 * hand to a translation engine as the source language.
 *
 * Franc's answer and the pure-ASCII fallback are deliberately withheld. Measured
 * on saved chat, franc got 16 of 85 Spanish lines and 13 of 51 Turkish lines
 * right; forcing one of its wrong answers on the engine makes it translate from
 * a language the text is not in, which either returns the text unchanged (the
 * line is then dropped without a word) or returns something that is not what was
 * said. Sending nothing lets the engine detect the language itself.
 */
export function confidentLanguage(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed.length === 0 ? undefined : memo(LOOKUP_MEMO, trimmed, detectByLookup);
}

/**
 * Both answers are pure functions of the text, and a chat line asks for them
 * five times: `prepare` runs on the websocket warm pass and again on the DOM
 * node, each time calling `detectLanguage` then `confidentLanguage`, and the
 * warm pass asks `confidentLanguage` once more for its source hint. Measured
 * over the 1120 lines of the 41-language chat corpus, that was 122 microseconds
 * of detection per line, for one detection's worth of answer (49). A chat at 20
 * lines a second paid it 20 times a second for as long as the stream ran.
 *
 * The memo keeps the last few hundred lines, which covers the gap between the
 * warm pass and the node landing in the DOM, and the copypasta a chat repeats.
 * It is bounded so a long stream cannot grow it.
 */
const MEMO_MAX = 512;
const LOOKUP_MEMO = new Map<string, string | undefined>();
const DETECT_MEMO = new Map<string, string | undefined>();

function memo(
  table: Map<string, string | undefined>,
  key: string,
  compute: (key: string) => string | undefined,
): string | undefined {
  if (table.has(key)) return table.get(key);
  const value = compute(key);
  if (table.size >= MEMO_MAX) table.delete(table.keys().next().value!);
  table.set(key, value);
  return value;
}

/**
 * Des formes que deux langues voisines ecrivent, sorties du chemin sur par la
 * revue linguiste (2026-11-04) et rendues au seul chemin brut, comme le rire :
 * la plus frequente des deux y devine mieux que franc. Sans elles, les lignes
 * devenues muettes retombaient sur franc et le brut prenait 19 fausses Tatoeba.
 */
const PENCHANTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|[^\p{L}])taas([^\p{L}]|$)/iu, 'fi'],
  [/(^|[^\p{L}])ele([^\p{L}]|$)/iu, 'pt'],
  [/(knya|nmu|anku)([^\p{L}]|$)/iu, 'id'],
  [/ným([^\p{L}]|$)/iu, 'sk'],
];

function detectByPenchant(text: string): string | undefined {
  const langues = new Set(PENCHANTS.filter(([forme]) => forme.test(text)).map(([, l]) => l));
  return langues.size === 1 ? [...langues][0] : undefined;
}

export function detectLanguage(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed.length === 0 ? undefined : memo(DETECT_MEMO, trimmed, detectUncached);
}

/**
 * The raw answer, checked against the browser's own detector (`i18n.detectLanguage`,
 * built into Chrome and Firefox, no bytes to ship). What it reliably names wins; a
 * guess of ours stands only if its first choice agrees; otherwise no answer. A
 * table answer is never second-guessed, and without the API nothing changes.
 *
 * Rule fixed on the real bench's dev half, then read on heldout (700 lines,
 * right / silent / wrong): today 428 / 156 / 116, Chrome 409 / 276 / 15, Firefox
 * 506 / 168 / 26. Tatoeba (5040): 4135 / 397 / 508, 4084 / 886 / 70, 4563 / 318 / 159.
 * The price is on Chrome: more silence, so a reader with a source allowlist loses
 * the lines it no longer names. Measured on dev, English lines named English go
 * from 41 of 91 to 34 on Chrome and 49 on Firefox; foreign lines the English skip
 * would take go from 6 of 620 to 1 and to 11.
 */
export async function detectLanguageWithBrowser(text: string): Promise<string | undefined> {
  const guess = detectLanguage(text);
  if (confidentLanguage(text) || !globalThis.chrome?.i18n?.detectLanguage) return guess;
  let answer: chrome.i18n.LanguageDetectionResult;
  try {
    answer = await chrome.i18n.detectLanguage(text);
  } catch {
    return guess;
  }
  const first = answer.languages[0]?.language;
  const browser = first ? normalizeLang(first) : undefined;
  if (answer.isReliable && browser && isSupportedLang(browser)) return browser;
  return guess === browser ? guess : undefined;
}

function detectUncached(trimmed: string): string | undefined {
  const lookedUp = memo(LOOKUP_MEMO, trimmed, detectByLookup);
  if (lookedUp) return lookedUp;

  // L'arabizi, apres la recherche en table et avant franc.
  //
  // Il n'est pas dans `detectByLookup` a dessein : ce que cette fonction rend
  // part au moteur comme langue source via `confidentLanguage`, et annoncer
  // `sl=ar` sur du texte en lettres latines n'a pas ete mesure. Ici, la reponse
  // alimente les filtres et le drapeau, et le moteur continue de deviner seul.
  //
  // Ce que cela repare : avec une liste de langues sources autorisee, un message
  // arabizi sortait en `lang_unknown`, donc un lecteur arabophone qui restreint
  // ses sources a `ar` perdait exactement les messages qu'il voulait lire.
  // Les langues ecrites au clavier latin sans l'etre : russe, grec, japonais
  // romanises. Meme place et meme raison que l'arabizi : la reponse nourrit les
  // filtres et le drapeau, pas le `sl` envoye au moteur, parce qu'annoncer une
  // ecriture qui n'est pas dans le texte n'a pas ete mesure.
  const romanise = romanisedLanguage(trimmed);
  if (romanise) return romanise;

  if (isArabizi(trimmed)) return 'ar';
  if (arabeDeChat(trimmed)) return 'ar';

  // Le rire qui ne nomme plus la source sure nourrit encore le drapeau et les
  // filtres : dans un vrai chat `kkkk mano` est bresilien bien plus souvent que
  // `kkkk was zum` n'est allemand, et franc devine moins bien que lui.
  if (trimmed.length <= SHORT_TEXT_MAX) {
    const rire = detectByShortWords(trimmed, true);
    if (rire) return rire;
  }

  const penche = detectByPenchant(trimmed);
  if (penche) return penche;

  const francCode = franc(trimmed, { minLength: 3 });
  if (francCode === 'und') {
    // Heuristic: pure ASCII = probably English
    if (/^\p{ASCII}+$/u.test(trimmed)) return 'en';
    return undefined;
  }
  return francToIso2(francCode);
}

export function isLikelyEnglish(text: string): boolean {
  return detectLanguage(text) === 'en';
}
