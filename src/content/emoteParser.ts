import type { TextToken } from '~/shared/types';

// Kick chat content uses [emote:<id>:<name>] tokens for emotes,
// @<user> for mentions, and bare URLs for links.
const EMOTE_RE = /\[emote:(\d+):([^\]]+)\]/g;
const MENTION_RE = /(^|[\s,.!?])@([a-z0-9_]{2,32})/gi;
// Bare domains too (`www.nordtvs.com`, `Eldorado.gg`, `discord.gg/xyz`): measured
// on live chat they reached the engine, which has nothing to translate in them.
// A short list of TLDs, not any dot: "ok.so" or "e.g." must stay words.
const URL_RE =
  /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|\b[a-z0-9-]{2,}\.(?:com|gg|tv|net|org|io|be|ly|me|pl|br|bet|xyz|app|link)\b(?:\/[^\s<>"']*)?/gi;

/**
 * An emote name typed as a word (pepeLaugh, catJam, PogChamp): a lowercase
 * stem of two letters or more then a capital, or a PascalCase emote family.
 * Shared with the composer, which keeps these out of what the engine reads.
 * The measurement behind the shape is in stripInlineEmoteNames.
 */
export const EMOTE_NAME_RE =
  /\b(?:[a-z]{2,}[A-Z][a-zA-Z0-9]*|(?:Pepe|Peepo|Pepo|Pepega|Pog|Pause|Feels|Weird|Okay|Monka|Widepeepo)[A-Z][a-zA-Z0-9]*|BibleThump|ResidentSleeper|NotLikeThis|WutFace|DansGame|SeemsGood|HeyGuys|KomodoHype|CoolCat|TriHard|BabyRage)\b/g;

export interface ParsedContent {
  /** Readable text with placeholders (`:emote:`, `[link]`, `@user`). */
  plain: string;
  /** ONLY the human words — emotes / mentions / urls removed. What we translate. */
  realText: string;
  tokens: TextToken[];
}

interface Marker {
  start: number;
  end: number;
  token: TextToken;
  plain: string;
}

export function parseKickContent(content: string): ParsedContent {
  const markers: Marker[] = [];

  for (const match of content.matchAll(EMOTE_RE)) {
    if (match.index === undefined) continue;
    const id = match[1] ?? '';
    const name = match[2] ?? '';
    markers.push({
      start: match.index,
      end: match.index + match[0].length,
      token: { kind: 'emote', id, name },
      plain: ` :${name}: `,
    });
  }

  for (const match of content.matchAll(URL_RE)) {
    if (match.index === undefined) continue;
    if (overlaps(markers, match.index, match.index + match[0].length)) continue;
    markers.push({
      start: match.index,
      end: match.index + match[0].length,
      token: { kind: 'url', href: match[0] },
      plain: ' [link] ',
    });
  }

  for (const match of content.matchAll(MENTION_RE)) {
    if (match.index === undefined) continue;
    const lead = match[1] ?? '';
    const user = match[2] ?? '';
    const absStart = match.index + lead.length;
    const absEnd = absStart + 1 + user.length; // '@' + user
    if (overlaps(markers, absStart, absEnd)) continue;
    markers.push({
      start: absStart,
      end: absEnd,
      token: { kind: 'mention', user: user.toLowerCase() },
      plain: ` @${user} `,
    });
  }

  markers.sort((a, b) => a.start - b.start);

  const tokens: TextToken[] = [];
  let cursor = 0;
  const plainParts: string[] = [];

  for (const m of markers) {
    if (m.start > cursor) {
      const slice = content.slice(cursor, m.start);
      tokens.push({ kind: 'text', value: slice });
      plainParts.push(slice);
    }
    tokens.push(m.token);
    plainParts.push(m.plain);
    cursor = m.end;
  }
  if (cursor < content.length) {
    const slice = content.slice(cursor);
    tokens.push({ kind: 'text', value: slice });
    plainParts.push(slice);
  }

  const plain = plainParts.join('').replace(/\s+/g, ' ').trim();
  const rawReal = tokens
    .filter((t): t is { kind: 'text'; value: string } => t.kind === 'text')
    .map((t) => t.value)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip inline emote names: tokens like "namedarumajankiss2", "LUL", "KEKW",
  // "xqcL", "pepeLaugh" that are concatenated with real text. These are typically
  // camelCase/PascalCase with digits, or ALL-CAPS 3+ letter words that aren't real
  // words. We strip them to recover the translatable text underneath.
  const realText = stripInlineEmoteNames(rawReal);
  return { plain, realText, tokens };
}

/**
 * Strip words that look like emote names from extracted text.
 * Patterns:
 * - camelCase/PascalCase with digits (namedarumajankiss2, xqcL, pepeLaugh)
 * - ALL-CAPS 3+ letters that aren't common words (KEKW, LULW, OMEGALUL)
 * - Words starting with lowercase then uppercase mid-word (catJam, monkaS)
 * Preserves real text around them.
 */
function stripInlineEmoteNames(text: string): string {
  return (
    text
      // Mixed-case emote names (pepeLaugh, catJam, xqcL3, PogChamp, FeelsBadMan).
      //
      // This was every mixed-case word, and the brands it cost were the
      // sentence: "LeBron is the best player ever" reached the reader as "est
      // le meilleur joueur de tous les temps", "let's go to McDonald's" as
      // "allons à 's". Measured on two lists written before the rule, then on
      // two fresh ones it never saw: the old rule deleted 49 of 50 and 30 of 30
      // brand and person names (iPhone, YouTube, PlayStation, PayPal, xQc). This
      // one deletes none, and still removes 50 of 50 and 23 of 29 emote names.
      // 7TV names start with a lowercase stem of two letters or more (iPhone and
      // eBay have one); PascalCase ones are taken by family. Kept, an emote name
      // is mangled by Google 44% of the time (peepoJoyeux), so the six that slip
      // through cost less than every brand did.
      .replace(EMOTE_NAME_RE, ' ')
      // A long all-lowercase slug, but only when it carries a digit.
      //
      // This used to be `[a-z]{3,}[a-z0-9]{10,}`: any lowercase word of 13
      // characters or more. Measured over 11583 words of the store listings it
      // destroyed completamente, almacenamiento, armazenamento, justifications,
      // communications, certifications, creditworthiness and conditionally, and
      // it caught exactly one emote name of thirteen, namedarumajankiss2, which
      // the suffix rule below already catches. Thirteen characters is an
      // ordinary word length in Spanish, Portuguese, Turkish, German, Finnish.
      .replace(/\b[a-z]{3,}[a-z0-9]*\d[a-z0-9]*\b/g, (m) => (m.length >= 13 ? ' ' : m))
      // Known emote suffixes (common Kick/BTTV/7TV patterns).
      //
      // `ez` and `gg` were in this list and were pure damage. Turkish forms the
      // negative aorist with -mez, so etmez, istemez, gitmez, gerekmez and
      // gondermez were all deleted before translation, and Turkish is the second
      // most read of the localised listings. Spanish vez, Czech bez and kez went
      // the same way. All nine words this rule destroyed in that corpus came
      // from those two alternatives, and dropping them costs no emote: OMEGALUL
      // is still caught by `lul`.
      //
      // The suffixes split in two. kiss, pog, clap and hype end almost no word in
      // any of the 37 languages measured below, and keep the open rule, with a
      // two-letter stem so that Swedish skiss and French apogee survive.
      .replace(/\b\w{2,}(kiss|pog|clap|hype)\d*\b/gi, ' ')
      // lul, kek, jam, hug, love, wave and dab are ordinary word endings, and the
      // open rule deleted them before translation. Measured on the 30000 most
      // frequent words of 37 languages (wordfreq), weighted by frequency: 23
      // words in 10000 of Romanian text, the -ul article (felul, copilul, rolul,
      // nivelul), 5 in Turkish (erkek), 5 in Latvian (-jam datives), 4 in
      // Hungarian (gyerekek), 2 to 3 in Indonesian, Malay, Slovenian,
      // Lithuanian and Portuguese (sejam, vejam). They now strip only when the
      // name is shouted in capitals, the way OMEGALUL and CATJAM are typed, or
      // when the stem is one of the emote families that wear these suffixes.
      .replace(/\b[A-Z0-9]{2,}(LUL|KEK|JAM|HUG|LOVE|WAVE|DAB)\d*\b/g, ' ')
      .replace(/\b(pepe|peepo|widepeepo|monka|omega|cat|dog|blob)(lul|kek|jam|hug|love|wave|dab)\w*\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * The @mentions of a line, as typed, each once. They never go to the engine
 * (realText leaves them out), and they used to never come back either: with
 * "replace" display a reply lost who it answered. The translation now leads
 * with them.
 */
export function mentionsOf(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of content.matchAll(MENTION_RE)) {
    const user = m[2] ?? '';
    if (seen.has(user.toLowerCase())) continue;
    seen.add(user.toLowerCase());
    out.push(`@${user}`);
  }
  return out;
}

function overlaps(markers: Marker[], start: number, end: number): boolean {
  for (const m of markers) {
    if (start < m.end && end > m.start) return true;
  }
  return false;
}
