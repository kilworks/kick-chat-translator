// Hashed features for training, computed by the shipped TypeScript so training
// and inference share one definition of a feature.
// node --import tsx tools/lid/featurize.mjs --data <data-dir>
// Writes <data>/lid/feat/<set>.{idx,off,json}: Int32 feature indices (2^20
// buckets, reduce with `& (B - 1)`), Int32 row offsets (n + 1), and the labels
// plus texts. Sets: train, valid (Tatoeba), dev and bench (texts.json; heldout
// is featurized only with --heldout, once, at the end).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const data = args[args.indexOf('--data') + 1];
const withHeldout = args.includes('--heldout');
const src = args.includes('--src') ? args[args.indexOf('--src') + 1] : 'lid';
const only = args.includes('--train-only');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..');
const { lidNormalize, lidFeatures } = await import(pathToFileURL(path.join(root, 'src/content/lid/model.ts')).href);
const BUCKETS = 1 << 20;
const out = path.join(data, src, 'feat');
fs.mkdirSync(out, { recursive: true });

function write(name, rows) {
  let idx = new Int32Array(1 << 20);
  let n = 0;
  const off = new Int32Array(rows.length + 1);
  rows.forEach((r, i) => {
    for (const f of lidFeatures(lidNormalize(r.text), BUCKETS)) {
      if (n === idx.length) {
        const grown = new Int32Array(idx.length * 2);
        grown.set(idx);
        idx = grown;
      }
      idx[n++] = f;
    }
    off[i + 1] = n;
  });
  fs.writeFileSync(path.join(out, `${name}.idx`), Buffer.from(idx.buffer, 0, n * 4));
  fs.writeFileSync(path.join(out, `${name}.off`), Buffer.from(off.buffer));
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(rows.map((r) => ({ text: r.text, lang: r.lang }))));
  console.log(name, rows.length, "features", n);
}

const jsonl = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
for (const set of ['valid', 'train']) write(set, jsonl(path.join(data, src, `${set}.jsonl`)));
if (only) process.exit(0);
const T = JSON.parse(fs.readFileSync(path.join(data, 'detect', 'texts.json'), 'utf8'));
write('dev', T.sets.dev.map((r) => ({ text: r.text, lang: r.gold })));
write('bench', T.sets.tatoeba.map((r) => ({ text: r.text, lang: r.gold })));
if (withHeldout) write('heldout', T.sets.heldout.map((r) => ({ text: r.text, lang: r.gold })));
