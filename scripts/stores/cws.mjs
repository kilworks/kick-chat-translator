/**
 * Chrome Web Store API v2, through a service account: no browser, no OAuth
 * window, no refresh token that dies after seven days in "Testing" mode.
 *
 *   node .claude/skills/publish-stores/cws.mjs status
 *   node .claude/skills/publish-stores/cws.mjs upload <zip> [--publish]
 *   node .claude/skills/publish-stores/cws.mjs publish
 *   node .claude/skills/publish-stores/cws.mjs cancel
 *
 * Reads, outside the repository:
 *   ~/.config/kick-chat-translator/cws-service-account.json   the key (CWS_SA_KEY overrides)
 *   ~/.config/kick-chat-translator/cws.json                   {"publisherId": "..."} (CWS_PUBLISHER_ID overrides)
 *
 * The key and the access token are never printed. What the API answers is,
 * because it holds nothing secret and it is the only proof of what happened.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { endpoint } from './local-only.mjs';

const ITEM_ID = process.env.CWS_ITEM_ID ?? 'nkkjmbkmacbdkboijmnhjnblcaiclhni';
const CONF = path.join(os.homedir(), '.config', 'kick-chat-translator');
const KEY_FILE = process.env.CWS_SA_KEY ?? path.join(CONF, 'cws-service-account.json');
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';

const die = (msg) => {
  console.error('cws: ' + msg);
  process.exit(1);
};
const TOKEN_URL = endpoint('CWS_TOKEN_URL', 'https://oauth2.googleapis.com/token', die);
const API = endpoint('CWS_API', 'https://chromewebstore.googleapis.com', die);

function publisherId() {
  if (process.env.CWS_PUBLISHER_ID) return process.env.CWS_PUBLISHER_ID;
  const f = path.join(CONF, 'cws.json');
  if (!fs.existsSync(f)) die(`publisher ID absent : ${f} avec {"publisherId": "..."} (Developer Dashboard, Publisher > Settings)`);
  return JSON.parse(fs.readFileSync(f, 'utf8')).publisherId || die(`publisherId vide dans ${f}`);
}

async function accessToken() {
  if (!fs.existsSync(KEY_FILE)) die(`cle du compte de service absente : ${KEY_FILE}`);
  const key = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  if (!key.client_email || !key.private_key) die(`${KEY_FILE} n est pas une cle JSON de compte de service`);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json().catch(() => ({}));
  // The error body names the cause (invalid_grant, unauthorized_client) and carries no secret.
  if (!r.ok || !j.access_token) die(`jeton refuse (${r.status}) : ${j.error ?? ''} ${j.error_description ?? ''}`.trim());
  return j.access_token;
}

async function call(method, url, token, body) {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  console.log(`${method} ${url.replace(API, '')} -> ${r.status}`);
  console.log(JSON.stringify(json, null, 2));
  if (!r.ok) process.exit(1);
  return json;
}

const [cmd, arg] = process.argv.slice(2);
const item = () => `${API}/v2/publishers/${publisherId()}/items/${ITEM_ID}`;

if (cmd === 'status') {
  await call('GET', `${item()}:fetchStatus`, await accessToken());
} else if (cmd === 'upload') {
  if (!arg || !fs.existsSync(arg)) die(`zip introuvable : ${arg ?? '(aucun)'}`);
  const base = item();
  const token = await accessToken();
  const up = await call('POST', `${API}/upload/v2/publishers/${publisherId()}/items/${ITEM_ID}:upload`, token, fs.readFileSync(arg));
  if (up.uploadState === 'FAILED') die('upload refuse par le store, voir la reponse ci-dessus');
  // Large packages are processed asynchronously; the status says when it is done.
  for (let i = 0; up.uploadState === 'IN_PROGRESS' && i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await call('GET', `${base}:fetchStatus`, token);
    if (s.lastAsyncUploadState && s.lastAsyncUploadState !== 'IN_PROGRESS') {
      if (s.lastAsyncUploadState !== 'SUCCEEDED') die(`upload ${s.lastAsyncUploadState}`);
      break;
    }
  }
  if (process.argv.includes('--publish')) await call('POST', `${base}:publish`, token);
} else if (cmd === 'publish') {
  await call('POST', `${item()}:publish`, await accessToken());
} else if (cmd === 'cancel') {
  // The listing cannot be edited while a submission is in review: cancel, edit, publish again.
  await call('POST', `${item()}:cancelSubmission`, await accessToken());
} else {
  console.error('usage: cws.mjs status | upload <zip> [--publish] | publish | cancel');
  process.exit(2);
}
