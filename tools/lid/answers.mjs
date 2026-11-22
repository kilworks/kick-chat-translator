// What the shipped rules answer on each bench text, so tools/lid/cost.py can
// try any trained model and threshold without rebuilding.
// node --import tsx tools/lid/answers.mjs --data <data-dir> [--set dev|heldout]
// Writes <data>/lid/answers-<set>.json, per text of texts.json sets.<set> and
// sets.tatoeba (key `bench`): [confident, pre, master] where
//   confident  confidentLanguage, the looked-up answer (cloud `sl`)
//   pre        detectLanguage when the model is never trusted and stays silent:
//              non-null means a rule answered before the model is reached
//   master     detectLanguage of master: the same rules, then franc
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

Object.assign(globalThis, { __KT_METRICS__: false, __KT_DEV__: false, __KT_BUILD__: 'bench' });
const args = process.argv.slice(2);
const data = args[args.indexOf('--data') + 1];
const set = args.includes('--set') ? args[args.indexOf('--set') + 1] : 'dev';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..');
const { confidentLanguage, detectLanguage, setLidThresholds } = await import(
  pathToFileURL(path.join(root, 'src/content/langDetect.ts')).href
);
const { lidReady } = await import(pathToFileURL(path.join(root, 'src/content/lid/model.ts')).href);
// Without a model, `pre` would silently hold franc's answers: refuse instead.
if (!lidReady()) throw new Error('no model installed: run tools/lid/install.py first');
const T = JSON.parse(fs.readFileSync(path.join(data, 'detect', 'texts.json'), 'utf8'));
const texts = { [set]: T.sets[set].map((r) => r.text), bench: T.sets.tatoeba.map((r) => r.text) };

const run = (cfg, fn) => {
  setLidThresholds(cfg);
  return Object.fromEntries(Object.entries(texts).map(([k, list]) => [k, list.map((t) => fn(t) ?? null)]));
};
const conf = run({ det: Infinity, sl: Infinity, below: 'silence' }, confidentLanguage);
const pre = run({ det: Infinity, sl: Infinity, below: 'silence' }, detectLanguage);
const master = run({ det: Infinity, sl: Infinity, below: 'franc' }, detectLanguage);
const out = Object.fromEntries(
  Object.keys(texts).map((k) => [k, texts[k].map((_, i) => [conf[k][i], pre[k][i], master[k][i]])]),
);
fs.writeFileSync(path.join(data, 'lid', `answers-${set}.json`), JSON.stringify(out));
console.log('texts', Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, v.length])));
process.exit(0);
