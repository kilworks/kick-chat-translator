/**
 * Regarder le README rendu, pas sa source.
 *
 * Un README se juge a l'oeil. Un tableau d'images parfaitement valide en
 * markdown peut sortir illisible, et un badge peut annoncer quelque chose que
 * personne ne relit. Les deux sont arrives ici le meme jour : la premiere
 * version des tableaux mettait cote a cote une image de 719px de haut et une de
 * 214, et le badge CI disait `failing` depuis quinze jours sans que rien ne le
 * signale, parce que les portes hors ligne sont vertes et que le badge vit sur
 * une page que personne ne rouvre.
 *
 * Le rendu vient de l'API markdown de GitHub, donc c'est leur moteur qui decide,
 * pas une approximation locale. Les chemins d'image relatifs sont reecrits en
 * URL absolues pour que la page puisse vivre hors de la racine du depot sans
 * casser les images ni laisser un fichier HTML dans le depot.
 *
 *   node test/e2e/readme-rendu.mjs            # README.md
 *   node test/e2e/readme-rendu.mjs CHANGELOG.md
 *
 * Demande `gh` authentifie. Sans lui, sortie 2 : un prerequis absent n'est pas
 * une porte rouge.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from './playwright.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'readme-vue');
const SOURCE = process.argv[2] ?? 'README.md';
const CHEMIN = path.join(ROOT, SOURCE);

if (!fs.existsSync(CHEMIN)) {
  console.error(`${SOURCE} introuvable.`);
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

const markdown = fs.readFileSync(CHEMIN, 'utf8');
const requete = path.join(os.tmpdir(), `kct-md-${process.pid}.json`);
// mode markdown, as GitHub renders a file in a repository; gfm is the comment mode,
// where every line break is a hard break (it stacked the badges one per line).
fs.writeFileSync(requete, JSON.stringify({ text: markdown, mode: 'markdown' }), 'utf8');

let corps;
try {
  // Sans le slash initial : Git Bash reecrit `/markdown` en chemin de fichier,
  // et `gh` repond alors "invalid API endpoint: C:/Program Files/Git/markdown".
  corps = execFileSync('gh', ['api', '-X', 'POST', 'markdown', '--input', requete], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (e) {
  console.error('Le rendu a echoue. `gh` est-il installe et authentifie ?');
  console.error(String(e.stderr ?? e.message).slice(0, 300));
  process.exit(2);
} finally {
  fs.rmSync(requete, { force: true });
}

// Les chemins relatifs pointent depuis la racine du depot : on les absolutise
// pour que la page rendue puisse vivre ailleurs.
const absolu = corps.replace(/src="(?!https?:|data:|\/\/)([^"]+)"/g, (_, rel) => {
  return `src="${pathToFileURL(path.join(ROOT, rel)).href}"`;
});

const page = `<!doctype html><meta charset="utf-8"><title>${SOURCE} rendu</title>
<style>
 body{background:#0d1117;color:#e6edf3;font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:0;padding:32px 0}
 .box{max-width:1012px;margin:0 auto;border:1px solid #30363d;border-radius:6px;padding:32px 40px}
 h1,h2{border-bottom:1px solid #21262d;padding-bottom:.3em;margin-top:1.6em}
 h1{font-size:2em}h2{font-size:1.5em}
 a{color:#4493f8;text-decoration:none}a:hover{text-decoration:underline}
 img{max-width:100%}
 table{border-collapse:collapse;margin:16px 0;display:block;overflow:auto}
 th,td{border:1px solid #30363d;padding:6px 13px;vertical-align:top}
 tr:nth-child(2n){background:#151b23}
 code{background:#151b23;padding:.2em .4em;border-radius:6px;font-size:85%}
 pre{background:#151b23;padding:16px;border-radius:6px;overflow:auto}
 pre code{background:none;padding:0}
 blockquote{border-left:.25em solid #30363d;color:#9198a1;padding:0 1em;margin:0}
 sub{color:#9198a1;font-size:85%}
</style><div class="box">${absolu}</div>`;

const fichierPage = path.join(OUT, `${path.basename(SOURCE, '.md')}.html`);
fs.writeFileSync(fichierPage, page, 'utf8');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-md-'));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1100, height: 1000 },
  args: ['--headless=new', '--no-first-run', '--no-default-browser-check'],
});
const page_ = ctx.pages()[0] ?? (await ctx.newPage());
await page_.goto(pathToFileURL(fichierPage).href, { waitUntil: 'load' });
await page_.waitForTimeout(800);

const hauteur = await page_.evaluate(() => document.body.scrollHeight);
const images = await page_.evaluate(() =>
  [...document.images]
    .filter((i) => i.src.startsWith('file:'))
    .map((i) => ({ src: decodeURIComponent(i.src.split('/').pop() ?? ''), charge: i.complete && i.naturalWidth > 0, l: i.naturalWidth, h: i.naturalHeight })),
);

console.log(`${SOURCE} : ${hauteur}px de haut`);
for (const i of images) console.log(`  ${i.charge ? 'OK   ' : 'CASSE'} ${i.src}  ${i.l}x${i.h}`);

// Par ecrans successifs : une capture pleine hauteur est illisible une fois reduite.
const pas = 1000;
let n = 0;
for (let y = 0; y < hauteur && n < 8; y += pas) {
  await page_.evaluate((v) => window.scrollTo(0, v), y);
  await page_.waitForTimeout(200);
  n += 1;
  await page_.screenshot({ path: path.join(OUT, `ecran-${String(n).padStart(2, '0')}.png`) });
}

await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });

const casses = images.filter((i) => !i.charge);
if (casses.length) {
  console.error(`FAIL: ${casses.length} image(s) locale(s) ne chargent pas : ${casses.map((c) => c.src).join(', ')}`);
  process.exit(1);
}
console.log(`\n${n} ecran(s) et la page dans ${OUT}, ${images.length} image(s) locale(s) chargees`);
