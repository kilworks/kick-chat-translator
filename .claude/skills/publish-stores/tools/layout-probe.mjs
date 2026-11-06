// Layout probe over every UI locale (43), written for the 3.4.0 Discord link: popup footer on one row,
// link in the middle, popup height <= 600, Options link on the tab row and tablist not scrolling,
// screenshots of en fr ta ar ja de. For another UI change: copy, change the two evaluate() blocks.
// Always run it twice: on the change, then on a master build (git diff > patch, checkout, build,
// run, git apply) so a failure already on master is not blamed on the change.
// usage (after npm run build): UX_KIT=C:/Users/kil/.claude/ux-ui-agent-skills node layout-probe.mjs "$(pwd -W)" <out-dir>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [ROOT, OUT] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'test/e2e/playwright.mjs')).href);
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(OUT, { recursive: true });
const LOCALES = ['en', ...fs.readdirSync(path.join(ROOT, 'src/shared/i18n')).filter((f) => f.endsWith('.ts')).map((f) => f.slice(0, -3))];
const SHOTS = new Set(['en', 'fr', 'ta', 'ar', 'ja', 'de']);
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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

function shim(locale) {
  const noop = { addListener() {}, removeListener() {} };
  const settings = { enabled: true, targetLang: 'auto', displayStyle: 'below', showOriginal: true, showSourceBadge: true,
    composeEnabled: true, composeTargetLang: 'ja', popupShowsStats: true, uiLang: locale, usageStatsAsked: true,
    providerOrder: ['google', 'mymemory', 'lingva'], favoriteLangs: [], deeplApiKey: '', deeplPlan: 'free', pausedChannels: [] };
  const reply = (m) => {
    switch (m?.type) {
      case 'settings.get': return { type: 'settings', payload: settings };
      case 'providers.status': return { type: 'providers', payload: [{ id: 'google', ok: true }, { id: 'mymemory', ok: true }, { id: 'lingva', ok: true }] };
      case 'stats.get': return { type: 'stats', payload: { totalRequests: 472, totalCacheHits: 104, totalErrors: 0, byLang: {}, byProvider: {}, byChannel: {}, charsSent: 0, todayKey: 'today', history: [] } };
      case 'deepl.usage': return { type: 'deepl', payload: { configured: false, count: 0, limit: 0 } };
      default: return { type: 'ok' };
    }
  };
  globalThis.chrome = {
    runtime: { getManifest: () => ({ version: '3.3.0' }), openOptionsPage() {}, lastError: undefined, onMessage: noop,
      sendMessage: (m, cb) => { const r = reply(m); if (typeof cb === 'function') { cb(r); return; } return Promise.resolve(r); } },
    storage: { sync: { get: async () => ({}), set: async () => {} }, local: { get: async () => ({}), set: async () => {} }, onChanged: noop },
    i18n: { getUILanguage: () => locale, getMessage: () => '' },
    tabs: { query: async () => [{ url: 'https://kick.com/somechannel' }], create() {} },
  };
}

const browser = await chromium.launch();
const bad = [];
let maxH = 0;
for (const locale of LOCALES) {
  const page = await browser.newPage({ viewport: { width: 333, height: 1200 }, colorScheme: 'dark' });
  await page.addInitScript(shim, locale);
  await page.goto(`http://localhost:${port}/src/popup/index.html`);
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const f = document.querySelector('footer');
    if (!f) return { missing: 'footer' };
    const kids = [...f.children].map((c) => c.getBoundingClientRect());
    const a = f.querySelector('a[href^="https://discord.gg/"]');
    return { n: f.children.length, oneRow: kids.every((k) => Math.abs(k.top - kids[0].top) < 2), fits: f.scrollWidth <= f.clientWidth,
      discordMiddle: f.children[1] === a, w: kids.map((k) => Math.round(k.width)), fw: f.clientWidth, h: Math.round(f.getBoundingClientRect().height) };
  });
  const bodyH = await page.evaluate(() => document.body.scrollHeight);
  if (bodyH > 600) bad.push(`popup ${locale} height ${bodyH}`);
  maxH = Math.max(maxH, bodyH);
  if (r.missing || !r.oneRow || !r.fits || !r.discordMiddle) bad.push(`popup ${locale} ${JSON.stringify(r)}`);
  if (SHOTS.has(locale)) {
    await page.locator('footer').hover();
    if (await page.locator('footer a').count()) await page.locator('footer a').hover();
    await page.screenshot({ path: path.join(OUT, `popup-${locale}.png`), fullPage: true });
  }
  await page.close();

  const opt = await browser.newPage({ viewport: { width: 1100, height: 700 }, colorScheme: 'dark' });
  await opt.addInitScript(shim, locale);
  await opt.goto(`http://localhost:${port}/src/options/index.html`);
  await opt.waitForTimeout(1000);
  const o = await opt.evaluate(() => {
    const a = document.querySelector('a[href^="https://discord.gg/"]');
    const nav = document.querySelector('[role=tablist]');
    if (!a || !nav) return { missing: !a ? 'link' : 'tablist', navScrolls: nav ? nav.scrollWidth > nav.clientWidth : null };
    const ar = a.getBoundingClientRect(), nr = nav.getBoundingClientRect();
    return { inTablist: nav.contains(a), sameRow: Math.abs(ar.top + ar.height / 2 - (nr.top + nr.height / 2)) < 6, navScrolls: nav.scrollWidth > nav.clientWidth, over: nav.scrollWidth - nav.clientWidth };
  });
  if (o.missing || o.inTablist || !o.sameRow || o.navScrolls) bad.push(`options ${locale} ${JSON.stringify(o)}`);
  if (SHOTS.has(locale)) await opt.screenshot({ path: path.join(OUT, `options-${locale}.png`), clip: { x: 0, y: 0, width: 1100, height: 260 } });
  await opt.close();
}
await browser.close();
srv.close();
console.log(`locales: ${LOCALES.length}, failures: ${bad.length}, tallest popup ${maxH}px`);
for (const b of bad) console.log('  ' + b);
process.exit(bad.length ? 1 : 0);
