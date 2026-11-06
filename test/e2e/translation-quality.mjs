/**
 * Translate real chat lines the way the extension does, for a quality grid.
 *
 *   node --import tsx test/e2e/translation-quality.mjs --in <lines.jsonl> --out <outputs.jsonl>
 *        [--engines google,mymemory,local] [--cache <cache.json>] [--profile <dir>] [--channel chrome]
 *
 * Each input line is {id, text, target}. The text goes through the content
 * pipeline's own `prepare` (emote parsing, trimming, skips, the confident source
 * hint, English abbreviations spelled out), then to the provider module the
 * service worker calls, with the request the product builds. A line the
 * pipeline skips is written with its reason and costs no call.
 *
 * Gentle on purpose: one call at a time per engine, a pause between calls, a
 * local cache so a rerun asks nothing twice, and a daily cap ends that engine's
 * run instead of retrying. The input and output are third-party chat: keep them
 * out of git (C:\Users\kil\kct-data).
 */
import fs from 'node:fs';
import { register } from 'node:module';

// The pipeline pulls the content stylesheet in; node has no loader for it and the bench needs none.
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function load(u, c, next) { return u.split('?')[0].endsWith('.css') ? { format: 'module', source: 'export default ""', shortCircuit: true } : next(u, c); }`,
    ),
);
// The content modules expect a page and an extension around them; prepare uses neither.
globalThis.addEventListener ??= () => {};
Object.assign(globalThis, { __KT_METRICS__: false, __KT_DEV__: false, __KT_BUILD__: 'bench' });
const noop = { addListener() {} };
globalThis.chrome ??= {
  runtime: { id: 'bench', sendMessage: async () => undefined, onMessage: noop, getURL: (p) => p },
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, sync: { get: async () => ({}), set: async () => {} }, onChanged: noop },
  i18n: { getMessage: () => '', getUILanguage: () => 'en' },
};
const { TranslationPipeline } = await import('../../src/content/pipeline.ts');
const { defaultSettings } = await import('../../src/shared/settings.ts');
const { googleProvider } = await import('../../src/background/translator/google.ts');
const { myMemoryProvider } = await import('../../src/background/translator/mymemory.ts');

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const IN = arg('--in');
const OUT = arg('--out');
if (!IN || !OUT) {
  console.error('translation-quality: --in <lines.jsonl> --out <outputs.jsonl> required');
  process.exit(2);
}
const CACHE = arg('--cache', OUT + '.cache.json');
const ENGINES = { google: [googleProvider, 400], mymemory: [myMemoryProvider, 1500] };
const engines = arg('--engines', 'google,mymemory').split(',');

const ctx = { deeplApiKey: '', deeplPlan: 'free', deeplBudgetPct: 100, lingvaInstance: '', myMemoryEmail: '', concurrency: 1 };
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = fs.readFileSync(IN, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const pipelines = new Map();
const prepare = (text, target) => {
  if (!pipelines.has(target)) pipelines.set(target, new TranslationPipeline({ ...defaultSettings(), targetLang: target }));
  // prepare is private to the class; called here so the bench sends what the product sends.
  return pipelines.get(target).prepare(text, { username: '', channel: '', isBot: false }, { dedup: false });
};

// Chrome's on-device Translator, in the bundled browser, on a page served by the
// route below so it is a secure context without touching the network. Models
// stay in the profile folder between runs. Same tags as localEngine.ts `norm`.
// shortcut: on 2026-11-04 create() crashed the tab under Playwright (Chromium 151
// and Chrome 157), so this engine has never returned a line; retry on a new build.
const tag = (c) => ({ 'zh-tw': 'zh-Hant', 'zh-hant': 'zh-Hant' })[c.toLowerCase()] ?? c.toLowerCase().split('-')[0];
let page;
const pairs = new Map();
async function onDevice(src, tgt, text) {
  if (!page) {
    const { chromium } = await import('./playwright.mjs');
    const browser = await chromium.launchPersistentContext(arg('--profile', OUT + '.profile'), { headless: false, ...(arg('--channel') ? { channel: arg('--channel') } : {}) });
    page = browser.pages()[0] ?? (await browser.newPage());
    await page.route('https://kct-bench.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<button id="go">go</button>' }));
    await page.goto('https://kct-bench.test/');
  }
  const k = `${tag(src)}>${tag(tgt)}`;
  if (!pairs.has(k)) {
    await page.evaluate(([s, t]) => {
      window.__tr ??= {};
      // create() may download a model, which needs a user gesture: the click below.
      document.getElementById('go').onclick = () => {
        window.__made = Translator.create({ sourceLanguage: s, targetLanguage: t }).then(
          (x) => ((window.__tr[`${s}>${t}`] = x), 'ok'),
          (e) => String(e),
        );
      };
    }, [tag(src), tag(tgt)]);
    await page.click('#go');
    pairs.set(k, await page.evaluate(() => window.__made));
    console.log(`local ${k}: ${pairs.get(k)}`);
  }
  if (pairs.get(k) !== 'ok') throw Object.assign(new Error(pairs.get(k)), { code: 'no_model' });
  return { translatedText: await page.evaluate(([key, t]) => window.__tr[key].translate(t), [k, text]), detectedLang: src };
}
ENGINES.local = [{ translate: (req) => onDevice(req.sourceLangHint, req.targetLang, req.text) }, 0];

const out = [];
const capped = new Set();
for (const engine of engines) {
  const [provider, gap] = ENGINES[engine];
  for (const line of lines) {
    const p = await prepare(line.text, line.target);
    const row = { id: line.id, engine, target: line.target };
    if (typeof p === 'string') {
      out.push({ ...row, skipped: p || 'gate' });
      continue;
    }
    // pipeline.ts, on-device branch: the looked-up language, or franc's guess only when it is English.
    const source = engine === 'local' ? p.hint ?? (p.detected === 'en' ? 'en' : undefined) : p.hint;
    if (engine === 'local' && !source) {
      out.push({ ...row, sent: p.real, hint: null, routed: 'cloud: no source' });
      continue;
    }
    const key = `${engine}|${line.target}|${source ?? ''}|${p.real}`;
    if (!(key in cache) && !capped.has(engine)) {
      try {
        const r = await provider.translate({ messageId: line.id, text: p.real, targetLang: line.target, ...(source ? { sourceLangHint: source } : {}) }, ctx);
        cache[key] = { text: r.translatedText, detected: r.detectedLang };
      } catch (e) {
        if (e?.code === 'rate_limit') {
          capped.add(engine);
          console.error(`${engine}: ${e.message}, stopping this engine`);
        } else cache[key] = { error: e?.code ?? String(e) };
      }
      fs.writeFileSync(CACHE, JSON.stringify(cache));
      await pause(gap);
    }
    const got = cache[key];
    const base = { ...row, sent: p.real, hint: source ?? null };
    if (!got) out.push({ ...base, notObserved: 'daily cap' });
    // Handed back unchanged, local-first asks the cloud instead (pipeline.ts).
    else if (engine === 'local' && got.text?.trim().toLowerCase() === p.real.trim().toLowerCase()) out.push({ ...base, routed: 'cloud: unchanged' });
    else out.push({ ...base, ...got });
  }
}
fs.writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
const count = (f) => engines.map((e) => `${e} ${out.filter((r) => r.engine === e && f(r)).length}`).join(', ');
console.log(`translation-quality: ${lines.length} lines x ${engines.length} engines`);
console.log(`  translated: ${count((r) => 'text' in r)}`);
console.log(`  skipped by the pipeline: ${count((r) => 'skipped' in r)}`);
console.log(`  errors: ${count((r) => 'error' in r)}, not observed (cap): ${count((r) => 'notObserved' in r)}`);
// A module timer (keepalive, usage flush) would hold node open after the last line.
process.exit(0);
