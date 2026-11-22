/**
 * Capture real Kick chat lines, for measuring what the pre-send filters save.
 *
 *   node test/e2e/capture-chat.mjs --out <file.jsonl> [--rounds 3] [--per-lang 8]
 *
 * Read-only and anonymous: the two public endpoints the site itself calls
 * (/stream/livestreams/<lang>, /api/v2/channels/<id>/messages). Keeps only the
 * message content, the language the stream was listed under and the hour it
 * was sent, never a user or channel name: an @mention in the text becomes an
 * opaque @u<n>. The output is third-party chat: keep it out of git.
 *
 * Headed on purpose: Kick's Cloudflare answers a headless browser differently.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '../../test/e2e/playwright.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const OUT = arg('--out');
if (!OUT) {
  console.error('capture-chat: --out <file.jsonl> required');
  process.exit(2);
}
const ROUNDS = Number(arg('--rounds', 3));
const PER_LANG = Number(arg('--per-lang', 8));
const PAGES = Number(arg('--pages', 20));
// Seconds between rounds. Doubles (up to 300) when more than 10 % of requests are refused, so a
// block never builds up on the home IP; comes back down by 5 s per clean round.
const INTERVAL = Number(arg('--interval', 60));
let wait = INTERVAL;

const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kt-capture-')), {
  headless: false,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto('https://kick.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

// The language in the URL is ignored (measured: /pt returns Spanish, Polish,
// Arabic...), but every stream carries the language its streamer declared. So
// walk the whole list, sorted by viewers, and keep the top PER_LANG of each.
const channels = await page.evaluate(
  async ({ pages, per }) => {
    const byLang = {};
    for (let p = 1; p <= pages; p++) {
      try {
        const r = await fetch(`/stream/livestreams/en?page=${p}&limit=24&sort=desc`);
        const data = (await r.json()).data ?? [];
        if (data.length === 0) break;
        for (const s of data) {
          const l = s.language || 'unknown';
          (byLang[l] ??= []).length < per && byLang[l].push({ id: s.channel_id, lang: l });
        }
      } catch {}
    }
    return Object.values(byLang).flat();
  },
  { pages: PAGES, per: PER_LANG },
);
const uniq = [...new Map(channels.map((c) => [c.id, c])).values()];
const langCount = {};
for (const c of uniq) langCount[c.lang] = (langCount[c.lang] ?? 0) + 1;
console.log('channels per language:', JSON.stringify(langCount));

// Research copy of test/e2e/capture-chat.mjs: channels fetched 8 at a time and
// every round appended to OUT at once, so a crash loses one round, not the run.
const seen = new Set();
const renum = new Map();
const users = new Map();
const hour = (at) => (Number.isNaN(Date.parse(at)) ? null : new Date(Date.parse(at)).toISOString().slice(0, 13) + ':00Z');
let total = 0;
for (let round = 0; round < ROUNDS; round++) {
  const t0 = Date.now();
  const got = await page.evaluate(async (chs) => {
    const res = [];
    const st = { ok: 0, refused: 0, err: 0 };
    let next = 0;
    const worker = async () => {
      while (next < chs.length) {
        const c = chs[next++];
        try {
          const r = await fetch(`/api/v2/channels/${c.id}/messages`);
          if (r.status === 403 || r.status === 429) { st.refused++; continue; }
          st.ok++;
          for (const m of (await r.json()).data?.messages ?? []) {
            if (m.type === 'message') res.push({ id: m.id, lang: c.lang, ch: c.id, content: m.content, at: m.created_at });
          }
        } catch { st.err++; }
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    return { res, st };
  }, uniq).then(({ res, st }) => {
    const bad = st.refused / Math.max(st.ok + st.refused, 1);
    wait = bad > 0.1 ? Math.min(wait * 2, 300) : Math.max(INTERVAL, wait - 5);
    console.log(`  http ok ${st.ok} refused ${st.refused} err ${st.err} -> next round in ${wait} s`);
    return res;
  });
  const fresh = got.filter((m) => !seen.has(m.id) && seen.add(m.id));
  fs.appendFileSync(
    OUT,
    fresh
      .map((l) => {
        if (!renum.has(l.ch)) renum.set(l.ch, renum.size);
        const content = l.content.replace(/@([A-Za-z0-9_]{2,25})/g, (_, u) => {
          const k = u.toLowerCase();
          if (!users.has(k)) users.set(k, users.size);
          return `@u${users.get(k)}`;
        });
        return JSON.stringify({ lang: l.lang, ch: renum.get(l.ch), t: hour(l.at), content }) + '\n';
      })
      .join(''),
  );
  total += fresh.length;
  console.log(`round ${round + 1}/${ROUNDS}: +${fresh.length} (${total}) from ${uniq.length} channels in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (round < ROUNDS - 1) await page.waitForTimeout(Math.max(0, wait * 1000 - (Date.now() - t0)));
}
await ctx.close();
console.log(`kick_capture: ${total} lines -> ${OUT}`);
