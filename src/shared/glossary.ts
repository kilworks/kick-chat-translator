/**
 * Streaming / Twitch-Kick slang that should NOT be translated: it has no
 * meaningful target-language rendering ("poggers" → "poggers"). A message made
 * ONLY of these (+ noise) is skipped, saving provider quota and avoiding junk
 * like "copium" → some literal mistranslation.
 */
export const SLANG = new Set<string>([
  'pog', 'poggers', 'pogchamp', 'pogu', 'poggies', 'kekw', 'kek', 'lul', 'lulw',
  'omegalul', 'lmao', 'lmfao', 'rofl', 'copium', 'hopium', 'malding', 'mald',
  'based', 'cringe', 'ratio', 'sadge', 'aware', 'unaware', 'gigachad', 'chad',
  'sus', 'sheesh', 'kappa', 'monkas', 'monkaw', 'pepega', 'pepe', 'peepo',
  'widepeepohappy', 'ezclap', 'ez', 'gg', 'ggs', 'glhf', 'wp', 'gget',
  'pausechamp', 'catjam', 'modcheck', 'clap', 'pepelaugh', 'kekwait', 'hypers',
  'pog champ', 'd:', 'pepehands', 'sadcat', 'icant', 'plonk', 'gigachat',
  'yep', 'nope', 'copege', 'prayge', 'gambage', 'donowall', 'koncha',
  'w', 'l', 'dub', 'ws', 'ls', 'ratioed', 'gyatt', 'gyat', 'rizz', 'fr', 'frfr',
  'ong', 'ngl', 'tuff', 'aura', 'mewing', 'goon', 'goonin', 'edging',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.!?:;()"']+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * A slang token as chat stretches it: `poggg`, `sheeeesh`, `kekwww`. Folded for
 * this membership test only; the text sent to the engine is never changed,
 * because flattening before translation was measured to make lines worse.
 */
function isSlangToken(t: string): boolean {
  return (
    SLANG.has(t) || SLANG.has(t.replace(/(\p{L})\1{2,}/gu, '$1$1')) || SLANG.has(t.replace(/(\p{L})\1{2,}/gu, '$1'))
  );
}

/** True when every token is streaming slang → no point translating. */
export function isSlangOnly(text: string): boolean {
  const tokens = tokenize(text);
  if (tokens.length === 0) return false;
  return tokens.every(isSlangToken);
}

/**
 * Apply user-defined glossary replacements to a translated string.
 * Each entry is "source→replacement". Case-insensitive word boundary replace.
 */
export function applyUserGlossary(text: string, entries: string[]): string {
  if (entries.length === 0) return text;
  let out = text;
  for (const entry of entries) {
    const sep = entry.indexOf('→');
    if (sep < 1) continue;
    const from = entry.slice(0, sep).trim();
    const to = entry.slice(sep + 1).trim();
    if (!from) continue;
    try {
      // \b is ASCII-only, so anchoring both ends unconditionally made every
      // non-ASCII term ("草→lol", "привет→hi", "café→coffee") match nothing.
      // Anchor only the ends that actually begin or end on a word character.
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const lead = /^\w/.test(from) ? '\\b' : '';
      const trail = /\w$/.test(from) ? '\\b' : '';
      const re = new RegExp(`${lead}${escaped}${trail}`, 'gi');
      out = out.replace(re, to);
    } catch {
      // Invalid regex char in user input — skip silently.
    }
  }
  return out;
}

/**
 * Names the engines translate when they should not, each entered on a measured
 * miss: on the real bench (2026-11-04) Google gave the match platform `faceit`
 * as Portuguese "encarar". Written as it is shown back.
 *
 * The engine gets a placeholder in its place. `⟦n⟧` kept its place in 98 of 100
 * bench lines through Google, one line short of the best form (`[n]`, 99), and a
 * chat never types it, where a literal `[1]` would be taken for a placeholder.
 */
const KEEP_AS_IS = ['FACEIT'];
const KEEP_RE = new RegExp(String.raw`(?<![\p{L}\p{N}])(${KEEP_AS_IS.join('|')})(?![\p{L}\p{N}])`, 'giu');

/** The text for the engine, each kept name swapped for its placeholder. */
export function protectNames(text: string): string {
  return text.replace(KEEP_RE, (m) => `⟦${KEEP_AS_IS.findIndex((n) => n.toLowerCase() === m.toLowerCase()) + 1}⟧`);
}

/** The names back in place. A placeholder the engine dropped stays dropped; one it mangled is removed, never shown. */
export function restoreNames(translated: string): string {
  return translated.replace(/⟦\s*(\d+)\s*⟧/g, (_, n: string) => KEEP_AS_IS[Number(n) - 1] ?? '');
}
