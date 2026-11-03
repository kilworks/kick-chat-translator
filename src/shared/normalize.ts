/**
 * Normalize chat text so cosmetic variations collapse to the same cache key.
 * Chat repeats heavily ("WWWW"/"wwww", "loooool"/"lool", trailing punctuation).
 * Collapsing them multiplies the cache hit-rate — the #1 lever against rate-limits.
 * Shared by the SW IndexedDB cache and the content-side memory cache so both
 * agree on what counts as "the same message".
 */

/** U+0307 COMBINING DOT ABOVE, built from its code point so the source stays ASCII. */
const COMBINING_DOT_ABOVE = String.fromCharCode(0x0307);

/**
 * Lowercase for comparison. JS lowercases Turkish capital I-with-dot to a plain
 * "i" followed by a combining dot, and how many of those a string carries depends
 * on how it was capitalised, so the same word in two cases stops comparing equal.
 * Dropping the mark restores that. It deliberately does NOT fold dotless i onto
 * plain i: those are separate letters, and folding them would be wrong in every
 * other language.
 */
export function foldCase(text: string): string {
  return text.toLowerCase().split(COMBINING_DOT_ABOVE).join('');
}

export function normalizeForKey(text: string): string {
  return foldCase(text.trim())
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    // Digits are not elongation: collapsing them made "1000" and "100" one key, and
    // both caches replayed the first line's translation with the wrong number.
    .replace(/(\P{N})\1{2,}/gu, '$1$1')
    // Strip ALL trailing AND leading punctuation/symbols — "¿hola!" = "hola" = "hola."
    .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '');
}

export function cacheKey(text: string, targetLang: string): string {
  return `${targetLang}::${normalizeForKey(text)}`;
}
