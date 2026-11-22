// Unlabeled chat pool for self-training (E9): every line of <data>/lid/raw-chat
// (Kick: kick-*.jsonl, Twitch: twitch-*.jsonl), read like the pipeline reads it,
// deduplicated on normalized text, minus every dev and heldout text.
// node --import tsx tools/lid/pool.mjs --data <data-dir> [--before 2026-11-22T21:00Z]
// --before: only lines stamped earlier (t is the hour, UTC); later lines are test2 (tools/lid/test2.mjs).
// Writes <data>/lid/feat/pool.{idx,off,json}; json rows: {text, decl, src, ch}.
// decl is the channel's declared language (Kick name or Twitch code), a weak
// label only; nothing here is ever used to evaluate.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

Object.assign(globalThis, { __KT_METRICS__: false, __KT_DEV__: false, __KT_BUILD__: 'bench' });
const args = process.argv.slice(2);
const data = args[args.indexOf('--data') + 1];
const before = args.includes('--before') ? args[args.indexOf('--before') + 1] : null;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..');
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
const { lidNormalize, lidFeatures } = await imp('src/content/lid/model.ts');
const { parseKickContent } = await imp('src/content/emoteParser.ts');
const { trimForEngine } = await imp('src/content/filters.ts');

const T = JSON.parse(fs.readFileSync(path.join(data, 'detect', 'texts.json'), 'utf8'));
const evaluated = new Set([...T.sets.dev, ...T.sets.heldout].map((r) => lidNormalize(r.text)));
const raw = path.join(data, 'lid', 'raw-chat');
const rows = [];
const seen = new Set();
let read = 0;
for (const f of fs.readdirSync(raw).filter((n) => /^(kick|twitch)-.*\.jsonl$/.test(n))) {
  const src = f.startsWith('kick') ? 'kick' : 'twitch';
  for (const line of fs.readFileSync(path.join(raw, f), 'utf8').split(/\r?\n/)) {
    if (!line.endsWith('}')) continue; // last line may be half written (Twitch file has CRLF)
    read++;
    const r = JSON.parse(line);
    if (before && !(r.t < before)) continue; // a line with no hour is not known to be earlier
    const text = trimForEngine(src === 'kick' ? parseKickContent(r.content).realText : r.content);
    const norm = lidNormalize(text);
    if (!/\p{L}/u.test(norm) || evaluated.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    rows.push({ text, decl: r.lang, src, ch: `${f}:${r.ch}` });
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
const out = path.join(data, 'lid', 'feat');
fs.writeFileSync(path.join(out, 'pool.idx'), Buffer.from(idx.buffer, 0, n * 4));
fs.writeFileSync(path.join(out, 'pool.off'), Buffer.from(off.buffer));
fs.writeFileSync(path.join(out, 'pool.json'), JSON.stringify(rows));
console.log('read', read, 'pool', rows.length, 'features', n);
process.exit(0);
