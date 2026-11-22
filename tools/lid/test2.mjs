// test2: chat collected from --from on (pool.mjs --before keeps the same lines out of training), to measure
// on many more lines than dev. Channel ids are renumbered per file, so the split is by time, not by channel.
// node --import tsx tools/lid/test2.mjs --data <data-dir> --from 2026-11-22T21:00Z [--n 6000]
// Writes <data>/lid/feat/test2all.{idx,off,json}: every line from --from in file order (the channel's earlier
// lines feed the causal adaptation), rows {text, decl, src, ch, pos}; and <data>/lid/test2/: sample.json (the
// lines to label: {id, row}), batch-NN.jsonl ({id, text} as typed, 300 per batch) for the two annotators.
// The sample: lines with a letter, not a dev or heldout text, one per normalized text, spread over the declared
// languages (each language gets the same quota, or all its lines when it has fewer).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

Object.assign(globalThis, { __KT_METRICS__: false, __KT_DEV__: false, __KT_BUILD__: 'bench' });
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const data = arg('--data');
const from = arg('--from');
const N = Number(arg('--n', 6000));
if (!data || !from) throw new Error('--data and --from are required');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..');
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
const { lidNormalize, lidFeatures } = await imp('src/content/lid/model.ts');
const { parseKickContent } = await imp('src/content/emoteParser.ts');
const { trimForEngine } = await imp('src/content/filters.ts');

const T = JSON.parse(fs.readFileSync(path.join(data, 'detect', 'texts.json'), 'utf8'));
const evaluated = new Set([...T.sets.dev, ...T.sets.heldout].map((r) => lidNormalize(r.text)));
const raw = path.join(data, 'lid', 'raw-chat');
const rows = [];
const typed = [];
for (const f of fs.readdirSync(raw).filter((n) => /^(kick|twitch)-.*\.jsonl$/.test(n)).sort()) {
  const src = f.startsWith('kick') ? 'kick' : 'twitch';
  let pos = 0;
  for (const line of fs.readFileSync(path.join(raw, f), 'utf8').split(/\r?\n/)) {
    if (!line.endsWith('}')) continue;
    const r = JSON.parse(line);
    if (!(r.t >= from)) continue;
    const text = trimForEngine(src === 'kick' ? parseKickContent(r.content).realText : r.content);
    if (!text) continue;
    rows.push({ text, decl: r.lang, src, ch: `${f}:${r.ch}`, pos: pos++ });
    typed.push(r.content);
  }
}
let idx = new Int32Array(1 << 22);
let n = 0;
const off = new Int32Array(rows.length + 1);
rows.forEach((r, i) => {
  for (const x of lidFeatures(lidNormalize(r.text), 1 << 20)) {
    if (n === idx.length) {
      const grown = new Int32Array(idx.length * 2);
      grown.set(idx);
      idx = grown;
    }
    idx[n++] = x;
  }
  off[i + 1] = n;
});
const feat = path.join(data, 'lid', 'feat');
fs.writeFileSync(path.join(feat, 'test2all.idx'), Buffer.from(idx.buffer, 0, n * 4));
fs.writeFileSync(path.join(feat, 'test2all.off'), Buffer.from(off.buffer));
fs.writeFileSync(path.join(feat, 'test2all.json'), JSON.stringify(rows));

// sample: one row per normalized text, by declared language, equal quotas (water-filling up to N)
const seen = new Set();
const byLang = new Map();
rows.forEach((r, i) => {
  const norm = lidNormalize(r.text);
  if (!/\p{L}/u.test(norm) || evaluated.has(norm) || seen.has(norm)) return;
  seen.add(norm);
  if (!byLang.has(r.decl)) byLang.set(r.decl, []);
  byLang.get(r.decl).push(i);
});
let seed = 1;
const rand = () => ((seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 2 ** 32;
for (const list of byLang.values()) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}
const sizes = [...byLang.values()].map((l) => l.length).sort((a, b) => a - b);
let quota = 0;
for (let left = N, k = sizes.length, i = 0; i < sizes.length; i++, k--) {
  quota = Math.floor(left / k);
  if (sizes[i] >= quota) break;
  left -= sizes[i];
}
const picked = [...byLang.values()].flatMap((l) => l.slice(0, quota)).sort((a, b) => a - b);
const out = path.join(data, 'lid', 'test2');
fs.mkdirSync(out, { recursive: true });
const sample = picked.map((row, k) => ({ id: `t${String(k).padStart(5, '0')}`, row }));
fs.writeFileSync(path.join(out, 'sample.json'), JSON.stringify(sample));
for (let b = 0; b * 300 < sample.length; b++) {
  const part = sample.slice(b * 300, (b + 1) * 300).map((s) => JSON.stringify({ id: s.id, text: typed[s.row] }));
  fs.writeFileSync(path.join(out, `batch-${String(b).padStart(2, '0')}.jsonl`), part.join('\n') + '\n');
}
console.log('rows', rows.length, 'features', n, 'languages', byLang.size, 'quota', quota, 'sample', sample.length,
  'batches', Math.ceil(sample.length / 300));
process.exit(0);
