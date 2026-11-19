/**
 * Les cinq captures des stores, prises sans personne dedans.
 *
 * Pourquoi ce fichier existe a cote de `store-shots.mjs`. Celui-la suit la
 * premiere chaine en direct de /browse : les images montrent alors la marque de
 * quelqu'un, son flux, et les pseudos de vraies personnes qui n'ont rien demande.
 * C'est ce qui laissait les captures en attente d'une decision. Ici la page est
 * fabriquee, les pseudos sont inventes, et le moteur de traduction est repondu
 * localement, donc rien de tiers n'apparait et rien ne sort de la machine.
 *
 * Ce que les images montrent reste vrai : c'est le build de `dist/` qui tourne,
 * l'extension lit ce chat comme elle lirait n'importe quel autre, et les
 * traductions affichees sont celles que l'extension a demandees et posees. Ce
 * qui est fabrique, c'est le salon, pas le produit.
 *
 * Les traductions rendues sont plausibles et pas des marqueurs : une capture
 * ne sert a rien si elle montre ZZTRADUCTIONZZ.
 *
 *   node test/e2e/store-shots-fixture.mjs              # fiche anglaise, et le README
 *   node test/e2e/store-shots-fixture.mjs --lang=ja     # une autre langue de fiche
 *   node test/e2e/store-shots-fixture.mjs --gif         # anglais, plus readme/demo.gif (ffmpeg)
 *
 * Ecrit dans test/e2e/store-fixture/<lang>/ en 01..05, au 1280x800 que le
 * store demande, et verifie que chaque image montre bien son sujet avant de la
 * compter. Le lecteur lit, tape et voit l'interface dans la langue de la fiche ;
 * le salon et ses traductions sont dans `store-shots-lines.mjs`.
 */
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from './playwright.mjs';
import { LINES, PSEUDOS, ROOM_ES, SETTINGS, TYPED } from './store-shots-lines.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Par defaut le repertoire de build. `KT_EXT` permet de pointer sur un paquet
// decompresse : ce qui part au store n'est pas `dist/` mais l'archive, et
// personne n'avait jamais lance ces portes sur l'archive elle-meme.
const EXT = process.env.KT_EXT ?? path.resolve(HERE, '../../dist');
const LANG = process.argv.find((a) => a.startsWith('--lang='))?.slice(7) ?? 'en';
if (!SETTINGS[LANG]) {
  console.error(`langue de fiche inconnue : ${LANG}, connues : ${Object.keys(SETTINGS).join(' ')}`);
  process.exit(2);
}
// --firefox : les captures de la fiche AMO. Firefox n'a pas l'API de traduction
// sur l'appareil ; avec elle, la puce "Local" et la section des modeles locaux
// promettaient aux lecteurs de Firefox ce qu'ils n'auront pas. Chromium coupe
// ses API integrees au lancement, et l'extension se comporte comme sur Firefox.
const FIREFOX = process.argv.includes('--firefox');
const OUT = path.join(HERE, FIREFOX ? 'store-fixture-firefox' : 'store-fixture', LANG);

if (!fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error('dist/manifest.json absent. Lancer `npm run build` avant.');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

/**
 * Le salon. Espagnol vers la langue de la fiche, et anglais vers espagnol pour
 * la fiche espagnole. Les pseudos sont inventes et volontairement quelconques.
 * Aucun ne doit ressembler a un vrai diffuseur : ces images partent sur une page
 * publique.
 */
const [READ, UI, CODE] = SETTINGS[LANG];
const SALON = LANG === 'es' ? 'en' : 'es';
const CONVERSATION = PSEUDOS.map((p, i) => [p, (LANG === 'es' ? LINES.en : ROOM_ES)[i]]);

/**
 * Ce que le faux moteur rend, phrase par phrase : les lignes du salon vers la
 * langue du lecteur, et ce que le lecteur tape vers celle du salon. Sans cette
 * derniere entree l'apercu rendait la phrase telle quelle et la capture montrait
 * la fonctionnalite en train de ne rien faire.
 */
const TRADUCTIONS = new Map([...CONVERSATION.map(([, t], i) => [t, LINES[LANG][i]]), TYPED[LANG]]);

const rangee = (i, [pseudo, texte]) =>
  `<div data-index="${i}" class="px-3 py-1">` +
  '<div class="w-full min-w-0 shrink-0">' +
  `<button class="font-bold" style="color:#53FC18">${pseudo}</button>` +
  '<span style="opacity:.5">: </span>' +
  `<span class="font-normal">${texte}</span>` +
  '</div></div>';

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>chat</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; background: #0b0b0c; color: #e8e8e8;
               font: 14px/1.5 Inter, ui-sans-serif, system-ui, sans-serif; }
  #page { display: flex; height: 100vh; }
  /* La zone du lecteur. Volontairement abstraite : une capture de store ne doit
     pas fabriquer le flux de quelqu'un ni une marque qui n'existe pas. Un aplat
     travaille et une barre de lecture generique suffisent a situer la page. */
  #video { flex: 1; position: relative; overflow: hidden;
           background:
             radial-gradient(120% 90% at 25% 20%, #1b2228 0%, transparent 60%),
             radial-gradient(100% 80% at 80% 75%, #16201a 0%, transparent 55%),
             linear-gradient(160deg, #14181b, #0b0d0f); }
  #video::before { content: ''; position: absolute; inset: 0;
                   background-image: linear-gradient(#ffffff08 1px, transparent 1px),
                                     linear-gradient(90deg, #ffffff08 1px, transparent 1px);
                   background-size: 48px 48px; }
  #player { position: absolute; left: 24px; right: 24px; bottom: 22px; height: 4px;
            border-radius: 2px; background: #ffffff1f; }
  #player i { display: block; height: 100%; width: 62%; border-radius: 2px;
              background: #53FC18; }
  #live { position: absolute; left: 24px; top: 22px; display: flex; align-items: center;
          gap: 8px; font-size: 12px; letter-spacing: .04em; color: #cfd4d8; }
  #live b { width: 8px; height: 8px; border-radius: 50%; background: #ff4d4d; }
  /* overflow: hidden comme sur Kick. Le panneau de langues se borne a la colonne
     qui rogne son ancre ; sans elle il retombait sur la boite du bouton, 80px de
     haut, et la liste debordait sur le chat de toutes les captures 02. */
  #channel-chatroom { width: 360px; border-left: 1px solid #1f2326; display: flex;
                      flex-direction: column; background: #101013; overflow: hidden; }
  /* Le leurre existe pour que l'observateur choisisse le bon conteneur entre
     deux qui repondent au meme selecteur, comme sur le vrai site. Il ne doit pas
     prendre de place : avec "flex: 1" sur les deux, il mangeait la moitie haute
     de la colonne et les captures montraient un chat a moitie vide. */
  [data-which='decoy'] { flex: 0 0 0; height: 0; overflow: hidden; }
  [data-which='messages'] { flex: 1; overflow: auto; display: flex;
                            flex-direction: column; justify-content: flex-end; }
  [data-which="messages"] > div { padding: 3px 10px; }
  #compose { border-top: 1px solid #1f2326; padding: 10px; }
  [contenteditable] { min-height: 38px; border: 1px solid #2a2f33; border-radius: 4px;
                      padding: 8px; outline: none; }
</style></head>
<body>
  <div id="page">
    <div id="video">
      <div id="live"><b></b>LIVE</div>
      <div id="player"><i></i></div>
    </div>
    <div id="channel-chatroom">
      <div class="no-scrollbar" data-which="decoy"></div>
      <div class="no-scrollbar" data-which="messages">
        ${CONVERSATION.map((c, i) => rangee(i, c)).join('\n')}
      </div>
      <div id="compose">
        <div contenteditable="true" spellcheck="false" role="textbox" data-testid="chat-input" class="editor-input"></div>
      </div>
    </div>
  </div>
  <script>
    // Comme l'editeur Lexical de Kick : un beforeinput insertText, meme
    // synthetique, remplace la selection. Un contenteditable nu l'ignore, et Tab
    // retombait sur la copie dans le presse-papiers au lieu d'echanger le texte.
    document.addEventListener('beforeinput', (e) => {
      if (e.isTrusted || e.inputType !== 'insertText' || !e.target.isContentEditable) return;
      e.preventDefault();
      const r = getSelection().getRangeAt(0);
      r.deleteContents();
      r.insertNode(document.createTextNode(e.data));
      getSelection().collapseToEnd();
    });
  </script>
</body></html>`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-shots-'));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1280, height: 800 },
  // Le Chrome Web Store veut exactement 1280x800 ou 640x400 et refuse le reste.
  // Avec `deviceScaleFactor: 2` les images sortaient en 2560x1600, ce qui aurait
  // fait rejeter la soumission sans que rien ici ne le dise.
  deviceScaleFactor: 1,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--window-position=-2400,-2400',
    ...(FIREFOX ? ['--disable-features=TranslationAPI,LanguageDetectionAPI'] : []),
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

const KICK = /^https?:\/\/(www\.)?kick\.com\//;

await ctx.route('**://translate.googleapis.com/**', async (route) => {
  const q = new URL(route.request().url()).searchParams.get('q') ?? '';
  const SAUT = String.fromCharCode(10);
  const lignes = q.split(SAUT);
  const segments = lignes.map((l, k) => [
    (TRADUCTIONS.get(l.trim()) ?? l) + (k < lignes.length - 1 ? SAUT : ''),
    l,
    null,
    null,
    10,
  ]);
  // La langue detectee : celle du lecteur pour ce qu'il tape, celle du salon
  // pour le reste. Le drapeau de source de chaque ligne traduite la montre.
  const source = lignes[0].trim() === TYPED[LANG][0] ? CODE : SALON;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([segments, null, source]),
  });
});

await ctx.route(KICK, async (route) => {
  const req = route.request();
  if (req.resourceType() === 'document') {
    await route.fulfill({ status: 200, contentType: 'text/html', body: PAGE });
  } else if (req.url().includes('/api/')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ chatroom: { id: 1 }, livestream: { lang_iso: SALON } }),
    });
  } else {
    await route.fulfill({ status: 204, body: '' });
  }
});

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto('https://kick.com/demo-channel', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// La langue de lecture et celle de l'interface, posees avant que le salon ne
// soit lu : le service worker n'existe qu'une fois une page kick.com ouverte.
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
const extId = await sw.evaluate(() => chrome.runtime.id);
await sw.evaluate(
  async ([read, ui]) => {
    const KEY = 'kt.settings.v2';
    const cur = (await chrome.storage.sync.get(KEY))[KEY] ?? {};
    // The usual popup, not the one-time consent card: the README promises providers and counts.
    await chrome.storage.sync.set({ [KEY]: { ...cur, targetLang: read, uiLang: ui, usageStatsAsked: true } });
  },
  [READ, UI],
);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);

// Le chat se lit par le bas, comme un vrai salon.
await page.evaluate(() => {
  const l = document.querySelector('#channel-chatroom [data-which="messages"]');
  if (l) l.scrollTop = l.scrollHeight;
});
await page.waitForTimeout(600);

const notes = [];
/** Constats faits pendant la prise, verses dans `fails` plus bas. */
const failsAlign = [];

/** Prend une image et verifie qu'elle montre son sujet, sinon elle ne compte pas. */
async function prendre(nom, sujet, cible = page) {
  const montre = await cible.evaluate(sujet);
  await cible.screenshot({ path: path.join(OUT, `${nom}.png`) });
  notes.push({ nom, montre: !!montre });
}

/**
 * Les images du README, qui ne sont pas les memes que celles du store.
 *
 * Le store impose 1280x800 et la page fabriquee y est aux trois quarts un
 * rectangle noir : c'est la zone video, et elle ne montre rien. Acceptable pour
 * une fiche, ou l'image est cliquee et agrandie ; inutilisable dans un README ou
 * la meme image est reduite a la largeur d'une colonne de texte et ou le produit
 * devient illisible.
 *
 * Le cadre est donc DERIVE de la page au lieu d'etre un rectangle ecrit ici.
 * Des nombres fixes survivraient a un changement de mise en page en cadrant a
 * cote sans que rien ne rougisse, ce qui est exactement la panne que le controle
 * "montre bien son sujet" existe pour attraper.
 */
const OUT_README = path.join(HERE, 'readme');
fs.mkdirSync(OUT_README, { recursive: true });

/** Le rectangle qu'occupent reellement des elements, en un seul cadre. */
async function cadreDe(p, selecteurs) {
  const c = await p.evaluate((sels) => {
    const boites = sels
      .map((s) => document.querySelector(s))
      .filter(Boolean)
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.width > 1 && b.height > 1);
    if (boites.length === 0) return null;
    const gauche = Math.min(...boites.map((b) => b.left));
    const haut = Math.min(...boites.map((b) => b.top));
    const droite = Math.max(...boites.map((b) => b.right));
    const bas = Math.max(...boites.map((b) => b.bottom));
    return { gauche, haut, droite, bas, vl: window.innerWidth, vh: window.innerHeight };
  }, selecteurs);
  if (!c) return null;
  const marge = 10;
  const x = Math.max(0, Math.floor(c.gauche - marge));
  const y = Math.max(0, Math.floor(c.haut - marge));
  return {
    x,
    y,
    width: Math.min(c.vl - x, Math.ceil(c.droite - c.gauche + marge * 2)),
    height: Math.min(c.vh - y, Math.ceil(c.bas - c.haut + marge * 2)),
  };
}

async function prendreReadme(nom, selecteurs, sujet) {
  // Le README est en anglais ; ses images viennent de la fiche anglaise.
  if (LANG !== 'en') return;
  const clip = await cadreDe(page, selecteurs);
  const montre = clip !== null && (await page.evaluate(sujet));
  if (clip) await page.screenshot({ path: path.join(OUT_README, `${nom}.png`), clip });
  notes.push({ nom, montre: !!montre, readme: true, clip });
}

// Une rangee coupee en deux sur le bord haut d'une image se lit comme un defaut
// de rendu, pas comme un chat defile.
//
// Premiere tentative, et pourquoi elle ne pouvait pas marcher : ajuster
// `scrollTop`. Mesure, `scrollable: false`, `scrollTop: 0`, rangee toujours
// coupee. La liste est en `justify-content: flex-end`, et un contenu qui deborde
// par le DEBUT d'un conteneur flex n'est pas atteignable par le defilement. Il
// n'y a rien a faire defiler ; il y a une rangee que le conteneur ne peut pas
// montrer.
//
// Donc les rangees que le cadre coupe sont retirees, pas repositionnees. C'est
// un salon fabrique : une conversation plus courte reste une conversation, et ce
// que l'image montre du produit ne change pas. La boucle est derivee du DOM,
// donc elle suit une mise en page qui bouge.
const alignement = await page.evaluate(() => {
  const l = document.querySelector('#channel-chatroom [data-which="messages"]');
  if (!l) return { absent: true };
  const depassante = () => {
    const haut = l.getBoundingClientRect().top;
    return [...l.querySelectorAll('[data-index]')].find((r) => r.getBoundingClientRect().top < haut - 1);
  };
  let retirees = 0;
  let r;
  // Un plafond, sinon une mise en page cassee viderait le chat en silence et
  // l'image partirait vide en passant le controle du sujet de justesse.
  while ((r = depassante()) && retirees < 5) {
    r.remove();
    retirees += 1;
  }
  return { retirees, reste: depassante() ? 1 : 0, rangees: l.querySelectorAll('[data-index]').length };
});
await page.waitForTimeout(300);
console.log(`alignement       ${alignement.retirees} rangee(s) retiree(s), ${alignement.rangees} restantes, ${alignement.reste} encore coupee(s)`);
if (alignement.reste) failsAlign.push('une rangee reste coupee en haut du cadre');

// 01 : le chat qui fait son travail. Verifie en comptant les traductions
// reellement posees, pas en supposant qu'elles sont la.
await prendre(
  '01-chat-traduit',
  () => document.querySelectorAll('.kt-translation, .kt-translation-inline, .kt-translation-replace').length >= 6,
);


// Le meme instant, cadre pour le README : la barre et la liste de messages, sans
// la zone video vide qui occupe les trois quarts de l'image du store.
await prendreReadme(
  'chat',
  ['#kt-floating-bar', '#channel-chatroom [data-which="messages"]'],
  () => document.querySelectorAll('.kt-translation, .kt-translation-inline, .kt-translation-replace').length >= 6,
);

// 02 : la grille de langues, ce que la fiche actuelle ne montre pas du tout.
// Le bouton exact, repris de `kick-actions.mjs` : la barre est
// `#kt-floating-bar` et son controle de langue `.kt-float-lang`. Un premier
// essai cliquait `#kt-float button`, qui n'existe pas, et l'image sortait sur
// un panneau ferme.
await page.evaluate(() => document.querySelector('#kt-floating-bar .kt-float-lang')?.click());
await page.waitForTimeout(900);
// Compter les rangees ne suffisait pas : un panneau de 80px dont la liste
// debordait passait le controle. La liste doit tenir dans son panneau.
await prendre('02-langues', () => {
  const l = document.querySelector('.kt-lang-panel, .kt-chip-menu');
  const liste = l?.querySelector('.kt-lang-list')?.getBoundingClientRect();
  return !!l && l.querySelectorAll('.kt-lang-row, .kt-chip-row').length > 10 && (!liste || liste.bottom <= l.getBoundingClientRect().bottom + 1);
});
await prendreReadme('languages', ['.kt-lang-panel', '.kt-chip-menu'], () => {
  const l = document.querySelector('.kt-lang-panel, .kt-chip-menu');
  return !!l && l.querySelectorAll('.kt-lang-row, .kt-chip-row').length > 10;
});
await page.keyboard.press('Escape').catch(() => undefined);
await page.waitForTimeout(400);

// 03 : l'apercu de composition, au-dessus de la boite de saisie.
const saisie = page.locator('#channel-chatroom [contenteditable="true"]');
await saisie.click();
await saisie.type(TYPED[LANG][0], { delay: 20 });
await page.waitForTimeout(7000);
await prendre('03-composition', () => {
  const p = document.querySelector('.kt-compose');
  return !!p && p.dataset.state === 'ready' && (p.textContent ?? '').trim().length > 3;
});
// L'apercu couvrait 18px des 24 de la puce de langue, celle qui regle la langue
// de cet apercu, et laissait depasser le bas de son contour sous le panneau.
const chevauchement = await page.evaluate(() => {
  const p = document.querySelector('.kt-compose')?.getBoundingClientRect();
  const c = document.querySelector('.kt-chip')?.getBoundingClientRect();
  if (!p || !c || !c.height) return null;
  return Math.max(0, Math.min(p.bottom, c.bottom) - Math.max(p.top, c.top));
});
console.log(`apercu/puce       ${chevauchement ?? 'puce absente'}px de chevauchement`);
if (chevauchement === null) failsAlign.push('03 : pas de puce de langue a mesurer sous l apercu');
else if (chevauchement > 0) failsAlign.push(`03 : l apercu couvre ${Math.round(chevauchement)}px de la puce de langue`);

// Pour le README, le compositeur et son apercu seulement : c'est la ou se passe
// la chose, et la liste de messages au-dessus la noierait.
await prendreReadme(
  'compose',
  [
    // L'avant-derniere rangee du chat plutot qu'une marge en pixels : le cadre
    // reste derive du DOM et il donne son contexte a l'apercu, qui seul ne
    // montrait qu'une boite de saisie coupee en haut.
    '#channel-chatroom [data-which="messages"] > div:nth-last-child(2)',
    '.kt-compose',
    '#channel-chatroom [contenteditable="true"]',
  ],
  () => {
    const p = document.querySelector('.kt-compose');
    return !!p && p.dataset.state === 'ready' && (p.textContent ?? '').trim().length > 3;
  },
);

// 04 et 05 : des pages de l'extension, aucun salon en jeu.
const opt = await ctx.newPage();
await opt.setViewportSize({ width: 1280, height: 800 });
await opt.goto(`chrome-extension://${extId}/src/options/index.html`);
await opt.waitForTimeout(3000);
await prendre('04-reglages', () => document.querySelectorAll('select, input, button').length > 5, opt);
await opt.close();

// Le popup fait environ 360px de large : le tirer dans un cadre 1280x800 sans
// mise en scene donnerait une image aux trois quarts vide.
const pop = await ctx.newPage();
await pop.setViewportSize({ width: 420, height: 640 });
await pop.goto(`chrome-extension://${extId}/src/popup/index.html`);
await pop.waitForTimeout(2500);
const popOk = await pop.evaluate(() => document.querySelectorAll('select, button').length > 2);
const brut = await pop.screenshot();
// Le popup a sa taille reelle pour le README : le cadre 1280x800 ci-dessous
// existe pour le store, qui impose cette dimension, et il noierait le popup dans
// une page reduite a la largeur d'une colonne de texte.
if (LANG === 'en') {
  fs.writeFileSync(path.join(OUT_README, 'popup.png'), brut);
  notes.push({ nom: 'popup', montre: popOk, readme: true, clip: { natif: true } });
}
await pop.close();

const cadre = await ctx.newPage();
await cadre.setViewportSize({ width: 1280, height: 800 });
await cadre.setContent(
  `<!doctype html><html><head><meta charset="utf-8"><title>popup</title><style>
    html,body{margin:0;height:100%;background:linear-gradient(160deg,#0f1214,#0b0b0c);
              display:flex;align-items:center;justify-content:center}
    img{border-radius:8px;border:1px solid #1f2326;max-height:88%}
  </style></head><body><img src="data:image/png;base64,${brut.toString('base64')}"></body></html>`,
);
await cadre.waitForTimeout(400);
await cadre.screenshot({ path: path.join(OUT, '05-popup.png') });
notes.push({ nom: '05-popup', montre: popOk });
await cadre.close();

// Le GIF du README : le salon qui se remplit ligne par ligne, puis une reponse
// tapee, son apercu, et Tab qui la remplace. Des captures du cadre du chat,
// assemblees par ffmpeg, qui seul sait ecrire un GIF sans dependance ajoutee.
if (LANG === 'en' && process.argv.includes('--gif')) {
  // Page rechargee : la phrase tapee pour la capture 03 compte comme deja
  // traitee, et la retaper a l'identique ne rouvre pas l'apercu.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const images = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-gif-'));
  const clip = await cadreDe(page, ['#channel-chatroom']);
  let n = 0;
  const image = async (fois = 1) => {
    const b = await page.screenshot({ clip });
    for (let k = 0; k < fois; k++) fs.writeFileSync(path.join(images, `f${String(n++).padStart(4, '0')}.png`), b);
  };
  await page.evaluate(() => document.querySelector('#channel-chatroom [data-which="messages"]')?.replaceChildren());
  await page.waitForTimeout(300);
  await image(2);
  // De nouveaux index : ceux d'avant sont deja traduits, et Kick recycle ses
  // rangees sous le meme index, que l'extension retraduit.
  for (const [i, c] of CONVERSATION.entries()) {
    await page.evaluate(
      (html) => document.querySelector('#channel-chatroom [data-which="messages"]')?.insertAdjacentHTML('beforeend', html),
      rangee(100 + i, c),
    );
    await page.waitForTimeout(120);
    await image();
    await page.waitForTimeout(500);
    await image();
  }
  await saisie.click();
  const phrase = TYPED[LANG][0];
  for (let k = 0; k < phrase.length; k += 5) {
    await saisie.type(phrase.slice(k, k + 5), { delay: 15 });
    await image();
  }
  await page
    .waitForFunction(() => {
      const p = document.querySelector('.kt-compose');
      return !!p && p.dataset.state === 'ready' && (p.textContent ?? '').trim().length > 3;
    }, null, { timeout: 15000 })
    .catch(() => undefined);
  // L'apercu entre en fondu : l'image se prend une fois qu'il est opaque.
  await page.waitForTimeout(500);
  await image(6);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  await image(12);

  const gif = path.join(OUT_README, 'demo.gif');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '4', '-i', path.join(images, 'f%04d.png'),
    '-vf', 'split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none', '-loop', '0', gif]);
  fs.rmSync(images, { recursive: true, force: true });
  const taille = fs.existsSync(gif) ? fs.statSync(gif).size : 0;
  const echange = await saisie.textContent();
  console.log(`readme/demo.gif      ${n} images, ${Math.round(taille / 1024)}Ko, Tab a remplace la saisie: ${echange?.trim() === TYPED[LANG][1]}`);
  if (r.status !== 0 || !taille) failsAlign.push(`demo.gif : ffmpeg a echoue (${r.error?.code ?? String(r.stderr).trim().slice(0, 120)})`);
  if (echange?.trim() !== TYPED[LANG][1]) failsAlign.push(`demo.gif : apres Tab la saisie porte "${echange?.trim()}"`);
}

await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });

const fails = [...failsAlign];
/** Largeur et hauteur lues dans l'en-tete PNG, sans dependance. */
function dimensions(fichier) {
  const b = fs.readFileSync(fichier);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

for (const n of notes) {
  const f = path.join(n.readme ? OUT_README : OUT, `${n.nom}.png`);
  const octets = fs.existsSync(f) ? fs.statSync(f).size : 0;
  const [l, h] = octets ? dimensions(f) : [0, 0];
  console.log(
    `${(n.readme ? 'readme/' + n.nom : n.nom).padEnd(20)} ${String(l).padStart(4)}x${String(h).padEnd(4)} ` +
      `${String(Math.round(octets / 1024)).padStart(4)}Ko  sujet visible: ${n.montre}`,
  );
  const plancher = n.readme ? 3000 : 8000;
  if (octets < plancher) fails.push(`${n.nom} pese ${octets} octets : l image est vide ou n a pas ete ecrite`);
  if (n.readme) {
    // Le cadre est derive de la page, donc sa taille varie avec la mise en page.
    // Ce qui doit rester vrai est qu'il cadre quelque chose : une image large de
    // toute la fenetre veut dire que le selecteur n'a rien trouve et que le cadre
    // est retombe sur le viewport entier.
    if (n.clip === null) fails.push(`${n.nom} : aucun element trouve, rien a cadrer`);
    else if (l >= 1200) fails.push(`${n.nom} fait ${l}px de large : le cadre couvre toute la fenetre, il ne cadre rien`);
    else if (l < 200 || h < 100) fails.push(`${n.nom} fait ${l}x${h} : trop petit pour montrer quoi que ce soit`);
  } else if (!(l === 1280 && h === 800)) {
    fails.push(
      `${n.nom} fait ${l}x${h} : le Chrome Web Store veut exactement 1280x800 ou 640x400 et rejette le reste`,
    );
  }
  if (!n.montre) fails.push(`${n.nom} ne montre pas son sujet`);
}
const nStore = notes.filter((n) => !n.readme).length;
const nReadme = notes.filter((n) => n.readme).length;
if (nStore !== 5) fails.push(`${nStore} images de store sur 5`);
if (LANG === 'en' && nReadme !== 4) fails.push(`${nReadme} images de README sur 4`);

console.log(`\n${OUT}`);
if (fails.length) {
  console.error('FAIL: ' + fails.join(' ; '));
  process.exit(1);
}
console.log('store-shots-fixture: OK');
