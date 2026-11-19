/**
 * Kick's art direction, checked on the popup and the options page.
 *
 * `audit_da.py` covers the injected stylesheet and reports 0 deviations. It
 * reads `src/content/inject.css` and nothing else, so these two surfaces were
 * never checked at all, and it missed the largest deviation in the product:
 * Tailwind's `rounded-md` is 0.375rem, and 460 elements were drawing a 6px
 * radius on a direction that has two, 4 and 8.
 *
 * Computed styles, not source. Tailwind only becomes 6px at render time, so a
 * source scan cannot see this.
 *
 * The four absolutes, same as the stylesheet audit: no shadows, radii of 4 and
 * 8, transitions at 0.15s, type in whole pixels. Colours are deliberately not
 * audited, for the reason written in audit_da.py.
 *
 * Run after `node snapshot.mjs`:
 *   node test/e2e/da-surfaces.mjs
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

// 9999px is `rounded-full`: a pill or a knob, a shape rather than a step on the
// radius scale. Kick draws both.
const RADII_OK = new Set(['0px', '4px', '8px', '9999px', '50%']);
const DURATIONS_OK = new Set(['0s', '0.15s']);

/**
 * Three sizes on the Display tab are em-relative and come from inject.css: the
 * live chat preview reproduces the chat's own sizing, which is 0.9em of 0.85em
 * of the row. They are the chat's scale faithfully rendered, not the page's.
 */
const PREVIEW_CLASSES = ['kt-translation', 'kt-flag', 'kt-provider', 'kt-error', 'kt-retry'];

/**
 * Le drapeau est une image, pas une surface de l'interface.
 *
 * Depuis que les 43 drapeaux vivent dans src/shared/flags.css, la page
 * d'options les dessine aussi : 172 rayons de 2px et 43 liseres blancs
 * internes sont arrives d'un coup, et ni l'un ni l'autre n'est negociable.
 * Un rayon de 4px sur 16x12 arrondirait un rectangle national en pastille, et
 * le liseré est ce qui empeche un drapeau a fond blanc, JP ou FI, de
 * disparaitre sur la surface.
 *
 * Exemptes sur le rayon et l'ombre uniquement. Tout le reste de la page reste
 * mesure, et un drapeau qui prendrait une duree hors direction rougirait.
 */
const IMAGE_CLASSES = ['kt-flag'];

const browser = await chromium.launch();
const counts = { radii: new Map(), durations: new Map(), shadows: new Map(), sizes: new Map() };
const failures = [];
let elements = 0;

for (const [name, file] of SURFACES) {
  const page = await browser.newPage({ viewport: { width: 900, height: 1600 }, colorScheme: 'dark' });
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(250);

  const seen = await page.evaluate(({ previewClasses, imageClasses }) => {
    const out = { radii: [], durations: [], shadows: [], sizes: [], n: 0 };
    const inPreview = (el) => {
      for (let n = el; n; n = n.parentElement) {
        if (previewClasses.some((c) => n.classList?.contains(c))) return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      out.n += 1;
      const cs = getComputedStyle(el);
      const where = el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0];

      const estImage = imageClasses.some((c) => el.classList?.contains(c));

      for (const corner of [
        'borderTopLeftRadius',
        'borderTopRightRadius',
        'borderBottomLeftRadius',
        'borderBottomRightRadius',
      ]) {
        if (cs[corner] !== '0px' && !estImage) out.radii.push([cs[corner], where]);
      }
      for (const d of cs.transitionDuration.split(',').map((x) => x.trim())) {
        if (d) out.durations.push([d, where]);
      }
      if (cs.boxShadow && cs.boxShadow !== 'none' && !estImage)
        out.shadows.push([cs.boxShadow.slice(0, 50), where]);
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
        if (!inPreview(el)) out.sizes.push([cs.fontSize, where]);
      }
    }
    return out;
  }, { previewClasses: PREVIEW_CLASSES, imageClasses: IMAGE_CLASSES });
  await page.close();

  elements += seen.n;
  const tally = (map, rows) => {
    for (const [v, where] of rows) {
      const at = map.get(v) ?? { n: 0, where };
      at.n += 1;
      map.set(v, at);
    }
  };
  tally(counts.radii, seen.radii);
  tally(counts.durations, seen.durations);
  tally(counts.shadows, seen.shadows);
  tally(counts.sizes, seen.sizes);

  for (const [v, where] of seen.radii) {
    if (!RADII_OK.has(v)) failures.push(`${name}: rayon ${v} sur ${where}`);
  }
  for (const [v, where] of seen.durations) {
    if (!DURATIONS_OK.has(v)) failures.push(`${name}: duree ${v} sur ${where}`);
  }
  for (const [v, where] of seen.shadows) failures.push(`${name}: ombre ${v} sur ${where}`);
  for (const [v, where] of seen.sizes) {
    if (!/^\d+px$/.test(v)) failures.push(`${name}: taille fractionnaire ${v} sur ${where}`);
  }
}

await browser.close();

const top = (m) =>
  [...m]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([v, d]) => `${v} x${d.n}`)
    .join(', ');
console.log('rayons  :', top(counts.radii) || 'aucun');
console.log('durees  :', top(counts.durations) || 'aucune');
console.log('ombres  :', top(counts.shadows) || 'aucune');
console.log('tailles :', top(counts.sizes) || 'aucune');

// An empty page satisfies every check above.
if (elements < 300) {
  console.error(`da-surfaces: ${elements} elements lus, la sonde ne mesure rien`);
  process.exit(1);
}
if (failures.length) {
  // Grouped: 460 lines of the same radius teaches nothing.
  const grouped = new Map();
  for (const f of failures) {
    const key = f.replace(/ sur .*$/, '');
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  console.error();
  console.error(`da-surfaces: ${failures.length} ecart(s) a la direction artistique`);
  for (const [k, n] of [...grouped].sort((a, b) => b[1] - a[1])) console.error(`  x ${k} (x${n})`);
  process.exit(1);
}
console.log();
console.log(`da-surfaces: OK - ${elements} elements, 0 ecart.`);
