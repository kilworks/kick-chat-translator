/**
 * cws.mjs against a fake Google: the token endpoint checks the JWT signature
 * with the public half of a throwaway key, the store endpoints check the
 * bearer token and the bytes of the zip. No network, no real credentials.
 *
 *   node .claude/skills/publish-stores/cws-selftest.mjs
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CWS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cws.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cws-selftest-'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = { type: 'service_account', client_email: 'ci@test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
fs.writeFileSync(path.join(dir, 'key.json'), JSON.stringify(key));
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
fs.writeFileSync(path.join(dir, 'wrong.json'), JSON.stringify({ ...key, private_key: other }));
const zip = crypto.randomBytes(4096);
fs.writeFileSync(path.join(dir, 'pkg.zip'), zip);

const seen = [];
const srv = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const send = (code, obj) => (res.writeHead(code, { 'Content-Type': 'application/json' }), res.end(JSON.stringify(obj)));
  const base = `http://127.0.0.1:${srv.address().port}`;
  if (req.url === '/token') {
    const assertion = new URLSearchParams(body.toString()).get('assertion') ?? '';
    const [h, c, s] = assertion.split('.');
    const valid = crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s ?? '', 'base64url'));
    const claims = JSON.parse(Buffer.from(c ?? '', 'base64url').toString() || '{}');
    const good = valid && claims.iss === key.client_email && claims.aud === `${base}/token`
      && claims.scope === 'https://www.googleapis.com/auth/chromewebstore' && claims.exp - claims.iat === 3600;
    seen.push(`token:${good}`);
    return good ? send(200, { access_token: 'tok-123', expires_in: 3600 }) : send(400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' });
  }
  if (req.headers.authorization !== 'Bearer tok-123') return send(401, { error: 'unauthenticated' });
  const item = '/v2/publishers/pub-1/items/nkkjmbkmacbdkboijmnhjnblcaiclhni';
  if (req.method === 'POST' && req.url === `/upload${item}:upload`) {
    seen.push(`upload:${body.equals(zip)}`);
    return send(200, { itemId: 'nkkjmbkmacbdkboijmnhjnblcaiclhni', uploadState: 'IN_PROGRESS' });
  }
  if (req.method === 'GET' && req.url === `${item}:fetchStatus`) {
    seen.push('status');
    return send(200, { itemId: 'nkkjmbkmacbdkboijmnhjnblcaiclhni', lastAsyncUploadState: 'SUCCEEDED' });
  }
  if (req.method === 'POST' && req.url === `${item}:publish`) {
    seen.push('publish');
    return send(200, { itemId: 'nkkjmbkmacbdkboijmnhjnblcaiclhni', state: 'PENDING_REVIEW' });
  }
  send(404, { error: `unexpected ${req.method} ${req.url}` });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

// Async on purpose: a synchronous child would block the loop the fake server answers on.
const run = (args, keyFile = 'key.json') =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [CWS, ...args], {
      env: { ...process.env, CWS_SA_KEY: path.join(dir, keyFile), CWS_PUBLISHER_ID: 'pub-1', CWS_TOKEN_URL: `${base}/token`, CWS_API: base },
    });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolve({ code, out }));
  });

const fails = [];
const expect = (cond, what) => (cond ? console.log('  ok  ' + what) : fails.push(what));

let r = await run(['status']);
expect(r.code === 0 && seen.includes('token:true') && seen.includes('status'), 'status : JWT signe accepte, fetchStatus appele');
seen.length = 0;
r = await run(['upload', path.join(dir, 'pkg.zip'), '--publish']);
expect(r.code === 0 && seen.join(',') === 'token:true,upload:true,status,publish', `upload --publish : zip octet pour octet, attente du traitement, publication (${seen.join(',')})`);
expect(!r.out.includes('tok-123') && !r.out.includes('PRIVATE KEY'), 'ni jeton ni cle dans la sortie');
seen.length = 0;
r = await run(['status'], 'wrong.json');
expect(r.code === 1 && /invalid_grant/.test(r.out) && !seen.includes('status'), 'mauvaise cle : refus au jeton, aucun appel au store');
r = await run(['upload', path.join(dir, 'absent.zip')]);
expect(r.code === 1 && /zip introuvable/.test(r.out), 'zip absent : arret avant tout appel');

// An override that points anywhere but this machine must stop the run before a credential is read.
{
  const out = await new Promise((resolve) => {
    const p = spawn(process.execPath, [CWS, 'status'], {
      env: { ...process.env, CWS_SA_KEY: path.join(dir, 'key.json'), CWS_PUBLISHER_ID: 'pub-1', CWS_TOKEN_URL: 'https://evil.example/token', CWS_API: base },
    });
    let o = '';
    p.stdout.on('data', (d) => (o += d));
    p.stderr.on('data', (d) => (o += d));
    p.on('close', (code) => resolve({ code, o }));
  });
  expect(out.code === 1 && /may only point at http:\/\/127\.0\.0\.1/.test(out.o) && !seen.includes('token:true'), 'CWS_TOKEN_URL hors boucle locale : refuse, aucun jeton envoye');
}

srv.close();
fs.rmSync(dir, { recursive: true, force: true });
if (fails.length) {
  for (const f of fails) console.error('  x   ' + f);
  process.exit(1);
}
console.log('cws-selftest : 6/6');
