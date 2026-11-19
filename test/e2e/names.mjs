/**
 * Every control assistive technology can reach must have a name, and no two on
 * a surface may share one.
 *
 * axe checks the first half and only for the element types it has rules for;
 * it never checks the second. Four textareas on Filters had a visible label
 * sitting right above them with no `for` and no wrapping, so a screen reader
 * announced "edit, multiline" four times; the Lingva URL field had the same
 * shape; and the popup had two switches both called "enable", one for the chat
 * and one for what you type.
 *
 * Only what assistive tech actually sees is counted: the file picker behind
 * "Import settings" is display:none and needs no name.
 *
 * Run after `node snapshot.mjs`:
 *   node test/e2e/names.mjs
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

const browser = await chromium.launch();
const failures = [];
let counted = 0;

for (const [name, file] of SURFACES) {
  const page = await browser.newPage({ viewport: { width: 900, height: 1500 }, colorScheme: 'dark' });
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const visible = (el) => {
      const cs = getComputedStyle(el);
      return (
        cs.display !== 'none' && cs.visibility !== 'hidden' && el.getAttribute('aria-hidden') !== 'true'
      );
    };
    const controls = [
      ...document.querySelectorAll('button, input, select, textarea, [role=tab], a[href]'),
    ].filter(visible);
    const named = controls.map((el) => {
      const label =
        el.getAttribute('aria-label') ||
        (el.labels && el.labels[0]?.textContent?.trim()) ||
        el.closest('label')?.textContent?.trim() ||
        el.textContent?.trim() ||
        el.getAttribute('title') ||
        '';
      return {
        name: label.replace(/\s+/g, ' ').slice(0, 44),
        what: el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0],
      };
    });
    const seen = {};
    for (const { name } of named) if (name) seen[name] = (seen[name] ?? 0) + 1;
    return {
      total: controls.length,
      unnamed: named.filter((x) => !x.name).map((x) => x.what),
      shared: Object.entries(seen)
        .filter(([, n]) => n > 1)
        .map(([label, n]) => `${label} x${n}`),
    };
  });
  await page.close();

  counted += result.total;
  // A surface with no controls means the snapshot did not render, and an empty
  // page passes both checks trivially.
  if (result.total === 0) failures.push(`${name}: aucun controle trouve, le snapshot n a pas rendu`);
  for (const w of result.unnamed) failures.push(`${name}: ${w} sans nom accessible`);
  for (const s of result.shared) failures.push(`${name}: nom partage par plusieurs controles: ${s}`);
  console.log(
    `${name.padEnd(10)} ${String(result.total).padStart(3)} controles | ` +
      `${result.unnamed.length} sans nom | ${result.shared.length} nom(s) partage(s)`,
  );
}

await browser.close();

if (failures.length) {
  console.error();
  console.error('names: ' + failures.length + ' echec(s)');
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}
console.log();
console.log('names: OK - ' + counted + ' controles, tous nommes, aucun nom partage.');
