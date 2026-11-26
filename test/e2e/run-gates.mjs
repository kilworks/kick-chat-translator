/**
 * Runs the offline gates and reports what each one cost.
 *
 * They are independent but for one edge: four gates read the pages snapshot
 * writes and wait for it (see `apres` below). The five that bundle with
 * esbuild each own their own output file. Run in series they are
 * eighteen Chromium launches waiting on each other for no reason.
 *
 *   node test/e2e/run-gates.mjs              # all of them, pooled
 *   node test/e2e/run-gates.mjs --jobs 1     # the serial baseline
 *   node test/e2e/run-gates.mjs --only chip-live,rtl-live
 *   node test/e2e/run-gates.mjs --no-build
 *   node test/e2e/run-gates.mjs --headless   # sans ouvrir de fenetre (le CI)
 *
 * Exit code is the gates': non-zero if any of them failed. Nothing here pipes a
 * gate anywhere or chains it behind &&, which is how a script that threw an
 * exception once reported green.
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** Every offline gate, with what it runs. Live gates are deliberately absent:
    they open a browser onto kick.com and are launched by hand. */
const GATES = [
  ['snapshot', 'node', ['test/e2e/snapshot.mjs']],
  ['names', 'node', ['test/e2e/names.mjs'], { apres: 'snapshot' }],
  ['chip-live', 'node', ['test/e2e/chip-live.mjs']],
  ['chat-live', 'node', ['test/e2e/chat-live.mjs']],
  ['flag-surfaces', 'node', ['test/e2e/flag-surfaces.mjs']],
  ['measure-popup', 'node', ['test/e2e/measure-popup.mjs']],
  ['emote-survival', 'node', ['test/e2e/emote-survival.mjs']],
  ['bar-live', 'node', ['test/e2e/bar-live.mjs']],
  ['compose-live', 'node', ['test/e2e/compose-live.mjs']],
  ['rtl-live', 'node', ['test/e2e/rtl-live.mjs']],
  ['rtl-surfaces', 'node', ['test/e2e/rtl-surfaces.mjs'], { apres: 'snapshot' }],
  ['reduced-motion', 'node', ['test/e2e/reduced-motion.mjs']],
  ['long-content', 'node', ['test/e2e/long-content.mjs']],
  ['da-surfaces', 'node', ['test/e2e/da-surfaces.mjs'], { apres: 'snapshot' }],
  ['boundaries', 'node', ['test/e2e/boundaries.mjs'], { apres: 'snapshot' }],
  // Wired late. They existed and asserted and simply were not in this list, so
  // nothing ran them: bar-panel-live was reporting a panel 4px off the left of
  // the window, which turned out to be a real placement bug, for as long as it
  // sat outside. Three shooters stay out on purpose (flag-render,
  // lang-panel-shoot, probe-row-space): they draw images and print numbers for a
  // human and assert nothing, so adding them would buy runtime and no verdict.
  ['bar-panel-live', 'node', ['test/e2e/bar-panel-live.mjs']],
  // La barre flottante a dix largeurs. Elle n'etait dans aucun dump audite et
  // ses deux boutons vivaient sous 24x24 depuis toujours.
  ['bar-widths', 'node', ['test/e2e/bar-widths.mjs']],
  // DEUX DE PLUS SONT SORTIES, et pour les deux raisons deja ecrites plus haut.
  //
  // `flags-preview` dessine les drapeaux pour qu'on les REGARDE et n'asserte
  // rien : c'est le quatrieme shooter et il avait ete mis dans la liste par
  // inadvertance. Il y etait ECHEC sur tout clone frais, parce quil lisait un
  // `flags.css` que rien ne produit ; il lit maintenant la feuille livree et
  // tourne, a la main, quand on veut voir les drapeaux.
  //
  // `lang-panel-measure` ouvre `lang-panel.html`, une page que seule
  // `lang-panel-shoot` fabrique et que le depot ne contient pas. Les deux sont
  // donc dehors ensemble. Ce que cette porte mesurait, `bar-panel-live` le
  // mesure sur le vrai panneau et il est dans la liste.
  // La seule porte qui charge la vraie extension. Toutes les autres montent les
  // composants a la main et ne touchent jamais le manifeste ni le chemin par
  // lequel Chrome injecte. Elle ouvre une fenetre, parce que sans fenetre
  // l'extension n'est pas chargee du tout, et la pousse hors de l'ecran.
  ['extension-load', 'node', ['test/e2e/extension-load.mjs']],
  ['manual-start', 'node', ['test/e2e/manual-start.mjs']],
  // Le produit fait une seule chose et rien hors ligne ne la verifiait : un
  // message arrive, sa traduction apparait dessous. Meme fenetre hors ecran.
  ['translate-offline', 'node', ['test/e2e/translate-offline.mjs']],
  // La chaine de repli, qui garde la traduction vivante quand le premier moteur
  // limite le lecteur. Couverture propre, mesuree : tronquer la cascade a un
  // seul moteur dans `background/translator/index.ts` laisse les 620 tests verts
  // et fait rougir cette porte.
  ['translate-repli', 'node', ['test/e2e/translate-offline.mjs', '--bascule']],
  // Le recyclage de rangees du virtualiseur de Kick, provoque plutot qu'attendu.
  // A trouve un vrai defaut : les rangees reutilisees n'etaient jamais
  // retraduites, sans raison sur la ligne et sans appel au moteur.
  ['translate-recyclage', 'node', ['test/e2e/translate-offline.mjs', '--recyclage']],
  // Le changement de chaine, qui remonte le chat sans recharger la page. Si
  // l'extension ne se raccroche pas, la traduction s'arrete et rien ne le dit.
  // Couverture propre, mesuree : desactiver le rattachement au remontage laisse
  // les 621 tests verts et fait rougir cette porte.
  ['translate-navigation', 'node', ['test/e2e/translate-offline.mjs', '--navigation']],
  // La pause du bandeau est par chaine : elle ne doit ni deborder sur la
  // suivante ni se perdre au retour. Couverture propre, mesuree : sans le
  // rattrapage de route dans le rappel de l'observateur, le retour sur une
  // chaine en pause la retrouve traduite (ligne D) et cette porte rougit ; les
  // 39 autres restent vertes.
  ['nav-monde', 'node', ['test/e2e/nav-monde.mjs']],
  // Un onglet Kick ouvert pendant une mise a jour doit continuer de traduire,
  // avec une seule copie de chaque piece posee. Couverture propre, mesuree :
  // sans la reinjection de onInstalled, le message pose apres la mise a jour
  // n'est pas traduit et cette porte rougit. Le cas 3.0.1 vers ce build se lance
  // a la main avec KT_EXT_AVANT (le paquet publie, decompresse) : sans la marque
  // signee par instance, l'orphelin 3.0.1 marque les lignes avant le nouveau
  // script et il rougit aussi ; sans le nettoyage, le menu de langue est double.
  ['mise-a-jour', 'node', ['test/e2e/mise-a-jour.mjs']],
  // La meme mise a jour, avec la seconde injection que Firefox fait de lui-meme.
  ['mise-a-jour-firefox', 'node', ['test/e2e/mise-a-jour.mjs', '--firefox']],
  // Le mode survol, dont la fiche des stores fait un argument chiffre : environ
  // dix fois moins de consommation. L'argument ne tient que si rien ne part
  // avant que la souris passe. Couverture propre, mesuree : court-circuiter
  // l'armement laisse les 621 tests verts et fait rougir cette porte.
  ['translate-survol', 'node', ['test/e2e/translate-offline.mjs', '--survol']],
  // Choisir une langue dans la barre doit atteindre la page sans rechargement.
  // Couverture propre, mesuree : couper `pipeline.updateSettings` laisse les 621
  // tests verts et fait rougir cette porte.
  ['translate-reglages', 'node', ['test/e2e/translate-offline.mjs', '--reglages']],
  // Le second contrat DOM, celui d'une page ou 7TV rend le chat. Un test
  // unitaire couvre deja la preference elle-meme ; ce que cette porte ajoute est
  // la chaine complete sur une rangee dont le texte n'existe que dans les
  // jetons 7TV.
  ['translate-seventv', 'node', ['test/e2e/translate-offline.mjs', '--seventv']],
  // Les deux caches, qui sont ce qui fait tenir un quota gratuit. Couverture
  // propre, mesuree : un cache qui repond sans afficher laisse les 621 tests
  // verts et fait rougir cette porte, alors que toute repetition d'un message
  // n'afficherait plus rien.
  ['translate-cache', 'node', ['test/e2e/translate-offline.mjs', '--cache']],
  // Le trajet complet de la verification de version : le popup demande, le
  // service worker interroge GitHub, la banniere se dessine. Couverture propre,
  // mesuree : forcer la reponse du worker a "pas de mise a jour" laisse les 621
  // tests verts et fait rougir cette porte.
  ['translate-maj', 'node', ['test/e2e/translate-offline.mjs', '--maj']],
  // L'autre moitie du produit : ecrire une reponse et la voir dans la langue de
  // la chaine. Couverture propre, mesuree : ne jamais transmettre la langue de
  // la chaine laisse les 621 tests verts et fait rougir cette porte.
  ['translate-compose', 'node', ['test/e2e/translate-offline.mjs', '--compose']],
  // L'esquive des panneaux que Kick ouvre au-dessus du compositeur. Couverture
  // propre, mesuree : le calcul geometrique est teste unitairement, mais la
  // recherche de la superposition dans un vrai DOM ne l'etait pas, et la
  // desactiver laisse les 621 tests verts.
  ['translate-esquive', 'node', ['test/e2e/translate-offline.mjs', '--esquive']],
  // Le dictionnaire qui repond avant le reseau sur une expression courte visee
  // vers une ecriture non latine. Couverture propre, mesuree : rendre
  // `getSemanticOverride` muet laisse typecheck, lint et les 984 tests verts et
  // fait rougir cette porte sur ses deux moities, le mot parti au moteur et la
  // rangee portant l'epellation au lieu de la salutation.
  ['translate-override', 'node', ['test/e2e/translate-offline.mjs', '--override']],
  // Les quatre images des quatre READMEs. Elles sont generees, donc elles peuvent
  // perimer en silence : une refonte qui vide un panneau laisse les 1034 tests
  // verts et la page d'accueil du depot montrant un produit qui n'existe plus.
  // Cette porte ne compare pas les images commitees, elle verifie que le harnais
  // sait encore en produire de valides : chaque capture doit montrer son sujet,
  // au moins six traductions posees pour le chat, plus de dix rangees pour la
  // grille de langues, un apercu monte et non vide pour la composition. Elle
  // devient abordable maintenant que les portes tournent sans fenetre.
  ['captures-readme', 'node', ['test/e2e/store-shots-fixture.mjs']],
  ['audit-strings', 'python', ['test/audits/audit_content_strings.py']],
  ['audit-da', 'python', ['test/audits/audit_da.py']],
  ['audit-rtl', 'python', ['test/audits/audit_rtl.py']],
  ['audit-surfaces-rtl', 'python', ['test/audits/audit_surfaces_rtl.py']],
  // Selectors the harnesses query and the product can no longer emit. Cheap,
  // static, and it caught two assertions that had stopped being able to fail:
  // a count of a class deleted in 2.8.0, and a dead selector hidden behind a
  // `??` fallback that quietly did the work instead.
  ['audit-selecteurs', 'python', ['test/audits/audit_selecteurs.py']],
  // The one cost every reader pays on every page. It rose 12.5% in one version
  // and nobody saw it for three days, because nothing was looking.
  ['audit-poids', 'python', ['test/audits/audit_poids.py']],
  // La prose des tables, qui n'est pas couverte par la porte au-dessus : les
  // notes des rires pesaient 1754 octets, soit 0.85 pour cent, et la marge du
  // poids est de 2 pour cent, donc leur retour y passerait sans un mot.
  // Couverture propre, mesuree : une reference a `LAUGHTER_NOTES` depuis
  // `isLaughter` avec une CLE DYNAMIQUE fait rougir cette porte. Avec une cle
  // constante elle reste verte et c'est correct, esbuild replie l'acces.
  ['poids-notes', 'node', ['test/e2e/poids-notes.mjs']],
  // Les limites de champ des deux stores, plus les descriptions telles qu'elles
  // sont livrees dans `public/_locales`. Une soumission rejetee pour un champ
  // trop long se decouvre autrement une semaine plus tard.
  ['audit-fiche', 'python', ['test/audits/audit_fiche.py']],
];

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
/**
 * One worker per core, measured rather than guessed.
 *
 * On the six cores this was written on: 61.7s in series, 23.2s at three, 16.8s
 * at six, 17.7s at nine. Nine is slower than six on the clock AND burns 131.4s
 * of CPU against 87.7, so the knee sits exactly on the core count. Half the
 * cores, which is the cautious-looking default, leaves 6.4s on the table.
 *
 * 16.8s is within 1.9s of the floor, which is the longest single gate:
 * measure-popup loads the popup in all 43 languages and six states, 56.2s on
 * its own (2026-11-19; ten languages and 14.9s before).
 * Nothing above this line can go faster than that, so splitting the gates
 * themselves would buy seconds for real complexity.
 */
const rawJobs = flag('--jobs', Math.max(2, cpus().length));
const jobs = Number(rawJobs);
// `--jobs` with nothing after it made this NaN, which spawned no workers, ran no
// gates, and printed "0/0 portes vertes" on the way to exit 0. A runner that
// measures nothing has to say so, not read as good news.
if (!Number.isInteger(jobs) || jobs < 1) {
  console.error(`--jobs attend un entier >= 1, recu ${JSON.stringify(rawJobs)}`);
  process.exit(2);
}
const only = flag('--only', '')?.split(',').filter(Boolean) ?? [];

/**
 * `--headless` : les portes tournent sans ouvrir une seule fenetre.
 *
 * Mesure qui rend ce drapeau possible, sur le meme build et la meme page :
 * `--headless=new` charge l'extension et demarre le service worker, alors que
 * le `headless: true` de Playwright n'en charge aucun des deux. Le depot avait
 * conclu de ce second echec que le headless etait impossible ici, et ouvrait
 * donc une vraie fenetre poussee a -2400,-2400 a chaque porte.
 *
 * Le drapeau est passe aux enfants par l'environnement plutot que par la ligne
 * de commande : c'est `test/e2e/playwright.mjs` qui le lit, une fois,
 * pour les trente-neuf harnais a la fois.
 */
const sansFenetre = argv.includes('--headless');
const build = !argv.includes('--no-build');

const chosen = only.length ? GATES.filter(([n]) => only.includes(n)) : GATES;
if (only.length && chosen.length !== only.length) {
  const known = new Set(GATES.map(([n]) => n));
  const bad = only.filter((n) => !known.has(n));
  console.error('porte inconnue : ' + bad.join(', '));
  process.exit(2);
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, args, {
      cwd: ROOT,
      shell: process.platform === 'win32',
      env: sansFenetre ? { ...process.env, KT_HEADLESS: '1' } : process.env,
    });
    let out = '';
    child.stdout.on('data', (b) => (out += b));
    child.stderr.on('data', (b) => (out += b));
    child.on('close', (code) => resolve({ code: code ?? 1, ms: Date.now() - started, out }));
    child.on('error', (e) => resolve({ code: 1, ms: Date.now() - started, out: String(e) }));
  });
}

const t0 = Date.now();

if (build) {
  process.stdout.write('build ... ');
  const r = await run('npm', ['run', 'build']);
  console.log(`${(r.ms / 1000).toFixed(1)}s  ${r.code === 0 ? 'ok' : 'ECHEC'}`);
  if (r.code !== 0) {
    console.error(r.out.slice(-2000));
    process.exit(1);
  }
}

const tGates = Date.now();
const queue = [...chosen];
const results = [];

/**
 * Four gates are not independent after all: names, rtl-surfaces, da-surfaces
 * and boundaries open the popup.html and options/*.html that snapshot writes.
 * The pool handed them out before snapshot had finished, so on a fresh clone
 * they failed on a missing file, and on a used one they quietly measured the
 * previous build's pages. They now wait for it, and do not run on its failure.
 */
const fin = new Map();
for (const [name] of chosen) {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  fin.set(name, { promise, resolve, code: null });
}

async function worker() {
  for (;;) {
    const i = queue.findIndex(
      ([, , , o]) => !o?.apres || !fin.has(o.apres) || fin.get(o.apres).code !== null,
    );
    if (i === -1) {
      if (!queue.length) return;
      await Promise.race(queue.map(([, , , o]) => fin.get(o.apres).promise));
      continue;
    }
    const [name, cmd, args, o] = queue.splice(i, 1)[0];
    const dep = o?.apres && fin.get(o.apres);
    const r =
      dep && dep.code !== 0
        ? { code: 1, ms: 0, out: `${o.apres} a echoue, ses pages ne sont pas fiables` }
        : await run(cmd, args);
    fin.get(name).code = r.code;
    fin.get(name).resolve();
    results.push({ name, ...r });
    process.stdout.write(
      `${r.code === 0 ? 'ok  ' : 'ECHEC'} ${name.padEnd(19)} ${(r.ms / 1000).toFixed(1)}s\n`,
    );
  }
}

await Promise.all(Array.from({ length: Math.min(jobs, chosen.length) }, worker));

const wall = (Date.now() - tGates) / 1000;
const cpu = results.reduce((a, r) => a + r.ms, 0) / 1000;
const failed = results.filter((r) => r.code !== 0);

// The assertion this whole script owes: every gate asked for actually ran. A
// pool that spawns no worker, or one that drops a gate off the queue, otherwise
// reports a clean sweep of nothing.
if (results.length !== chosen.length) {
  console.error(
    `\n${results.length} portes executees sur ${chosen.length} demandees. Le pool en a perdu.`,
  );
  process.exit(2);
}

console.log();
console.log('les plus lentes :');
for (const r of [...results].sort((a, b) => b.ms - a.ms).slice(0, 5)) {
  console.log(`  ${r.name.padEnd(19)} ${(r.ms / 1000).toFixed(1)}s`);
}
console.log();
console.log(
  `${results.length - failed.length}/${results.length} portes vertes | ` +
    `${jobs} en parallele | horloge ${wall.toFixed(1)}s | cumul ${cpu.toFixed(1)}s | ` +
    `gain x${(cpu / wall).toFixed(2)}` +
    (build ? ` | + ${((tGates - t0) / 1000).toFixed(1)}s de build` : ''),
);

if (failed.length) {
  console.error();
  for (const r of failed) {
    console.error(`=== ${r.name} (code ${r.code}) ===`);
    console.error(r.out.trim().split('\n').slice(-14).join('\n'));
    console.error();
  }
  process.exit(1);
}
