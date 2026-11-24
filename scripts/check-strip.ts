/**
 * Fail the build if instrumentation reached a bundle that ships.
 *
 * shared/metrics.ts selects its sink with `__KT_METRICS__ ? live : NOOP`, a
 * constant vite folds at build time. That is a claim about esbuild's dead-code
 * elimination, and an unverified claim about a privacy boundary is worth nothing:
 * this asserts it against the actual output.
 *
 * Both directions are checked, because a gate that can only pass is not a gate.
 * On a release build the marker must be ABSENT. On `build:metrics` it must be
 * PRESENT, which is the control: if the instrumented build were also clean, the
 * absence in the release build would prove nothing except that the sink is dead
 * everywhere.
 *
 * Run automatically at the end of `npm run build` and `npm run build:metrics`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Duplicated from shared/metrics.ts rather than imported: importing it would run
// the module, which needs the __KT_METRICS__ global that only exists inside a
// vite build. The metrics test asserts the constant still equals this string.
const MARKER = 'kt.metrics.v1';
const DIST = 'dist';

/**
 * Measurement keys, which survive the sink being stripped unless the call site is
 * guarded too.
 *
 * The marker above proves the sink is gone: nothing is collected, stored or
 * readable. It does not prove the keys are gone. A call compiles to an empty
 * function invocation and takes its string argument along, so a release used to
 * carry `dom.row.seen` and `compose.skipSameLang.` in plain text. Inert, but it
 * reads to anyone opening the bundle as telemetry that is merely not wired up yet,
 * and a store reviewer opening a bundle is not a hypothetical.
 *
 * Guarding each call site with `__KT_METRICS__` folds the whole statement away.
 * This asserts that none was missed, which no amount of care at the call site can.
 */
const KEYS = [
  'leg.roundtrip',
  'leg.sw.total',
  'leg.coalesce.wait',
  'leg.cache.lookup',
  'leg.inject',
  'e2e.cloud',
  'e2e.local',
  'dom.row.seen',
  'dom.row.textEmpty',
  'dom.container.miss',
  'chain.attempt.',
  'chain.depth.',
  'cooldown.trip.',
  'cache.mem.hit',
  'cache.sw.hit',
  'batch.items',
  'compose.action.',
  'compose.skipSameLang.',
  'retry.normalized',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

function main(): void {
  const instrumented = process.env.KT_METRICS === '1';

  let files: string[];
  try {
    files = walk(DIST);
  } catch {
    console.error(`[check-strip] no ${DIST}/ to check. Run a build first.`);
    process.exit(1);
  }

  const sources = new Map(files.map((f) => [relative(DIST, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')]));
  const hits = [...sources].filter(([, src]) => src.includes(MARKER)).map(([name]) => name);
  /** Every measurement key still readable in the bundles, with where it survived. */
  const keyHits = KEYS.flatMap((k) => [...sources].filter(([, src]) => src.includes(k)).map(([name]) => `${k} @ ${name}`));

  if (instrumented) {
    if (hits.length === 0) {
      console.error(
        `[check-strip] CONTROL FAILED: an instrumented build carries no "${MARKER}".\n` +
          `  The sink was stripped from the build that is supposed to keep it, so the\n` +
          `  release check below proves nothing. Look at the define in vite.config.ts.`,
      );
      process.exit(1);
    }
    // "Present somewhere" is too weak a control, and it already passed once while
    // half the instrumentation was dead: the service worker kept its sink, the
    // content script did not, and every page-side measurement recorded nothing.
    // The two bundles are produced by two separate vite passes, so each one has to
    // be named or the failure of either hides behind the other.
    // The keys must be here too, or the release check below is comparing against
    // a build that never had them and would pass on anything.
    if (keyHits.length === 0) {
      console.error(
        `[check-strip] CONTROL FAILED: an instrumented build carries no measurement key.\n` +
          `  The guards around the call sites folded in the build meant to keep them.`,
      );
      process.exit(1);
    }
    const normalized = hits;
    for (const required of ['assets/content.js']) {
      if (!normalized.includes(required)) {
        console.error(
          `[check-strip] CONTROL FAILED: "${MARKER}" is missing from ${required}.\n` +
            `  Found instead in: ${normalized.join(', ') || '(nothing)'}\n` +
            `  That bundle comes from scripts/bundle-content.ts, which runs as its own\n` +
            `  vite pass with configFile:false. Check that KT_METRICS reaches it.`,
        );
        process.exit(1);
      }
    }
    console.info(
      `[check-strip] instrumented build: marker in ${hits.length} file(s) (${normalized.join(', ')}), ` +
        `${keyHits.length} measurement key(s) present.`,
    );
    return;
  }

  // The dev hooks let any page reload the extension or patch its settings (the
  // Lingva server among them): never in a release. Each is its own marker, so a
  // refactor that moves one out of the __KT_DEV__ block cannot ship unnoticed.
  for (const hook of ['kt-dev-reload', 'kt-dev-settings', 'kt-dev-locale', 'ktSettings']) {
    const devHits = [...sources].filter(([, src]) => src.includes(hook)).map(([name]) => name);
    if (process.env.KT_DEV !== '1' && devHits.length > 0) {
      console.error(`[check-strip] RELEASE BUILD CARRIES THE DEV HOOK "${hook}" in ${devHits.join(', ')}`);
      process.exit(1);
    }
  }

  if (hits.length > 0) {
    console.error(
      `[check-strip] RELEASE BUILD CARRIES INSTRUMENTATION: "${MARKER}" found in\n` +
        hits.map((h) => `  - ${h}`).join('\n') +
        `\n  This bundle must not ship. Something references LiveMetrics outside the\n` +
        `  __KT_METRICS__ ternary, so esbuild could not drop it.`,
    );
    process.exit(1);
  }

  if (keyHits.length > 0) {
    console.error(
      `[check-strip] RELEASE BUILD CARRIES MEASUREMENT KEYS:\n` +
        keyHits.map((h) => `  - ${h}`).join('\n') +
        `\n  The sink is gone, so nothing is collected, but these strings are readable\n` +
        `  in a shipped bundle. A call site was left unguarded: wrap it in\n` +
        `  \`if (__KT_METRICS__)\`, or for one whose value is used, in a\n` +
        `  \`__KT_METRICS__ ? metrics.measure(...) : ...\` ternary.`,
    );
    process.exit(1);
  }

  console.info(
    `[check-strip] release build clean: no "${MARKER}" and no measurement key in ${files.length} bundled file(s).`,
  );
}

main();
