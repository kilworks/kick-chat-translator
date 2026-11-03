/**
 * Capture real Kick chat lines, for measuring what the pre-send filters save.
 *
 *   node test/e2e/capture-chat.mjs --out <file.jsonl> [--rounds 3] [--per-lang 8]
 *
 * Read-only and anonymous: the two public endpoints the site itself calls
 * (/stream/livestreams/<lang>, /api/v2/channels/<id>/messages). Keeps only the
 * message content and the language the stream was listed under, never a user
 * or channel name. The output is third-party chat: keep it out of git.
 *
 * Headed on purpose: Kick's Cloudflare answers a headless browser differently.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from './playwright.mjs';

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

const seen = new Set();
const lines = [];
for (let round = 0; round < ROUNDS; round++) {
  const got = await page.evaluate(async (chs) => {
    const res = [];
    for (const c of chs) {
      try {
        const r = await fetch(`/api/v2/channels/${c.id}/messages`);
        for (const m of (await r.json()).data?.messages ?? []) {
          if (m.type === 'message') res.push({ id: m.id, lang: c.lang, ch: c.id, content: m.content });
        }
      } catch {}
    }
    return res;
  }, uniq);
  for (const m of got) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    lines.push({ lang: m.lang, ch: m.ch, content: m.content });
  }
  console.log(`round ${round + 1}/${ROUNDS}: ${lines.length} lines from ${uniq.length} channels`);
  if (round < ROUNDS - 1) await page.waitForTimeout(60000);
}
await ctx.close();

// The channel id only groups lines for the bot filter downstream; it is renumbered so the file names nobody.
const renum = new Map();
fs.writeFileSync(
  OUT,
  lines
    .map((l) => {
      if (!renum.has(l.ch)) renum.set(l.ch, renum.size);
      return JSON.stringify({ lang: l.lang, ch: renum.get(l.ch), content: l.content });
    })
    .join('\n') + '\n',
);
console.log(`capture-chat: ${lines.length} lines -> ${OUT}`);
