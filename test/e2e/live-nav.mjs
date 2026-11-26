/**
 * What one live session can answer in one go: channel changes, Kick's own theme
 * switch, the popup inside the real extension, and the update check.
 *
 * Each launch costs about a minute, so these four share a session. The long
 * recycling run lives in live-recycle.mjs, on its own.
 *
 * Same two constraints as live-kick.mjs: Playwright's Chromium, because
 * --load-extension is ignored by Chrome 137 and later; and a kick.com page
 * opened before the extension id can be read, because the MV3 worker is lazy.
 *
 *   node test/e2e/live-nav.mjs
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from './playwright.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '../../dist');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-nav-'));

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1500, height: 950 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

const failures = [];
const note = (ok, msg) => {
  if (!ok) failures.push(msg);
};
const page = ctx.pages()[0] ?? (await ctx.newPage());

/** Channels are discovered, never named here. */
async function directory() {
  await page.goto('https://kick.com/browse', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(7000);
  return page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('a[href^="/"]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => /^\/[a-zA-Z0-9_-]{3,25}$/.test(h))
        .filter(
          (h) =>
            !/^\/(browse|following|categories|search|about|help|login|signup|clips|home|subscriptions)$/.test(
              h,
            ),
        ),
    ),
  ]);
}

/** State of everything we inject, counted rather than merely detected. */
const artifacts = () =>
  page.evaluate(() => {
    // Kick leaves a second #channel-chatroom in the page behind a suspense
    // placeholder its renderer never removed. Counting elements without saying
    // which panel they are in is how that ghost reads as a duplicate.
    const panels = [...document.querySelectorAll('#channel-chatroom')];
    const live = panels.find((p) => p.getBoundingClientRect().height > 0) ?? null;
    return {
      panels: panels.length,
      bars: document.querySelectorAll('#kt-floating-bar').length,
      chips: document.querySelectorAll('#kt-lang-chip').length,
      hosts: document.querySelectorAll('.kt-chip-host').length,
      styles: document.querySelectorAll('#kt-inject-style').length,
      lines: live ? live.querySelectorAll('[data-index]').length : 0,
      stamp: document.documentElement.getAttribute('data-kt-scheme'),
      path: location.pathname,
    };
  });

const channels = await directory();
let visited = 0;

// ── Channel changes ────────────────────────────────────────────────────────
for (const c of channels.slice(0, 5)) {
  await page.goto('https://kick.com' + c, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(11000);
  const a = await artifacts();
  if (a.lines < 3) {
    console.log(`  ${c} : ${a.lines} ligne(s), chaine ignoree`);
    continue;
  }
  visited += 1;
  console.log(`  ${a.path} : barres=${a.bars} puces=${a.chips} hotes=${a.hosts} styles=${a.styles} lignes=${a.lines}`);
  note(a.bars === 1, `${a.path}: ${a.bars} barre(s) flottante(s), attendu 1`);
  note(a.chips === 1, `${a.path}: ${a.chips} puce(s), attendu 1`);
  note(a.hosts === 1, `${a.path}: ${a.hosts} hote(s) de puce, attendu 1`);
  note(a.styles === 1, `${a.path}: ${a.styles} feuille(s) injectee(s), attendu 1`);
  if (visited >= 3) break;
}
// A run that never found a working channel proves nothing.
note(visited >= 2, `seulement ${visited} chaine(s) avec du chat, la sonde ne mesure rien`);

// ── Kick's own theme switch ────────────────────────────────────────────────
// This is the fix that measured 1.01:1 against 10.98:1. It has never been seen
// following Kick's real toggle.
const theme = await page.evaluate(async () => {
  const before = document.documentElement.getAttribute('data-kt-scheme');
  const body = document.body;
  const ground = () => getComputedStyle(body).backgroundColor;
  const groundBefore = ground();
  // Kick's own control is not reliably findable by class, so the page is
  // repainted the way a theme switch repaints it and the observer is asked to
  // keep up. Not a substitute for the real control; it is what can be asserted
  // without guessing at Kick's markup.
  body.style.backgroundColor = before === 'dark' ? '#ffffff' : '#0b0b0c';
  await new Promise((r) => setTimeout(r, 1200));
  const after = document.documentElement.getAttribute('data-kt-scheme');
  body.style.backgroundColor = '';
  await new Promise((r) => setTimeout(r, 1200));
  return { before, after, restored: document.documentElement.getAttribute('data-kt-scheme'), groundBefore };
});
console.log('theme :', JSON.stringify(theme));
note(theme.before === 'dark', `tampon initial ${theme.before}, attendu dark`);
note(theme.after !== theme.before, "le tampon n'a pas suivi le repeint de la page");
note(theme.restored === theme.before, 'le tampon n est pas revenu apres restauration');

// ── The popup and the update check, in the real extension ─────────────────
const sw =
  ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null));
const id = sw ? sw.url().split('/')[2] : null;
note(Boolean(id), 'service worker jamais demarre');

if (id) {
  const pop = await ctx.newPage();
  await pop.goto(`chrome-extension://${id}/src/popup/index.html`);
  await pop.waitForTimeout(2500);
  const shot = await pop.evaluate(() => ({
    height: document.body.scrollHeight,
    width: Math.round(document.body.getBoundingClientRect().width),
    toggles: document.querySelectorAll('input[type=checkbox]').length,
    version: document.querySelector('header span:nth-child(2)')?.textContent?.trim() ?? null,
    enabled: document.querySelector('input[type=checkbox]')?.checked ?? null,
  }));
  console.log('popup :', JSON.stringify(shot));
  note(shot.height <= 600, `popup a ${shot.height}px, budget 600`);
  note(shot.toggles >= 4, `${shot.toggles} interrupteur(s), attendu au moins 4`);

  // Writing a real setting: flip the master switch and read it back from
  // storage, then put it back. Reading alone would not prove the popup writes.
  const wrote = await pop.evaluate(async () => {
    const box = document.querySelector('input[type=checkbox]');
    const was = box.checked;
    box.click();
    await new Promise((r) => setTimeout(r, 1200));
    const stored = await chrome.storage.sync.get(null);
    const key = Object.keys(stored).find((k) => k.includes('settings'));
    const after = key ? stored[key]?.enabled : undefined;
    box.click();
    await new Promise((r) => setTimeout(r, 1200));
    return { was, after, backTo: box.checked };
  });
  console.log('popup ecrit :', JSON.stringify(wrote));
  note(wrote.after === !wrote.was, `le popup n a pas ecrit enabled (${wrote.after})`);
  note(wrote.backTo === wrote.was, "l'etat n'a pas ete remis comme il etait");
  await pop.screenshot({ path: path.join(HERE, 'live-popup.png') });
  await pop.close();

  // The update check asks GitHub for the latest release. With the installed
  // version equal to it, the extension must stay quiet.
  const update = await page.evaluate(async () => {
    const res = await fetch('https://api.github.com/repos/kilworks/kick-chat-translator/releases/latest');
    const json = await res.json();
    return { latest: json.tag_name, installed: chrome?.runtime?.getManifest?.().version ?? null };
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  console.log('mise a jour :', JSON.stringify({ ...update, manifest }));
  note(
    update.latest === `v${manifest}`,
    `la derniere release est ${update.latest}, le paquet est ${manifest}`,
  );
}

await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });

if (failures.length) {
  console.error();
  console.error(`live-nav: ${failures.length} echec(s)`);
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}
console.log();
console.log(`live-nav: OK - ${visited} chaines, theme, popup et verification de mise a jour.`);
