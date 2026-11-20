/**
 * The composer chip's three modes, told apart by the cascade a browser applies.
 *
 * langChip.test.ts checks that auto and pinned "still differ", in jsdom, which
 * applies no cascade. It stayed green while the light scheme's base rule
 * (html[data-kt-scheme='light'] .kt-chip, 0,2,1) outranked the 0,2,0 mode rules:
 * in light, pinned lost its green fill and edge, off kept a fill, and auto and
 * pinned differed by text grey alone.
 *
 *   node test/e2e/chip-modes.mjs
 * Exits 1 when a mode loses its surface in either scheme.
 */
import { chromium } from './playwright.mjs';
import { feuille } from './feuille.mjs';

const css = feuille();
const PAGE = (scheme) => `<!doctype html>
<html lang="en" data-kt-scheme="${scheme}"><head><meta charset="utf-8"><title>chip modes</title>
<style>${css}</style>
<style>*{transition:none!important;animation:none!important}</style></head>
<body>${['auto', 'pinned', 'off']
  .map((m) => `<button type="button" class="kt-chip" data-mode="${m}">${m === 'off' ? 'OFF' : 'JA'}</button>`)
  .join('')}</body></html>`;

const browser = await chromium.launch();
const failures = [];
for (const scheme of ['dark', 'light']) {
  const page = await browser.newPage();
  await page.setContent(PAGE(scheme));
  const got = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.kt-chip')].map((c) => {
        const cs = getComputedStyle(c);
        return [c.dataset.mode, { border: cs.borderTopColor, bg: cs.backgroundColor, ink: cs.color }];
      }),
    ),
  );
  console.log(scheme, JSON.stringify(got));
  const { auto, pinned, off } = got;
  if (pinned.border === auto.border) failures.push(`${scheme}: pinned has the auto edge (${pinned.border})`);
  if (pinned.bg === auto.bg) failures.push(`${scheme}: pinned has the auto fill (${pinned.bg})`);
  if (off.bg !== 'rgba(0, 0, 0, 0)') failures.push(`${scheme}: off sits on a fill (${off.bg})`);
  if (off.bg === auto.bg) failures.push(`${scheme}: off and auto share a fill`);
  await page.close();
}
await browser.close();
if (failures.length) {
  console.error(`chip-modes: ${failures.length} failure(s)`);
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}
console.log('chip-modes: OK, auto, pinned and off keep their own surface in dark and light.');
