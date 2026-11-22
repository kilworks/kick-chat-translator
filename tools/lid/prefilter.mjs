// Which dev lines reach language detection in the real pipeline (pipeline.ts prepare, before detectLanguageWithBrowser).
// Reads dev.jsonl only (never texts.json, never heldout). Prints counts, writes a per-line mask.
// node --import tsx tools/lid/prefilter.mjs <repo> <data>/dev.jsonl <mask.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

Object.assign(globalThis, { __KT_METRICS__: false, __KT_DEV__: false, __KT_BUILD__: 'bench' });
const [repo, devPath, outPath] = process.argv.slice(2);
const imp = (p) => import(pathToFileURL(path.join(repo, p)).href);
const { parseKickContent } = await imp('src/content/emoteParser.ts');
const { chatLength, isBareCommand, isNoise, trimForEngine } = await imp('src/content/filters.ts');
const { isSlangOnly } = await imp('src/shared/glossary.ts');
const { MIN_TEXT_LENGTH, MAX_TEXT_LENGTH } = await imp('src/shared/constants.ts');

function outcome(raw) {
  const parsed = parseKickContent(raw).realText;
  if (isBareCommand(parsed)) return 'command';
  const t = trimForEngine(parsed);
  if (chatLength(t) < MIN_TEXT_LENGTH) return 'short';
  if (t.length > MAX_TEXT_LENGTH) return 'long';
  if (isNoise(t)) return 'noise';
  if (isSlangOnly(t)) return 'slang';
  return 'detect';
}

const NOT_LANG = new Set(['neutral', 'other', 'mixed']);
const rows = fs.readFileSync(devPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const mask = [];
const table = {};
for (const r of rows) {
  const o = outcome(r.text);
  mask.push(o === 'detect');
  const g = r.lang == null ? 'null' : NOT_LANG.has(r.lang) ? r.lang : 'in-cost';
  (table[g] ??= {})[o] = ((table[g] ??= {})[o] ?? 0) + 1;
}
fs.writeFileSync(outPath, JSON.stringify(mask));
console.log('MIN_TEXT_LENGTH', MIN_TEXT_LENGTH, 'rows', rows.length, 'reach detection', mask.filter(Boolean).length);
for (const [g, v] of Object.entries(table)) console.log(g, JSON.stringify(v));
process.exit(0);
