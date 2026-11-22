// Unlabeled chat for prior estimation: the captured lines as the pipeline reads
// them (realText), minus every dev and heldout text, featurized like the rest.
// node --import tsx tools/lid/captures.mjs --data <data-dir>
// Writes <data>/lid/feat/captures.{idx,off,json}. The channel language is kept
// for reporting only; nothing is trained on it.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

Object.assign(globalThis, { __KT_METRICS__: false, __KT_DEV__: false, __KT_BUILD__: 'bench' });
const args = process.argv.slice(2);
const data = args[args.indexOf('--data') + 1];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..');
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
const { lidNormalize, lidFeatures } = await imp('src/content/lid/model.ts');
const { parseKickContent } = await imp('src/content/emoteParser.ts');
const { trimForEngine } = await imp('src/content/filters.ts');

const T = JSON.parse(fs.readFileSync(path.join(data, 'detect', 'texts.json'), 'utf8'));
const evaluated = new Set([...T.sets.dev, ...T.sets.heldout].map((r) => lidNormalize(r.text)));
const rows = [];
const seen = new Set();
for (const f of fs.readdirSync(data).filter((n) => /^capture-.*\.jsonl$/.test(n))) {
  const lines = fs.readFileSync(path.join(data, f), 'utf8').split('\n');
  for (let pos = 0; pos < lines.length; pos++) {
    const line = lines[pos];
    if (!line) continue;
    const r = JSON.parse(line);
    const text = trimForEngine(parseKickContent(r.content).realText);
    const norm = lidNormalize(text);
    if (!/\p{L}/u.test(norm) || evaluated.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    rows.push({ text, lang: r.lang, ch: `${f.replace(/\.jsonl$/, "")}:${r.ch}`, pos });
  }
}
const idx = [];
const off = [0];
for (const r of rows) {
  for (const x of lidFeatures(lidNormalize(r.text), 1 << 20)) idx.push(x);
  off.push(idx.length);
}
const out = path.join(data, 'lid', 'feat');
fs.writeFileSync(path.join(out, 'captures.idx'), Buffer.from(Int32Array.from(idx).buffer));
fs.writeFileSync(path.join(out, 'captures.off'), Buffer.from(Int32Array.from(off).buffer));
fs.writeFileSync(path.join(out, 'captures.json'), JSON.stringify(rows));
console.log('captures', rows.length, 'features', idx.length, 'excluded evaluated', evaluated.size);
process.exit(0);
