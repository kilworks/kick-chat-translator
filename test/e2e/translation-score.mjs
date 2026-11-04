/**
 * Turn two blind MQM judges into the engine x pair x category table.
 *
 *   node test/e2e/translation-score.mjs <mqm-dir>
 *
 * Reads <mqm-dir>/key.jsonl (which engine produced which judged item, never
 * shown to the judges) and every <mqm-dir>/j1/*.jsonl and j2/*.jsonl. Writes
 * <mqm-dir>/table.json and <mqm-dir>/kil-check.jsonl, one item in ten with both
 * verdicts and the engine, for a human to check. Prints the totals.
 *
 * Penalty per line, MQM weights: critical 25, major 5, minor 1. An error count
 * is the mean of the two judges, so a cell reads in errors per line.
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const W = { critical: 25, major: 5, minor: 1 };
const CATS = ['mistranslation', 'omission', 'register', 'slang', 'proper_noun', 'emote_user', 'transliteration', 'wrong_language'];
const readJsonl = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const judge = (j) => {
  const m = new Map();
  for (const f of fs.readdirSync(path.join(dir, j)).sort()) for (const r of readJsonl(path.join(dir, j, f))) m.set(r.item, r.errors ?? []);
  return m;
};
const [j1, j2] = [judge('j1'), judge('j2')];
const key = readJsonl(path.join(dir, 'key.jsonl'));
const items = [...new Set(key.map((k) => k.item))];
const missing = items.filter((i) => !j1.has(i) || !j2.has(i));
if (missing.length) {
  console.error(`translation-score: ${missing.length} items not judged by both, first ${missing.slice(0, 5).join(' ')}`);
  process.exit(1);
}
const penalty = (errs) => errs.reduce((s, e) => s + (W[e.sev] ?? 0), 0);
const serious = (errs) => errs.some((e) => e.sev === 'critical' || e.sev === 'major');

// Agreement: same call on "at least one major or critical error", and per category on presence.
const agree = (f) => items.filter((i) => f(j1.get(i)) === f(j2.get(i))).length / items.length;
const kappa = (f) => {
  const po = agree(f);
  const p1 = items.filter((i) => f(j1.get(i))).length / items.length;
  const p2 = items.filter((i) => f(j2.get(i))).length / items.length;
  const pe = p1 * p2 + (1 - p1) * (1 - p2);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
};
const agreement = { serious: { agree: agree(serious), kappa: kappa(serious) } };
for (const c of CATS) {
  const has = (errs) => errs.some((e) => e.cat === c);
  agreement[c] = { agree: agree(has), kappa: kappa(has) };
}

const table = {};
for (const k of key) {
  const cell = (table[`${k.engine} ${k.src}>${k.target}`] ??= { n: 0, penalty: 0, serious: 0, cats: Object.fromEntries(CATS.map((c) => [c, 0])) });
  const both = [j1.get(k.item), j2.get(k.item)];
  cell.n += 1;
  cell.penalty += both.reduce((s, e) => s + penalty(e), 0) / 2;
  cell.serious += both.filter(serious).length / 2;
  for (const errs of both) for (const e of errs) if (e.cat in cell.cats) cell.cats[e.cat] += 0.5;
}
fs.writeFileSync(path.join(dir, 'table.json'), JSON.stringify({ agreement, table }, null, 2) + '\n');
const check = key.filter((_, i) => i % 10 === 0).map((k) => ({ ...k, j1: j1.get(k.item), j2: j2.get(k.item) }));
fs.writeFileSync(path.join(dir, 'kil-check.jsonl'), check.map((r) => JSON.stringify(r)).join('\n') + '\n');

console.log(`translation-score: ${items.length} judged items, ${key.length} engine outputs, ${check.length} for the human check`);
console.log(`agreement on a major or critical error: ${(agreement.serious.agree * 100).toFixed(1)} %, kappa ${agreement.serious.kappa.toFixed(3)}`);
for (const c of CATS) console.log(`  ${c}: ${(agreement[c].agree * 100).toFixed(1)} %, kappa ${agreement[c].kappa.toFixed(3)}`);
const byEngine = {};
for (const [k, c] of Object.entries(table)) {
  const e = (byEngine[k.split(' ')[0]] ??= { n: 0, penalty: 0, serious: 0, cats: Object.fromEntries(CATS.map((x) => [x, 0])) });
  e.n += c.n;
  e.penalty += c.penalty;
  e.serious += c.serious;
  for (const x of CATS) e.cats[x] += c.cats[x];
}
for (const [e, c] of Object.entries(byEngine)) {
  console.log(`${e}: n ${c.n}, penalty/line ${(c.penalty / c.n).toFixed(2)}, serious ${((c.serious / c.n) * 100).toFixed(1)} %`);
  console.log('  ' + CATS.map((x) => `${x} ${c.cats[x]}`).join(', '));
}
for (const [k, c] of Object.entries(table).sort()) console.log(`  ${k}: n ${c.n}, penalty/line ${(c.penalty / c.n).toFixed(2)}, serious ${c.serious}`);
