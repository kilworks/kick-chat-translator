/**
 * English chat abbreviations, spelled out before an English line goes to the
 * engine for a reader in another language.
 *
 * Google leaves most of these as they are, so the reader gets "ngl c'était
 * propre", or worse, reads them as something else: "idc about the score" came
 * back as "je ne sais pas à propos du score", "lmk when he goes live" as "je
 * verrai quand il sera en direct" and as "kkkkk quando ele entrar ao vivo",
 * "wyd chat" as "charla de la jornada laboral", "irl" as "merde". Spelled out,
 * the same lines come back as what was said. "he is the goat" came back as
 * "c'est lui la chèvre", "el es la cabra", "er ist die Ziege".
 *
 * Measured on 34 chat lines into all 42 other languages, one Google request per
 * language: of 1386 abbreviations, 952 came back exactly as typed. Spelled out,
 * none did.
 *
 * Only abbreviations Google gets wrong are here. `pls`, `btw`, `thx`, `omg`,
 * `bc`, `ppl`, `fyi` and `u` were measured and come back right as they are.
 * `af`, `asf` and `tf` come back WORSE spelled out: "fast asf" became "rapide
 * comme de la merde" where Google alone said "très rapide".
 *
 * The caller spells out only lines the detector reads as English and that carry
 * no letter English does not write. `w` is a preposition in Polish, `l` an
 * article in French and Romanian; measured on 1085 foreign chat lines and 4920
 * Tatoeba lines, that gate rewrites none of them.
 */
const SPELLED_OUT = new Map<string, string>(Object.entries({
  ngl: 'not gonna lie',
  icl: "I can't lie",
  fr: 'for real',
  frfr: 'for real',
  tbh: 'to be honest',
  tbf: 'to be fair',
  imo: 'in my opinion',
  rn: 'right now',
  nvm: 'never mind',
  wdym: 'what do you mean',
  istg: 'I swear',
  ong: 'I swear',
  idc: "I don't care",
  idek: "I don't even know",
  ikr: 'I know, right',
  irl: 'in real life',
  lmk: 'let me know',
  hbu: 'how about you',
  wyd: 'what are you doing',
  w: 'win',
  l: 'loss',
  mf: 'motherfucker',
  ofc: 'of course',
  jk: 'just kidding',
  dw: "don't worry",
  atp: 'at this point',
  fs: 'for sure',
  iirc: 'if I remember correctly',
  goat: 'greatest of all time',
  ig: 'I guess',
  gl: 'good luck',
  smh: 'disappointing',
  sm: 'so much',
}));

/**
 * Chat shorthand of other languages. Each entry has two independent sources (a
 * Wiktionary edition and a slang dictionary) and beat the engine on real chat.
 * Applied only to the text the engine gets, only when the looked-up language of
 * the line is this one.
 *
 * Google left `slk` as typed and read `pqp` as `pq`, "because". Measured on the 9
 * Google outputs of the 3 real lines these reach, two blind judges: 10.5 penalty
 * points a line before, 0.72 after. One of the 3 lines, untranslated before, now
 * comes back with a word Google seems to have invented, which the judges did not
 * score; without it, 3.25 and 0.25 on 6 outputs.
 *
 * `vc` and `tb` were measured and Google already gets them right. `msm` gains
 * nothing and "mesmo" can come back as "the same". `pfv`, `vtnc`, `mdr` and `wlh`
 * have two sources too, but no real line carrying them got a looked-up language,
 * so they were never measured.
 */
const SPELLED_OUT_BY_LANGUAGE = new Map<string, Map<string, string>>([
  ['pt', new Map(Object.entries({
    slk: 'você é louco',
    pqp: 'puta que pariu',
  }))],
]);

export function spellOutForLanguage(text: string, language: string | undefined): string {
  const table = language ? SPELLED_OUT_BY_LANGUAGE.get(language) : undefined;
  if (!table) return text;
  return text.replace(/[\p{L}\p{N}']+/gu, (word) => table.get(word.toLowerCase()) ?? word);
}

/** "follow my ig" is Instagram, and so is "ig" after any of these. */
const INSTAGRAM_BEFORE = /(^|[^\p{L}])(my|on|his|her|their|your|ur|the)[^\p{L}]+$/iu;

export function spellOutAbbreviations(text: string): string {
  return text.replace(/[\p{L}\p{N}']+/gu, (word, offset: number) => {
    const lower = word.toLowerCase();
    if (lower === 'ig' && INSTAGRAM_BEFORE.test(text.slice(0, offset))) return word;
    // A lone letter against a dot or a slash is an initial or a shorthand:
    // "L.A.", "w/ the boys". Only a free-standing W or L is the verdict.
    if (word.length === 1 && /[./&-]/.test((text[offset - 1] ?? '') + (text[offset + 1] ?? ''))) return word;
    return SPELLED_OUT.get(lower) ?? word;
  });
}
