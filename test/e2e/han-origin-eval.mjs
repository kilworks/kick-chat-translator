// Share of each answer of confidentLanguage over lines of known origin.
// Run from the repo root so the ~/ alias resolves to this tree:
//   node --import tsx test/e2e/han-origin-eval.mjs --data <dir> --split <train|dev|test|fresh> --out out.json
// <dir>/<origin>.jsonl rows: {t, o, src, s?} for origins tw hk yue cn ja. Rows with src 'sub' are skipped (labelled by file name only).
// --split fresh keeps every row (a set with no split field). No data path is hard-coded.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const dir = arg('--data');
const split = arg('--split');
const out = arg('--out');
if (!dir || !split || !out) {
  console.error('usage: --data <dir> --split <train|dev|test|fresh> --out out.json');
  process.exit(2);
}
const { confidentLanguage } = await import(new URL('../../src/content/langDetect.ts', import.meta.url).href);
const { shares } = await import(new URL('../../src/content/hanOriginEval.ts', import.meta.url).href);

const result = {};
for (const origin of ['tw', 'hk', 'yue', 'cn', 'ja']) {
  let text;
  try {
    text = readFileSync(join(dir, origin + '.jsonl'), 'utf-8');
  } catch {
    continue;
  }
  const rows = text
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((d) => d.src !== 'sub' && (split === 'fresh' || d.s === split));
  result[origin] = shares(rows, confidentLanguage);
}
writeFileSync(out, JSON.stringify(result, null, 1));
for (const [o, v] of Object.entries(result)) console.log(o, v.n, JSON.stringify(v.shares));
