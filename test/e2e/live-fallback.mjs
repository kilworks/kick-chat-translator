/**
 * The fallback chain, against real failures.
 *
 * The error path and the retry control had only ever run against a harness
 * calling showError() by hand. Nothing had made a provider actually fail.
 *
 * Providers are killed at the RESOLVER, with --host-resolver-rules, and that
 * choice was paid for twice. The first version routed with page.route and
 * measured nothing: in MV3 the translation requests leave from the service
 * worker, and page routing never sees them. Counted on a live channel, the
 * context saw 16 provider requests where the page saw 2. context.route reaches
 * some of them and not all: 1 abort for 4 requests in the same measurement.
 * Mapping the host to a dead address covers everything the browser does, worker
 * included, and is what an unreachable provider actually looks like.
 *
 * One launch per stage, since the flag is a launch argument.
 *
 * Every stage carries a witness that the block itself worked, because a stage
 * that silently failed to block reads exactly like a stage that passed.
 *
 *   node test/e2e/live-fallback.mjs
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from './playwright.mjs';
import { poserLangueCible } from './kick-actions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '../../dist');

const PROVIDER_HOSTS = [
  'translate.googleapis.com',
  'lingva.lunar.icu',
  'api.mymemory.translated.net',
  'api-free.deepl.com',
  'api.deepl.com',
];
const PROVIDER_RE = /googleapis|lingva|mymemory|deepl/;

/** Opens a session with the named hosts pointed at a dead address. */
async function session(blocked) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-fb-'));
  const args = [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];
  if (blocked.length) {
    // 0.0.0.0 refuses immediately rather than hanging, which is the failure a
    // provider outage produces.
    args.push(`--host-resolver-rules=${blocked.map((h) => `MAP ${h} 0.0.0.0`).join(',')}`);
  }
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1500, height: 950 },
    args,
  });
  const seen = { asked: 0, failed: 0 };
  ctx.on('request', (r) => {
    if (PROVIDER_RE.test(r.url())) seen.asked += 1;
  });
  ctx.on('requestfailed', (r) => {
    if (PROVIDER_RE.test(r.url())) seen.failed += 1;
  });
  return { ctx, profile, seen };
}

/** A live channel, discovered from the directory rather than named here. */
async function openChannel(ctx) {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('https://kick.com/browse', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(7000);
  const channels = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('a[href^="/"]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => /^\/[a-zA-Z0-9_-]{3,25}$/.test(h))
        .filter(
          (h) =>
            !/^\/(browse|following|categories|search|about|help|login|signup|clips|home|subscriptions)$/.test(h),
        ),
    ),
  ]);
  for (const c of channels.slice(0, 6)) {
    await page.goto('https://kick.com' + c, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(11000);
    if ((await page.evaluate(() => document.querySelectorAll('#channel-chatroom [data-index]').length)) > 5) {
      // Aim at a language the chat is not written in, or nothing is requested.
      // Through the real control: this used to poke `.value` on what is a
      // button, so the target never moved and every count below was taken on
      // the default one.
      const pose = await poserLangueCible(page, 'fr');
      if (!pose.ok) {
        console.error('live-fallback: ' + pose.raison);
        return { page: null, channel: null, raison: pose.raison };
      }
      return { page, channel: c };
    }
  }
  return { page: null, channel: null };
}

const count = (page) =>
  page.evaluate(() => ({
    translations: document.querySelectorAll(
      '.kt-translation, .kt-translation-inline, .kt-translation-replace',
    ).length,
    errors: document.querySelectorAll('.kt-error').length,
    retries: document.querySelectorAll('.kt-retry').length,
  }));

const failures = [];

async function stage(label, blocked, wait, check) {
  const { ctx, profile, seen } = await session(blocked);
  const { page, channel } = await openChannel(ctx);
  if (!page) {
    failures.push(`${label}: aucune chaine avec du chat, la sonde ne mesure rien`);
  } else {
    await page.waitForTimeout(wait);
    const got = await count(page);
    console.log(`${label.padEnd(22)} ${JSON.stringify(got)}  reseau: demandees=${seen.asked} echouees=${seen.failed}`);
    check(got, seen, page, channel);
    await page
      .locator('#channel-chatroom')
      .screenshot({ path: path.join(HERE, `live-fallback-${label.replace(/\W+/g, '-')}.png`) })
      .catch(() => {});
  }
  await ctx.close();
  fs.rmSync(profile, { recursive: true, force: true });
}

// 1. Everything up. Without translations here the later stages mean nothing.
await stage('1 tout debout', [], 24000, (got, seen) => {
  if (got.translations === 0) failures.push('aucune traduction avec tous les fournisseurs debout');
  if (seen.asked === 0) failures.push('aucune requete fournisseur observee, la sonde ne mesure rien');
});

// 2. The first link dies. This is the stage that matters: a chain that stops
// translating when its first provider dies looks like a chat with nothing to
// translate.
await stage('2 google coupe', ['translate.googleapis.com'], 30000, (got, seen) => {
  if (seen.failed === 0) failures.push('le blocage de google n a rien fait echouer, la sonde ne mesure rien');
  if (got.translations === 0) failures.push('la chaine ne bascule pas quand le premier fournisseur tombe');
});

// 3. Everything down.
await stage('3 tous coupes', PROVIDER_HOSTS, 36000, (got, seen) => {
  if (seen.failed === 0) failures.push('aucune requete fournisseur en echec, la sonde ne mesure rien');
  if (got.errors === 0) failures.push('aucun .kt-error avec tous les fournisseurs coupes');
  if (got.errors > 0 && got.retries === 0) failures.push('erreur affichee sans bouton de reprise');
});

if (failures.length) {
  console.error();
  console.error(`live-fallback: ${failures.length} echec(s)`);
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}
console.log();
console.log('live-fallback: OK - bascule et chemin d erreur verifies contre de vraies pannes.');
