/**
 * No interactive control may have a boundary nobody can see.
 *
 * WCAG 1.4.11 holds the boundary of a user interface component to 3:1. The
 * popup and the options page had 35 controls whose only edge was `#1F2731`,
 * which measures 1.18:1 on a card: the four display-style cards, the ghost
 * buttons, the icon buttons, the provider rows, the engine's flag buttons and
 * the language chips. All the same colour, all invisible.
 *
 * Cards are deliberately out of scope. Measured on the rendered pages, a card's
 * fill separates from the page at 1.09:1 and Kick's own surface sits at 1.13:1
 * on its ink: surfaces at nearly the same value is the house style, and
 * about.kick.com draws no decorative borders at all. So a card keeps its fill
 * and drops its edge, and only things you can operate are held to 3:1.
 *
 * The background is composited: several of these sit on a translucent fill over
 * a card over the page, and reading the declared colour alone gets the wrong
 * ground.
 *
 * Run after `node snapshot.mjs`:
 *   node test/e2e/boundaries.mjs
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from './playwright.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SURFACES = [
  ['popup', path.join(HERE, 'popup.html')],
  ...['providers', 'display', 'filters', 'advanced', 'activity', 'about'].map((t) => [
    t,
    path.join(HERE, 'options', `${t}.html`),
  ]),
];

const lin = (c) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const x = L(a);
  const y = L(b);
  return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2);
};

const browser = await chromium.launch();
const failures = [];
let measured = 0;

for (const [name, file] of SURFACES) {
  const page = await browser.newPage({ viewport: { width: 900, height: 1600 }, colorScheme: 'dark' });
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(250);

  const rows = await page.evaluate(() => {
    const px = (v) => (v.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const ground = (el) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const m = (getComputedStyle(n).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
        if ((m.length > 3 ? m[3] : 1) >= 1) return m.slice(0, 3);
      }
      return [10, 14, 18];
    };
    const out = [];
    for (const el of document.querySelectorAll('button, [role=tab], input, select, textarea, a[href]')) {
      const cs = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      if (box.width === 0 || cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (parseFloat(cs.borderTopWidth) <= 0) continue;
      // A disabled control is exempt from contrast requirements.
      if (el.disabled) continue;
      // A transparent border reads as rgb(0,0,0) once its alpha is dropped: the
      // visible edge is then the control's own fill (a colour swatch), or nothing.
      const alpha = (v) => { const m = (v.match(/[\d.]+/g) ?? []).map(Number); return m.length > 3 ? m[3] : 1; };
      let edge = cs.borderTopColor;
      if (alpha(edge) === 0) {
        if (alpha(cs.backgroundColor) < 1) continue;
        edge = cs.backgroundColor;
      }
      out.push({
        what: String(el.className).split(' ').slice(0, 2).join('.') || el.tagName.toLowerCase(),
        border: px(edge),
        ground: ground(el),
      });
    }
    return out;
  });
  await page.close();

  measured += rows.length;
  for (const r of rows) {
    const c = ratio(r.border, r.ground);
    if (c < 3) failures.push(`${name}: ${r.what} a ${c}:1`);
  }
  console.log(`${name.padEnd(11)} ${String(rows.length).padStart(3)} controles bordes`);
}

await browser.close();

// A run that found no bordered control passes every check above.
if (measured < 20) {
  console.error(`boundaries: ${measured} controles bordes trouves, la sonde ne mesure rien`);
  process.exit(1);
}
if (failures.length) {
  const grouped = new Map();
  for (const f of failures) grouped.set(f, (grouped.get(f) ?? 0) + 1);
  console.error();
  console.error(`boundaries: ${failures.length} frontiere(s) sous les 3:1 de WCAG 1.4.11`);
  for (const [k, n] of [...grouped].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.error(`  x ${k}${n > 1 ? ` (x${n})` : ''}`);
  }
  process.exit(1);
}
console.log();
console.log(`boundaries: OK - ${measured} controles bordes, tous au moins a 3:1.`);
