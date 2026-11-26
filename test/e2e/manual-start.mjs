/**
 * Manual start, on the real built extension: in manual mode a fresh channel stays silent, the chat tab
 * answers the popup's `start.state`, `start.set` (the message behind the popup's Resume button) starts it,
 * and the next line is translated. Auto mode is the control. Everything is served locally.
 *
 *   node test/e2e/manual-start.mjs
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from './playwright.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = process.env.KT_EXT ?? path.resolve(HERE, '../../dist');
if (!fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error('dist/manifest.json missing. Run `npm run build` first.');
  process.exit(2);
}

const ROW = '#channel-chatroom div[data-index]';
const LIST = '#channel-chatroom [data-which="messages"]';
const TR = '.kt-translation, .kt-translation-inline, .kt-translation-replace';
const row = (t, i) =>
  `<div data-index="${i}"><div class="w-full min-w-0 shrink-0"><button class="font-bold" style="color: rgb(1,2,3)">pseudo${i}</button><span class="font-normal">${t}</span></div></div>`;
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><div id="channel-chatroom"><div class="no-scrollbar" data-which="decoy"></div><div class="no-scrollbar" data-which="messages" style="height:600px;overflow:auto">${row('hola amigo que tal', 0)}</div><div contenteditable="true" role="textbox" data-testid="chat-input" class="editor-input" style="min-height:38px"></div></div></body></html>`;

const results = [];
const check = (name, ok) => {
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`);
};

async function run(mode) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kct-manual-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1200, height: 800 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--window-position=-2400,-2400', '--host-resolver-rules=MAP * ~NOTFOUND', '--no-first-run', '--no-default-browser-check'],
  });
  const out = {};
  try {
    await ctx.route(/^https?:/, (r) => r.abort());
    await ctx.route(/^https?:\/\/(www\.)?kick\.com\//, (r) => {
      const q = r.request();
      if (q.resourceType() === 'document') return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE });
      if (q.url().includes('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ chatroom: { id: 1 }, livestream: { lang_iso: 'zh' } }) });
      return r.fulfill({ status: 204, body: '' });
    });
    await ctx.route('**://translate.googleapis.com/**', (r) => {
      const q = r.request();
      const post = q.method() === 'POST';
      const lines = post ? new URLSearchParams(q.postData() ?? '').getAll('q') : [new URL(q.url()).searchParams.get('q') ?? ''];
      const body = post ? lines.map((l) => ['ZZTRADUIT:' + l, 'es']) : [lines.map((l) => ['ZZTRADUIT:' + l, l, null, null, 10]), null, 'es'];
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
    const id = new URL(sw.url()).host;
    const opt = await ctx.newPage();
    await opt.goto(`chrome-extension://${id}/src/options/index.html`);
    await opt.evaluate((m) => chrome.runtime.sendMessage(m), { type: 'settings.set', payload: { targetLang: 'en', ignoreEnglish: true, showFloatingBar: true, startMode: mode } });
    const ask = (type) =>
      opt.evaluate(async (type) => {
        const [t] = await chrome.tabs.query({ url: 'https://kick.com/*' });
        return chrome.tabs.sendMessage(t.id, { type });
      }, type);
    const shown = (p, text) =>
      p.evaluate(({ ROW, TR, text }) => [...document.querySelectorAll(ROW)].some((r) => r.textContent.includes(text) && r.querySelector(TR)?.textContent.includes('ZZTRADUIT')), { ROW, TR, text });
    const add = (p, t, i) => p.evaluate(({ LIST, html }) => document.querySelector(LIST).insertAdjacentHTML('beforeend', html), { LIST, html: row(t, i) });
    const page = await ctx.newPage();
    await page.goto('https://kick.com/kt-un', { waitUntil: 'domcontentloaded' });
    await page.bringToFront();
    await page.waitForTimeout(3000);
    await add(page, 'hola amigos como estan todos hoy', 10);
    await page.waitForTimeout(5000);
    out.before = await shown(page, 'hola amigos como estan todos hoy');
    out.askBefore = (await ask('start.state'))?.waiting;
    out.set = (await ask('start.set'))?.waiting;
    out.askAfter = (await ask('start.state'))?.waiting;
    await add(page, 'buenas noches a todos los presentes', 11);
    await page.waitForTimeout(6000);
    out.after = await shown(page, 'buenas noches a todos los presentes');
  } finally {
    await ctx.close().catch(() => undefined);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
  return out;
}

try {
  const man = await run('manual');
  const aut = await run('auto');
  check('manual: the tab says it is waiting', man.askBefore === true);
  check('manual: a line before the start is not translated', man.before === false);
  check('manual: start.set answers that it no longer waits', man.set === false && man.askAfter === false);
  check('manual: the next line is translated after start.set', man.after === true);
  check('auto control: not waiting, first line translated at once', aut.askBefore === false && aut.before === true);
} catch (e) {
  check(`no exception: ${String(e.stack ?? e).slice(0, 300)}`, false);
}
console.log(`${results.filter(Boolean).length}/${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
