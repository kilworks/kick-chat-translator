/**
 * Check every "only language X writes this" claim of the detector against
 * word frequency lists, instead of against memory.
 *
 *   node --import tsx test/e2e/exclusivity-check.mjs <freq-dir> [--rev <git-rev>] [--out <report.json>] [--of-own <ratio>]
 *
 * <freq-dir> holds one `<code>.txt` per language ("word count" lines, the
 * FrequencyWords lists built from OpenSubtitles 2018, CC BY-SA 4.0, kept out
 * of git). The script copies src/content/langDetect.ts and
 * src/shared/romanised.ts at <rev> (default: the working tree) into a
 * temporary folder, exports their top-level constants and reads the tables
 * as the detector holds them, so a table is never parsed by hand.
 *
 * THE THRESHOLD, written before any result was read (2026-11-04): an entry
 * claimed for languages C is a violation for a language L outside C when L
 * writes it at 50 per million words or more AND at a tenth or more of the
 * highest rate among C. When no language of C has the entry in its list (a
 * romanised word against a list in its own script), the first condition
 * alone decides. Variants share a list family: pt and pt-br, zh and zh-tw.
 *
 * That threshold failed its control: on f5b67d7 it saw taas, hola and hallo
 * but not ik (Latvian 96 per million, Dutch 38,770) nor ele (Romanian 268,
 * Portuguese 8,036), the tenth-of-own condition hiding both. The default is
 * now the first condition alone, set AFTER the control and said so;
 * `--of-own 0.1` replays the threshold as first written.
 *
 * Exits 1 when any violation is found, and prints them all.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const FREQ = process.argv[2];
const REV = arg('--rev');
const OUT = arg('--out');
if (!FREQ || !fs.existsSync(FREQ)) {
  console.error('exclusivity-check: <freq-dir> required');
  process.exit(2);
}
const ABS = 50e-6;
const REL = Number(arg('--of-own', 0));
const FAMILY = { 'pt-br': 'pt', 'zh-tw': 'zh' };
const fam = (l) => FAMILY[l] ?? l;

// Frequency lists, as relative rates.
const lists = new Map();
for (const f of fs.readdirSync(FREQ).filter((f) => f.endsWith('.txt'))) {
  const rates = new Map();
  let total = 0;
  const rows = fs.readFileSync(path.join(FREQ, f), 'utf8').split('\n');
  for (const r of rows) {
    const [w, n] = r.trim().split(/\s+/);
    if (w && Number(n) > 0) total += Number(n);
  }
  for (const r of rows) {
    const [w, n] = r.trim().split(/\s+/);
    if (w && Number(n) > 0) rates.set(w.toLowerCase(), (rates.get(w.toLowerCase()) ?? 0) + Number(n) / total);
  }
  lists.set(f.slice(0, -4), rates);
}

// The two modules at <rev>, with their constants exported.
const tmp = fs.mkdtempSync(path.join(process.cwd(), '.exclusivity-'));
const source = (p) => (REV ? execFileSync('git', ['show', `${REV}:${p}`], { encoding: 'utf8', maxBuffer: 1 << 26 }) : fs.readFileSync(p, 'utf8'));
const exposed = (src) => {
  const names = [...src.matchAll(/^const ([A-Z][A-Z0-9_]*)\b/gm)].map((m) => m[1]);
  return `${src}\nexport { ${names.join(', ')} };\n`;
};
let detect;
let roman;
try {
  fs.writeFileSync(path.join(tmp, 'romanised.ts'), exposed(source('src/shared/romanised.ts')));
  fs.writeFileSync(path.join(tmp, 'langDetect.ts'), exposed(source('src/content/langDetect.ts')).replace("'~/shared/romanised'", "'./romanised.ts'"));
  roman = await import(pathToFileURL(path.join(tmp, 'romanised.ts')).href);
  detect = await import(pathToFileURL(path.join(tmp, 'langDetect.ts')).href);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Single regex constants: which languages each one claims, and, for a tie-break
// between siblings, which languages it is meant to separate (`among`).
const NAMED = {
  MOTS_NORVEGIENS: { claims: ['no'], among: ['da'] },
  MOTS_DANOIS: { claims: ['da'], among: ['no'] },
  SEQUENCES_NORVEGIENNES: { claims: ['no'], among: ['da'] },
  SEQUENCES_DANOISES: { claims: ['da'], among: ['no'] },
  LETTRES_DANO_NORVEGIENNES: { claims: ['da', 'no'] },
  A_ROND_SCANDINAVE: { claims: ['sv', 'da', 'no'] },
  MOTS_SUEDOIS: { claims: ['sv'] },
  MOTS_DANO_NORVEGIENS: { claims: ['da', 'no'] },
  O_BARRE: { claims: ['et'] },
  MOTS_ESTONIENS: { claims: ['et'] },
  MOTS_PORTUGAIS: { claims: ['pt'] },
  MOTS_MALAIS_INDONESIENS: { claims: ['ms', 'id'] },
  MOTS_INDONESIENS: { claims: ['id'], among: ['ms'] },
  MOTS_MALAIS: { claims: ['ms'], among: ['id'] },
  ANGLAIS_DE_CHAT: { claims: ['en'] },
  LETTRES_PERSANES: { claims: ['fa'] },
  LETTRES_OURDOUES: { claims: ['ur'] },
  LETTRES_JAWI: { claims: ['ms'] },
  MOTS_JAWI: { claims: ['ms'] },
  MOTS_PERSANS: { claims: ['fa'] },
  LETTRES_ARABES: { claims: ['ar'] },
  MOTS_ARABES: { claims: ['ar'] },
  ARTICLE_ARABE: { claims: ['ar'] },
  MOTS_ARABES_CHAT: { claims: ['ar'] },
  LETTRES_MONGOLES: { claims: ['mn'] },
  MOTS_MONGOLS: { claims: ['mn'] },
  LETTRES_UKRAINIENNES: { claims: ['uk'] },
  MOTS_UKRAINIENS: { claims: ['uk'] },
  LETTRES_RUSSES: { claims: ['ru'] },
  ER_BULGARE: { claims: ['bg'] },
  ARTICLE_BULGARE: { claims: ['bg'] },
  INFINITIF_RUSSE: { claims: ['ru'] },
  MOTS_RUSSES: { claims: ['ru'] },
  ADJECTIF_RUSSE: { claims: ['ru'] },
  UKRAINIEN_OU_BULGARE: { claims: ['uk', 'bg'] },
  MOTS_BULGARES: { claims: ['bg'] },
  MOTS_CANTONAIS: { claims: ['yue'] },
  CARACTERES_CANTONAIS: { claims: ['yue'] },
  CARACTERES_TRADITIONNELS: { claims: ['zh-tw', 'yue'], among: ['zh'] },
  CARACTERES_SIMPLIFIES: { claims: ['zh'], among: ['zh-tw'] },
  ADJECTIF_RU: { claims: ['ru'] },
};
// Not claims of exclusivity, said so in the code: neutral tokens, and the
// raw-path leanings that are shared on purpose.
const NOT_CLAIMS = new Set(['COMMON_SHORT_TOKENS', 'PENCHANTS', 'SHORT_TEXT_MAX', 'MEMO_MAX', 'LOOKUP_MEMO', 'DETECT_MEMO', 'TABLE', 'FAIBLES']);
// romanised.ts TABLE and FAIBLES are built from MARQUEURS and FAIBLES_PAR_LANGUE: the same words, read once.
const SET_CLAIMS = { MOTS_HINGLISH: ['hi'], MOTS_HINGLISH_FORTS: ['hi'], ANGLAIS_AUTOUR_DU_RIRE: ['en'] };

// Every claim as { table, entry, claims, among?, word | re }.
const claims = [];
const unread = [];
const seen = new Set();
const fromRegex = (table, re, langs, among) => {
  // A plain word alternation is checked word by word, so a report names the word.
  const m = /^\(\^\|\[\^\\p\{L\}\]\)\(([\p{L}|]+)\)(?:\(\[\^\\p\{L\}\]\|\$\)|\(\?=\[\^\\p\{L\}\]\|\$\))$/u.exec(re.source);
  if (m) for (const w of m[1].split('|')) claims.push({ table, entry: w, claims: langs, among, word: w.toLowerCase() });
  else claims.push({ table, entry: re.source, claims: langs, among, re: new RegExp(re.source, re.flags.replace('g', '')) });
};
for (const [mod, scope] of [
  [detect, 'langDetect'],
  [roman, 'romanised'],
]) {
  for (const [name, value] of Object.entries(mod)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || NOT_CLAIMS.has(name) || seen.has(value)) continue;
    // An exported alias (ROMANISED_MARKERS = MARQUEURS) is the same table.
    seen.add(value);
    const table = `${scope}.${name}`;
    if (value instanceof Map) for (const [w, l] of value) typeof l === 'string' && claims.push({ table, entry: w, claims: [l], word: String(w).toLowerCase() });
    else if (value instanceof Set) {
      if (SET_CLAIMS[name]) for (const w of value) claims.push({ table, entry: w, claims: SET_CLAIMS[name], word: String(w).toLowerCase() });
      else unread.push(table);
    } else if (value instanceof RegExp) {
      if (NAMED[name]) fromRegex(table, value, NAMED[name].claims, NAMED[name].among);
      else unread.push(table);
    } else if (Array.isArray(value) && value.every((e) => Array.isArray(e) && e[0] instanceof RegExp)) {
      for (const [re, l] of value) fromRegex(table, re, Array.isArray(l) ? l : [l]);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [l, v] of Object.entries(value)) {
        if (v instanceof RegExp) fromRegex(table, v, [l]);
        else if (Array.isArray(v)) for (const w of v) claims.push({ table, entry: w, claims: [l], word: String(w).toLowerCase() });
        else unread.push(`${table}.${l}`);
      }
    } else unread.push(table);
  }
}

// Rate of an entry in one list: the word's own rate, or the summed rate of every listed word the pattern matches.
const rate = (c, rates) => {
  if (c.word !== undefined) return { r: rates.get(c.word) ?? 0, top: [] };
  let r = 0;
  const top = [];
  for (const [w, x] of rates) {
    if (c.re.test(` ${w} `)) {
      r += x;
      if (top.length < 3) top.push(w);
    }
  }
  return { r, top };
};

const violations = [];
for (const c of claims) {
  const claimed = new Set(c.claims.map(fam));
  const own = Math.max(0, ...c.claims.filter((l) => lists.has(l)).map((l) => rate(c, lists.get(l)).r));
  for (const [l, rates] of lists) {
    if (claimed.has(fam(l)) || (c.among && !c.among.includes(l))) continue;
    const { r, top } = rate(c, rates);
    if (r >= ABS && (own === 0 || r >= REL * own)) {
      violations.push({ table: c.table, entry: c.entry, claims: c.claims.join(','), writer: l, perMillion: Math.round(r * 1e6), ownPerMillion: Math.round(own * 1e6), examples: top });
    }
  }
}

const report = { rev: REV ?? 'working tree', lists: [...lists.keys()].sort(), claims: claims.length, unread, threshold: { perMillion: ABS * 1e6, ofOwn: REL }, violations };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
const entries = new Set(violations.map((v) => `${v.table} ${v.entry}`));
console.log(`exclusivity-check ${report.rev}: ${claims.length} claims, ${lists.size} lists, ${violations.length} violations on ${entries.size} entries`);
if (unread.length) console.log(`  tables not read as claims: ${unread.join(', ')}`);
for (const v of violations) console.log(`  ${v.table} ${v.entry} [${v.claims}] also ${v.writer} ${v.perMillion}/M (own ${v.ownPerMillion}/M)${v.examples.length ? ' ' + v.examples.join(' ') : ''}`);
process.exit(violations.length ? 1 : 0);
