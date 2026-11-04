/**
 * Les langues ecrites en lettres latines qui ne s'ecrivent pas ainsi.
 *
 * Un lecteur russe, grec ou japonais tape souvent son message au clavier latin,
 * sans changer de disposition. Le texte reste sa langue et perd son ecriture,
 * donc le pre-controle par ecriture ne voit rien et le detecteur, qui ne connait
 * que des lettres latines, repond pour une langue latine.
 *
 * Ce que cela coutait, mesure avant d'ecrire une ligne :
 *
 *   privet kak dela segodnya      -> id     (indonesien)
 *   spasibo bolshoe za stream     -> cs
 *   pozhaluysta pomogite mne      -> it
 *   khorosho ochen khorosho       -> sv
 *   nichego ne ponyatno           -> pl
 *   ti kaneis re file einai kalo  -> rien
 *   konnichiwa minna genki desu ka-> rien
 *
 * Le russe est le pire des trois : une reponse fausse mais assuree. Avec une
 * liste de langues sources autorisee il sort en `lang_not_allowed`, et avec
 * l'indonesien pour cible il n'est pas traduit du tout, puisque le produit le
 * croit deja dans la langue du lecteur.
 *
 * LA REGLE D'ADMISSION, celle que la table des mots courts se donne deja : une
 * entree ne merite une langue que si elle est sans ambiguite contre l'anglais
 * courant ET contre les autres entrees. C'est ce qui exclut d'emblee les mots
 * japonais passes dans l'argot internet anglais, `kawaii`, `sugoi`, `senpai`,
 * `baka`, `desu`, `sensei`, qu'un anglophone ecrit sans parler un mot de
 * japonais. Meme raison pour le grec `malaka`, et pour `davai` ou `net` en
 * russe, trop courts ou trop communs ailleurs.
 *
 * Mesure sur vingt phrases translitterees et vingt pieges, ceux ci-dessus
 * compris : vingt marquees, zero faux positif.
 *
 * CE N'EST PAS UNE REPONSE SURE, pour la meme raison que l'arabizi. Ce que rend
 * `confidentLanguage` part au moteur comme langue source, et annoncer `sl=ru`
 * sur un texte en lettres latines demande au moteur de lire du cyrillique la ou
 * il n'y en a pas. Ces marqueurs alimentent la detection ordinaire, qui nourrit
 * les filtres et le drapeau montre au lecteur ; le moteur continue de deviner.
 */

/** Marqueurs par langue, chacun choisi pour n'exister que la une fois romanise. */
const MARQUEURS: Record<string, readonly string[]> = {
  ru: [
    'privet', 'spasibo', 'pozhaluysta', 'khorosho', 'nichego', 'ochen',
    'konechno', 'zdravstvuyte', 'ponyatno', 'pravda', 'pobeda', 'bolshoe',
  ],
  el: [
    'kalimera', 'kalispera', 'kaneis', 'kanete', 'efharisto', 'ginetai',
    'katalava', 'tipota', 'paidia', 'simera', 'ekanes',
  ],
  ja: [
    'konnichiwa', 'arigatou', 'gozaimasu', 'ohayou', 'yoroshiku',
    'onegaishimasu', 'kudasai', 'ganbatte', 'subarashii',
  ],
  // Le bulgare en lettres latines, la shlyokavitsa, que le chat bulgare ecrit
  // couramment. Bati par PARADIGME et jamais par la liste des rates : les
  // interrogatifs, et les racines ou le bulgare diverge du russe, donc hors de
  // portee de `ru` ci-dessus. Le reste des paradigmes, le futur et les
  // demonstratifs, est passe au second etage par le plancher de cinq lettres.
  // `si`, `sa` et `ste` restent dehors partout, trop courts ou trop communs.
  bg: [
    'kakvo', 'zashto', 'kolko', 'kakav', 'kakva',
    'chovek', 'neshto', 'vsichko', 'blagodarya', 'zdravey', 'zdravei',
    'hubavo', 'hubava', 'hubav', 'razbira',
  ],
};

/**
 * Marqueurs qui ne suffisent pas seuls, et pourquoi il en faut.
 *
 * Mesure qui a impose ce second etage. Les marqueurs FORTS ci-dessus, batis par
 * paradigme et tenus au plancher de cinq lettres, prennent 10 des 20 lignes de
 * shlyokavitsa ecrites en meme temps qu'eux et **ZERO des 4 ecrites la veille**,
 * avant que la liste existe. Un
 * paradigme grammatical donne les mots d'un manuel ; un chat ecrit "mnogo dobre
 * igra" et "az sam tuk", qui ne portent aucun d'eux. C'est le meme defaut que la
 * table de mots courts faite de salutations, vu avant d'etre livre cette fois.
 *
 * Ces mots-la appartiennent aussi a d'autres langues, `dobre` au polonais, `az`
 * au hongrois, `sam` a l'anglais comme prenom, `mnogo` et `smeshno` au russe
 * romanise. Un seul ne peut donc rien decider. DEUX dans la meme ligne le
 * peuvent : sur les deux bancs du depot, 187 lignes en 19 langues que ces listes
 * n'ont jamais regardees, la regle fait zero faux positif, et elle prend 3 des 4
 * lignes tenues a l'ecart contre 0 pour les marqueurs forts seuls.
 *
 * LA COLLISION EST NOMMEE PLUTOT QUE CACHEE. `mnogo` et `smeshno` s'ecrivent
 * pareil en bulgare et en russe romanises, donc une ligne russe qui ne porte que
 * ces deux mots sort `bg`. Mesure sur quatre lignes russes ecrites pour ce
 * piege : deux sont protegees par un marqueur `ru` fort, `ochen` et `spasibo`,
 * et deux sont prises. Ce que la detection rendait sur ces deux-la avant :
 * `undefined` et `pl`. Aucune des deux n'etait juste, et le texte lui-meme est
 * indecidable.
 */
const FAIBLES_PAR_LANGUE: Record<string, readonly string[]> = {
  bg: [
    'mnogo', 'dobre', 'az', 'sam', 'tuk', 'tuka', 'stiga', 'smeshno',
    'nali', 'sega', 'taka', 'nyama', 'nqma', 'mislya', 'pravish', 'stava',
    // Descendus des forts par le plancher de cinq lettres que la table se donne,
    // qui a rejete neuf entrees. Respecte plutot que contourne : ce sont des
    // paradigmes entiers, la particule du futur et les demonstratifs, et ils
    // gardent leur valeur, simplement ils ne decident plus seuls. Le rappel tenu
    // a l'ecart ne bouge pas d'un point, 3 sur 4 avant comme apres ; c'est le
    // rappel sur mes propres lignes qui tombe de 16 a 14 sur 20, et celui-la ne
    // mesurait que l'ajustement.
    'shte', 'kade', 'kude', 'koga',
    'tova', 'tozi', 'tazi', 'tezi',
    'sme',
  ],
};

const TABLE = new Map<string, string>();
for (const [langue, mots] of Object.entries(MARQUEURS)) {
  for (const m of mots) TABLE.set(m, langue);
}

/**
 * L'adjectif russe translittere : -ый/-ий/-ой ecrit -yy (novyy, dobryy, polnyy).
 * Une forme plutot qu'une liste, parce que chaque adjectif en est une entree.
 * Le finnois finit aussi en -yy, mais apres t, k, s (loytyy, nakyy, pysyy) ou
 * sur trois lettres (syy, myy), d'ou la consonne et la lettre devant elle.
 * Apres t, k, s encore russe si le mot porte ch, sh, zh ou kh, que le finnois
 * n'ecrit pas (chistyy). Le neutre -oe apres consonne et n (krasnoe) aussi, et
 * le genitif -kogo/-togo (takogo), que le slovene ecrit -ega ; kogo seul est
 * slovene, d'ou deux lettres devant.
 */
const ADJECTIF_RU = /^(?:\p{L}+[bvmnlpr]yy|\p{L}*[cszk]h\p{L}*yy|\p{L}{2,}[^aeiouy]noe|\p{L}{2,}[kt]ogo)$/u;

const FAIBLES = new Map<string, string>();
for (const [langue, mots] of Object.entries(FAIBLES_PAR_LANGUE)) {
  for (const m of mots) FAIBLES.set(m, langue);
}

/**
 * La langue d'un message ecrit en lettres latines mais qui n'est pas latin.
 *
 * Le vote suit la meme regle que la table des mots courts : deux marqueurs qui
 * ne s'accordent pas annulent la reponse, parce qu'un message qui porte a la
 * fois un marqueur russe et un marqueur grec n'est pas plus l'un que l'autre.
 */
export function romanisedLanguage(text: string): string | undefined {
  let vote: string | undefined;
  /** Marqueurs faibles vus, par langue, dedupliques : "tuk tuk" n'est qu'un. */
  const faibles = new Map<string, Set<string>>();

  for (const jeton of text.toLowerCase().split(/[^\p{L}]+/u)) {
    if (!jeton) continue;
    const fort = TABLE.get(jeton) ?? (ADJECTIF_RU.test(jeton) ? 'ru' : undefined);
    if (fort) {
      if (vote && vote !== fort) return undefined;
      vote = fort;
      continue;
    }
    const faible = FAIBLES.get(jeton);
    if (faible) {
      let vus = faibles.get(faible);
      if (!vus) {
        vus = new Set();
        faibles.set(faible, vus);
      }
      vus.add(jeton);
    }
  }

  // Un marqueur fort tranche toujours, et le second etage ne peut pas le
  // contredire : c'est ce qui garde `ochen mnogo ludey` en russe.
  if (vote) return vote;

  const gagnantes = [...faibles].filter(([, vus]) => vus.size >= 2);
  return gagnantes.length === 1 ? gagnantes[0]?.[0] : undefined;
}

/** Pour les tests et pour qui veut auditer la table plutot que la croire. */
export const ROMANISED_MARKERS = MARQUEURS;

/** Idem, pour le second etage. */
export const ROMANISED_WEAK_MARKERS = FAIBLES_PAR_LANGUE;
