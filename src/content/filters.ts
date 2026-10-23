import { COMMON_BOTS } from '~/shared/constants';
import { foldCase } from '~/shared/normalize';
import type { Settings } from '~/shared/settings';

export interface MessageMeta {
  username: string;
  channel: string;
  isBot: boolean;
}

export function shouldDropByUserOrChannel(meta: MessageMeta, settings: Settings): string | undefined {
  const user = foldCase(meta.username);
  if (
    settings.ignoreBots &&
    (meta.isBot || COMMON_BOTS.has(user) || settings.extraBots.some((b) => foldCase(b) === user))
  ) {
    return 'bot';
  }
  if (settings.blacklistUsers.some((u) => foldCase(u) === user)) return 'user_blacklisted';
  if (settings.blacklistChannels.includes(meta.channel)) return 'channel_blacklisted';
  if (settings.whitelistChannels.length > 0 && !settings.whitelistChannels.includes(meta.channel)) {
    return 'channel_not_whitelisted';
  }
  return undefined;
}

/** Case-insensitive substring match: `!fish` catches `!fish` and `!fish 3`. */
export function hasBlockedKeyword(text: string, settings: Settings): boolean {
  const t = foldCase(text);
  return settings.blockedKeywords.some((k) => k && t.includes(foldCase(k)));
}

export function shouldDropBySourceLang(detected: string | undefined, settings: Settings): string | undefined {
  if (settings.sourceLangAllowlist.length === 0) return undefined;
  if (!detected) return 'lang_unknown';
  if (!settings.sourceLangAllowlist.includes(detected)) return 'lang_not_allowed';
  return undefined;
}

const baseLang = (code: string): string => code.toLowerCase().split('-')[0] ?? code.toLowerCase();

/**
 * A letter English does not write: an accented Latin letter or any other
 * script. franc calls short lines English often enough that the English skip
 * deleted foreign chat for English readers: on the chat corpora 10 of 1085
 * foreign lines, on Tatoeba 25, Italian "è troppo forte" among them. Half of
 * those carry such a letter (5 and 11), and no English line of either corpus
 * does, so the letter vetoes the skip at no cost to English chat.
 */
export function hasNonEnglishLetter(text: string): boolean {
  return /(?![A-Za-z])\p{L}/u.test(text);
}

/**
 * Same language as the target? Compares base languages so regional variants count
 * as a match (pt ≡ pt-BR, zh ≡ zh-TW) — no point translating a message that's
 * already in the reader's language.
 */
export function isSameLanguageAsTarget(detected: string | undefined, target: string): boolean {
  if (!detected) return false;
  return baseLang(detected) === baseLang(target);
}

const EMOJI_OR_SYMBOL = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{P}\p{S}\s]/u;

/**
 * Chat "noise" that should never be translated: emoji/symbol-only, laughter spam
 * (wwww, kkkk, jajaja, 草草草, lololol), single repeated character, digits/punct only.
 * Cheap to skip and avoids garbage translations like "WWWW" -> "wwww".
 */
import { isLaughter } from '~/shared/laughter';

/**
 * Une promenade sur une rangee du clavier, pas un mot.
 *
 * Le martelement est frequent et couteux : mesure sur quinze formes attestees,
 * dont le turc `askfhsjkd` et l'espagnol `asdasdasd`, ZERO n'etait ecarte. Les
 * quinze partaient au moteur, et trois en ressortaient avec une langue :
 * `asdasdasd` portugais, `zxcvbnm` espagnol, `hjkhjkhjk` neerlandais. Une langue
 * fausse sur un message qui n'en a aucune.
 *
 * Le critere est la proportion de paires de lettres voisines qui vivent sur la
 * MEME rangee du clavier. Le critere evident, l'absence de voyelles, a ete
 * mesure et jete : le tcheque a de vrais mots sans voyelle, `krk`, `prst`,
 * `smrt`, et un filtre qui les avale ecarte de la parole en silence.
 *
 * Seuils choisis sur mesure, pas au jugement. Contre quinze martelements et
 * quarante mots reels pris dans le pire cas, consonnes alignees des langues
 * slaves comprises : a 0,6 il reste deux faux positifs, `wzglad` et `jugada` ;
 * a partir de 0,65 il n'y en a plus aucun et les quinze sont pris. 0,7 laisse la
 * marge des deux cotes. Sous six lettres le signal ne veut rien dire, au-dessus
 * de sept on commence a rater `zxcvbnm`.
 *
 * Ce que ce critere ne pretend pas etre : universel. Les rangees sont celles de
 * QWERTY. Un martelement tape sur AZERTY tombe en grande partie dans les memes
 * lettres, la rangee du milieu ne differant que par ses extremites, mais ce
 * n'est pas mesure et le filtre ne s'applique qu'a un message d'un seul mot,
 * ou le doute coute le moins.
 */
const RANGEES_CLAVIER = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const MARTELEMENT_LONGUEUR_MIN = 6;
const MARTELEMENT_PROPORTION = 0.7;

export function isKeyboardSmash(text: string): boolean {
  const t = text.trim().toLowerCase();
  // Un seul mot : c'est ainsi que le martelement se tape, et restreindre la
  // regle a ce cas est ce qui garde une phrase reelle hors de portee.
  if (/\s/.test(t)) return false;
  const lettres = t.replace(/[^a-z]/g, '');
  if (lettres.length < MARTELEMENT_LONGUEUR_MIN) return false;
  if (lettres.length !== t.length) return false;

  // Un mot etire n'est pas un martelement, et il en porte pourtant la signature :
  // une lettre tenue vit forcement sur une seule rangee. Mesure : `siiiiiiii` et
  // `NOOOOOO` etaient pris a tort par la seule regle des rangees. Ce qui les
  // separe est le nombre de lettres differentes, six ou plus contre deux ou
  // trois, ou bien un GROUPE de lettres repete plutot qu'une lettre tenue :
  // `asdasdasd` est trois fois "asd", `holaaaaa` est "hola" plus un a tenu.
  // Le rire est teste avant celui-ci dans `isNoise`, donc `jajaja` et `wkwkwk`
  // n'arrivent jamais ici.
  const distinctes = new Set(lettres).size;
  const groupeRepete = /^(.{2,4})\1{2,}$/.test(lettres);
  if (distinctes < 6 && !groupeRepete) return false;

  let memeRangee = 0;
  let voisines = 0;
  for (let i = 0; i < lettres.length - 1; i++) {
    const a = RANGEES_CLAVIER.findIndex((r) => r.includes(lettres[i]!));
    const b = RANGEES_CLAVIER.findIndex((r) => r.includes(lettres[i + 1]!));
    if (a >= 0 && a === b) {
      memeRangee++;
      const r = RANGEES_CLAVIER[a]!;
      if (Math.abs(r.indexOf(lettres[i]!) - r.indexOf(lettres[i + 1]!)) === 1) voisines++;
    }
  }
  if (memeRangee / (lettres.length - 1) < MARTELEMENT_PROPORTION) return false;

  // La rangee seule ne suffit pas : celle du haut porte e, u, i, o, y, assez
  // pour ecrire des mots. Mesure le 2026-10-17 sur les 27 297 mots Tatoeba du
  // banc (langCorpus.ts) : 62 vrais mots passaient pour du martelement, dont
  // `quiero`, `porque`, `primeiro`, `europa`, `airport`, et sur le vrai chat
  // `portugal`, `inshallah`, `DENTROOOOO`. Un message fait de ce seul mot etait
  // jete comme du bruit.
  //
  // Ce qui les separe, mesure contre 17 martelements attestes et ces 68 mots :
  // un martelement a peu de voyelles (moins d'un quart, allongements aplatis
  // pour que `predictionnnnn` ne soit pas dilue), ou bien en a un peu plus mais
  // repete un groupe de trois lettres (`dksaj...dksaj`), ou bien suit les touches
  // voisines (`qwertyuiop`). 17 sur 17 gardes, 0 mot sur 68 avale. Les mots
  // nordiques a 25 pour cent de voyelles (`skjorter`, `triskart`) ne repetent
  // aucun groupe, c'est ce qui les sauve. Seuils regles sur ces jeux memes :
  // un nouveau faux positif se corrige en l'ajoutant aux temoins du test.
  if (groupeRepete || voisines / (lettres.length - 1) >= 0.8) return true;
  const plat = lettres.replace(/(.)\1+/g, '$1');
  const voyelles = (plat.match(/[aeiou]/g) ?? []).length / plat.length;
  return voyelles < 0.25 || (voyelles < 0.3 && /(...).*\1/.test(lettres));
}

export function isNoise(text: string): boolean {
  const t = text.trim();
  if (!t) return true;

  // strip emoji/symbols/punct/space — if nothing meaningful remains, it's noise
  const stripped = [...t].filter((ch) => !EMOJI_OR_SYMBOL.test(ch)).join('');
  if (stripped.length === 0) return true;

  const lower = stripped.toLowerCase();
  // single character repeated (wwww, ーーー, 草草草, !!!)
  if (/^(.)\1*$/u.test(lower)) return true;
  // Le rire vit dans `~/shared/laughter`, une table par langue avec ses
  // sources, plutot qu'une alternation grossie a la main ici. Elle sert deux
  // fois : reconnaitre un message qui n'est que du rire, et dire de quelle
  // langue une forme releve quand elle en marque une.
  if (isLaughter(lower)) return true;
  // Sur le texte ORIGINAL, pas sur `lower` : le filtrage ci-dessus retire les
  // espaces, et le martelement se reconnait a ce qu'il est d'un seul mot. Passe
  // la version sans espaces, "hahaha ha que risa" devient un mot de quinze
  // lettres majoritairement sur la rangee du milieu, donc du martelement.
  if (isKeyboardSmash(t)) return true;
  // digits / punctuation only
  if (/^[\d\s.,!?'"()-]+$/u.test(t)) return true;

  return false;
}

/**
 * Flatten stretched characters, for a second attempt at a line the engine refused.
 *
 * NOT used as a preprocessing step, and that is the whole point. Measured against
 * Google on real chat: it already handles some stretching well, "sooo goood" comes
 * back as "tellement bon", and flattening first turns that into "alors mon Dieu".
 * Normalising every line trades one failure for another.
 *
 * What it does rescue is the lines the engine hands straight back untranslated:
 * "BINNNNNNNGOOOOOOO" and "muuuuy biennnn" return unchanged, and flattened they
 * become "BINGO" and "très bien". So this runs only after that has happened, where
 * it cannot make anything worse than the nothing already obtained.
 *
 * Repeats only. An isolated Japanese prolongation is deliberately left alone: it
 * carries meaning, and stripping it turns コーヒー into コヒ, ラーメン into ラメン and
 * スーパー into スパ. Elongation of the おーわーりー kind is therefore not handled,
 * because no rule tested here separates it from a real word without a dictionary.
 */
export function normalizeElongation(text: string): string {
  return text
    // Three or more of the same letter is not a word in any language we target.
    .replace(/(\p{L})\1{2,}/gu, '$1')
    // Repeated prolongation marks; a single one is left in place.
    .replace(/ー{2,}/gu, 'ー')
    .replace(/([!?！？])\1{2,}/gu, '$1$1')
    .trim();
}

// ── What is worth paying to translate inside a line ─────────────────────────
//
// Measured on 15,155 live Kick lines in 31 languages (test/e2e/capture-chat.mjs),
// after every filter above had run: a phrase pasted over and over in one message
// was 4.3 percent of all the characters sent to the engine, laughter or emoji at
// either end of a real sentence 1.7, bare bot commands 0.5, emoji runs 0.2. The
// original line stays on screen untouched; only what goes to the engine shrinks.

const COMMAND = /^[!/][\p{L}\d_]+/u;

/**
 * `!points`, `!slots 332`, `!gamble all`: addressed to a bot, nothing to read.
 * A command carrying a sentence (`!tts eso te pasa por bocon...`, read aloud on
 * stream) is not bare: three words or more and the sentence is worth translating.
 */
export function isBareCommand(text: string): boolean {
  const t = text.trim();
  const m = t.match(COMMAND);
  if (!m) return false;
  return t.slice(m[0].length).split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length < 3;
}

const EMO = String.raw`\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F|\u200D\p{Extended_Pictographic})*`;
const EMOJI_RUN = new RegExp(String.raw`(${EMO})(?:\s*${EMO})+`, 'gu');
const EMOJI_ONLY = new RegExp(`^(?:${EMO})+$`, 'u');
const EMOJI_EDGE = new RegExp(String.raw`^(?:${EMO}|\s)+|(?:${EMO}|\s)+$`, 'gu');

/** "SEM TP SEM TP SEM TP SEM T" -> "SEM TP": three copies or more, a cut-off last one allowed. */
function collapseRepeat(t: string): string {
  // "FUGA FUGA FUGAAAAAA FUGAA FUGA": the stretched copies are not equal, so the
  // pattern below misses them. Same word once flattened, three times or more.
  const toks = t.split(/\s+/);
  const flat = (w: string): string => w.toLowerCase().replace(/(\p{L})\1+/gu, '$1');
  if (toks.length >= 3 && toks[0]!.length >= 3 && toks.every((w) => flat(w) === flat(toks[0]!))) return toks[0]!;
  // The copy has to end on a word boundary, or "Oye hoye hoye hoye" repeats
  // "oye h" and collapses to "Oye h". Scripts written without spaces have no
  // such boundary, so there any character ends a copy.
  const m = t.match(
    /^(.{2,}?(?:(?<=\P{L})|(?=\P{L}|$)|(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}])))(?:\s*\1){2,}\s*(.*)$/isu,
  );
  // Three characters minimum: "jajaja" -> "ja" would turn laughter into the
  // German for yes, and "lalala" -> "la" into an article.
  if (!m || !/\p{L}/u.test(m[1]!) || m[1]!.trim().length < 3) return t;
  return m[1]!.toLowerCase().startsWith(m[2]!.toLowerCase()) ? m[1]!.trim() : t;
}

/**
 * Laughter, keyboard smash or emoji at either end of a line with real words in
 * it. Punctuation stays (`????` and `))` carry meaning), so do digits (`10 ضغط`),
 * and so does a line that is nothing but noise: isNoise owns that one.
 */
function trimEdgeNoise(t: string): string {
  const toks = t.split(/\s+/);
  const noise = (w: string): boolean => {
    const core = w.replace(/^\p{P}+|\p{P}+$/gu, '');
    // No isKeyboardSmash here: it calls "equipo" a smash (every letter on the
    // top row), and at the edge of a sentence that deletes a real word.
    return core.length >= 2 && (isLaughter(core.toLowerCase()) || EMOJI_ONLY.test(core));
  };
  let a = 0;
  let b = toks.length - 1;
  while (a <= b && noise(toks[a]!)) a++;
  while (b >= a && noise(toks[b]!)) b--;
  if (a > b) return t;
  // Rejoined only when something was cut: a clean line keeps its own spaces,
  // the French no-break space before "?" and the ideographic one included.
  const words = a === 0 && b === toks.length - 1 ? t : toks.slice(a, b + 1).join(' ');
  // Emoji glued to a word ("GATA ONLY🔥") is not a token of its own.
  const kept = words.replace(EMOJI_EDGE, '');
  return /\p{L}/u.test(kept) ? kept : words;
}

/**
 * A long line that is mostly the same few words over again, copies that are
 * not equal: "yo quiero remiix yo quiero yo quiero remiix...", "CON TOS
 * VOY CONTOSVOY CON TOSVOY...". It goes out as its distinct words, in order.
 *
 * Only when two words in three or more are repeats, over eight words or more.
 * Measured: at that floor the 8 lines touched in the 15,155-line capture are all
 * spam (0.34 percent of the characters sent), and no Tatoeba sentence is. At
 * half instead of a third it starts dropping the second "nie" of a Polish
 * sentence, which turns its meaning around.
 */
function dedupeWords(t: string): string {
  const toks = t.split(/\s+/).filter(Boolean);
  if (toks.length < 8) return t;
  const seen = new Set<string>();
  const keep: string[] = [];
  for (const w of toks) {
    const k = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').replace(/(.)\1+/gu, '$1');
    if (!k || seen.has(k)) continue;
    seen.add(k);
    keep.push(w);
  }
  return keep.length / toks.length <= 0.35 ? keep.join(' ') : t;
}

/**
 * "fala pro salve kosky krlh 👺 qqqq", then "👺 q", "👺 qaqa", "👺 aaaa": the
 * same line resent with junk after an emoji to get past Kick's duplicate check.
 * Every variant is a different text, so each one missed the cache and was paid
 * for: 14 of 148 lines sent on a live Brazilian channel (2026-10-17).
 *
 * Only the last word after the last emoji, and only junk: at most two different
 * letters, one letter or three and more. Two-letter words ("no", "si", "ok")
 * and real words ("te amo ❤️ mucho") stay.
 */
function trimBypassSuffix(t: string): string {
  const m = t.match(new RegExp(String.raw`^(.*\p{L}.*?(?:${EMO}))\s+(\p{L}+)$`, 'u'));
  if (!m) return t;
  const junk = m[2]!;
  const ok = new Set(junk.toLowerCase()).size <= 2 && (junk.length === 1 || junk.length >= 3);
  return ok ? m[1]!.trim() : t;
}

/** The part of a chat line sent to the engine. Bare commands are the caller's to skip. */
export function trimForEngine(text: string): string {
  // A line that is all noise is isNoise's to skip whole; trimming it first could
  // leave a fragment that no longer looks like noise.
  if (isNoise(text)) return text.trim();
  let t = text.trim().replace(COMMAND, '').trim();
  t = t.replace(EMOJI_RUN, '$1');
  t = dedupeWords(collapseRepeat(trimBypassSuffix(t)));
  return trimEdgeNoise(t);
}
