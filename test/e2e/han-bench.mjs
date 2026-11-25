// Han bench: runs the real deleting gates on a line set, for each reader, and writes one decision per (line, reader).
// Run from the repo root so the `~/` alias resolves to this tree:
//   REPO=<repo root> node --import tsx test/e2e/han-bench.mjs --data set.jsonl --verdicts google-verdicts.json --out out.json
// set.jsonl rows: {id, text, sent, cls (ja|zh|ko), unit, hanOnly}. verdicts: {<sent>: {detected}}.
// No data path is hard-coded. Compare two outputs with test/e2e/han-compare.mjs.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const repo = process.env.REPO;
if (!repo || realpathSync(process.cwd()) !== realpathSync(repo)) {
  console.error('REPO must equal the working directory (the ~/ alias resolves from cwd)');
  process.exit(2);
}
const data = arg('--data');
const verdictsPath = arg('--verdicts');
const out = arg('--out');
if (!data || !verdictsPath || !out) {
  console.error('usage: --data set.jsonl --verdicts verdicts.json --out out.json');
  process.exit(2);
}

const lang = await import(new URL('../../src/content/langDetect.ts', import.meta.url).href);
const filters = await import(new URL('../../src/content/filters.ts', import.meta.url).href);
const languages = await import(new URL('../../src/shared/languages.ts', import.meta.url).href);
console.log('resolved languages module:', new URL('../../src/shared/languages.ts', import.meta.url).pathname);

const READERS = { en: 'en', ja: 'ja', zh: 'zh', 'zh-tw': 'zh-TW', ko: 'ko' };
const LISTS = { 'L-ja-ko': ['ja', 'ko'], 'L-zh-zhtw-yue': ['zh', 'zh-tw', 'yue'], 'L-zh': ['zh'] };
const verdicts = JSON.parse(readFileSync(verdictsPath, 'utf-8'));
const rows = readFileSync(data, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const trusted = typeof filters.trustedVerdict === 'function' ? filters.trustedVerdict : (v) => v;
const NOT_LATIN_LETTER = /[\p{Script=Han}\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9d\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u3105-\u312f\u31a0-\u31bf]/u;

const res = [];
for (const r of rows) {
  const detected = await lang.detectLanguageWithBrowser(r.text);
  const hint = lang.confidentLanguage(r.text);
  const g = verdicts[r.sent];
  const hasVerdict = g !== undefined;
  const raw = hint ?? (g?.detected ? languages.normalizeLang(g.detected) : undefined);
  const verdict = raw === undefined ? undefined : trusted(raw, r.text);
  const dec = {};
  for (const [name, tgt] of Object.entries(READERS)) {
    if (tgt === 'en' && detected === 'en' && !filters.hasNonEnglishLetter(r.text)) { dec[name] = 'skipEnglish'; continue; }
    if (filters.skipOnHint(hint, tgt)) { dec[name] = 'skipSame'; continue; }
    dec[name] = filters.skipOnVerdict(verdict ?? 'auto', tgt, true) ? 'skipVerdict' : 'show';
  }
  const lists = {};
  for (const [name, allow] of Object.entries(LISTS)) {
    lists[name] = filters.shouldDropBySourceLang(detected, { sourceLangAllowlist: allow }) ?? null;
  }
  res.push({
    id: r.id, cls: r.cls, unit: r.unit, hanOnly: r.hanOnly, hasVerdict, hint: hint ?? null, detected: detected ?? null,
    verdict: verdict ?? null, nonLatin: NOT_LATIN_LETTER.test(r.text), latin: /\p{Script=Latin}/u.test(r.text), dec, lists,
  });
}
writeFileSync(out, JSON.stringify({ repo: process.cwd(), n: res.length, rows: res }));
console.log('rows', res.length, 'with verdict', res.filter((x) => x.hasVerdict).length);
