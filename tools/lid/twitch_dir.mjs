// Rescan the public Twitch directory: live channels per broadcaster language, most viewed first.
// node tools/lid/twitch_dir.mjs --out <raw>/twitch-channels-2.json --pc-out <raw>/twitch-channels.json [--pc-top 50] [--cap 3000] [--langs fr,da] [--drop en] [--min 300]
// Logged out, a directory page stops at 30 channels (scrolling loads nothing more, measured 22/11), so each
// language is read on the "all" page and on the 30 top categories. --out keeps the union with its last content
// (fresh channels first, at most --cap per language): a channel offline now often comes back. --pc-out gets the
// --pc-top most viewed of this scan, then its own last content. --drop (default en, the language we hold the most
// of) leaves both lists. A language whose filter chip never shows is not a Twitch language: skipped.
// Files are replaced only when the scan found enough channels. Prints counts only.
import fs from 'node:fs';
// On an InstaBox VM (lid_scan.py): LID_CHROMIUM names the system browser, driven by playwright-core installed beside.
const { chromium } = process.env.LID_CHROMIUM ? await import('playwright-core') : await import('../../test/e2e/playwright.mjs');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('--out');
const pcOut = arg('--pc-out');
const pcTop = Number(arg('--pc-top', 50));
const min = Number(arg('--min', 300));
const cap = Number(arg('--cap', 3000));
const drop = new Set(arg('--drop', 'en').split(','));
const LANGS = (arg('--langs') ?? 'ar bg bn ca cs da de el en es et fa fi fr he hi hu id it ja ko lt lv ms nl no pl pt ro ru sk sl sv ta th tl tr '
  + 'uk vi zh zh-hk').split(/[ ,]/).filter((l) => !drop.has(l));
const CARD = 'a[data-a-target="preview-card-channel-link"]';

async function cards(page, url, lang) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector(CARD, { timeout: 15000 });
  } catch {
    return { chip: false, got: [] };  // nothing live there in this language
  }
  let got = [];
  for (let i = 0, last = -1; i < 6 && got.length !== last; i++) {  // cards render in waves: read until stable
    last = got.length;
    await page.waitForTimeout(800);
    got = await page.$$eval(CARD, (as) => as.map((a) => a.getAttribute('href')));
  }
  const chip = Boolean(await page.$(`[data-a-target="form-tag-${lang}"]`));
  return { chip, got: got.map((h) => (h || '').replace(/^\//, '').split(/[/?]/)[0].toLowerCase()).filter((c) => /^[a-z0-9_]{2,25}$/.test(c)) };
}

const browser = await chromium.launch({ headless: true, ...(process.env.LID_CHROMIUM && { executablePath: process.env.LID_CHROMIUM }) });
const page0 = await browser.newPage({ locale: 'en-US' });
await page0.goto('https://www.twitch.tv/directory?sort=VIEWER_COUNT', { waitUntil: 'domcontentloaded' });
await page0.waitForTimeout(4000);
const cats = await page0.$$eval('a[href^="/directory/category/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href').split('?')[0]))]);
await page0.close();
console.log('categories', cats.length);

const found = {};
const queue = [...LANGS];
await Promise.all([0, 1, 2].map(async () => {  // 8 pages at once lost whole languages (22/11): Twitch slows a busy client
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1600, height: 1200 } });
  for (let lang; (lang = queue.shift());) {
    const seen = new Set();
    let chip = false;
    for (const u of ['/directory/all', ...cats]) {
      const url = `https://www.twitch.tv${u}?sort=VIEWER_COUNT&tl=${lang}`;
      let r = await cards(page, url, lang).catch(() => ({ chip: false, got: [] }));
      if (u === '/directory/all' && !r.chip) r = await cards(page, url, lang).catch(() => ({ chip: false, got: [] }));  // one retry before skipping
      chip ||= r.chip;
      r.got.forEach((c) => seen.add(c));
      if (u === '/directory/all' && !r.chip) break;  // not a Twitch language, or nothing live at all
    }
    if (chip && seen.size) found[lang] = [...seen];
    console.log(lang, chip ? seen.size : 'skipped');
  }
}));
await browser.close();
const total = Object.values(found).reduce((s, v) => s + v.length, 0);
console.log('languages', Object.keys(found).length, 'fresh channels', total);
if (total < min) {
  console.log('too few channels: lists kept');
  process.exit(1);
}
const write = (file, data) => {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
  fs.renameSync(`${file}.tmp`, file);
};
const merge = (file, n) => {  // fresh channels first, then the file's last content, at most n per language
  let old = {};
  try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first scan */ }
  const m = {};
  for (const l of new Set([...Object.keys(found), ...Object.keys(old)])) if (!drop.has(l)) m[l] = [...new Set([...(found[l] ?? []), ...(old[l] ?? [])])].slice(0, n);
  write(file, m);
  return m;
};
const merged = merge(out, cap);
if (pcOut) merge(pcOut, pcTop);
console.log('written: union', Object.values(merged).reduce((s, v) => s + v.length, 0), 'channels in', Object.keys(merged).length, 'languages');
process.exit(0);
