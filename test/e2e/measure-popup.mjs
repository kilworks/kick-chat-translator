/**
 * Popup height, measured by rendering the built popup in every interface
 * language.
 *
 * Why a script and not a vitest case: the constraint is "does it fit without a
 * scrollbar", which only a layout engine can answer. A unit test on string
 * length would be a proxy, and a bad one: CJK characters are twice as wide as
 * Latin ones, so the same length behaves differently in ja and in es.
 *
 * The failure this exists for: Spanish rendered at 606px against a 600px
 * budget, because "mantener original" and "insignia de idioma" both wrapped to
 * a second line. Nine other languages fitted, so anything short of measuring
 * all ten would have missed it.
 *
 * Usage, after `npm run build`:
 *   node test/e2e/measure-popup.mjs
 * Exits 1 if any state x language overflows, 2 if a state's required card
 * did not render (that state was not measured).
 *
 * Needs playwright, which lives with the UX kit rather than in this repo:
 *   node --experimental-default-type=module ... or run from the kit directory.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from './playwright.mjs';

/**
 * playwright is not a dependency of this extension: it belongs to the UX kit
 * that runs the design gates. Resolve it from there rather than adding a
 * 300MB devDependency for one script.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const BUDGET = 600;
// `--langs en,ar,th` narrows the run; `--shots <dir>` also saves one PNG per
// state and language, for the before/after comparison a gate cannot make.
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
// Every interface language by default. Ten were measured until 2026-11-19 and
// the other 33 were assumed to fit: Tamil was at 760px, Greek at 636.
const ALL = ['en', ...fs.readdirSync(path.join(ROOT, 'src/shared/i18n'))
  .filter((f) => /^[a-z]{2,3}(-[a-z]{2})?\.ts$/.test(f)).map((f) => f.slice(0, -3))];
const LOCALES = arg('--langs')?.split(',') ?? ALL;
const SHOTS = arg('--shots');

const TYPES = {
  '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

// file:// resolves the built absolute asset paths against the drive root, so
// the page loads nothing. A throwaway server is the shortest way past that.
const srv = http.createServer((q, r) => {
  const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    r.end(d);
  });
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;

/**
 * Worst-case states a real install produces. `needs` lists what must be on
 * screen for the measure to mean anything; a state whose card did not mount
 * measured a shorter popup than the one users see, so it fails the run.
 *   kick     on a Kick channel, stats question not answered yet
 *   usual    on a Kick channel, question answered, stats block shown
 *   paused   on a paused Kick channel (resume row)
 *   firstrun off Kick, nothing translated yet, question not answered: the
 *            first opening after install. "Open Kick" only: the stats
 *            question waits for the next opening (`bans`), both together
 *            measured 649 to 681px.
 */
const STATES = {
  kick: { url: 'https://kick.com/kt-pause', asked: false, paused: false, fresh: false, needs: ['ask'] },
  usual: { url: 'https://kick.com/kt-pause', asked: true, paused: false, fresh: false, needs: [] },
  paused: { url: 'https://kick.com/kt-pause', asked: true, paused: true, fresh: false, needs: ['resume'] },
  firstrun: { url: 'https://example.com/', asked: false, paused: false, fresh: true, needs: ['openKick'], bans: ['ask'] },
  // A channel list keeps this channel out. Like the pause, its card takes the
  // place of the stats question and of the day's numbers (both together: 652
  // to 664px).
  blocked: { url: 'https://kick.com/kt-pause', asked: false, paused: false, fresh: false, blocked: true, needs: ['filters'], bans: ['ask'] },
  blockedasked: { url: 'https://kick.com/kt-pause', asked: true, paused: false, fresh: false, blocked: true, needs: ['filters'] },
};

function shim([locale, st]) {
  const noop = { addListener() {}, removeListener() {} };
  // What the buttons did when clicked after the measure: proof of which cards mounted.
  const seen = (globalThis.__ktSeen = []);
  const settings = {
    enabled: true, targetLang: 'auto', displayStyle: 'below', showOriginal: true,
    showSourceBadge: true, showProviderBadge: false, showFloatingBar: true,
    showComposerChip: true, composeEnabled: true, composeTargetLang: 'auto',
    composeInsertMode: 'insert', popupShowsStats: true, uiLang: locale,
    providerOrder: ['google', 'mymemory', 'lingva'], favoriteLangs: [],
    deeplApiKey: '', deeplPlan: 'free',
    usageStats: false, usageStatsAsked: st.asked,
    pausedChannels: st.paused ? ['kt-pause'] : [],
    whitelistChannels: st.blocked ? ['kt-other'] : [], blacklistChannels: [],
  };
  const stats = st.fresh
    ? { totalRequests: 0, totalCacheHits: 0, totalErrors: 0, byLang: {}, byProvider: {},
      byChannel: {}, charsSent: 0, todayKey: 'today', history: [] }
    : { totalRequests: 1124, totalCacheHits: 214, totalErrors: 0, byLang: { ko: 80 },
      byProvider: {}, byChannel: {}, charsSent: 0, todayKey: 'today',
      history: [{ day: 'today', requests: 1124, cacheHits: 214 }] };
  const reply = (m) => {
    switch (m?.type) {
      case 'settings.get': return { type: 'settings', payload: settings };
      case 'settings.set':
        if (m.payload && 'usageStatsAsked' in m.payload) seen.push('ask');
        if (m.payload && 'pausedChannels' in m.payload) seen.push('resume');
        return { type: 'ok' };
      case 'providers.status': return { type: 'providers', payload: [
        { id: 'google', available: true }, { id: 'mymemory', available: true }, { id: 'lingva', available: false, lastError: 'cooldown' }] };
      case 'stats.get': return { type: 'stats', payload: stats };
      case 'deepl.usage': return { type: 'deepl', payload: { configured: false, count: 0, limit: 0 } };
      default: return { type: 'ok' };
    }
  };
  globalThis.chrome = {
    runtime: { getManifest: () => ({ version: '0.0.0' }), openOptionsPage() {}, getURL: (p) => `chrome-extension://kt/${p}`,
      lastError: undefined, onMessage: noop,
      sendMessage: (m, cb) => { const r = reply(m); if (typeof cb === 'function') { cb(r); return; } return Promise.resolve(r); } },
    storage: { sync: { get: async () => ({}), set: async () => {} },
      local: { get: async () => ({}), set: async () => {} }, onChanged: noop },
    i18n: { getUILanguage: () => locale, getMessage: () => '' },
    tabs: {
      query: async () => [{ url: st.url }],
      create: async (o) => {
        if (/kick\.com/.test(o?.url ?? '')) seen.push('openKick');
        if (/#filters$/.test(o?.url ?? '')) seen.push('filters');
      },
    },
  };
}

const browser = await chromium.launch();
const over = [];
const muettes = [];
const table = Object.fromEntries(Object.keys(STATES).map((n) => [n, {}]));
const jobs = Object.entries(STATES).flatMap(([name, st]) => LOCALES.map((locale) => [name, st, locale]));
// Eight pages at a time: 6 states x 43 languages one by one took minutes.
async function measure([name, st, locale]) {
  {
    const page = await browser.newPage({ viewport: { width: 360, height: 1200 }, colorScheme: 'dark' });
    await page.addInitScript(shim, [locale, st]);
    await page.goto(`http://localhost:${port}/src/popup/index.html`);
    await page.waitForTimeout(1300);
    const h = await page.evaluate(() => document.body.scrollHeight);
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.mouse.move(0, 1199);
      await page.screenshot({ path: path.join(SHOTS, `${name}-${locale}.png`), clip: { x: 0, y: 0, width: 360, height: h } });
    }
    // Height is taken; now press every button and see which cards answered.
    const seen = await page.evaluate(async () => {
      for (const b of document.querySelectorAll('button')) b.click();
      await new Promise((r) => setTimeout(r, 150));
      return globalThis.__ktSeen;
    });
    const missing = st.needs.filter((n) => !seen.includes(n));
    if (missing.length) muettes.push(`${name}/${locale} (${missing.join('+')})`);
    const banned = (st.bans ?? []).filter((n) => seen.includes(n));
    if (banned.length) over.push(`${name}/${locale} shows ${banned.join('+')}`);
    if (h > BUDGET) over.push(`${name}/${locale} ${h}px`);
    table[name][locale] = h;
    await page.close();
  }
}
for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map(measure));
if (Object.values(table).some((row) => Object.keys(row).length !== LOCALES.length)) {
  console.error('SILENT PROBE: a state/language pair was not measured');
  process.exit(2);
}
await browser.close();
srv.close();

console.log(`popup height, state x interface language, 360px wide (budget ${BUDGET}px)`);
console.log(`  ${'state'.padEnd(9)}${LOCALES.map((l) => l.padStart(5)).join('')}   max`);
for (const [name, row] of Object.entries(table)) {
  const hs = LOCALES.map((l) => row[l]);
  const cells = hs.map((h) => `${h}${h > BUDGET ? '!' : ' '}`.padStart(5)).join('');
  console.log(`  ${name.padEnd(9)}${cells}   ${Math.max(...hs)}`);
}
console.log('  (! = over budget)');

if (muettes.length) {
  console.error(`\nSILENT PROBE: required card missing, state not measured: ${muettes.join(', ')}`);
  process.exit(2);
}
if (over.length) {
  console.error(`\nFAIL: ${over.length} state/language pair(s) overflow: ${over.join(', ')}`);
  process.exit(1);
}
console.log('\nOK: every state fits without a scrollbar in every interface language.');
