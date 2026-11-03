/**
 * Written laughter, by language.
 *
 * Why this file exists. Laughter is the most repeated thing in a chat and the
 * hardest for a language detector: franc is unreliable below about twenty
 * characters and "kkkkk" is five. Until now the product handled it in two
 * unrelated places, both grown by hand: an alternation inside `isNoise` that
 * covered about ten forms, and two French entries sitting in the short-word
 * table because somebody hit them. Measured on the shipped function before this
 * file existed: jaja, haha, rsrs, huehue, lolol, hehe and hihi were all skipped
 * in their repeated form, and xdxd was translated, because the pattern carried
 * `x+d+` and not the repeated syllable.
 *
 * Nothing reusable exists to import. The academic work on social-media text
 * normalisation treats laughter as a category to strip and publishes no lexicon;
 * the popular write-ups are prose, not data; the one machine-readable list found
 * on GitHub carries no licence at all, so it could not be used even as a
 * starting point. What is not anybody's property is the linguistic fact that
 * Thai writes 555 and Indonesian writes wkwk, and those facts are what this
 * table records, each with where it is attested.
 *
 * Sources, all consulted 2026-08-31 and cross-checked against each other:
 *   preply.com/en/d/laughing-around-the-world-map--lp  (26 languages)
 *   restofworld.org/2023/how-people-laugh-online       (journalism, widest set)
 *   blog.duolingo.com/laughter-in-different-languages
 *
 * The table does two jobs. It says whether a message is nothing but laughter,
 * which saves a provider call, and it says which language a form belongs to when
 * it belongs to one unambiguously. The second job follows the rule the
 * short-word table already states about itself: an entry earns a language only
 * if it is unambiguous against common English and against the other entries.
 * `haha`, `lol` and `xd` are used everywhere and mark nothing.
 *
 * A form in a non-Latin script mostly does not need to mark anything either:
 * `detectByScript` already resolves Arabic, Hebrew, Cyrillic, Hangul, kana, Thai
 * and Devanagari from the characters alone. The entries that earn their place as
 * language marks are therefore the Latin-script and digit ones, which are
 * exactly the ones a detector cannot resolve at five characters.
 */

interface FormeDeRire {
  /** Anchored on the whole message: these are checked against a lone token. */
  motif: RegExp;
  /** ISO-2 code when the form marks a language on its own, else undefined. */
  langue?: string;
}

const FORMES: FormeDeRire[] = [
  // ── Latin script, marks a language ──────────────────────────────────────
  {
    motif: /^(?:ja){2,}j?a?$/i,
    langue: 'es',
  },
  {
    motif: /^(?:je){2,}j?e?$/i,
    langue: 'es',
  },
  {
    motif: /^(?:ji){2,}j?i?$/i,
    langue: 'es',
  },
  {
    motif: /^(?:js){2,}j?s?$/i,
    langue: 'es',
  },
  {
    motif: /^k{3,}$/i,
    langue: 'pt',
  },
  {
    motif: /^(?:rs){2,}$/i,
    langue: 'pt',
  },
  {
    motif: /^(?:hue){2,}h?u?e?$/i,
    langue: 'pt',
  },
  { motif: /^m+d+r+$/i, langue: 'fr' },
  { motif: /^p+t+d+r+$/i, langue: 'fr' },
  {
    motif: /^m+o?u+ha(?:ha)+h?a?$/i,
    langue: 'fr',
  },
  { motif: /^asg$/i, langue: 'sv' },
  {
    motif: /^(?:h[oø]){1,}(?:hø)(?:h[oø])*h?[oø]?$/i,
    langue: 'da',
  },
  {
    motif: /^(?:h[aæ])*(?:hæ)(?:h[aæ])*h?[aæ]?$/i,
    langue: 'da',
  },
  {
    motif: /^(?:wk){2,}w?k?$/i,
    langue: 'id',
  },
  { motif: /^wa?(?:kaka)+k?a?$/i, langue: 'id' },
  { motif: /^(?:xi){2,}x?i?$/i, langue: 'id' },
  { motif: /^(?:ha3)+$/i, langue: 'ms' },
  {
    motif: /^5{3,}$/,
    langue: 'th',
  },
  // `note` est une VALEUR, pas un commentaire : chaque caractere part dans le
  // bundle injecte sur toutes les pages Kick. La table entiere pese 3791 octets
  // pour cette raison. Le raisonnement va donc ici, ou le minifieur l'efface, et
  // la note reste de la longueur des autres.
  //
  // Le `www` demi-chasse portait `ja` avec pour argument que trois w ou plus
  // "ne peuvent pas etre un hote www nu". L'argument lit le message ENTIER ; le
  // vote de `detectByShortWords` porte sur les JETONS et decoupe sur les
  // non-lettres, donc `www.kick.com` donne les jetons www, kick, com et le
  // premier vote seul. Mesure : trois vrais noms d'hotes sur quatre sortaient
  // `ja` AVEC `sl=ja`, ce qui demande au moteur de traduire une URL depuis le
  // japonais. La table se donne deja la regle qui tranche, une entree ne merite
  // une langue que si elle est non ambigue, et celle-ci ne l'est pas.
  //
  // La pleine chasse garde la marque : aucun nom d'hote ne s'ecrit en ｗ. Deux
  // ou plus, le plancher d'un caractere de `detectByScript` ne la voyant jamais.
  // Ce que le demi-chasse perd en face, mesure : le japonais en romaji suivi de
  // `www` part au moteur avec `sl` vide, donc le moteur detecte seul.
  {
    motif: /^w{3,}$/i,
  },
  {
    motif: /^ｗ{2,}$/,
    langue: 'ja',
  },
  {
    motif: /^2+3{3,}$/,
    langue: 'zh',
  },

  // ── Non-Latin scripts. The script check resolves the language already, so
  //    these earn their place by being recognised as laughter, not as marks.
  { motif: /^[ха]*(?:ах|ха){2,}[ха]*$/i },
  { motif: /^х{3,}$/i },
  { motif: /^г{3,}$/i },
  { motif: /^(?:хα|χα){2,}χ?α?$/i, langue: 'el' },
  { motif: /^(?:χ[εοι]){2,}$/i, langue: 'el' },
  { motif: /^ه{3,}$/ },
  { motif: /^خ{3,}$/ },
  { motif: /^ח{3,}$/ },
  { motif: /^[ㅋㅎ]{2,}$/ },
  { motif: /^(?:哈){2,}$/ },
  { motif: /^(?:呵){2,}$/ },
  { motif: /^(?:[wｗ]*草+[wｗ]*|大草原)$/ },
  { motif: /^(?:हा){2,}$/ },
  { motif: /^(?:হা\s?){2,}$/ },

  // ── Latin script, marks nothing: used across too many languages ──────────
  { motif: /^a*(?:ha){2,}h?a*$/i },
  { motif: /^(?:he){2,}h?e?$/i },
  { motif: /^(?:hi){2,}h?i?$/i },
  { motif: /^(?:ah){2,}a?$/i },
  { motif: /^l+o+l+(?:o+l+)*$/i },
  { motif: /^l+m+f?a+o+$/i },
  { motif: /^rofl$/i },
  {
    motif: /^(?:x+d+|(?:xd){2,})$/i,
  },
  { motif: /^ke+k+w*$/i },
  { motif: /^u?wu$|^owo$/i },

  // ── Added 2026-11-03, and none of them marks a language. Each reached the
  //    provider as a lone message. They carry no `langue` on purpose: a form
  //    with one also votes per token in `detectByShortWords`, so `ksksks` as pt
  //    would pin the source language of a Turkish sentence that contains it.
  //    The first two are SHAPE rules, laughter typed across neighbouring keys,
  //    not lexicon entries, so no source attests them as written.
  { motif: /^(?=(?:.*j){2})(?=(?:.*a){2})[jas]{6,}$/i },
  { motif: /^(?=(?:.*h){2})(?=(?:.*a){2})[has]{6,}$/i },
  { motif: /^k(?:sk){2,}s?$/i },
  { motif: /^k{3,}j+k*$/i },
  { motif: /^(?:hau|hua){2,}h?$/i },
  { motif: /^(?:kw){2,}k?$/i },
  { motif: /^(?:a?wok){2,}$/i },
  { motif: /^а?(?:за){2,}$/i },
  { motif: /^х+д+$/i },
  { motif: /^ワロタ+$/ },
  { motif: /^笑死(?:了|我了)?$/ },
  { motif: /^xswl$/i },
  { motif: /^(?:อิ){2,}$/ },
];

/** Every message that is nothing but laughter, in any of the forms above. */
export function isLaughter(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return FORMES.some((f) => f.motif.test(t));
}

/**
 * The language a lone laugh belongs to, when it belongs to one.
 *
 * Returns undefined for `haha`, `lol`, `xd` and every other form used across
 * languages. A wrong answer here is worse than none: it would be handed to the
 * engine as the source language.
 */
export function laughterLanguage(text: string): string | undefined {
  const t = text.trim();
  if (!t) return undefined;
  for (const f of FORMES) {
    if (f.langue && f.motif.test(t)) return f.langue;
  }
  return undefined;
}


/**
 * Where each form is attested, keyed by the source of its pattern.
 *
 * This used to be a `note` field on every entry, which reads like a comment
 * and is not one: it is a string in an object, the minifier keeps it, and it
 * travelled to every Kick page. Measured in the shipped script, 42 of the 45
 * were in it, 1754 bytes, 0.85 percent of everything a reader downloads, and
 * about half of what this table was measured to cost in the first place.
 *
 * Nothing reads it at runtime. Keeping it out of the executed path is
 * therefore free, and the rule that made provenance non-optional survives:
 * the test below asserts one note per form, keyed so that inserting a form
 * cannot silently shift the notes of the ones after it.
 */
export const LAUGHTER_NOTES: Readonly<Record<string, string>> = {
  '^(?:ja){2,}j?a?$':
    'Spanish: j is pronounced as English h, so jajaja reads hahaha',
  '^(?:je){2,}j?e?$':
    'Spanish jejeje, the ironic register',
  '^(?:ji){2,}j?i?$':
    'Spanish jijiji, the mischievous register',
  '^(?:js){2,}j?s?$':
    'Spanish jsjsjs, jaja typed with the neighbouring key',
  '^k{3,}$':
    'Brazilian Portuguese kkkk. Three or more: kk alone is too short to claim a language',
  '^(?:rs){2,}$':
    'Brazilian Portuguese rsrsrs, repeated from riso, laughter',
  '^(?:hue){2,}h?u?e?$':
    'Brazilian Portuguese huehuehue',
  '^m+o?u+ha(?:ha)+h?a?$':
    'French mouhahaha, the villain laugh',
  '^(?:h[oø]){1,}(?:hø)(?:h[oø])*h?[oø]?$':
    'Danish hohohoe. At least one slashed o is required: plain hohoho is the Santa laugh and belongs to nobody',
  '^(?:h[aæ])*(?:hæ)(?:h[aæ])*h?[aæ]?$':
    'Danish haehaehae. At least one ae is required, or this swallows hahaha, which marks nothing',
  '^(?:wk){2,}w?k?$':
    'Indonesian wkwkwk',
  '^5{3,}$':
    'Thai: five is pronounced ha, so 555 reads hahaha. Also used in Lao',
  '^w{3,}$':
    'Japanese w for warai. Marks nothing: www is a hostname token too',
  '^ｗ{2,}$':
    'Japanese warai typed full-width, which no hostname ever is',
  '^2+3{3,}$':
    'Mandarin 2333. Three threes minimum: 233 on its own is the emoticon number, and a number',
  '^(?:x+d+|(?:xd){2,})$':
    'xd and xdxd. The repeated syllable was the form that used to slip through',
  '^m+d+r+$':
    'French mort de rire',
  '^p+t+d+r+$':
    'French pete de rire',
  '^asg$':
    'Swedish, short for asgarv, uproarious laughter',
  '^wa?(?:kaka)+k?a?$':
    'Indonesian wakaka',
  '^(?:xi){2,}x?i?$':
    'Indonesian xixixi',
  '^(?:ha3)+$':
    'Malay ha3, the 3 standing for a third ha',
  '^[ха]*(?:ах|ха){2,}[ха]*$':
    'Cyrillic hahaha and ahahaha',
  '^х{3,}$':
    'Cyrillic khkhkh: the letter repeated on its own, without the vowel',
  '^г{3,}$':
    'Cyrillic gggg, the older Slavic form',
  '^(?:хα|χα){2,}χ?α?$':
    'Greek chacha. Greek script is not in the script pre-check',
  '^(?:χ[εοι]){2,}$':
    'Greek cheche, chocho and chichi',
  '^ه{3,}$':
    'Arabic hhh',
  '^خ{3,}$':
    'Arabic and Persian khkhkh',
  '^ח{3,}$':
    'Hebrew chchch',
  '^[ㅋㅎ]{2,}$':
    'Korean jamo kk and hh typed on their own',
  '^(?:哈){2,}$':
    'Mandarin haha',
  '^(?:呵){2,}$':
    'Mandarin hehe, the dry register',
  '^(?:[wｗ]*草+[wｗ]*|大草原)$':
    'Japanese grass, from www looking like blades of it; repeated and mixed with w in chat',
  '^(?:हा){2,}$':
    'Devanagari haha',
  '^(?:হা\\s?){2,}$':
    'Bengali haha',
  '^a*(?:ha){2,}h?a*$':
    'hahaha, everywhere',
  '^(?:he){2,}h?e?$':
    'hehehe, everywhere',
  '^(?:hi){2,}h?i?$':
    'hihihi, everywhere including Vietnamese',
  '^(?:ah){2,}a?$':
    'ahahah, common in Italian and Turkish',
  '^l+o+l+(?:o+l+)*$':
    'lol and lolol',
  '^l+m+f?a+o+$':
    'lmao and lmfao',
  '^rofl$':
    'rofl, rolling on the floor laughing, borrowed into many languages',
  '^ke+k+w*$':
    'kek and kekw, from streaming chat, w stretched as in KEKWWWW',
  '^(?=(?:.*j){2})(?=(?:.*a){2})[jas]{6,}$':
    'Spanish jajaja typed across the j, a, s keys (JAJSJAJS); a shape rule, no source lists it',
  '^(?=(?:.*h){2})(?=(?:.*a){2})[has]{6,}$':
    'hahaha typed across the h, a, s keys (HAHAHSHA); a shape rule, no source lists it',
  '^k(?:sk){2,}s?$':
    'ksksk, Brazilian and Turkish chat laughter; marks no language because both use it',
  '^k{3,}j+k*$':
    'kkkj, Brazilian kkkk with the neighbouring j; chat usage, not in the three sources',
  '^(?:hau|hua){2,}h?$':
    'hauhau and huahua, Brazilian chat laughter; chat usage, not in the three sources',
  '^(?:kw){2,}k?$':
    'kwkw, the Indonesian wkwk started on the other key; chat usage',
  '^(?:a?wok){2,}$':
    'awokawok, Indonesian chat laughter; chat usage, not in the three sources',
  '^а?(?:за){2,}$':
    'Russian azaza, an internet laugh; the script already names the language',
  '^х+д+$':
    'Russian xD typed on the Cyrillic layout; the script already names the language',
  '^ワロタ+$':
    'Japanese net slang warota, I laughed; kana already names the language',
  '^笑死(?:了|我了)?$':
    'Chinese xiaosi, dying of laughter; Han does not decide zh against ja, so no mark',
  '^xswl$':
    'Chinese pinyin initials of xiao si wo le, dying of laughter; Latin, so no mark claimed',
  '^(?:อิ){2,}$':
    'Thai ii, a giggle like hihi; the script already names the language',
  '^u?wu$|^owo$':
    'uwu and owo',
};

/** For tests and for anyone auditing the table rather than trusting it. */
export const LAUGHTER_FORMS: ReadonlyArray<Readonly<FormeDeRire>> = FORMES;
