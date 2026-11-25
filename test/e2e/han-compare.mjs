// Compare two han-bench outputs (reference, candidate). Prints W S K Z per (reader, class), the cost with a paired
// bootstrap by unit (1000 draws, seed 0), the list cells, and the two han-only columns.
//   node test/e2e/han-compare.mjs ref.json cand.json [--only-answered]
import { readFileSync } from 'node:fs';

const [refPath, candPath] = process.argv.slice(2);
const load = (p) => JSON.parse(readFileSync(p, 'utf-8')).rows;
let ref = load(refPath);
let cand = load(candPath);
if (ref.length !== cand.length) throw new Error('row count differs');
const keep = ref.map((r, i) => r.hasVerdict && cand[i].hasVerdict);
ref = ref.filter((_, i) => keep[i]);
cand = cand.filter((_, i) => keep[i]);

const READERS = ['en', 'ja', 'zh', 'zh-tw', 'ko'];
const CLASSES = ['ja', 'zh', 'ko'];
const LISTS = { 'L-ja-ko': ['ja', 'ko'], 'L-zh-zhtw-yue': ['zh', 'zh-tw', 'yue'], 'L-zh': ['zh'] };
const base = (c) => c.toLowerCase().split('-')[0];
const SKIP = (d) => d !== 'show';

// Per-row contribution to each count, so that the same function feeds the table and the bootstrap.
function contrib(r, reader) {
  const c = { W: 0, S: 0, K: 0, Z: 0 };
  const rb = base(reader);
  if (reader === 'en') {
    if (SKIP(r.dec[reader]) && r.nonLatin && !r.latin) c.W = 1;
    if (!SKIP(r.dec[reader]) && r.latin && !r.nonLatin) c.K = 1;
  } else {
    if (r.cls !== rb && SKIP(r.dec[reader])) c.W = 1;
    if (r.cls === rb && !SKIP(r.dec[reader])) c.K = 1;
  }
  if (r.hint) {
    if (base(r.hint) !== r.cls && !(r.hint === 'yue' && r.cls === 'zh')) c.S = 1;
  } else c.Z = 1;
  return c;
}
const cost = (c) => 10 * c.W + 5 * c.S + c.K + 0.5 * c.Z;

function table(rows) {
  const t = {};
  for (const reader of READERS) {
    t[reader] = {};
    for (const cls of CLASSES) {
      const sub = rows.filter((r) => r.cls === cls);
      const a = { n: sub.length, W: 0, S: 0, K: 0, Z: 0 };
      for (const r of sub) { const c = contrib(r, reader); a.W += c.W; a.S += c.S; a.K += c.K; a.Z += c.Z; }
      t[reader][cls] = a;
    }
  }
  return t;
}
const tr = table(ref);
const tc = table(cand);
console.log(`rows answered: ${ref.length}`);
for (const reader of READERS) {
  for (const cls of CLASSES) {
    const a = tr[reader][cls];
    const b = tc[reader][cls];
    if (!a.n) continue;
    console.log(`${reader.padEnd(5)} ${cls} n=${a.n} W ${a.W}->${b.W} S ${a.S}->${b.S} K ${a.K}->${b.K} Z ${a.Z}->${b.Z}`);
  }
}
for (const [name, allow] of Object.entries(LISTS)) {
  for (const cls of CLASSES) {
    const w = (rows) => rows.filter((r) => r.cls === cls && allow.includes(r.cls) && r.lists[name]).length;
    const a = w(ref);
    const b = w(cand);
    if (allow.includes(cls)) console.log(`${name} ${cls} W ${a}->${b}`);
  }
}
// han-only columns
const hanOnly = (rows) => rows.filter((r) => r.hanOnly);
const silence = (rows) => {
  const z = hanOnly(rows).filter((r) => r.cls === 'zh');
  return z.length ? (z.filter((r) => !r.hint).length / z.length).toFixed(3) : 'na';
};
const leak = (rows) => {
  const j = hanOnly(rows).filter((r) => r.cls === 'ja');
  return j.length ? (j.filter((r) => r.hint && base(r.hint) === 'zh' || (r.hint === 'yue')).length / j.length).toFixed(3) : 'na';
};
console.log(`han-only zh silence ${silence(ref)}->${silence(cand)}; ja->zh leak ${leak(ref)}->${leak(cand)}`);

// paired bootstrap by unit on the cost of each reader
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const units = [...new Set(ref.map((r) => r.unit))];
const idx = new Map(units.map((u, i) => [u, i]));
for (const reader of READERS) {
  const d = new Float64Array(units.length);
  ref.forEach((r, i) => { d[idx.get(r.unit)] += cost(contrib(cand[i], reader)) - cost(contrib(r, reader)); });
  const rnd = rng(0);
  const means = [];
  for (let b = 0; b < 1000; b++) {
    let s = 0;
    for (let k = 0; k < units.length; k++) s += d[Math.floor(rnd() * units.length)];
    means.push(s / units.length);
  }
  means.sort((x, y) => x - y);
  const mean = d.reduce((x, y) => x + y, 0) / units.length;
  const lo = means[25];
  const hi = means[974];
  const up = [...d].filter((v) => v > 0).length;
  console.log(`cost ${reader}: paired mean per unit ${mean.toFixed(4)} CI95 [${lo.toFixed(4)}, ${hi.toFixed(4)}] units=${units.length} units-up=${up}`);
}
