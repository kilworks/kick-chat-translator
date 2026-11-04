/**
 * Build the real chat bench from captures, in two steps around the annotation.
 *
 *   node test/e2e/real-bench.mjs sample <dir> <capture.jsonl>...
 *       Merges the captures, drops exact repeats, draws a stratified sample by
 *       the language the stream declared (2000 lines, at least 30 per language
 *       when the capture has them) and writes <dir>/sample.jsonl plus the
 *       annotation batches <dir>/annotate/batch-<n>.jsonl, which hold only an id
 *       and the text: an annotator sees neither the stream's language nor the
 *       detector.
 *
 *   node test/e2e/real-bench.mjs split <dir> <annotator-a.jsonl> <annotator-b.jsonl>
 *       Scores the agreement between the two annotators field by field (raw
 *       agreement and Cohen's kappa), keeps a field's value only where both
 *       agree, lists every disagreement for a speaker to settle
 *       (<dir>/disagreements.jsonl, never settled here), and splits the bench in
 *       two halves by gold language: <dir>/dev.jsonl to read and tune on,
 *       <dir>/heldout.jsonl never read line by line, its sha256 written next to it.
 *
 * Seeded, so the same captures and annotations give the same files. Everything
 * it reads and writes is third-party chat: keep <dir> out of git.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [cmd, dir, ...files] = process.argv.slice(2);
const TOTAL = 2000;
const FLOOR = 30;
const BATCH = 250;
const FIELDS = ['lang', 'variant', 'slang', 'romanised', 'code_switch', 'emote_only', 'bot_command', 'english_chat'];

const readJsonl = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const writeJsonl = (f, rows) => fs.writeFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (xs, rand) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const groupBy = (xs, key) => xs.reduce((m, x) => m.set(key(x), [...(m.get(key(x)) ?? []), x]), new Map());

/** Floor first, then the rest in proportion to what each language has left. */
export function allocate(available, total = TOTAL, floor = FLOOR) {
  const take = new Map([...available].map(([k, n]) => [k, Math.min(n, floor)]));
  let left = total - [...take.values()].reduce((a, b) => a + b, 0);
  while (left > 0) {
    const room = [...available].filter(([k, n]) => n > take.get(k));
    if (room.length === 0) break;
    const spare = room.reduce((a, [k, n]) => a + n - take.get(k), 0);
    let given = 0;
    for (const [k, n] of room) {
      const add = Math.min(n - take.get(k), Math.max(1, Math.floor((left * (n - take.get(k))) / spare)), left - given);
      take.set(k, take.get(k) + add);
      given += add;
      if (given === left) break;
    }
    left -= given;
  }
  return take;
}

export function kappa(pairs) {
  const n = pairs.length;
  if (n === 0) return { n, agree: null, kappa: null };
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const ca = new Map();
  const cb = new Map();
  for (const [a, b] of pairs) {
    ca.set(a, (ca.get(a) ?? 0) + 1);
    cb.set(b, (cb.get(b) ?? 0) + 1);
  }
  const pe = [...ca].reduce((s, [k, x]) => s + (x / n) * ((cb.get(k) ?? 0) / n), 0);
  return { n, agree: po, kappa: pe === 1 ? 1 : (po - pe) / (1 - pe) };
}

if (cmd === 'sample') {
  const seen = new Set();
  const lines = [];
  for (const f of files) {
    for (const l of readJsonl(f)) {
      if (seen.has(l.content)) continue;
      seen.add(l.content);
      lines.push({ decl: l.lang, ch: `${path.basename(f, '.jsonl')}:${l.ch}`, t: l.t, text: l.content });
    }
  }
  const rand = rng(20261104);
  const byDecl = groupBy(lines, (l) => l.decl);
  const take = allocate(new Map([...byDecl].map(([k, v]) => [k, v.length])));
  const sample = shuffle(
    [...byDecl].flatMap(([k, v]) => shuffle(v, rand).slice(0, take.get(k))),
    rand,
  ).map((l, i) => ({ id: `r${String(i).padStart(4, '0')}`, ...l }));
  writeJsonl(path.join(dir, 'sample.jsonl'), sample);
  fs.mkdirSync(path.join(dir, 'annotate'), { recursive: true });
  for (let b = 0; b * BATCH < sample.length; b++) {
    writeJsonl(path.join(dir, 'annotate', `batch-${b}.jsonl`), sample.slice(b * BATCH, (b + 1) * BATCH).map(({ id, text }) => ({ id, text })));
  }
  console.log(`sample: ${lines.length} distinct lines, ${sample.length} drawn`);
  console.log('per declared language:', JSON.stringify(Object.fromEntries([...take].sort((a, b) => b[1] - a[1]))));
  const short = [...take].filter(([, n]) => n < FLOOR);
  console.log(`under ${FLOOR}:`, short.length ? JSON.stringify(Object.fromEntries(short)) : 'none');
} else if (cmd === 'split') {
  const sample = readJsonl(path.join(dir, 'sample.jsonl'));
  const [a, b] = files.map((f) => new Map(readJsonl(f).map((r) => [r.id, r])));
  const missing = sample.filter((s) => !a.has(s.id) || !b.has(s.id)).map((s) => s.id);
  if (missing.length) {
    console.error(`split: ${missing.length} lines not annotated by both, first ${missing.slice(0, 5).join(' ')}`);
    process.exit(1);
  }
  const agreement = Object.fromEntries(FIELDS.map((f) => [f, kappa(sample.map((s) => [a.get(s.id)[f] ?? null, b.get(s.id)[f] ?? null]))]));
  const disagreements = [];
  const bench = sample.map((s) => {
    const gold = {};
    for (const f of FIELDS) {
      const [x, y] = [a.get(s.id)[f] ?? null, b.get(s.id)[f] ?? null];
      if (x === y) gold[f] = x;
      else {
        gold[f] = undefined;
        disagreements.push({ id: s.id, text: s.text, field: f, a: x, b: y });
      }
    }
    return { ...s, ...gold };
  });
  const rand = rng(1104);
  const dev = [];
  const heldout = [];
  for (const [, rows] of [...groupBy(bench, (r) => r.lang ?? '?')].sort(([x], [y]) => (x < y ? -1 : 1))) {
    shuffle(rows, rand).forEach((r, i) => (i % 2 === 0 ? dev : heldout).push(r));
  }
  writeJsonl(path.join(dir, 'dev.jsonl'), dev);
  writeJsonl(path.join(dir, 'heldout.jsonl'), heldout);
  writeJsonl(path.join(dir, 'disagreements.jsonl'), disagreements);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'heldout.jsonl'))).digest('hex');
  fs.writeFileSync(path.join(dir, 'heldout.sha256'), sha + '\n');
  fs.writeFileSync(path.join(dir, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n');
  console.log(`split: dev ${dev.length}, heldout ${heldout.length} (sha256 ${sha}), disagreements ${disagreements.length}`);
  for (const [f, k] of Object.entries(agreement)) console.log(`  ${f}: agree ${(k.agree * 100).toFixed(1)} %, kappa ${k.kappa.toFixed(3)}`);
} else if (cmd === 'selftest') {
  const assert = (await import('node:assert/strict')).default;
  const t = allocate(new Map([['a', 10], ['b', 100], ['c', 1000]]), 200, 30);
  assert.deepEqual([t.get('a'), t.get('b'), t.get('c')].reduce((x, y) => x + y), 200);
  assert.equal(t.get('a'), 10);
  assert.ok(t.get('b') >= 30 && t.get('c') > t.get('b'));
  assert.deepEqual(kappa([['x', 'x'], ['y', 'y']]), { n: 2, agree: 1, kappa: 1 });
  assert.equal(kappa([['x', 'y'], ['y', 'x']]).kappa, -1);
  console.log('real-bench selftest: ok');
} else if (cmd !== undefined) {
  console.error('real-bench: sample <dir> <capture.jsonl>... | split <dir> <a.jsonl> <b.jsonl>');
  process.exit(2);
}
