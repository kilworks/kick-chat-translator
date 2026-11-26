/**
 * Charge la vraie extension construite et verifie que le script de contenu
 * s'execute sur une page qui se presente comme kick.com.
 *
 * Pourquoi cette porte existe. Toutes les autres portes hors-ligne montent les
 * composants a la main dans une page fabriquee : elles mesurent le dessin, la
 * geometrie et le clavier, et elles ne touchent jamais le manifeste, les
 * `content_scripts`, ni le chemin par lequel Chrome charge reellement le code.
 * Les seuls harnais qui l'exercent ouvrent le vrai kick.com, donc ils demandent
 * le reseau et parfois une session, et ils ne tournent pas dans la suite. Une
 * regression de chargement passait donc entierement sous les portes: c'est
 * exactement le defaut que `scripts/bundle-content.ts` a ete ecrit pour
 * reparer, un import dynamique qui perdait sa course et n'injectait rien, sans
 * une ligne dans la console.
 *
 * Comment elle evite le reseau. Le motif de `content_scripts` porte sur l'URL,
 * pas sur ce qui repond : on intercepte `https://kick.com/**` et on sert une
 * page locale. Le document garde son URL kick.com, Chrome injecte, et rien ne
 * sort de la machine.
 *
 *   node test/e2e/extension-load.mjs
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from './playwright.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Par defaut le repertoire de build. `KT_EXT` permet de pointer sur un paquet
// decompresse : ce qui part au store n'est pas `dist/` mais l'archive, et
// personne n'avait jamais lance ces portes sur l'archive elle-meme.
const EXT = process.env.KT_EXT ?? path.resolve(HERE, '../../dist');

if (!fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error('dist/manifest.json absent. Lancer `npm run build` avant.');
  process.exit(2);
}

const manifeste = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));

// Une page pauvre exprès. On ne teste pas que la barre trouve le chat de Kick,
// ce que font deja d'autres portes : on teste que le code arrive dans la page.
const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><title>fixture</title></head>
<body><div id="channel-chatroom"></div></body></html>`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-load-'));
const ctx = await chromium.launchPersistentContext(profile, {
  // Sans fenetre, l'extension n'est pas chargee du tout : mesure le 2026-08-30,
  // `headless: true` donne une page sans #kt-inject-style. La fenetre est donc
  // obligatoire, et elle est poussee hors de l'ecran pour ne pas clignoter
  // devant le mainteneur a chaque passage de la suite.
  headless: false,
  viewport: { width: 1200, height: 800 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--window-position=-2400,-2400',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

const page = ctx.pages()[0] ?? (await ctx.newPage());

// Tout ce qui part vers kick.com est servi localement. Le harnais echoue si une
// requete quelconque sort quand meme.
const sorties = [];
// Le glob de Playwright ne fait pas matcher `*.kick.com` sur `kick.com` : `*`
// veut au moins un caractere avant le point, donc le document partait sur le
// vrai site pendant que les sous-ressources, elles, etaient bien interceptees.
// Une expression reguliere prend les deux formes.
const KICK = /^https?:\/\/(www\.)?kick\.com\//;

await ctx.route(KICK, async (route) => {
  const url = route.request().url();
  if (route.request().resourceType() === 'document') {
    await route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE });
  } else {
    sorties.push(url);
    await route.fulfill({ status: 204, body: '' });
  }
});

// A channel address: the style goes in on a chat route only, the home page gets none on purpose.
await page.goto('https://kick.com/kt-fixture-channel', { waitUntil: 'domcontentloaded' });
// `document_idle` n'est pas un evenement qu'on peut attendre : on laisse le
// temps que Chrome injecte, puis on regarde.
// Wait for the condition, not a fixed 3 s: under the 24 parallel windows of run-gates the injection was seen
// to take longer and the gate failed with the script merely late. Absent after 20 s still fails.
await page.waitForFunction(() => !!document.getElementById('kt-inject-style'), null, { timeout: 20000 }).catch(() => undefined);

const vu = await page.evaluate(() => ({
  style: !!document.getElementById('kt-inject-style'),
  scheme: document.documentElement.getAttribute('data-kt-scheme'),
  url: location.href,
}));

await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });

// Quel navigateur ce build vise. `package:all` construisait Chrome, empaquetait,
// construisait Firefox, empaquetait, et s'arretait la : `dist/` restait le build
// Firefox. Chrome n'en demarre pas le fond, qui declare `background.scripts` au
// lieu d'un `service_worker`, donc aucun script de contenu n'arrive et l'interface
// disparait entierement. Quiconque a `dist/` charge en extension non empaquetee
// se retrouvait avec une extension muette apres une simple mise en paquet, et le
// symptome ne disait rien de la cause.
const viseFirefox =
  !!manifeste.browser_specific_settings || Array.isArray(manifeste.background?.scripts);

const fails = [];
if (viseFirefox)
  fails.push(
    'dist/ contient le build Firefox : `background.scripts` et un bloc gecko. ' +
      'Chrome ne le demarre pas. Relancer `npm run build`.',
  );
if (!vu.url.startsWith('https://kick.com/'))
  fails.push(`la page n a pas garde son URL kick.com : ${vu.url}`);
if (!vu.style)
  fails.push('le script de contenu ne s est pas execute : aucun #kt-inject-style dans la page');

// Ce que le manifeste expose aux pages du site. Le script de contenu est
// re-bundle en un seul fichier autonome par `scripts/bundle-content.ts`, donc il
// ne va rien chercher dans l'extension au moment de tourner. Chaque ressource
// listee ici reste joignable par n'importe quel script de la page a une URL
// stable, ce qui suffit a confirmer que l'extension est installee.
const exposees = (manifeste.web_accessible_resources ?? []).flatMap((e) => e.resources ?? []);
if (exposees.length)
  fails.push(
    `le manifeste expose ${exposees.length} ressource(s) aux pages du site : ${exposees.join(', ')}. ` +
      'Le script de contenu ne va rien chercher dans l extension, donc chacune est une URL stable ' +
      'qu une page peut interroger pour confirmer que l extension est installee.',
  );
console.log(`content script  ${vu.style ? 'injecte' : 'ABSENT'}, scheme ${vu.scheme ?? '(aucun)'}`);
console.log(`exposees au site ${exposees.length}${exposees.length ? ' : ' + exposees.join(', ') : ''}`);
if (sorties.length) console.log(`requetes kick.com interceptees : ${sorties.length}`);

if (fails.length) {
  console.error('FAIL: ' + fails.join(' ; '));
  process.exit(1);
}
console.log('extension-load: OK');
