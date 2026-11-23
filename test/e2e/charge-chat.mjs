/**
 * Ce que l'extension coute a une page Kick pendant un chat rapide.
 *
 * Les autres portes disent si une ligne est traduite. Aucune ne disait a quel
 * prix pour la page : temps de script, recalculs de style, mises en page
 * forcees, tas JavaScript. Ce harnais rejoue un chat soutenu sur la fixture
 * hors ligne, deux fois, sans puis avec l'extension, et lit les compteurs du
 * moteur de rendu par CDP (`Performance.getMetrics`). Le script de contenu vit
 * dans le meme processus de rendu que la page, donc la difference entre les
 * deux passes est ce que l'extension ajoute.
 *
 * Le chat imite ce que fait le virtualiseur de Kick : une rangee
 * `div[data-index]` ajoutee par message, les plus anciennes retirees au-dela
 * d'une fenetre, et un compteur hors du chat mis a jour quatre fois par seconde
 * comme le reste d'une page vivante (lecteur video, spectateurs).
 *
 *   node test/e2e/charge-chat.mjs [--debit 20] [--duree 30] [--page 1000]
 *       [--echantillon 60] [--sans-temoin | --temoin-seul] [--json] [--sortie f.json]
 *       [--unique 0.6] [--recyclage] [--graine 1]
 *       [--latence 300] [--gigue 200] [--repli-latence 800] [--repli-gigue 400]
 *       [--rafale429 30/180] [--blocage 0.1:60] [--profil 180,1080]
 *   node test/e2e/charge-chat.mjs --live --decouvrir --sortie f.json
 *   node test/e2e/charge-chat.mjs --live --chaine <slug> [--temoin-seul | --sans-temoin]
 *       [--moteur-reel] [--cible fr] --duree 1200 --echantillon 60 [--profil 180,1080]
 *
 * Ce n'est pas une porte : les chiffres dependent de la machine. Il sert a
 * comparer deux builds sur la meme machine. The build under test is `KT_EXT`
 * (default `dist/`).
 *
 * Every engine the extension can call is answered here, and the browser cannot
 * resolve any other host, so nothing leaves the machine. A request that reaches
 * no route is counted and makes the pass invalid (exit 3), as does a page seen
 * hidden or an extension pass that translated nothing. With `--echantillon`,
 * a drift verdict compares the mean of samples 5 to 10 with the last 5: exit 1
 * when it is red.
 *
 * `--live` runs on kick.com, read only, in a fresh anonymous profile, off
 * screen but never headless (Kick does not load headless). `--decouvrir` ranks
 * five channels from /browse by chat lines a minute. A pass on one channel
 * answers the engines with the fake unless `--moteur-reel` (15 min at most:
 * Google blocks by IP). The chat's own lag is the time from a message's
 * WebSocket frame, read through CDP, to its row in the DOM. No channel name is
 * written anywhere but the `--sortie` file the caller chose.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from './playwright.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Resolved: Chromium reads a relative `--load-extension` against its own directory.
const EXT = path.resolve(process.env.KT_EXT ?? path.resolve(HERE, '../../dist'));
const brut = (nom) => {
  const i = process.argv.indexOf(nom);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const arg = (nom, def) => (brut(nom) === undefined ? def : Number(brut(nom)));
const DEBIT = arg('--debit', 20);
const DUREE = arg('--duree', 30);
const JSON_SEUL = process.argv.includes('--json');
const SANS_TEMOIN = process.argv.includes('--sans-temoin');
const TEMOIN_SEUL = process.argv.includes('--temoin-seul');
/** `--echantillon 60` : une ligne par minute, pour voir si le cout derive sur un long stream. */
const ECHANTILLON = arg('--echantillon', 0);
/** `--page 1000` : autant de blocs hors du chat, pour approcher la taille d'une vraie page Kick. */
const PAGE = arg('--page', 0);
/** Share of lines never seen before; the default keeps the old one in three. Repeats hit the tab cache. */
const UNIQUE = arg('--unique', 1 / 3);
/** A fixed pool of rows whose content and `data-index` are replaced, as Kick's virtualiser does. */
const RECYCLAGE = process.argv.includes('--recyclage');
const GRAINE = arg('--graine', 1);
const LATENCE = arg('--latence', 0);
const GIGUE = arg('--gigue', 0);
const REPLI_LATENCE = arg('--repli-latence', LATENCE);
const REPLI_GIGUE = arg('--repli-gigue', GIGUE);
/** `--rafale429 30/180` : Google answers 429 during the last 30 s of every 180 s. */
const [RAFALE_S, RAFALE_PERIODE] = (brut('--rafale429') ?? '0/0').split('/').map(Number);
/** `--blocage 0.1:60` : one engine call in ten hangs 60 s before it answers. */
const [BLOCAGE_P, BLOCAGE_S] = (brut('--blocage') ?? '0:0').split(':').map(Number);
/** `--profil 180,1080` : a 30 s CPU profile starting at each of these seconds of the run. */
const PROFILS = (brut('--profil') ?? '').split(',').filter(Boolean).map(Number);
const PROFIL_S = 30;
/** `--tas 300,1500`: heap snapshots at those seconds, diffed by constructor at the end. */
const TAS = (brut('--tas') ?? '').split(',').filter(Boolean).map(Number);
const SORTIE = brut('--sortie');
const LIVE = process.argv.includes('--live');
const DECOUVRIR = process.argv.includes('--decouvrir');
const CHAINE = brut('--chaine');
const MOTEUR_REEL = process.argv.includes('--moteur-reel');
/** `--cible fr`: the browser's language, which the extension takes as the reading language. */
const CIBLE = brut('--cible');
if (LIVE && !DECOUVRIR && !/^[a-zA-Z0-9_-]{2,25}$/.test(CHAINE ?? '')) {
  console.error('--live veut --chaine <slug> ou --decouvrir');
  process.exit(2);
}
// The real engine on this machine's IP: one short pass, never a long one.
if (MOTEUR_REEL && DUREE > 900) {
  console.error('--moteur-reel : 900 s au plus');
  process.exit(2);
}

const nombres = { DEBIT, DUREE, ECHANTILLON, PAGE, UNIQUE, GRAINE, LATENCE, GIGUE, REPLI_LATENCE, REPLI_GIGUE, RAFALE_S, RAFALE_PERIODE, BLOCAGE_P, BLOCAGE_S };
const fautifs = Object.entries(nombres).filter(([, v]) => !Number.isFinite(v)).map(([k]) => k);
if (fautifs.length || PROFILS.some((p) => !Number.isFinite(p))) {
  console.error(`arguments illisibles : ${[...fautifs, ...(PROFILS.some((p) => !Number.isFinite(p)) ? ['--profil'] : [])].join(', ')}`);
  process.exit(2);
}
if (!TEMOIN_SEUL && !fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error(`${EXT}/manifest.json absent. Lancer \`npm run build\` avant.`);
  process.exit(2);
}

const FIXTURE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>chat</title>
<style>body{background:#0b0e0f;color:#fff;margin:0} [data-index]{padding:2px 8px}</style></head>
<body>
  <div id="player"><span id="viewers">0</span> watching</div>
  <div id="channel-chatroom">
    <div class="no-scrollbar" data-which="decoy"></div>
    <div class="no-scrollbar" data-which="messages" style="height:600px;overflow:auto"></div>
    <div contenteditable="true" role="textbox" data-testid="chat-input" class="editor-input"
         style="min-height:40px;border:1px solid #333"></div>
  </div>
<script>
  const P = ${JSON.stringify({ unique: UNIQUE, recyclage: RECYCLAGE, graine: GRAINE })};
  const LIGNES = [
    'hola amigo que tal', 'que buen stream hoy', 'bonjour tout le monde', 'trop fort le mec',
    'wie geht es dir heute', 'das war ein krasser move', 'ciao a tutti ragazzi', 'che giocata incredibile',
    'olá pessoal tudo bem', 'que jogada absurda mano', 'привет всем как дела', 'это было очень круто',
    'merhaba arkadaşlar nasılsınız', 'bu oyun çok iyi', 'こんにちは皆さん', '今のプレイすごい',
    'lol', 'KEKW', 'gg', 'W', 'hello chat how are we doing', 'this stream is fire',
  ];
  const FENETRE = 80;
  // mulberry32: one seed, the same chat on every pass, so two builds see the same lines.
  let graine = P.graine >>> 0;
  const hasard = () => {
    graine = (graine + 0x6d2b79f5) >>> 0;
    let t = graine;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let n = 0;
  function ajouter() {
    const cible = document.querySelector('[data-which="messages"]');
    const i = n++;
    const base = LIGNES[i % LIGNES.length];
    // A unique line ends with its number, which is how the probes tell it from a repeat.
    const texte = hasard() < P.unique ? base + ' ' + i : base;
    const html =
      '<div class="w-full min-w-0 shrink-0">' +
      '<button class="font-bold" style="color: rgb(1,2,3)">user' + (i % 50) + '</button>' +
      '<span class="font-bold">: </span><span class="font-normal">' + texte + '</span></div>';
    if (P.recyclage && cible.children.length >= FENETRE) {
      // The virtualiser's move: the oldest row stays where it is and carries the next message.
      const ligne = cible.children[i % FENETRE];
      ligne.setAttribute('data-index', String(i));
      ligne.innerHTML = html;
    } else {
      const ligne = document.createElement('div');
      ligne.setAttribute('data-index', String(i));
      ligne.innerHTML = html;
      cible.appendChild(ligne);
      while (cible.children.length > FENETRE) cible.firstElementChild.remove();
    }
    cible.scrollTop = cible.scrollHeight;
  }
  // Le reste d'une page Kick : barre laterale, lecteur, recommandations. Des
  // milliers de noeuds hors du chat, que des regles CSS trop larges paient aussi.
  window.__remplir = (n) => {
    const hote = document.createElement('div');
    hote.id = 'remplissage';
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'card';
      d.innerHTML = '<div><span>chaine ' + i + '</span><div><span>titre</span></div></div>';
      hote.appendChild(d);
    }
    document.body.prepend(hote);
  };
  // A real chat queues what arrives while the page is busy. Every line is due
  // at a fixed time; a late tick adds all the overdue ones and records how late
  // each landed, which is this fixture's measure of a chat falling behind.
  window.__lancer = (debit, duree) => new Promise((fin) => {
    const t0 = performance.now();
    const total = Math.round(debit * duree);
    let faits = 0;
    const tick = () => {
      while (faits < total && t0 + (faits * 1000) / debit <= performance.now()) {
        const prevu = t0 + (faits * 1000) / debit;
        ajouter();
        faits++;
        window.__sonde?.retard(performance.now() - prevu);
      }
      if (faits >= total) {
        clearInterval(t);
        clearInterval(v);
        fin(n);
      }
    };
    const t = setInterval(tick, Math.max(4, Math.floor(1000 / debit)));
    const v = setInterval(() => { document.getElementById('viewers').textContent = String(Math.random()).slice(2, 7); }, 250);
  });
</script>
</body></html>`;

/** One key for a chat message, computed the same way from its WebSocket frame and from its row. */
const cleMessage = (u, t) => `${u}`.trim().toLowerCase() + '|' + `${t}`.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Main-world probe, installed by the harness rather than by the page or the
 * extension. It times each row from the moment its `data-index` first appears
 * to the moment a translation lands in it, counts long tasks, and drains on
 * each sample so nothing it holds grows with the session. On Kick it also keys
 * each new row for the WebSocket match, and counts the batches of body
 * mutations and of theme attribute changes that the extension's page-wide
 * observers wake on.
 */
const SONDE = `(() => {
  if (window.__sonde) return;
  const LIVE = ${LIVE};
  const cle = ${cleMessage.toString()};
  const S = { longues: [], latences: [], retards: [], tIns: new Map(), traduits: new Set(), barres: 0, rangees: 0, cible: null, inserees: [], corpsAppels: 0, corpsEnr: 0, themeAppels: 0, corps: null, chargements: 0 };
  window.__sonde = S;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) S.longues.push(e.duration); }).observe({ type: 'longtask' });
  } catch {}
  const TR = ['kt-translation', 'kt-translation-inline', 'kt-translation-replace'];
  const borne = (m) => { while (m.size > 5000) m.delete(m.keys().next().value); };
  // Kick caps its list and numbers rows again from the top: on Kick a
  // data-index comes back for another message, and every shown row changes
  // index at once. The key there is the message itself, name and text.
  const contenu = (r) => {
    const nom = r.querySelector('button[title]')?.getAttribute('title') ?? r.querySelector('button.font-bold')?.textContent ?? '';
    const texte = [...r.querySelectorAll('span.font-normal')]
      .filter((x) => !x.classList.contains('font-bold'))
      .map((x) => [...x.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''))
      .join(' ');
    return cle(nom, texte);
  };
  const cleRangee = (r) => {
    const d = r.getAttribute('data-index');
    return d === null ? null : LIVE ? contenu(r) : d;
  };
  const noter = (r) => {
    const d = cleRangee(r);
    if (d === null || S.tIns.has(d)) return;
    S.tIns.set(d, performance.now());
    S.rangees++;
    borne(S.tIns);
    if (LIVE) S.inserees.push({ k: d, at: Date.now() });
  };
  const traduite = (r) => {
    const d = r && cleRangee(r);
    if (d == null || S.traduits.has(d) || !S.tIns.has(d)) return;
    S.traduits.add(d);
    borne(S.traduits);
    S.latences.push(performance.now() - S.tIns.get(d));
  };
  const obs = new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === 'attributes') { noter(r.target); continue; }
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.id === 'kt-floating-bar') { S.barres++; continue; }
        // Each "…" put on a row is one height change Kick's list has to re-measure.
        if (n.classList.contains('kt-loading')) { S.chargements++; continue; }
        if (TR.some((c) => n.classList.contains(c))) { traduite(n.closest('[data-index]')); continue; }
        if (n.hasAttribute('data-index')) { noter(n); continue; }
        const r2 = r.target.closest ? r.target.closest('[data-index]') : null;
        if (r2) noter(r2);
      }
    }
  });
  const corpsObs = new MutationObserver((recs) => { S.corpsAppels++; S.corpsEnr += recs.length; });
  const themeObs = new MutationObserver(() => { S.themeAppels++; });
  setInterval(() => {
    // Kick can hold a hidden server-rendered copy first: take the shown panel with rows.
    const panneaux = [...document.querySelectorAll('#channel-chatroom')];
    const c = panneaux.find((p) => p.querySelector('[data-index]') && (!p.checkVisibility || p.checkVisibility())) ?? panneaux[0];
    if (c && c !== S.cible) {
      obs.disconnect();
      obs.observe(c, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-index'] });
      S.cible = c;
    }
    if (LIVE && document.body && document.body !== S.corps) {
      corpsObs.disconnect();
      themeObs.disconnect();
      corpsObs.observe(document.body, { childList: true, subtree: true });
      for (const t of [document.documentElement, document.body]) themeObs.observe(t, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
      S.corps = document.body;
    }
  }, 500);
  S.retard = (ms) => S.retards.push(ms);
  S.vider = () => {
    const out = {
      longues: S.longues.length,
      longuesMs: Math.round(S.longues.reduce((a, b) => a + b, 0)),
      longueMax: Math.round(S.longues.reduce((a, b) => Math.max(a, b), 0)),
      latences: S.latences.map(Math.round),
      retards: S.retards.map(Math.round),
      rangees: S.rangees,
      barres: S.barres,
      enAttente: document.querySelectorAll('.kt-loading').length,
      traductionsDom: document.querySelectorAll('.kt-translation, .kt-translation-inline, .kt-translation-replace').length,
      panneaux: document.querySelectorAll('#kt-float-lang-menu').length,
      chargements: S.chargements,
      visible: document.visibilityState,
    };
    if (LIVE) {
      // The chat's scroller: the first ancestor of a row that scrolls. Far from the bottom = Kick stopped following.
      let sc = document.querySelector('#channel-chatroom [data-index]')?.parentElement ?? null;
      while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      Object.assign(out, {
        inserees: S.inserees,
        corpsAppels: S.corpsAppels,
        corpsEnr: S.corpsEnr,
        themeAppels: S.themeAppels,
        distanceBas: sc && sc !== document.body ? Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight) : null,
      });
      S.inserees = []; S.corpsAppels = 0; S.corpsEnr = 0; S.themeAppels = 0;
    }
    S.longues = []; S.latences = []; S.retards = []; S.rangees = 0; S.barres = 0; S.chargements = 0;
    return out;
  };
})();`;

/**
 * Runs in the content script's own world, through CDP: counts what the page
 * sends the worker and how the worker answered, without touching the build.
 * A text that ends with a number is a fixture line seen once, so its sends
 * beyond the first are resends of the same row.
 *
 * It lives in the extension's heap, so it must not grow: a Map of every text
 * sent was the whole 2.2 MB "heap drift" of the first 30 min pass. Fixture
 * lines are counted by their number in an array sized up front, the shared
 * pool (a few hundred texts) in a Map, and on Kick no text is kept.
 */
const COMPTEUR = `(() => {
  if (globalThis.__ktSonde) return 'deja';
  const s = (globalThis.__ktSonde = { envois: 0, codes: {}, textes: new Map(), parNumero: new Uint8Array(${LIVE ? 0 : Math.ceil(DEBIT * DUREE) + 20000}) });
  const orig = chrome.runtime.sendMessage;
  const enveloppe = function (msg, ...rest) {
    if (msg && msg.type === 'translate' && msg.payload) {
      s.envois++;
      const t = msg.payload.text;
      const m = ${LIVE} ? null : / (\\d+)$/.exec(t);
      if (m && +m[1] < s.parNumero.length) s.parNumero[+m[1]] = Math.min(255, s.parNumero[+m[1]] + 1);
      else if (!${LIVE} && s.textes.size < 5000) s.textes.set(t, (s.textes.get(t) || 0) + 1);
      const k = rest.length - 1;
      if (k >= 0 && typeof rest[k] === 'function') {
        const cb = rest[k];
        rest[k] = (res) => {
          const code = !res ? 'sans-reponse' : res.type !== 'translate.result' ? res.type : res.payload && res.payload.ok === false ? (res.payload.error && res.payload.error.code) || 'erreur' : 'ok';
          s.codes[code] = (s.codes[code] || 0) + 1;
          return cb(res);
        };
      }
    }
    return orig.call(chrome.runtime, msg, ...rest);
  };
  try { chrome.runtime.sendMessage = enveloppe; } catch {}
  if (chrome.runtime.sendMessage !== enveloppe) Object.defineProperty(chrome.runtime, 'sendMessage', { value: enveloppe, configurable: true, writable: true });
  return chrome.runtime.sendMessage === enveloppe ? 'ok' : 'echec';
})()`;
const LIRE_COMPTEUR = `(() => {
  const s = globalThis.__ktSonde;
  if (!s) return null;
  let uniques = 0, envoisUniques = 0;
  for (const c of s.parNumero) if (c) { uniques++; envoisUniques += c; }
  return { envois: s.envois, distincts: s.textes.size + uniques, uniques, envoisUniques, codes: { ...s.codes } };
})()`;

const KICK = /^https?:\/\/(www\.)?kick\.com\//;
/** Every host the worker can send a chat line to. */
const MOTEURS = ['translate.googleapis.com', 'api.mymemory.translated.net', 'lingva.lunar.icu', 'api-free.deepl.com', 'api.deepl.com', 'www.google-analytics.com'];
const CLES = [
  'ScriptDuration',
  'TaskDuration',
  'RecalcStyleCount',
  'RecalcStyleDuration',
  'LayoutCount',
  'LayoutDuration',
  'JSHeapUsedSize',
  'Nodes',
  'JSEventListeners',
];
const attendre = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const centile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

/** Every engine the worker can reach, answered here with the latency and failures asked for. */
async function brancherMoteurs(ctx) {
  const c = { t0: null, googleGet: 0, googlePost: 0, lignesGoogle: 0, refus429: 0, bloques: 0, mymemory: 0, lingva: 0, deepl: 0, ga: 0, enVol: 0, enVolMax: 0, sorties: [] };
  const enRafale = () => RAFALE_PERIODE > 0 && c.t0 !== null && ((Date.now() - c.t0) / 1000) % RAFALE_PERIODE >= RAFALE_PERIODE - RAFALE_S;
  const servir = async (route, latence, gigue, reponse) => {
    c.enVol++;
    c.enVolMax = Math.max(c.enVolMax, c.enVol);
    try {
      if (BLOCAGE_P > 0 && Math.random() < BLOCAGE_P) {
        c.bloques++;
        await attendre(BLOCAGE_S * 1000);
      } else await attendre(latence + (Math.random() * 2 - 1) * gigue);
      // The extension may have given up on the call meanwhile: nothing left to answer.
      await route.fulfill(reponse()).catch(() => {});
    } finally {
      c.enVol--;
    }
  };
  const json = (corps) => () => ({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });

  // Registered first, so it runs last: whatever no route below claims. Not on
  // kick.com, where the page itself needs the network.
  if (!LIVE)
    await ctx.route('**/*', (route) => {
      c.sorties.push(route.request().url().slice(0, 120));
      return route.abort();
    });
  await ctx.route('**://translate.googleapis.com/**', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (enRafale()) {
      c.refus429++;
      return route.fulfill({ status: 429, contentType: 'text/plain', body: 'quota' });
    }
    if (req.method() === 'POST') {
      // translate_a/t, how google.ts sends a batch: one `q` per line in the body,
      // one answer per line, `[translation, detected]`, or the bare translation when `sl` is set.
      const lignes = new URLSearchParams(req.postData() ?? '').getAll('q');
      c.googlePost++;
      c.lignesGoogle += lignes.length;
      const sl = url.searchParams.get('sl');
      return servir(route, LATENCE, GIGUE, json(lignes.map((l) => (sl && sl !== 'auto' ? `TR:${l}` : [`TR:${l}`, 'es']))));
    }
    // translate_a/single: segments in data[0], detected source in data[2].
    const q = url.searchParams.get('q') ?? '';
    c.googleGet++;
    c.lignesGoogle += 1;
    const lignes = q.split('\n');
    const segments = lignes.map((l, k) => [`TR:${l}` + (k < lignes.length - 1 ? '\n' : ''), l, null, null, 10]);
    return servir(route, LATENCE, GIGUE, json([segments, null, 'es']));
  });
  await ctx.route('**://api.mymemory.translated.net/**', (route) => {
    c.mymemory++;
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    return servir(route, REPLI_LATENCE, REPLI_GIGUE, json({ responseData: { translatedText: `MM:${q}` }, responseStatus: 200, matches: [] }));
  });
  for (const hote of ['lingva.lunar.icu']) {
    await ctx.route(`**://${hote}/**`, (route) => {
      c.lingva++;
      const texte = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1) ?? '');
      return servir(route, REPLI_LATENCE, REPLI_GIGUE, json({ translation: `LV:${texte}`, info: { detectedSource: 'es' } }));
    });
  }
  for (const hote of ['api-free.deepl.com', 'api.deepl.com']) {
    await ctx.route(`**://${hote}/**`, (route) => {
      c.deepl++;
      return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"no key here"}' });
    });
  }
  await ctx.route('**://www.google-analytics.com/**', (route) => {
    c.ga++;
    return route.fulfill({ status: 204, body: '' });
  });
  await ctx.route('**://api.github.com/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"tag_name":"v0.0.1"}' }),
  );
  return c;
}

/** The content script's isolated world, found among the contexts CDP reports. */
async function mondeExtension(cdp) {
  const contextes = new Map();
  cdp.on('Runtime.executionContextCreated', (e) => contextes.set(e.context.id, e.context));
  cdp.on('Runtime.executionContextDestroyed', (e) => contextes.delete(e.executionContextId));
  await cdp.send('Runtime.enable');
  const trouver = () =>
    [...contextes.values()].find((x) => x.auxData?.type === 'isolated' && String(x.origin).startsWith('chrome-extension://'));
  for (let k = 0; k < 20 && !trouver(); k++) await attendre(100);
  const evaluer = async (expression) => {
    const monde = trouver();
    if (!monde) return { erreur: 'monde de l extension introuvable' };
    const r = await cdp.send('Runtime.evaluate', { expression, contextId: monde.id, returnByValue: true }).catch((e) => ({ exceptionDetails: { text: String(e) } }));
    return r.exceptionDetails ? { erreur: r.exceptionDetails.text } : { valeur: r.result.value };
  };
  return evaluer;
}

/** A CPU profile of the page's main thread: self time per script origin, top functions. */
async function profilCPU(cdp, depart) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await attendre(PROFIL_S * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  await cdp.send('Profiler.disable');
  return resumerProfil(profile, depart);
}

/** One heap snapshot of the renderer (page and extension worlds), summed by type and constructor. */
async function releveTas(cdp, t) {
  let brut = '';
  const lire = (e) => { brut += e.chunk; };
  cdp.on('HeapProfiler.addHeapSnapshotChunk', lire);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', lire);
  const snap = JSON.parse(brut);
  const champs = snap.snapshot.meta.node_fields;
  const types = snap.snapshot.meta.node_types[0];
  const n = champs.length;
  const [iT, iN, iS] = ['type', 'name', 'self_size'].map((f) => champs.indexOf(f));
  const parCle = new Map();
  for (let i = 0; i < snap.nodes.length; i += n) {
    const type = types[snap.nodes[i + iT]];
    const cle = /string|number|code|hidden|array|native/.test(type) ? `(${type})` : `${type}:${snap.strings[snap.nodes[i + iN]].slice(0, 60)}`;
    const e = parCle.get(cle) ?? { n: 0, o: 0 };
    e.n++;
    e.o += snap.nodes[i + iS];
    parCle.set(cle, e);
  }
  return { t, total: [...parCle.values()].reduce((a, e) => a + e.o, 0), parCle: Object.fromEntries(parCle) };
}

function diffTas(a, b) {
  const cles = new Set([...Object.keys(a.parCle), ...Object.keys(b.parCle)]);
  const lignes = [...cles].map((k) => {
    const x = a.parCle[k] ?? { n: 0, o: 0 };
    const y = b.parCle[k] ?? { n: 0, o: 0 };
    return { cle: k, dN: y.n - x.n, dKo: Math.round((y.o - x.o) / 102.4) / 10 };
  });
  lignes.sort((p, q) => q.dKo - p.dKo);
  return { de: a.t, a: b.t, totalKo: Math.round((b.total - a.total) / 1024), hausses: lignes.slice(0, 30), baisses: lignes.slice(-5) };
}

function resumerProfil(profile, depart) {
  const noeuds = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const e of n.children ?? []) parent.set(e, n.id);
  const propre = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    // The gap after a sample is the time that sample stands for.
    const dt = profile.timeDeltas[i + 1] ?? 0;
    propre.set(profile.samples[i], (propre.get(profile.samples[i]) ?? 0) + dt);
  }
  const SPECIAUX = ['(idle)', '(program)', '(garbage collector)', '(root)'];
  // Native frames carry no URL: their time goes to the nearest script frame that called them.
  const porteur = (id) => {
    for (let x = id; x !== undefined; x = parent.get(x)) if (noeuds.get(x).callFrame.url) return noeuds.get(x).callFrame;
    return null;
  };
  const categories = {};
  const fonctions = new Map();
  for (const [id, us] of propre) {
    const propreFrame = noeuds.get(id).callFrame;
    const f = SPECIAUX.includes(propreFrame.functionName) ? null : porteur(id);
    const cat = !f ? (SPECIAUX.includes(propreFrame.functionName) ? propreFrame.functionName : 'natif') : f.url.startsWith('chrome-extension://') ? 'extension' : 'page';
    categories[cat] = (categories[cat] ?? 0) + us;
    if (f) {
      const cle = `${f.functionName || '(anonyme)'} ${f.url.replace(/^chrome-extension:\/\/[a-z]+\//, 'ext/').replace(/^https?:\/\/[^/]+/, '')}:${f.lineNumber + 1}:${f.columnNumber + 1}`;
      fonctions.set(cle, (fonctions.get(cle) ?? 0) + us);
    }
  }
  const ms = (us) => Math.round(us / 1000);
  return {
    depart,
    secondes: PROFIL_S,
    categoriesMs: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, ms(v)])),
    top: [...fonctions].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([fonction, us]) => ({ fonction, ms: ms(us) })),
  };
}

/**
 * Kick's chat arrives over a WebSocket. Each chat frame is timed where CDP sees
 * it, before the page's main thread does anything with it, and matched later to
 * the row it became: the gap is the chat's own lag, the "buffer" a reader sees.
 */
function suivreWebSocket(cdp) {
  const enAttente = new Map();
  let decalage = null;
  let trames = 0;
  let messages = 0;
  cdp.on('Network.requestWillBeSent', (e) => {
    // CDP stamps frames on a monotonic clock; one request gives its offset to wall time.
    if (decalage === null && e.wallTime) decalage = e.wallTime * 1000 - e.timestamp * 1000;
  });
  cdp.on('Network.webSocketFrameReceived', (e) => {
    trames++;
    const brut = e.response?.payloadData;
    if (!brut || !brut.includes('ChatMessageEvent')) return;
    const at = decalage === null ? Date.now() : e.timestamp * 1000 + decalage;
    // Pusher sends one event a frame; Kick's realtime service (Centrifugo) can
    // batch several pushes in one frame, one JSON object a line.
    for (const ligne of brut.split('\n')) {
      let j;
      try {
        j = JSON.parse(ligne);
      } catch {
        continue;
      }
      const ev = j.push?.pub?.data ?? j;
      if (!`${ev?.event ?? ''}`.includes('ChatMessageEvent')) continue;
      let d = ev.data;
      try {
        if (typeof d === 'string') d = JSON.parse(d);
      } catch {
        continue;
      }
      if (typeof d?.sender?.username !== 'string' || typeof d?.content !== 'string') continue;
      messages++;
      const k = cleMessage(d.sender.username, d.content.replace(/\[emote:\d+:[^\]]*\]/g, ' '));
      if (!enAttente.has(k)) enAttente.set(k, []);
      enAttente.get(k).push(at);
    }
  });
  return {
    apparier(inserees) {
      const retards = [];
      let sansPaire = 0;
      for (const { k, at } of inserees) {
        const file = enAttente.get(k);
        if (!file?.length) {
          sansPaire++;
          continue;
        }
        retards.push(Math.round(at - file.shift()));
        if (!file.length) enAttente.delete(k);
      }
      // A frame whose row never came (filtered, deleted, missed) is forgotten after 30 s.
      const limite = Date.now() - 30_000;
      for (const [k, file] of enAttente) {
        while (file.length && file[0] < limite) file.shift();
        if (!file.length) enAttente.delete(k);
      }
      return { retards, sansPaire };
    },
    etat: () => ({ trames, messages, horloge: decalage !== null }),
  };
}

const CLES_DERIVE = ['tasMB', 'noeuds', 'ecouteurs', 'scriptMsParS', 'tacheMsParS', 'latenceP95', 'enAttente'];
const COMPTES = new Set(['noeuds', 'ecouteurs', 'enAttente']);

/**
 * Drift: mean of samples 5 to 10 against the mean of the last 5, at most +10 %
 * (+2 for a count under 20). Samples that carried a CPU profile are left out,
 * the profiler costs script time. A pass that translated nothing is never green.
 */
function verdictDerive(tranches, avecTraduction) {
  if (tranches.length < 15) return { ok: null, raison: `${tranches.length} echantillons, il en faut 15` };
  const fenetre = (de, a) => tranches.slice(de - 1, a).filter((t) => !t.profil);
  const A = fenetre(5, 10);
  const B = fenetre(tranches.length - 4, tranches.length);
  const moyenne = (xs, k) => {
    const v = xs.map((t) => t[k]).filter((x) => typeof x === 'number');
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };
  const cles = [...(avecTraduction ? CLES_DERIVE : CLES_DERIVE.slice(0, 5)), ...(LIVE ? ['retardP95'] : [])];
  const lignes = cles.map((cle) => {
    const a = moyenne(A, cle);
    const b = moyenne(B, cle);
    if (a === null || b === null) return { cle, a, b, ok: null };
    const limite = COMPTES.has(cle) && a < 20 ? a + 2 : a * 1.1;
    return { cle, a: +a.toFixed(2), b: +b.toFixed(2), ecartPct: a ? +((100 * (b - a)) / a).toFixed(1) : null, limite: +limite.toFixed(2), ok: b <= limite };
  });
  const traduites = tranches.reduce((s, t) => s + (t.traduites ?? 0), 0);
  if (avecTraduction && traduites === 0) return { ok: false, raison: 'rien traduit', lignes };
  return { ok: lignes.every((l) => l.ok !== false), fenetres: [`5-10`, `${tranches.length - 4}-${tranches.length}`], lignes };
}

async function passe(avecExtension) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-charge-'));
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--window-position=-2400,-2400',
    // Off screen must not read as hidden: with pauseWhenHidden the extension would translate nothing.
    '--disable-backgrounding-occluded-windows',
    '--disable-features=CalculateNativeWinOcclusion',
  ];
  // What no route answers fails to resolve instead of leaving the machine: every
  // host offline, the engines only on kick.com, nothing with the real engine.
  if (!LIVE) args.push('--host-resolver-rules=MAP * ~NOTFOUND');
  else if (!MOTEUR_REEL) args.push(`--host-resolver-rules=${MOTEURS.map((h) => `MAP ${h} ~NOTFOUND`).join(', ')}`);
  if (CIBLE) args.push(`--lang=${CIBLE}`);
  if (avecExtension) args.push(`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`);
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1200, height: 800 },
    ...(CIBLE ? { locale: CIBLE } : {}),
    args,
  });
  const moteur = LIVE && MOTEUR_REEL ? { t0: null, googleGet: 0, googlePost: 0, lignesGoogle: 0, refus429: 0, bloques: 0, mymemory: 0, lingva: 0, deepl: 0, ga: 0, enVol: 0, enVolMax: 0, sorties: [] } : await brancherMoteurs(ctx);
  if (!LIVE) await ctx.route(KICK, async (route) => {
    const req = route.request();
    if (req.resourceType() === 'document')
      return route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE });
    if (req.url().includes('/api/'))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ chatroom: { id: 1 }, livestream: { lang_iso: 'es' } }),
      });
    return route.fulfill({ status: 204, body: '' });
  });
  await ctx.addInitScript(SONDE);

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  let cdp = null;
  let ws = null;
  if (LIVE) {
    // Before the page opens its socket, so every chat frame is seen.
    cdp = await ctx.newCDPSession(page);
    ws = suivreWebSocket(cdp);
    await cdp.send('Network.enable');
    await page.goto(`https://kick.com/${CHAINE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#channel-chatroom [data-index]', { state: 'attached', timeout: 60000 });
  } else await page.goto('https://kick.com/kt-charge', { waitUntil: 'domcontentloaded' });
  if (avecExtension) {
    await page.waitForSelector('#kt-inject-style', { state: 'attached', timeout: 15000 });
  }
  const invalide = [];
  const visibilite = await page.evaluate(() => document.visibilityState);
  if (visibilite !== 'visible') invalide.push(`page ${visibilite} au depart`);
  if (LIVE) await page.waitForTimeout(10000);
  else {
    if (PAGE) await page.evaluate((n) => window.__remplir(n), PAGE);
    // Une rangee pour que l'observateur s'accroche, puis le calme.
    await page.evaluate(() => window.__lancer(10, 0.5));
    await page.waitForTimeout(2500);
    cdp = await ctx.newCDPSession(page);
  }
  let compteur = null;
  if (avecExtension) {
    compteur = await mondeExtension(cdp);
    const pose = await compteur(COMPTEUR);
    if (pose.valeur !== 'ok') invalide.push(`compteur d envois non pose : ${JSON.stringify(pose)}`);
  }
  const sw = avecExtension ? (ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 20000 }).catch(() => null))) : null;
  const lireMetriques = async () => {
    const w = ctx.serviceWorkers().at(-1) ?? sw;
    if (!w) return null;
    return w
      .evaluate(async () => {
        const o = await chrome.storage.local.get(['kt.metrics.v1.sw', 'kt.metrics.v1.content']);
        const sw = o['kt.metrics.v1.sw'];
        const content = o['kt.metrics.v1.content'];
        return sw || content ? { sw: sw?.counts ?? null, content: content?.counts ?? null } : null;
      })
      .catch(() => null);
  };
  // Metrics builds only: the counters start from this point, not from the warm-up.
  if (sw) await sw.evaluate(async () => chrome.storage.local.remove(['kt.metrics.v1.sw', 'kt.metrics.v1.content'])).catch(() => {});
  await page.evaluate(() => window.__sonde.vider());

  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const lire = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const avant = await lire();
  const t0 = Date.now();
  moteur.t0 = t0;
  const tranches = [];
  const profils = [];
  const releves = [];
  let profilSuivant = false;
  const lancer = LIVE ? attendre(DUREE * 1000).then(() => null) : page.evaluate(([d, s]) => window.__lancer(d, s), [DEBIT, DUREE]);
  if (ECHANTILLON) {
    let prec = avant;
    let tPrec = t0;
    let mPrec = { ...moteur };
    for (let k = 1; k * ECHANTILLON <= DUREE; k++) {
      // A sample right after a heap snapshot carries its cost: excluded like a profiled one.
      let profil = profilSuivant;
      profilSuivant = false;
      for (const p of PROFILS) {
        if (p >= (k - 1) * ECHANTILLON && p < k * ECHANTILLON) {
          await attendre(t0 + p * 1000 - Date.now());
          profils.push(await profilCPU(cdp, p));
          profil = true;
        }
      }
      await attendre(t0 + k * ECHANTILLON * 1000 - Date.now());
      await cdp.send('HeapProfiler.collectGarbage');
      const m = await lire();
      // After the sample's metrics, so the snapshot's own cost lands on the next one.
      if (TAS.some((x) => x > (k - 1) * ECHANTILLON && x <= k * ECHANTILLON)) {
        releves.push(await releveTas(cdp, k * ECHANTILLON));
        profilSuivant = true;
      }
      const s = await page.evaluate(() => window.__sonde.vider());
      const maintenant = Date.now();
      const dt = (maintenant - tPrec) / 1000;
      const delta = (cle) => moteur[cle] - mPrec[cle];
      const envois = compteur ? await compteur(LIRE_COMPTEUR) : null;
      // On Kick the lag is the chat's own, frame to row; on the fixture, schedule to row.
      const paires = LIVE ? ws.apparier(s.inserees) : null;
      if (paires) s.retards = paires.retards;
      const tranche = {
        t: Math.round((maintenant - t0) / 1000),
        profil,
        scriptMsParS: Math.round(((m.ScriptDuration - prec.ScriptDuration) * 1000) / dt),
        tacheMsParS: Math.round(((m.TaskDuration - prec.TaskDuration) * 1000) / dt),
        layoutsParS: Math.round((m.LayoutCount - prec.LayoutCount) / dt),
        stylesParS: Math.round((m.RecalcStyleCount - prec.RecalcStyleCount) / dt),
        tasMB: +(m.JSHeapUsedSize / 1048576).toFixed(2),
        noeuds: m.Nodes,
        ecouteurs: m.JSEventListeners,
        longues: s.longues,
        longuesMs: s.longuesMs,
        longueMax: s.longueMax,
        traduites: s.latences.length,
        latenceP50: centile(s.latences, 0.5),
        latenceP95: centile(s.latences, 0.95),
        retardP50: centile(s.retards, 0.5),
        retardP95: centile(s.retards, 0.95),
        retardMax: s.retards.length ? Math.max(...s.retards) : null,
        rangees: s.rangees,
        enAttente: s.enAttente,
        traductionsDom: s.traductionsDom,
        panneaux: s.panneaux,
        chargements: s.chargements,
        barres: s.barres,
        visible: s.visible,
        ...(LIVE
          ? { sansPaire: paires.sansPaire, corpsAppels: s.corpsAppels, corpsEnr: s.corpsEnr, themeAppels: s.themeAppels, distanceBas: s.distanceBas, ws: ws.etat() }
          : {}),
        moteur: {
          googleGet: delta('googleGet'),
          googlePost: delta('googlePost'),
          lignesGoogle: delta('lignesGoogle'),
          refus429: delta('refus429'),
          bloques: delta('bloques'),
          mymemory: delta('mymemory'),
          lingva: delta('lingva'),
          deepl: delta('deepl'),
          enVolMax: moteur.enVolMax,
        },
        envois: envois?.valeur ?? envois?.erreur ?? null,
        metriques: avecExtension ? await lireMetriques() : null,
      };
      moteur.enVolMax = moteur.enVol;
      if (s.visible !== 'visible') invalide.push(`page ${s.visible} a t=${tranche.t}`);
      tranches.push(tranche);
      if (!JSON_SEUL) console.log(JSON.stringify({ ...tranche, metriques: undefined }));
      prec = m;
      tPrec = maintenant;
      mPrec = { ...moteur };
    }
  }
  const messages = (await lancer) ?? tranches.reduce((n, t) => n + t.rangees, 0);
  if (LIVE && ECHANTILLON && !tranches.some((t) => t.retardP50 !== null)) invalide.push(`retard du chat non mesure : ${JSON.stringify(ws.etat())}`);
  await page.waitForTimeout(1500);
  await cdp.send('HeapProfiler.collectGarbage');
  const apres = await lire();
  const traduites = await page.evaluate(() => document.querySelectorAll('.kt-translation, .kt-translation-inline, .kt-translation-replace').length);
  const envoisFin = compteur ? await compteur(LIRE_COMPTEUR) : null;
  const metriquesFin = avecExtension ? await lireMetriques() : null;
  await ctx.close();
  fs.rmSync(profile, { recursive: true, force: true });

  if (moteur.sorties.length) invalide.push(`${moteur.sorties.length} requete(s) sans route : ${[...new Set(moteur.sorties)].slice(0, 3).join(' ')}`);
  const vues = tranches.reduce((s, t) => s + t.traduites, 0);
  if (avecExtension && traduites === 0 && vues === 0) invalide.push('rien traduit');
  const delta = {};
  for (const k of CLES) delta[k] = k === 'JSHeapUsedSize' || k === 'Nodes' || k === 'JSEventListeners' ? apres[k] : apres[k] - avant[k];
  const { t0: _t0, enVol: _enVol, enVolMax: _max, sorties, ...appels } = moteur;
  return {
    messages,
    appels: moteur.googleGet + moteur.googlePost + moteur.mymemory + moteur.lingva + moteur.deepl,
    moteur: appels,
    sorties: sorties.length,
    traduites,
    ...delta,
    envois: envoisFin?.valeur ?? envoisFin?.erreur ?? null,
    metriques: metriquesFin,
    tranches,
    profils,
    tas: releves.length >= 2 ? diffTas(releves[0], releves[releves.length - 1]) : null,
    verdict: ECHANTILLON ? verdictDerive(tranches, avecExtension) : null,
    chaine: LIVE ? CHAINE : undefined,
    invalide,
  };
}

/** The busiest of five channels from /browse, by chat lines in 60 s, without the extension. */
async function decouvrir() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-decouvre-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1200, height: 800 },
    args: ['--no-first-run', '--no-default-browser-check', '--window-position=-2400,-2400', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion'],
  });
  await ctx.addInitScript(SONDE);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('https://kick.com/browse', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(7000);
  // Kick's own live listing, busiest first; the page's links only if it fails.
  const parAudience = await page.evaluate(async () => {
    try {
      const r = await fetch('/stream/livestreams/en?page=1&limit=24&sort=desc');
      const j = await r.json();
      return (j.data ?? []).map((d) => d.channel?.slug).filter((x) => typeof x === 'string').map((x) => '/' + x);
    } catch {
      return [];
    }
  });
  const liens = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('a[href^="/"]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => /^\/[a-zA-Z0-9_-]{3,25}$/.test(h))
        .filter((h) => !/^\/(browse|following|categories|search|about|help|login|signup|clips|home|subscriptions)$/.test(h)),
    ),
  ]);
  const chaines = parAudience.length ? parAudience : liens;
  const mesures = [];
  for (const c of chaines.slice(0, 5)) {
    await page.goto('https://kick.com' + c, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(15000);
    await page.evaluate(() => window.__sonde?.vider());
    await page.waitForTimeout(60000);
    const s = await page.evaluate(() => window.__sonde?.vider() ?? { rangees: 0 });
    mesures.push({ chaine: c.slice(1), lignesParMinute: s.rangees });
    if (!JSON_SEUL) console.log(`  candidate ${mesures.length} : ${s.rangees} lignes en 60 s`);
  }
  await ctx.close();
  fs.rmSync(profile, { recursive: true, force: true });
  mesures.sort((a, b) => b.lignesParMinute - a.lignesParMinute);
  if (SORTIE) {
    fs.mkdirSync(path.dirname(path.resolve(SORTIE)), { recursive: true });
    fs.writeFileSync(SORTIE, JSON.stringify({ mesures, meilleure: mesures[0] ?? null }, null, 1));
  }
  if (!mesures.length || mesures[0].lignesParMinute === 0) {
    console.error(`decouverte : ${chaines.length} chaines trouvees, aucune ligne de chat mesuree`);
    process.exit(3);
  }
  console.log(`decouverte : meilleure a ${mesures[0].lignesParMinute} lignes par minute${SORTIE ? `, nom dans ${SORTIE}` : ''}`);
  process.exit(0);
}
if (DECOUVRIR) await decouvrir();

const temoin = SANS_TEMOIN ? null : await passe(false);
const ext = TEMOIN_SEUL ? null : await passe(true);
const resultat = {
  params: { ext: TEMOIN_SEUL ? null : EXT, debit: DEBIT, duree: DUREE, page: PAGE, echantillon: ECHANTILLON, unique: UNIQUE, recyclage: RECYCLAGE, graine: GRAINE, latence: LATENCE, gigue: GIGUE, repliLatence: REPLI_LATENCE, repliGigue: REPLI_GIGUE, rafale429: [RAFALE_S, RAFALE_PERIODE], blocage: [BLOCAGE_P, BLOCAGE_S], profils: PROFILS, tas: TAS },
  temoin,
  ext,
};
if (SORTIE) {
  fs.mkdirSync(path.dirname(path.resolve(SORTIE)), { recursive: true });
  fs.writeFileSync(SORTIE, JSON.stringify(resultat, null, 1));
}

const fmt = (k, v) =>
  k.endsWith('Duration') ? `${(v * 1000).toFixed(0)} ms` : k === 'JSHeapUsedSize' ? `${(v / 1048576).toFixed(2)} MB` : String(Math.round(v));
if (JSON_SEUL) {
  console.log(JSON.stringify({ debit: DEBIT, duree: DUREE, temoin, ext }));
} else {
  const p = ext ?? temoin;
  console.log(`chat ${DEBIT} msg/s pendant ${DUREE} s, ${p.messages} messages, ${p.traduites} traductions visibles, ${p.appels} appels moteur (${JSON.stringify(p.moteur)}), envois ${JSON.stringify(p.envois)}`);
  console.log(`${'compteur'.padEnd(22)}${'sans ext'.padStart(12)}${'avec ext'.padStart(12)}${'surcout'.padStart(12)}`);
  for (const k of CLES) {
    const a = temoin?.[k] ?? 0;
    const b = ext?.[k];
    console.log(`${k.padEnd(22)}${(temoin ? fmt(k, a) : '-').padStart(12)}${(ext ? fmt(k, b) : '-').padStart(12)}${(temoin && ext ? fmt(k, b - a) : '-').padStart(12)}`);
  }
  for (const [nom, r] of [['temoin', temoin], ['ext', ext]]) {
    if (!r?.verdict) continue;
    console.log(`derive ${nom} : ${r.verdict.ok === null ? 'non calculee' : r.verdict.ok ? 'VERTE' : 'ROUGE'}${r.verdict.raison ? ` (${r.verdict.raison})` : ''}`);
    for (const l of r.verdict.lignes ?? []) console.log(`  ${l.cle.padEnd(14)} ${String(l.a).padStart(10)} -> ${String(l.b).padStart(10)}  ${l.ecartPct ?? '-'} %  ${l.ok === null ? '-' : l.ok ? 'ok' : 'DERIVE'}`);
  }
  for (const r of [temoin, ext]) if (r?.invalide.length) console.log(`PASSE INVALIDE : ${r.invalide.join(' ; ')}`);
}
const invalide = [temoin, ext].some((r) => r?.invalide.length);
const rouge = [ext].some((r) => r?.verdict?.ok === false);
process.exit(invalide ? 3 : rouge ? 1 : 0);
