/**
 * The floating bar, in all ten interface languages, at the width Kick gives it.
 *
 * The bar's labels were English constants until this round. Translating them
 * changed their length, and the panel did not get any wider: "Translating" is
 * eleven characters, and its Russian is "Идёт перевод", while the throttle
 * tooltip's Russian runs to forty-five. inject.css already says which control
 * gives when the row runs out of room, and this is what checks that the order
 * still holds instead of the gear falling off the end.
 *
 *   node test/e2e/bar-live.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from './playwright.mjs';
import { feuille } from './feuille.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
// Its own bundle. chat-live.mjs owns chat-bundle.js, and two harnesses writing
// one file is how a test ends up reading another test's code.
const BUNDLE = path.join(HERE, 'bar-bundle.js');

const esbuild = await import(pathToFileURL(path.join(ROOT, 'node_modules/esbuild/lib/main.js')).href);
// Re-exports both modules through one entry, because the bar reads its labels
// through msg() and the locale is set on msg(), not on the injector.
await esbuild.build({
  stdin: {
    contents:
      "export * from './src/content/injector';\nexport { setContentLocale } from './src/content/msg';\n",
    resolveDir: ROOT,
    sourcefile: 'bar-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  globalName: 'Injector',
  define: { __KT_METRICS__: 'false' },
  alias: { '~': path.join(ROOT, 'src') },
  outfile: BUNDLE,
});

const css = feuille();
const js = readFileSync(BUNDLE, 'utf8');

// The chat's own catalogue, not public/_locales, which is down to the store
// listing now. English is the fallback written at each call site and ships no
// file, so it is added back here by hand.
const LOCALES = [
  'en',
  ...readdirSync(path.join(ROOT, 'src/content/i18n'))
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .map((f) => f.replace(/\.ts$/, '')),
];

const PAGE = `<!doctype html>
<html lang="en" data-kt-scheme="dark"><head><meta charset="utf-8"><title>bar, live</title>
<style>${css}</style>
<style>
  body { margin:0; padding:12px; background:#0b0b0c; color:#fff; font:14px/1.45 system-ui, sans-serif; }
  #channel-chatroom { inline-size:340px; background:#171a1c; border-radius:8px; overflow:hidden; }
  .rows { min-block-size:40px; }
</style></head>
<body><div id="channel-chatroom"><div class="rows"></div></div><script>${js}</script></body></html>`;

const browser = await chromium.launch();
const report = [];

for (const charge of [false, true]) {
 for (const locale of LOCALES) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 2 });
  await page.setContent(PAGE);
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });

  const measured = await page.evaluate(
    ({ locale, dir, charge }) => {
      // The real catalogue, reached the way the extension reaches it. This used
      // to stand a fake chrome.i18n in front of the bar and hand it messages
      // parsed from disk, which measured the harness's own substitution rather
      // than the module's.
      window.Injector.setContentLocale(locale);
      document.documentElement.dir = dir;
      const host = document.getElementById('channel-chatroom');
      const settings = {
        enabled: true,
        targetLang: 'auto',
        displayStyle: 'below',
        showOriginal: true,
        showSourceBadge: true,
        showProviderBadge: false,
        showFloatingBar: true,
        // Real settings always carry the channel lists (zod defaults); the bar reads them (P1-7).
        blacklistChannels: [],
        whitelistChannels: [],
      };
      const { mountFloatingBar, updateFloatingBar, showThrottleIndicator, updateLocalChip } =
        window.Injector;
      mountFloatingBar(host.querySelector('.rows'), settings, {
        onToggle: () => undefined,
        onTargetLang: () => undefined,
        onOpenOptions: () => undefined,
        onEnableLocal: () => undefined,
      });
      updateFloatingBar(settings);
      // Two states, because they are not the same bar. The throttle indicator
      // only shows while the provider is rate-limiting, and the local-model chip
      // only while a model is on offer; turning both on at once is the worst
      // case, not the usual one, and reporting only that would condemn a bar
      // most people never see.
      if (charge) {
        showThrottleIndicator(true);
        updateLocalChip({ kind: 'download', label: '38 MB' });
      }

      const bar = host.querySelector('.kt-float');
      const br = bar.getBoundingClientRect();
      const kids = [...bar.children].filter((k) => k.getBoundingClientRect().width > 0);
      const outside = kids
        .filter((k) => {
          const r = k.getBoundingClientRect();
          return r.right > br.right + 0.5 || r.left < br.left - 0.5;
        })
        .map((k) => k.className);
      const label = bar.querySelector('.kt-float-label');
      // Centre to centre, not top to top. The first version compared tops, and
      // the bar centres an 8px dot against 24px buttons, so it reported every
      // language as wrapped, English included, while the bar sat at 34.4px in
      // all ten. A probe that fails on the control case is measuring itself.
      const mid = (el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      };
      return {
        largeurBarre: +br.width.toFixed(1),
        hauteurBarre: +br.height.toFixed(1),
        debordeHorizontal: bar.scrollWidth > Math.ceil(br.width),
        enfantsDehors: outside,
        surPlusieursLignes: kids.some((k) => Math.abs(mid(k) - mid(kids[0])) > 2),
        libelle: label.textContent,
        libelleLargeur: +label.clientWidth.toFixed(1),
        libelleVoulu: +label.scrollWidth.toFixed(1),
        libelleTronque: label.scrollWidth > label.clientWidth + 1,
        engrenagePresent: Boolean(bar.querySelector('.kt-float-opts')),
        pausePresente: Boolean(bar.querySelector('.kt-float-power')),
      };
    },
    { locale, dir: locale === 'ar' ? 'rtl' : 'ltr', charge },
  );

  await page.screenshot({ path: path.join(HERE, `bar-${locale}${charge ? '-charge' : ''}.png`) });
  if (locale === 'ru' || locale === 'en') {
    writeFileSync(
      path.join(HERE, `bar-${locale}${charge ? '-charge' : ''}.html`),
      await page.content(),
      'utf8',
    );
  }
  await page.close();
  report.push({ locale, charge, ...measured });
 }
}

await browser.close();
for (const r of report) {
  console.log(
    `${(r.charge ? 'charge' : 'normal').padEnd(7)}${r.locale.padEnd(3)} ${String(r.hauteurBarre).padStart(5)}px  ${
      r.debordeHorizontal ? 'DEBORDE' : 'ok     '
    }  ${r.surPlusieursLignes ? 'ENROULE' : 'une ligne'}  libelle ${String(r.libelleVoulu).padStart(
      5,
    )}/${String(r.libelleLargeur).padStart(5)}px ${r.libelleTronque ? 'TRONQUE' : '       '}  ${r.libelle}`,
  );
}

// inject.css states the order of what gives when the row runs out of room: the
// label first, then the language menu, and the gear and the pause button never.
// The gear is the only route from Kick to the options page.
const failures = [];
// English in the SAME state is the control. Comparing the loaded bar against the
// normal one condemned all ten languages for a difference the local-model chip
// makes, which English makes too.
const refHeight = (charge) =>
  report.find((r) => r.locale === 'en' && r.charge === charge).hauteurBarre;
for (const r of report) {
  const tag = r.locale + (r.charge ? '/charge' : '');
  if (r.debordeHorizontal) failures.push(`${tag}: la barre deborde horizontalement`);
  // The state word is the bar's whole job in its normal state. It may be
  // squeezed once the throttle indicator and the local chip are both up, which
  // is the case inject.css already says the label gives way in.
  if (!r.charge && r.libelleTronque) {
    failures.push(`${tag}: le libelle "${r.libelle}" a ${r.libelleLargeur}px pour ${r.libelleVoulu}`);
  }
  if (r.enfantsDehors.length) failures.push(`${tag}: hors barre -> ${r.enfantsDehors.join(', ')}`);
  if (r.surPlusieursLignes) failures.push(`${tag}: la barre passe sur deux lignes`);
  const ref = refHeight(r.charge);
  if (r.hauteurBarre > ref + 1) {
    failures.push(`${tag}: barre a ${r.hauteurBarre}px contre ${ref} pour l anglais au meme etat`);
  }
  if (!r.engrenagePresent) failures.push(`${tag}: l engrenage a disparu, plus d acces aux options`);
  if (!r.pausePresente) failures.push(`${tag}: le bouton pause a disparu`);
}
if (failures.length) {
  console.error();
  console.error('bar-live: ' + failures.length + ' echec(s)');
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}
console.log();
console.log(
  `bar-live: OK - ${report.length} langues, une seule ligne, engrenage et pause intacts.`,
);
