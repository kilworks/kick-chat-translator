// Layout probe over every UI locale (43), on the REAL built extension, written for the 3.7.0 manual start and research card:
//  - popup with the "waiting" card (startMode manual, the tab answers waiting: true): body <= 600px, the card and
//    its label stay inside the popup, the Resume button inside the card;
//  - options About tab: the research card and its lists stay inside the card, no horizontal page scroll.
// Screenshots of en fr ta ar ja de. For another UI change: copy it and change the two evaluate() blocks.
// Run it on the change and on a master build so a failure already on master is not blamed on the change
// (git diff > patch, checkout master, build, run, git apply).
// Why the real extension: a hand-made chrome.* shim lacked a numeric setting and the options page threw
// ("toFixed of undefined"); the real worker answers every message.
// usage (after npm run build): UX_KIT=C:/Users/kil/.claude/ux-ui-agent-skills node layout-probe-manual.mjs "$(pwd -W)" <out-dir> [tab url]
// The tab url defaults to Kick; for Twitch Chat Translator pass https://www.twitch.tv/somechannel. Run it from either repository's copy of this file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [ROOT, OUT, TAB_URL = 'https://kick.com/somechannel'] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'test/e2e/playwright.mjs')).href);
const EXT = path.join(ROOT, 'dist');
fs.mkdirSync(OUT, { recursive: true });
const LOCALES = ['en', ...fs.readdirSync(path.join(ROOT, 'src/shared/i18n')).filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'en.ts').map((f) => f.slice(0, -3))];
const SHOTS = new Set(['en', 'fr', 'ta', 'ar', 'ja', 'de']);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-probe-'));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 340, height: 1200 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--window-position=-2400,-2400', '--no-first-run', '--no-default-browser-check'],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
const id = new URL(sw.url()).host;
const ctrl = await ctx.newPage();
await ctrl.goto(`chrome-extension://${id}/src/options/index.html`);

// The popup asks the active tab whether manual start holds the channel back: answer for it.
const stubTab = (url) => {
  const tab = { url, id: 7 };
  chrome.tabs.query = async () => [tab];
  chrome.tabs.sendMessage = async (_id, m) => (m?.type === 'start.state' ? { waiting: true } : undefined);
};

const bad = [];
let maxH = 0;
for (const locale of LOCALES) {
  await ctrl.evaluate((m) => chrome.runtime.sendMessage(m), { type: 'settings.set', payload: { uiLang: locale, startMode: 'manual', enabled: true, usageStatsAsked: true } });

  const page = await ctx.newPage();
  await page.setViewportSize({ width: 340, height: 1200 });
  await page.addInitScript(stubTab, TAB_URL);
  await page.goto(`chrome-extension://${id}/src/popup/index.html`);
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const card = document.querySelector('section[role="status"]');
    if (!card) return { missing: 'waiting card' };
    const label = card.querySelector('span');
    const btn = card.querySelector('button');
    const cr = card.getBoundingClientRect();
    return { w: Math.round(cr.width), h: Math.round(cr.height), cardFits: card.scrollWidth <= card.clientWidth + 1,
      labelFits: !label || label.scrollWidth <= label.clientWidth + 1, btnInside: !btn || btn.getBoundingClientRect().right <= cr.right + 1 };
  });
  const bodyH = await page.evaluate(() => document.body.scrollHeight);
  if (bodyH > 600) bad.push(`popup ${locale} height ${bodyH}`);
  maxH = Math.max(maxH, bodyH);
  if (r.missing || !r.cardFits || !r.labelFits || !r.btnInside) bad.push(`popup ${locale} ${JSON.stringify(r)}`);
  if (SHOTS.has(locale)) await page.screenshot({ path: path.join(OUT, `popup-${locale}.png`), fullPage: true });
  await page.close();

  const opt = await ctx.newPage();
  await opt.setViewportSize({ width: 1100, height: 900 });
  await opt.goto(`chrome-extension://${id}/src/options/index.html`);
  await opt.waitForTimeout(700);
  await opt.locator('[role="tab"]').last().click();
  await opt.waitForTimeout(500);
  const o = await opt.evaluate(() => {
    const card = document.querySelector('section:has(ul.kt-prose):has(a)');
    if (!card) return { missing: 'research card' };
    const lists = [...card.querySelectorAll('ul.kt-prose, ol.kt-prose')];
    return { fits: card.scrollWidth <= card.clientWidth + 1, pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      listsFit: lists.every((l) => l.scrollWidth <= l.clientWidth + 1), widest: Math.round(Math.max(...lists.map((l) => l.getBoundingClientRect().width))),
      card: Math.round(card.getBoundingClientRect().width), dir: document.documentElement.dir };
  });
  if (o.missing || !o.fits || o.pageScroll || !o.listsFit) bad.push(`options ${locale} ${JSON.stringify(o)}`);
  if (SHOTS.has(locale)) {
    const card = opt.locator('section:has(ul.kt-prose):has(a)').first();
    if (await card.count()) await card.screenshot({ path: path.join(OUT, `about-${locale}.png`) });
  }
  await opt.close();
}
await ctx.close();
fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
console.log(`locales: ${LOCALES.length}, failures: ${bad.length}, tallest popup ${maxH}px`);
for (const b of bad) console.log('  ' + b);
process.exit(bad.length ? 1 : 0);
