/**
 * Le produit fait une seule chose : un message arrive dans le chat, sa
 * traduction apparait dessous. Rien hors ligne ne le verifiait.
 *
 * Ce que les autres portes couvrent. `chat-live` appelle `inject()` a la main et
 * mesure le rendu ; les 620 tests unitaires bouchonnent aux frontieres de
 * module. Le chemin reel, du noeud ajoute au DOM jusqu'au texte traduit affiche,
 * en passant par l'observateur, le pipeline, le message vers le service worker
 * et le moteur, n'etait exerce que par des harnais live qui ouvrent le vrai
 * kick.com et demandent le reseau.
 *
 * Comment celui-ci s'en passe. Comme `extension-load` : `content_scripts` filtre
 * sur l'URL et pas sur ce qui repond, donc kick.com est servi localement. Le
 * moteur de traduction est intercepte de la meme facon et rend une reponse
 * fabriquee, ce qui rend l'assertion exacte : on sait quel texte doit apparaitre.
 *
 * Ce qu'elle attrape, mesure et pas suppose. Casser `font-normal` dans
 * `selectors.ts` la fait rougir : la chaine complete repond a une regression
 * reelle du produit. Mais les tests unitaires attrapent deja celle-la, quatre
 * d'entre eux. La valeur propre de cette porte est le cablage lui-meme, ce que
 * personne d'autre n'execute : Chrome charge l'extension, le script de contenu
 * arrive, l'observateur s'accroche au bon conteneur, le pipeline parle au
 * service worker, l'adaptateur du moteur lit la reponse, et le rendu se pose
 * sous le bon message. Aucun de ces sauts n'est franchi ailleurs hors ligne.
 *
 * Le mode `--bascule` couvre ce que rien d'autre ne couvre, et c'est mesure :
 * tronquer la cascade a un seul moteur dans `background/translator/index.ts`
 * laisse les 620 tests unitaires verts et fait rougir cette porte. Retirer la
 * chaine des reglages par defaut, en revanche, est attrape par un test qui
 * asserte la constante, ce qui ne dit rien sur le fait qu'elle s'execute.
 *
 * Ce qu'elle n'attrape pas, mesure aussi. Retirer
 * `https://translate.googleapis.com/*` des `host_permissions` ne la fait pas
 * rougir : l'interception repond avant que la permission compte. Elle ne dit
 * donc rien sur les permissions declarees, et il ne faut pas lui faire dire.
 *
 *   node test/e2e/translate-offline.mjs
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from './playwright.mjs';
import { poserLangueCible } from './kick-actions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Par defaut le repertoire de build. `KT_EXT` permet de pointer sur un paquet
// decompresse : ce qui part au store n'est pas `dist/` mais l'archive, et
// personne n'avait jamais lance ces portes sur l'archive elle-meme.
const EXT = process.env.KT_EXT ?? path.resolve(HERE, '../../dist');

if (!fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error('dist/manifest.json absent. Lancer `npm run build` avant.');
  process.exit(2);
}

/** Le texte que le faux moteur rend. Choisi pour ne ressembler a rien d'autre
    dans la page, afin qu'une assertion qui le trouve ne puisse pas le trouver
    ailleurs par accident. */
const TRADUIT = 'ZZTRADUCTIONZZ';
const REPLI = 'ZZREPLIZZ';
const SOURCE = 'hola amigo que tal';

/**
 * Deux modes. Par defaut le premier moteur repond ; avec `--bascule` il rend un
 * 429 et c'est le suivant de `providerOrder` qui doit fournir le texte.
 *
 * La bascule n'etait verifiee que par `live-fallback`, qui tue les moteurs au
 * resolveur DNS parce que sa premiere version routait avec `page.route` et ne
 * mesurait rien : en MV3 les requetes de traduction partent du service worker.
 * `ctx.route`, au niveau du contexte, les voit ; c'est mesure ici, le moteur est
 * bien appele. La chaine de repli devient donc testable sans reseau.
 */
const BASCULE = process.argv.includes('--bascule');

/**
 * Troisieme mode, `--recyclage`. Kick recycle ses rangees de chat : le
 * virtualiseur reutilise la meme valeur de `data-index` pour un autre message
 * quand on defile, ce que `selectors.ts` signale en majuscules. La panne
 * cherchee est une rangee recyclee qui garde la traduction du message
 * precedent, sous un texte auquel elle n'appartient pas.
 *
 * `live-recycle` la guette sur un vrai chat charge, echantillonne toutes les 20
 * secondes, parce qu'il faut attendre que le defilement veuille bien recycler.
 * Ici on le provoque : on reecrit le texte des memes `data-index`, ce que fait
 * exactement le virtualiseur, et la reponse est immediate et deterministe.
 *
 * Pour que la panne soit visible, le faux moteur repond en fonction de ce qu'on
 * lui donne au lieu de rendre une constante. Une traduction perimee se lit alors
 * a l'oeil : elle porte le texte d'un autre message.
 */
const RECYCLAGE = process.argv.includes('--recyclage');

/**
 * Quatrieme mode, `--navigation`. Changer de chaine sur Kick est une navigation
 * d'application : l'URL change et le chat est remonte, sans rechargement. Si
 * l'extension ne se raccroche pas, la traduction s'arrete pour de bon et rien ne
 * le dit.
 *
 * Le script de contenu patche `history.pushState` pour s'en apercevoir, mais il
 * vit dans un monde isole : le routeur de Kick appelle le sien dans le monde
 * principal, ou ce patch n'existe pas. Ce mode navigue depuis le monde
 * principal, comme le site, et voit donc ce qu'un lecteur voit.
 */
const NAVIGATION = process.argv.includes('--navigation');

/**
 * Cinquieme mode, `--survol`. Le mode survol ne traduit que ce que le lecteur
 * pointe, et la fiche des stores en fait un argument chiffre : environ dix fois
 * moins de consommation sur un chat rapide. Cet argument ne tient que si rien
 * ne part avant le survol, ce que seul un vrai navigateur peut dire.
 *
 * `armHoverTranslate` porte d'ailleurs un commentaire sur une garde correcte
 * dans un navigateur et invisible a tout test unitaire, faute de disposition.
 */
const SURVOL = process.argv.includes('--survol');

/**
 * Sixieme mode, `--reglages`. Changer la langue cible depuis la barre ou le
 * popup ecrit dans `chrome.storage`, et le script de contenu doit s'en
 * apercevoir sans rechargement : `watchSettings` existe pour ca. Si le
 * changement n'arrive pas, le lecteur choisit une langue et rien ne bouge
 * jusqu'a ce qu'il recharge, ce qui ressemble a une extension cassee.
 *
 * L'assertion est exacte parce que le faux moteur voit le parametre `tl` que
 * `google.ts` pose : on lit la langue reellement demandee, pas un affichage.
 */
const REGLAGES = process.argv.includes('--reglages');

/**
 * Septieme mode, `--seventv`. 7TV rend le chat a sa facon et le message n'est
 * plus dans les `span.font-normal` de Kick mais dans des
 * `span.seventv-text-token` ; `extractMessageText` les lit en premier. C'est un
 * second contrat DOM complet, celui d'une extension tierce tres repandue, et
 * rien hors ligne ne l'exercait.
 *
 * Ce mode n'essaie PAS de reproduire le doublon natif+7TV que cite le
 * commentaire de `extractMessageText`. Deux formes de rangee ont ete tentees et
 * aucune ne le produit : `joinTexts` ne prend que les noeuds texte d'un
 * element, donc un span qui ne contient que des jetons ne rend que des espaces.
 * La forme reelle du doublon demande la page de quelqu'un qui a 7TV installe, et
 * inventer une troisieme forme ne prouverait que mon imagination. Ce qui est
 * asserte ici est ce qui se verifie : une rangee dont le texte n'est atteignable
 * que par les jetons est bien envoyee au moteur, une fois, et traduite.
 */
const SEVENTV = process.argv.includes('--seventv');

/**
 * Huitieme mode, `--cache`. Le meme texte revient sans arret dans un chat, et
 * c'est ce qui fait tenir un quota gratuit : deux caches sont censes l'attraper,
 * celui de l'onglet dans `pipeline.ts` et celui du service worker. Aucun des
 * deux n'etait verifie de bout en bout, alors que c'est un cout direct pour le
 * lecteur, en argent chez DeepL et en blocage chez Google.
 *
 * Le pseudo change entre les deux messages exprès : le saut par pseudo de
 * `prepare()` ecarterait le second sans jamais consulter un cache, et la porte
 * verrait un zero qui ne prouverait rien.
 */
const CACHE = process.argv.includes('--cache');

/**
 * Neuvieme mode, `--maj`. L'extension lit la derniere release publiee sur GitHub
 * pour dire au lecteur qu'une version existe, et c'est une des permissions
 * qu'il faut justifier dans les fiches des stores. Si ce chemin casse, tout le
 * monde reste sur une vieille version sans rien voir.
 *
 * `updateChecker.store.test.ts` couvre deja la decision elle-meme, mais avec
 * `fetch` bouchonne et en appelant la fonction directement. Ce qui n'est couvert
 * nulle part est le trajet complet : le popup demande au service worker, celui-ci
 * interroge GitHub, et le popup dessine la banniere.
 */
const MAJ = process.argv.includes('--maj');

/**
 * Dixieme mode, `--compose`. L'autre moitie du produit : on ecrit une reponse,
 * un apercu apparait dans la langue de la chaine, et Ctrl+Entree la met a la
 * place de ce qu'on a tape. La propriete qui compte n'est pas que l'apercu
 * s'affiche, c'est vers QUELLE langue il traduit : la chaine, lue chez Kick, et
 * pas la langue du lecteur. Se tromper la envoie un message poli dans la
 * mauvaise langue devant tout le monde.
 *
 * La fixture repond `lang_iso: es` sur l'API de Kick, donc l'apercu doit partir
 * en espagnol pendant que le chat entrant arrive en anglais.
 */
const COMPOSE = process.argv.includes('--compose');

/**
 * Onzieme mode, `--esquive`. Kick ouvre des panneaux au-dessus du compositeur,
 * le selecteur d'emotes en tete, et l'apercu ne doit pas passer dessous.
 * `findOverlayTopAbove` les cherche par une liste de selecteurs avec une garde
 * de taille : au moins 40 par 40, au-dessus du compositeur, et le bas a moins de
 * huit pixels de son haut.
 *
 * Ce mode verifie le MECANISME, avec une superposition fabriquee qui repond a
 * ces criteres. Il ne dit rien de la question restee ouverte, qui est de savoir
 * si le vrai selecteur d'emotes de Kick correspond a l'un de ces selecteurs :
 * celle-la demande la page de kil, parce que Kick sert un `auth-modal` au
 * contexte Playwright. La moitie verifiable l'est donc, et l'autre reste
 * nommee pour ce qu'elle est.
 */
const ESQUIVE = process.argv.includes('--esquive');

/**
 * Douzieme mode, `--override`. Le dictionnaire de `transliterationGuard` repond
 * avant tout appel reseau sur une expression courte visee vers une ecriture non
 * latine, parce que les moteurs y rendent une TRANSLITTERATION phonetique au
 * lieu d'une traduction : mesure sur le vrai point de sortie de Google,
 * "bonjour" vers le japonais revient en ボンジュール, "merci" en メルシー,
 * "gracias" en グラシアス et "ciao" en チャオ.
 *
 * Ce qui se verifie ici est le CABLAGE, pas la table : que la reponse arrive
 * sous la rangee sans qu'aucun moteur ait ete appele. Le mode porte donc deux
 * lignes, une couverte par la table et une qui ne l'est pas, et la seconde est
 * ce qui empeche un vert a vide : si rien ne partait au moteur du tout, le zero
 * de la premiere ne prouverait rien.
 */
const OVERRIDE = process.argv.includes('--override');

/** Couverte par la table, et le mot que le moteur rend en katakana. */
const MOT_TABLE = 'bonjour';
/** Reponse attendue de la table, la vraie salutation et pas son epellation. */
const MOT_TABLE_JA = 'こんにちは';
/** Hors table : doit atteindre le moteur, sinon la porte est verte a vide. */
const MOT_HORS_TABLE = 'trop fort le mec';

const RANGEES = 8;

// Le chat de Kick reduit a son contrat, repris de `observer.test.ts` qui est
// ce que le produit dit savoir lire : `#channel-chatroom .no-scrollbar`, un
// leurre vide en premier comme sur le vrai site, puis des `div[data-index]`
// avec le pseudo dans un `button.font-bold` et le texte dans un
// `span.font-normal`.
//
// Le `div.w-full.min-w-0.shrink-0` autour des deux n'est pas decoratif :
// `pickInjectionTarget` le cherche en premier, et sans lui il retombe sur le
// premier enfant de la rangee, c'est-a-dire le bouton du pseudo. La traduction
// atterrissait alors DANS le nom de l'utilisateur, ce que les modes precedents
// affichaient sans le dire ("pseudo1ESZZTRADUCTIONZZ:..."), et le mode survol
// armait ce bouton au lieu du message.
const FIXTURE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>chat</title></head>
<body>
  <div id="channel-chatroom">
    <div class="no-scrollbar" data-which="decoy"></div>
    <div class="no-scrollbar" data-which="messages" style="height:600px;overflow:auto">
      <div data-index="0"><div class="w-full min-w-0 shrink-0"><button class="font-bold" style="color: rgb(1,2,3)">autre</button><span class="font-normal">buenos dias a todos</span></div></div>
    </div>
    <div contenteditable="true" role="textbox" data-testid="chat-input" class="editor-input"
         style="min-height:40px;border:1px solid #333"></div>
  </div>
</body></html>`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-tr-'));
const ctx = await chromium.launchPersistentContext(profile, {
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

const vuParLeMoteur = [];
/** La langue cible que le moteur a reellement recue, requete par requete. */
const ciblesDemandees = [];

// Le glob de Playwright ne fait pas matcher `*.kick.com` sur `kick.com` : `*`
// veut au moins un caractere avant le point, donc le document partait sur le
// vrai site pendant que les sous-ressources, elles, etaient bien interceptees.
// Une expression reguliere prend les deux formes.
const KICK = /^https?:\/\/(www\.)?kick\.com\//;

await ctx.route('**://api.github.com/**', async (route) => {
  vuParLeMoteur.push('github');
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ tag_name: 'v99.0.0' }),
  });
});

await ctx.route('**://translate.googleapis.com/**', async (route) => {
  vuParLeMoteur.push('google');
  const url = new URL(route.request().url());
  // translate_a/t, how google.ts sends a batch: one `q` per line in the POST
  // body. Answered in that form, or every batch fell back to one GET per line
  // (ShapeError) and the gate guarded a path production does not take.
  const lignesPost = route.request().method() === 'POST' ? new URLSearchParams(route.request().postData() ?? '').getAll('q') : null;
  // One entry per request, its lines joined, so a text sent twice in one request still shows.
  ciblesDemandees.push(`${url.searchParams.get('tl') ?? '?'}|${lignesPost ? lignesPost.join(String.fromCharCode(10)) : (url.searchParams.get('q') ?? '')}`);
  if (BASCULE) {
    // 429 est ce que `google.ts` lit comme `rate_limit`, la raison pour laquelle
    // un lecteur reel bascule : le quota gratuit qui tombe en pleine diffusion.
    await route.fulfill({ status: 429, contentType: 'text/plain', body: 'quota' });
    return;
  }
  if (lignesPost) {
    // One answer per line: `[translation, detected]`, or the bare translation when `sl` is set.
    const sl = url.searchParams.get('sl');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lignesPost.map((l) => (sl && sl !== 'auto' ? `${TRADUIT}:${l}` : [`${TRADUIT}:${l}`, 'es']))),
    });
    return;
  }
  // translate_a/single, one line, the form `src/background/translator/google.ts` reads:
  // data[0] = segments, chaque segment [traduit, original, ...], data[2] = langue source.
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    // La reponse depend de la requete : `google.ts` met le texte dans `q`.
    // Rendre une constante rendrait une traduction perimee indetectable, ce qui
    // est precisement la panne que le mode recyclage cherche.
    // A GET carries one line now (batches go by POST above). The split on line
    // breaks stays for the old joined form: segments are glued with '' by
    // `call`, so the break has to live inside the segment.
    //
    // Deux versions de ce bouchon ont accuse le produit avant celle-ci. La
    // premiere ne lisait qu'un `q` ; la seconde rendait un segment unique pour
    // le texte joint, si bien que seule la premiere ligne portait la marque et
    // que les six autres revenaient identiques a l'original. Le produit les
    // ecartait alors avec raison, en le disant sur la ligne : "the translation
    // came back the same as the original". La sonde avait tort, deux fois.
    body: (() => {
      const q = new URL(route.request().url()).searchParams.get('q') ?? '';
      const SAUT = String.fromCharCode(10);
      const lignes = q.split(SAUT);
      const segments = lignes.map((l, k) => [
        `${TRADUIT}:${l}` + (k < lignes.length - 1 ? SAUT : ''),
        l,
        null,
        null,
        10,
      ]);
      return JSON.stringify([segments, null, 'es']);
    })(),
  });
});

await ctx.route('**://api.mymemory.translated.net/**', async (route) => {
  vuParLeMoteur.push('mymemory');
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ responseData: { translatedText: REPLI }, responseStatus: 200 }),
  });
});

await ctx.route(KICK, async (route) => {
  const req = route.request();
  if (req.resourceType() === 'document') {
    await route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE });
    return;
  }
  if (req.url().includes('/api/')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ chatroom: { id: 1 }, livestream: { lang_iso: 'es' } }),
    });
    return;
  }
  await route.fulfill({ status: 204, body: '' });
});

const page = ctx.pages()[0] ?? (await ctx.newPage());
const console_ = [];
page.on('console', (m) => console_.push(`${m.type()}: ${m.text().slice(0, 160)}`));

await page.goto('https://kick.com/kt-fixture-channel', { waitUntil: 'domcontentloaded' });

// Attente bornee, pas fixe : sous 24 portes en parallele le script de contenu
// demarre parfois juste apres 3 s, et la porte le declarait absent a tort.
const barreMontee = await page
  .waitForSelector('#kt-inject-style', { state: 'attached', timeout: 15000 })
  .then(() => true, () => false);

if (SURVOL || OVERRIDE) {
  // Le reglage se pose la ou l'extension le lit, depuis son propre service
  // worker : c'est le seul contexte de la page qui ait `chrome.storage`. Le
  // worker MV3 est paresseux, d'ou l'ouverture d'une page kick.com avant.
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
  // La cible doit etre une ecriture non latine, sinon la table ne repond pas du
  // tout et la porte mesurerait le vide.
  const reglage = OVERRIDE ? { targetLang: 'ja' } : { displayStyle: 'hover' };
  await sw.evaluate(async ({ cle, reglage }) => {
    await chrome.storage.sync.set({ [cle]: reglage });
  }, { cle: 'kt.settings.v2', reglage });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  vuParLeMoteur.length = 0;
  ciblesDemandees.length = 0;
}

// Ajoute des rangees comme Kick le fait : un `div[data-index]` avec le pseudo
// dans un `button.font-bold` et le texte dans un `span.font-normal`.
//
// Ecrire le contenu d une rangee qui en a deja detruit ce que l extension y a
// insere. Une premiere version de ce pilote reecrivait toutes les rangees a
// chaque tour et rapportait une traduction sur huit : la panne etait dans le
// pilote, pas dans le produit, qui avait bien appele le moteur huit fois.
// Poser et recycler sont donc deux gestes distincts.
async function poserRangees(textes, depart = 1) {
  await page.evaluate(({ liste, depart }) => {
    const cible = document.querySelector('#channel-chatroom [data-which="messages"]');
    for (const [k, texte] of liste.entries()) {
      const i = depart + k;
      if (cible.querySelector(`div[data-index="${i}"]`)) continue;
      const ligne = document.createElement('div');
      ligne.setAttribute('data-index', String(i));
      ligne.innerHTML =
        `<div class="w-full min-w-0 shrink-0">` +
        `<button class="font-bold" style="color: rgb(1,2,3)">pseudo${i}</button>` +
        `<span class="font-normal">${texte}</span>` +
        `</div>`;
      cible.appendChild(ligne);
    }
  }, { liste: textes, depart });
}

// Ce que fait le virtualiseur en recyclant : la meme rangee, un autre message.
// La rangee ne bouge pas, son contenu est remplace, et ce qui y avait ete
// insere disparait avec.
async function recyclerRangees(textes, depart = 1) {
  await page.evaluate(({ liste, depart }) => {
    const cible = document.querySelector('#channel-chatroom [data-which="messages"]');
    for (const [k, texte] of liste.entries()) {
      const i = depart + k;
      const ligne = cible.querySelector(`div[data-index="${i}"]`);
      if (!ligne) continue;
      ligne.innerHTML =
        `<div class="w-full min-w-0 shrink-0">` +
        `<button class="font-bold" style="color: rgb(1,2,3)">pseudo${i}</button>` +
        `<span class="font-normal">${texte}</span>` +
        `</div>`;
    }
  }, { liste: textes, depart });
}

const SEL_TR = '.kt-translation, .kt-translation-inline, .kt-translation-replace';

/** Ce que chaque rangee porte : son texte source et ses traductions. */
async function lireRangees() {
  return page.evaluate((sel) => {
    const cible = document.querySelector('#channel-chatroom [data-which="messages"]');
    return [...cible.querySelectorAll('div[data-index]')].map((r) => ({
      index: r.getAttribute('data-index'),
      source:
        r.querySelector('.font-normal')?.textContent ??
        [...r.querySelectorAll('.seventv-text-token')].map((t) => t.textContent).join(' '),
      traductions: [...r.querySelectorAll(sel)].map((t) => t.textContent ?? ''),
    }));
  }, SEL_TR);
}

let traductionVue = null;
let rangees = [];
// Constats faits pendant le scenario, verses dans `fails` plus bas.
const fails0 = [];

if (OVERRIDE) {
  await poserRangees([MOT_TABLE, MOT_HORS_TABLE]);
  await page.waitForTimeout(8000);
  rangees = await lireRangees();

  const rangeeTable = rangees.find((r) => r.source === MOT_TABLE);
  const rangeeHors = rangees.find((r) => r.source === MOT_HORS_TABLE);
  // `ciblesDemandees` porte `<cible>|<texte>` par appel : c'est le seul endroit
  // qui dise ce que le moteur a VU, plutot que combien de fois il a repondu.
  const vusParGoogle = ciblesDemandees.map((c) => c.slice(c.indexOf('|') + 1));
  const tableEstPartie = vusParGoogle.some((q) => q.includes(MOT_TABLE));
  const horsEstParti = vusParGoogle.some((q) => q.includes(MOT_HORS_TABLE));

  console.log(
    `override         table "${MOT_TABLE}" ${tableEstPartie ? 'PARTIE au moteur' : 'jamais partie'}, ` +
      `temoin "${MOT_HORS_TABLE}" ${horsEstParti ? 'parti' : 'JAMAIS PARTI'}`,
  );

  if (!horsEstParti)
    fails0.push(
      `le temoin hors table n a jamais atteint le moteur : la porte serait verte a vide (moteur a vu [${vusParGoogle.join(' / ')}])`,
    );
  if (tableEstPartie)
    fails0.push(
      `"${MOT_TABLE}" a ete envoye au moteur : le dictionnaire ne repond pas avant l appel`,
    );
  const rendue = rangeeTable?.traductions[0] ?? null;
  if (rendue === null) fails0.push(`aucune traduction posee sous "${MOT_TABLE}"`);
  else if (!rendue.includes(MOT_TABLE_JA))
    fails0.push(
      `la rangee "${MOT_TABLE}" porte ${JSON.stringify(rendue)} au lieu de la reponse de la table ${JSON.stringify(MOT_TABLE_JA)}`,
    );
  if (!rangeeHors?.traductions.length)
    fails0.push(`aucune traduction posee sous le temoin "${MOT_HORS_TABLE}"`);

  traductionVue = rendue;
} else if (RECYCLAGE) {
  const premiers = Array.from({ length: RANGEES }, (_, i) => `hola numero ${i} uno`);
  await poserRangees(premiers);
  await page
    .waitForFunction(
      ([sel, n]) => document.querySelectorAll(sel).length >= n,
      [SEL_TR, RANGEES],
      { timeout: 20000 },
    )
    .catch(() => {});

  // Le recyclage : memes `data-index`, autres messages.
  const seconds = Array.from({ length: RANGEES }, (_, i) => `adios numero ${i} dos`);
  await recyclerRangees(seconds);
  await page.waitForTimeout(6000);
  rangees = await lireRangees();
  traductionVue = rangees.find((r) => r.traductions.length)?.traductions[0] ?? null;
} else if (ESQUIVE) {
  const saisie = page.locator('#channel-chatroom [contenteditable="true"]');
  await saisie.click();
  await saisie.type('hello everyone how is it going', { delay: 25 });
  await page.waitForTimeout(8000);

  const sans = await page.evaluate(() => {
    const p = document.querySelector('.kt-compose');
    const r = p?.getBoundingClientRect();
    return r ? { haut: Math.round(r.top), bas: Math.round(r.bottom) } : null;
  });

  // Une superposition qui satisfait la garde : plus de 40 par 40, au-dessus du
  // compositeur, et son bas colle a son haut.
  const boite = await page.evaluate(() => {
    const c = document.querySelector('#channel-chatroom [contenteditable="true"]');
    const r = c.getBoundingClientRect();
    const o = document.createElement('div');
    o.setAttribute('role', 'dialog');
    o.id = 'faux-selecteur-emotes';
    Object.assign(o.style, {
      position: 'fixed',
      left: `${Math.round(r.left)}px`,
      width: '260px',
      height: '220px',
      top: `${Math.round(r.top) - 222}px`,
      background: '#222',
      zIndex: '50',
    });
    document.body.appendChild(o);
    const ob = o.getBoundingClientRect();
    return { haut: Math.round(ob.top), bas: Math.round(ob.bottom), compositeurHaut: Math.round(r.top) };
  });

  // `positionPanel` se rejoue sur le viewport visuel ; un vrai redimensionnement
  // le declenche, un evenement fabrique non.
  await page.setViewportSize({ width: 1201, height: 800 });
  await page.waitForTimeout(1500);

  const avec = await page.evaluate(() => {
    const p = document.querySelector('.kt-compose');
    const r = p?.getBoundingClientRect();
    return r ? { haut: Math.round(r.top), bas: Math.round(r.bottom) } : null;
  });

  console.log(
    `esquive          superposition ${boite.haut}-${boite.bas}, compositeur a ${boite.compositeurHaut}, ` +
      `panneau ${sans ? sans.haut + '-' + sans.bas : '(aucun)'} puis ${avec ? avec.haut + '-' + avec.bas : '(aucun)'}`,
  );

  if (!sans) fails0.push('aucun panneau de composition avant meme la superposition');
  else if (!avec) fails0.push('le panneau a disparu quand la superposition s est ouverte');
  else if (avec.bas > boite.haut)
    fails0.push(
      `le panneau passe sous la superposition : son bas est a ${avec.bas} alors que la superposition commence a ${boite.haut}`,
    );
  traductionVue = 'sans objet';
} else if (COMPOSE) {
  const ECRIT = 'hello everyone how is it going';
  const saisie = page.locator('#channel-chatroom [contenteditable="true"]');
  await saisie.click();
  await saisie.type(ECRIT, { delay: 25 });
  await page.waitForTimeout(9000);

  const apercu = await page.evaluate(() => {
    const p = document.querySelector('.kt-compose');
    const t = p?.querySelector('.kt-compose-text');
    return p ? { texte: (t ?? p).textContent ?? '', visible: !p.hasAttribute('hidden') } : null;
  });
  const versChaine = ciblesDemandees.filter((c) => c.includes(ECRIT));
  console.log(
    `compose          apercu ${apercu ? JSON.stringify(apercu.texte.trim().slice(0, 50)) : '(aucun)'}, ` +
      `langue demandee ${versChaine.map((c) => c.split('|')[0]).join(',') || '(rien)'}`,
  );

  if (!apercu) fails0.push('aucun panneau de composition apres avoir tape une reponse');
  else {
    if (!apercu.visible) fails0.push('le panneau de composition est la mais cache');
    if (!apercu.texte.includes(TRADUIT))
      fails0.push(`l apercu ne vient pas du moteur : ${JSON.stringify(apercu.texte.slice(0, 60))}`);
  }
  if (versChaine.length === 0)
    fails0.push('ce qui a ete tape n a jamais ete envoye au moteur : pas d apercu possible');
  else if (!versChaine.every((c) => c.split('|')[0] === 'es'))
    fails0.push(
      `l apercu ne part pas vers la langue de la chaine : demande [${versChaine
        .map((c) => c.split('|')[0])
        .join(',')}] au lieu de es`,
    );
  traductionVue = 'sans objet';
} else if (MAJ || COMPOSE || ESQUIVE) {
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
  const id = await sw.evaluate(() => chrome.runtime.id);
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${id}/src/popup/index.html`, {
    waitUntil: 'domcontentloaded',
  });
  await popup.waitForTimeout(6000);

  const banniere = await popup.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((e) =>
      (e.textContent ?? '').toLowerCase().includes('update available'),
    );
    return a ? { texte: a.textContent ?? '', titre: a.getAttribute('title') ?? '', href: a.href } : null;
  });
  await popup.close();

  console.log(`maj              ${banniere ? JSON.stringify(banniere.texte.trim()) : '(aucune banniere)'}`);
  if (!banniere)
    fails0.push('aucune banniere de mise a jour dans le popup alors que la release annonce v99.0.0');
  else {
    if (!banniere.texte.includes('99.0.0'))
      fails0.push(`la banniere n annonce pas la version publiee : ${JSON.stringify(banniere.texte)}`);
    // Depuis 2.12.3 une copie installee a la main est envoyee sur la fiche du
    // Chrome Web Store, d'ou elle se mettra a jour seule, plutot que sur un zip.
    if (!banniere.href.startsWith('https://chromewebstore.google.com/detail/kick-chat-translator/'))
      fails0.push(`la banniere ne mene pas a la fiche du store : ${banniere.href}`);
  }
  if (!vuParLeMoteur.includes('github'))
    fails0.push('la release GitHub n a jamais ete demandee : rien ne verifie les versions');

  // Depuis 2.12.4 l'icone de la barre d'outils porte la nouvelle aussi, lue ici
  // dans le vrai navigateur et pas dans un chrome simule.
  const badge = await sw.evaluate(async () => ({
    texte: await chrome.action.getBadgeText({}),
    fond: await chrome.action.getBadgeBackgroundColor({}),
  }));
  console.log(`badge            ${JSON.stringify(badge.texte)} sur rgba(${badge.fond.join(',')})`);
  if (badge.texte !== '↑') fails0.push(`l icone ne signale pas la mise a jour : badge ${JSON.stringify(badge.texte)}`);
  else if (badge.fond.slice(0, 3).join(',') !== '83,252,24') fails0.push(`badge d une autre couleur que le vert : ${badge.fond}`);
  // Ce mode ne juge pas la traduction.
  traductionVue = 'sans objet';
} else if (CACHE) {
  const REPETE = 'hola a todos como va la partida';
  await poserRangees([REPETE], 1);
  await page
    .waitForFunction(
      (src) =>
        [...document.querySelectorAll('#channel-chatroom [data-which="messages"] div[data-index]')]
          .some(
            (r) =>
              r.querySelector('.font-normal')?.textContent === src &&
              r.querySelector('.kt-translation, .kt-translation-inline, .kt-translation-replace'),
          ),
      REPETE,
      { timeout: 25000 },
    )
    .catch(() => {});
  const apresPremier = vuParLeMoteur.length;

  // Le meme texte, un autre lecteur.
  await page.evaluate((texte) => {
    const cible = document.querySelector('#channel-chatroom [data-which="messages"]');
    const ligne = document.createElement('div');
    ligne.setAttribute('data-index', '5');
    ligne.innerHTML =
      '<div class="w-full min-w-0 shrink-0">' +
      '<button class="font-bold" style="color: rgb(1,2,3)">otroquien</button>' +
      `<span class="font-normal">${texte}</span>` +
      '</div>';
    cible.appendChild(ligne);
  }, REPETE);
  await page.waitForTimeout(9000);
  rangees = await lireRangees();
  const apresSecond = vuParLeMoteur.length;

  const repetee = rangees.find((r) => r.index === '5');
  console.log(
    `cache            ${apresPremier} appel(s) pour le premier, ${apresSecond - apresPremier} pour le meme texte repete`,
  );
  if (apresPremier === 0) fails0.push('le premier message n a jamais atteint le moteur');
  if (apresSecond > apresPremier)
    fails0.push(
      `le meme texte a coute ${apresSecond - apresPremier} appel(s) de plus : aucun cache ne l a retenu`,
    );
  if (!repetee?.traductions.length)
    fails0.push('le message repete n a recu aucune traduction : le cache a mange l affichage');
  traductionVue = repetee?.traductions[0] ?? null;
} else if (SEVENTV) {
  // Une rangee rendue par 7TV : le texte ne vit que dans ses jetons, il n'y a
  // aucun `span.font-normal` a lire.
  const TEXTE = 'hola amigo que tal todo bien';
  await page.evaluate((texte) => {
    const cible = document.querySelector('#channel-chatroom [data-which="messages"]');
    const ligne = document.createElement('div');
    ligne.setAttribute('data-index', '7');
    ligne.innerHTML =
      '<div class="w-full min-w-0 shrink-0">' +
      '<button class="font-bold" style="color: rgb(1,2,3)">alguien</button>' +
      texte
        .split(' ')
        .map((mot) => `<span class="seventv-text-token">${mot}</span>`)
        .join(' ') +
      '</div>';
    cible.appendChild(ligne);
  }, TEXTE);
  await page.waitForTimeout(10000);
  rangees = await lireRangees();

  const demandes = ciblesDemandees.filter((c) => c.includes(TEXTE));
  const double = ciblesDemandees.some((c) => {
    const premier = c.indexOf(TEXTE);
    return premier !== -1 && c.indexOf(TEXTE, premier + 1) !== -1;
  });
  console.log(`7tv              ${demandes.length} requete(s) portant ce message, texte double : ${double}`);
  if (demandes.length === 0)
    fails0.push('le message 7TV n a jamais ete envoye au moteur : le contrat 7TV n est pas lu');
  if (double) fails0.push('le texte part en double dans une meme requete');
  const ligne7tv = rangees.find((r) => r.index === '7');
  if (!ligne7tv?.traductions.length) fails0.push('aucune traduction sous le message 7TV');
  traductionVue = ligne7tv?.traductions[0] ?? null;
} else if (REGLAGES) {
  await poserRangees([SOURCE]);
  // Attendre LA traduction de ce message, pas une traduction quelconque :
  // l'amorce est traduite en premier et sortait de l'attente trop tot, si bien
  // que la requete du message se rangeait dans le "apres" et brouillait la
  // lecture.
  await page
    .waitForFunction(
      (src) =>
        [...document.querySelectorAll('#channel-chatroom [data-which="messages"] div[data-index]')]
          .some(
            (r) =>
              r.querySelector('.font-normal')?.textContent === src &&
              r.querySelector('.kt-translation, .kt-translation-inline, .kt-translation-replace'),
          ),
      SOURCE,
      { timeout: 25000 },
    )
    .catch(() => {});
  const avant = [...ciblesDemandees];

  // Le geste du lecteur, pas une ecriture en stockage devinee : la barre de
  // l'extension est montee dans cette page, et `poserLangueCible` ouvre son
  // panneau, clique la langue, et relit l'etiquette du controle avant de rendre
  // la main. Ce qui est teste est donc le chemin complet, du clic jusqu'au
  // parametre `tl` recu par le moteur.
  const pose = await poserLangueCible(page, 'fr');
  if (!pose?.ok) fails0.push(`le panneau de langues n a pas pris le choix : ${JSON.stringify(pose)}`);
  await page.waitForTimeout(3000);

  // Index 2 et suivants : 1 porte deja le premier message, et `poserRangees`
  // saute les rangees existantes.
  await poserRangees(['otro mensaje distinto para probar', 'y uno mas para estar seguro'], 2);
  await page.waitForTimeout(10000);
  rangees = await lireRangees();
  const apres = ciblesDemandees.slice(avant.length);
  console.log(
    `reglages         cibles avant [${avant.map((c) => c.split('|')[0]).join(',')}], apres [${apres.map((c) => c.split('|')[0]).join(',')}]`,
  );
  if (apres.length === 0)
    fails0.push('apres le changement de langue, plus rien n a ete demande au moteur');
  else if (!apres.every((c) => c.split('|')[0] === 'fr'))
    fails0.push(
      `la nouvelle langue cible n a pas atteint la page : le moteur a recu [${apres.join(',')}] au lieu de fr`,
    );
  traductionVue =
    rangees.find((r) => r.source === 'otro mensaje distinto para probar')?.traductions[0] ?? null;
} else if (SURVOL) {
  await poserRangees([SOURCE]);
  // Rien ne doit partir tant que la souris n'est pas passee. C'est l'argument
  // de la fiche, mesure ici plutot que suppose.
  await page.waitForTimeout(6000);
  const appelsAvant = vuParLeMoteur.length;
  const arme = await page.evaluate(() => document.querySelectorAll('.kt-hover-armed').length);

  const ligne = page.locator('#channel-chatroom [data-which="messages"] div[data-index="1"]');
  await ligne.hover();
  // La garde attend HOVER_DWELL_MS avant de demander quoi que ce soit.
  await page.waitForTimeout(8000);
  rangees = await lireRangees();
  const appelsApres = vuParLeMoteur.length;
  console.log(
    `survol           ${arme} rangee(s) armee(s), ${appelsAvant} appel(s) avant, ${appelsApres} apres`,
  );
  if (arme === 0) fails0.push('aucune rangee armee : le mode survol n a pas pris');
  if (appelsAvant !== 0)
    fails0.push(`${appelsAvant} appel(s) au moteur avant tout survol : le mode ne fait pas d economie`);
  if (appelsApres <= appelsAvant)
    fails0.push('le survol n a declenche aucune traduction');
  traductionVue = rangees.find((r) => r.source === SOURCE)?.traductions[0] ?? null;
} else if (NAVIGATION) {
  await poserRangees([SOURCE]);
  await page.waitForSelector(SEL_TR, { timeout: 20000 }).catch(() => {});
  const avant = (await lireRangees()).reduce((n, r) => n + r.traductions.length, 0);

  // La navigation telle que le site la fait : l'URL bouge et le chat est remonte.
  await page.evaluate(() => {
    history.pushState({}, '', '/kt-autre-chaine');
    const ancien = document.querySelector('#channel-chatroom');
    const neuf = document.createElement('div');
    neuf.id = 'channel-chatroom';
    neuf.innerHTML =
      '<div class="no-scrollbar" data-which="decoy"></div>' +
      '<div class="no-scrollbar" data-which="messages" style="height:600px;overflow:auto">' +
      '<div data-index="0"><div class="w-full min-w-0 shrink-0">' +
      '<button class="font-bold" style="color: rgb(1,2,3)">autre</button>' +
      '<span class="font-normal">buenos dias a todos</span></div></div></div>';
    ancien.replaceWith(neuf);
  });
  await page.waitForTimeout(4000);

  await poserRangees(['adios amigos hasta la proxima vez']);
  await page.waitForTimeout(12000);
  rangees = await lireRangees();
  const apres = rangees.reduce((n, r) => n + r.traductions.length, 0);
  console.log(`navigation       ${avant} traductions avant, ${apres} apres sur ${rangees.length} rangees`);
  traductionVue =
    rangees.find((r) => r.source === 'adios amigos hasta la proxima vez')?.traductions[0] ?? null;
} else {
  await poserRangees([SOURCE]);
  try {
    await page.waitForSelector(SEL_TR, { timeout: 15000 });
    await page.waitForTimeout(1500);
  } catch {
    /* l assertion plus bas dira ce qui manque */
  }
  rangees = await lireRangees();
  traductionVue = rangees.find((r) => r.source === SOURCE)?.traductions[0] ?? null;
}

await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });

console.log(`content script   ${barreMontee ? 'injecte' : 'ABSENT'}`);
console.log(`moteurs appeles  ${vuParLeMoteur.join(', ') || '(aucun)'}`);
console.log(`traduction       ${traductionVue === null ? '(aucune)' : JSON.stringify(traductionVue)}`);
if (RECYCLAGE)
  console.log(
    `rangees          ${rangees.length}, portant ${rangees.reduce((n, r) => n + r.traductions.length, 0)} traductions`,
  );
if (!traductionVue && console_.length) {
  console.log('console de la page :');
  for (const l of console_.slice(-8)) console.log('  ' + l);
}

const fails = [...fails0];
if (!barreMontee) fails.push('le script de contenu ne s est pas execute');
if (!MAJ && !COMPOSE && !ESQUIVE && vuParLeMoteur.length === 0)
  fails.push('aucun moteur n a ete appele : rien n a traduit');
const attendu = BASCULE ? REPLI : TRADUIT;

if (RECYCLAGE) {
  // Les trois formes de la panne, telles que `live-recycle` les guette sur un
  // vrai chat : plus de traductions que de rangees pouvant en porter, une
  // rangee qui en porte deux, et une traduction posee sous un texte auquel elle
  // n appartient pas.
  const portees = rangees.reduce((n, r) => n + r.traductions.length, 0);
  if (portees > rangees.length)
    fails.push(`${portees} traductions pour ${rangees.length} rangees : il en reste des anciennes`);
  for (const r of rangees) {
    if (r.traductions.length > 1)
      fails.push(`la rangee ${r.index} porte ${r.traductions.length} traductions`);
    for (const t of r.traductions) {
      // Le faux moteur repond `MARQUE:<texte source>`, donc une traduction
      // correcte porte le texte de la rangee ou elle se trouve. Une perimee
      // porte celui du message que le virtualiseur a remplace.
      if (!t.includes(`${TRADUIT}:${r.source}`))
        fails.push(
          `traduction perimee sur la rangee ${r.index} : source ${JSON.stringify(r.source)}, ` +
            `traduction ${JSON.stringify(t)}`,
        );
    }
  }
  // Compter, pas seulement constater. Une premiere version n'echouait qu'a zero
  // et passait au vert sur une traduction pour neuf rangees, ce qui est
  // exactement la panne qu'elle etait censee voir.
  if (portees !== rangees.length)
    fails.push(
      `${portees} traductions pour ${rangees.length} rangees apres recyclage : ` +
        'les rangees reutilisees n ont pas ete retraduites',
    );
}
if (MAJ) {
  // rien de plus a dire sur la traduction dans ce mode
} else if (!RECYCLAGE && traductionVue === null)
  fails.push(
    NAVIGATION
      ? 'apres un changement de chaine, le message suivant n est plus traduit'
      : 'aucune traduction affichee sous le message',
  );
else if (!RECYCLAGE && !MAJ && !COMPOSE && !ESQUIVE && !OVERRIDE && !traductionVue.includes(attendu))
  fails.push(
    `la traduction affichee ne vient pas du moteur attendu (${attendu}) : ${JSON.stringify(traductionVue)}`,
  );
if (BASCULE) {
  if (!vuParLeMoteur.includes('google'))
    fails.push('le premier moteur n a jamais ete essaye : la bascule ne prouve rien');
  if (!vuParLeMoteur.includes('mymemory'))
    fails.push('le second moteur n a jamais ete appele apres le 429 du premier');
}

if (fails.length) {
  console.error('FAIL: ' + fails.join(' ; '));
  process.exit(1);
}
console.log(`translate-offline${BASCULE ? ' --bascule' : ''}${RECYCLAGE ? ' --recyclage' : ''}${NAVIGATION ? ' --navigation' : ''}${SURVOL ? ' --survol' : ''}${REGLAGES ? ' --reglages' : ''}${SEVENTV ? ' --seventv' : ''}${CACHE ? ' --cache' : ''}${MAJ ? ' --maj' : ''}${COMPOSE ? ' --compose' : ''}${ESQUIVE ? ' --esquive' : ''}${OVERRIDE ? ' --override' : ''}: OK`);
