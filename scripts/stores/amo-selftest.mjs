/**
 * amo.mjs against a fake AMO: checks the JWT HMAC, the multipart fields, the
 * wait for validation, the source archive, the locale codes and the listing
 * read-back. No network, no real key.
 *
 *   node .claude/skills/publish-stores/amo-selftest.mjs
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AMO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'amo.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amo-selftest-'));
const secret = crypto.randomBytes(32).toString('hex');
fs.writeFileSync(path.join(dir, 'key.json'), JSON.stringify({ issuer: 'user:1:2', secret }));
fs.writeFileSync(path.join(dir, 'wrong.json'), JSON.stringify({ issuer: 'user:1:2', secret: 'nope' }));
const pkg = crypto.randomBytes(3000);
const src = crypto.randomBytes(5000);
fs.writeFileSync(path.join(dir, 'ff.zip'), pkg);
fs.writeFileSync(path.join(dir, 'src.zip'), src);
fs.writeFileSync(path.join(dir, 'notes.json'), JSON.stringify({ notes: { fr: 'n fr', 'en-us': 'n en', 'pt-br': 'n br' }, rev: 'for reviewers' }));
fs.writeFileSync(path.join(dir, 'listing.json'), JSON.stringify({ name: { fr: 'n fr', 'en-us': 'n en' }, summary: { fr: 's fr', 'en-us': 's en' }, description: { fr: 'd fr github.com/x & co', 'en-us': 'd en' } }));

const seen = [];
let polls = 0;
let stored = {};
const srv = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const send = (code, obj) => (res.writeHead(code, { 'Content-Type': 'application/json' }), res.end(JSON.stringify(obj)));
  const [scheme, jwt] = (req.headers.authorization ?? '').split(' ');
  const [h, c, s] = (jwt ?? '').split('.');
  const good = scheme === 'JWT' && s === crypto.createHmac('sha256', secret).update(`${h}.${c}`).digest('base64url');
  const claims = good ? JSON.parse(Buffer.from(c, 'base64url').toString()) : {};
  if (!good || claims.iss !== 'user:1:2' || !claims.jti || claims.exp - claims.iat > 300) {
    seen.push('auth:false');
    return send(401, { detail: 'Signature verification failed.' });
  }
  const url = req.url.replace(/^\/api\/v5/, '');
  const has = (b) => body.includes(b);
  if (req.method === 'POST' && url === '/addons/upload/') {
    seen.push(`upload:${has(pkg) && has(Buffer.from('listed'))}`);
    return send(201, { uuid: 'u-1', processed: false, valid: false });
  }
  if (req.method === 'GET' && url === '/addons/upload/u-1/') {
    polls++;
    return send(200, { uuid: 'u-1', processed: polls >= 2, valid: true, version: '9.9.9', validation: { errors: 0, warnings: 3 } });
  }
  if (req.method === 'POST' && url === '/addons/addon/kick-chat-translator/versions/') {
    seen.push(`version:${has(src) && has(Buffer.from('u-1'))}`);
    return send(201, { id: 42, version: '9.9.9' });
  }
  if (req.method === 'PATCH' && url === '/addons/addon/kick-chat-translator/versions/42/') {
    const j = JSON.parse(body);
    seen.push(`notes:${Object.keys(j.release_notes).sort().join(',')}|${j.approval_notes}`);
    return send(200, {});
  }
  if (req.method === 'GET' && url === '/addons/addon/kick-chat-translator/versions/42/') {
    return send(200, { version: '9.9.9', file: { status: 'public' }, source: 'x.zip', release_notes: { fr: 'n fr', 'en-US': 'n en', 'pt-BR': 'n br' } });
  }
  if (req.method === 'PATCH' && url === '/addons/addon/kick-chat-translator/') {
    stored = JSON.parse(body);
    seen.push(`listing:${Object.keys(stored.summary).sort().join(',')}`);
    return send(200, {});
  }
  if (req.method === 'GET' && url === '/addons/addon/kick-chat-translator/') {
    // As the real AMO does: URLs become outgoing links, & is escaped.
    const served = Object.fromEntries(Object.entries(stored.description ?? {}).map(([l, t]) => [l,
      t.replace(/&/g, '&amp;').replace(/github\.com\/x/, '<a href="https://outgoing.example/v1/x" rel="nofollow">github.com/x</a>')]));
    return send(200, { status: 'public', current_version: { version: '9.9.9', file: { status: 'public' } }, ...stored, description: served });
  }
  send(404, { detail: `unexpected ${req.method} ${url}` });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const API = `http://127.0.0.1:${srv.address().port}/api/v5`;

const run = (args, keyFile = 'key.json') =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [AMO, ...args], { env: { ...process.env, AMO_API_KEY: path.join(dir, keyFile), AMO_API: API } });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolve({ code, out }));
  });

const fails = [];
const expect = (cond, what) => (cond ? console.log('  ok  ' + what) : fails.push(what));

let r = await run(['release', path.join(dir, 'ff.zip'), path.join(dir, 'src.zip'), path.join(dir, 'notes.json')]);
expect(r.code === 0 && seen.join(' ') === 'upload:true version:true notes:en-US,fr,pt-BR|for reviewers',
  `release : paquet, validation attendue, version avec sources, notes en-US/pt-BR (${seen.join(' ')})`);
expect(polls >= 2, 'attend que la validation soit terminee avant de creer la version');
expect(!r.out.includes(secret), 'le secret n apparait pas dans la sortie');
seen.length = 0;
r = await run(['listing', path.join(dir, 'listing.json')]);
expect(r.code === 0 && /2\/2 locales relues identiques/.test(r.out), 'listing : envoye puis relu, 2/2');
seen.length = 0;
r = await run(['status'], 'wrong.json');
expect(r.code === 1 && seen.includes('auth:false'), 'mauvais secret : refuse, sortie en erreur');

// An override that points anywhere but this machine must stop the run before the JWT is built.
{
  const out = await new Promise((resolve) => {
    const p = spawn(process.execPath, [AMO, 'status'], { env: { ...process.env, AMO_API_KEY: path.join(dir, 'key.json'), AMO_API: 'https://evil.example/api/v5' } });
    let o = '';
    p.stdout.on('data', (d) => (o += d));
    p.stderr.on('data', (d) => (o += d));
    p.on('close', (code) => resolve({ code, o }));
  });
  expect(out.code === 1 && /may only point at http:\/\/127\.0\.0\.1/.test(out.o), 'AMO_API hors boucle locale : refuse avant tout JWT');
}

srv.close();
fs.rmSync(dir, { recursive: true, force: true });
if (fails.length) {
  for (const f of fails) console.error('  x   ' + f);
  process.exit(1);
}
console.log('amo-selftest : 6/6');
