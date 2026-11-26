// Measures the Cantonese stream counter on labelled lines of known origin (ext/ds), simulating streams. node via tsx.
//   npx tsx scripts/yue-stream.mts dev|test
import fs from 'node:fs';
import { confidentLanguage } from '../src/content/langDetect';
import { skipOnHintForStream, sourceHintForStream } from '../src/content/filters';
import { StreamPrior } from '../src/content/streamPrior';

const SPLIT = process.argv[2] ?? 'dev';
const DIR = 'C:/Users/kil/kct-data/han/ext/ds';
const HAN_ONLY = /^[\p{Script=Han}\s0-9\p{P}]+$/u;
function load(name: string, max = 20000): string[] {
  const out: string[] = [];
  for (const l of fs.readFileSync(`${DIR}/${name}.jsonl`, 'utf8').split('\n')) {
    if (!l) continue;
    const d = JSON.parse(l) as { t: string; s: string; src: string };
    if (d.s === SPLIT && d.src !== 'wiki' && HAN_ONLY.test(d.t)) out.push(d.t);
    if (out.length >= max) break;
  }
  return out;
}
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const draw = (pool: string[], n: number) => Array.from({ length: n }, () => pool[Math.floor(rnd() * pool.length)]!);

const pools = { yue: load('yue'), hk: load('hk'), tw: load('tw'), cn: load('cn'), ja: load('ja') };
const N = 300;
const WARM = 60;
const STREAMS = 100;

function run(lines: string[]) {
  const prior = new StreamPrior();
  let flagged = 0;
  let after = 0;
  const base = { skip: 0, n: 0 };
  const adapt = { skip: 0, src: 0 };
  lines.forEach((t, i) => {
    const hint = confidentLanguage(t);
    prior.observe(hint);
    const c = prior.cantonese();
    if (i < WARM) return;
    after++;
    if (c) flagged++;
    base.n++;
    if (skipOnHintForStream(hint, 'zh-tw', t, prior.family(), false)) base.skip++;
    if (skipOnHintForStream(hint, 'zh-tw', t, prior.family(), c)) adapt.skip++;
    if (sourceHintForStream(hint, t, prior.family(), c) === 'yue' && hint !== 'yue') adapt.src++;
  });
  return { flagged: flagged / after, base: base.skip / base.n, adapt: adapt.skip / base.n, relabelled: adapt.src / base.n };
}

const mix = (a: string[], b: string[]) => [...draw(a, N / 2), ...draw(b, N / 2)].sort(() => rnd() - 0.5);
const cases: Record<string, () => string[]> = {
  'yue stream': () => draw(pools.yue, N),
  'hk stream': () => draw(pools.hk, N),
  'tw stream': () => draw(pools.tw, N),
  'cn stream': () => draw(pools.cn, N),
  'ja stream': () => draw(pools.ja, N),
  'tw+yue half': () => mix(pools.tw, pools.yue),
};
console.log(SPLIT, 'pool sizes', Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length])));
for (const [name, mk] of Object.entries(cases)) {
  const rs = Array.from({ length: STREAMS }, () => run(mk()));
  const avg = (k: keyof ReturnType<typeof run>) => (rs.reduce((a, r) => a + r[k], 0) / rs.length) * 100;
  const flaggedStreams = rs.filter((r) => r.flagged > 0.5).length;
  console.log(`${name.padEnd(12)} flagged lines ${avg('flagged').toFixed(1)}% (streams mostly flagged: ${flaggedStreams}/${STREAMS})  skipped for a zh-tw reader: ${avg('base').toFixed(1)}% -> ${avg('adapt').toFixed(1)}%  relabelled yue: ${avg('relabelled').toFixed(1)}%`);
}
