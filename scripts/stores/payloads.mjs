/**
 * Builds what the store APIs receive from store/, and refuses to build it when
 * a text would embarrass the listing.
 *
 *   node scripts/stores/payloads.mjs <outdir>
 *
 * Writes <outdir>/amo-notes.json {notes, rev}, <outdir>/amo-listing.json
 * {name, summary, description} (the name from public/_locales) and <outdir>/cws-description-<lang>.txt (pasted by
 * hand: no API sets Chrome's description). `rev` is store/amo/reviewer-notes.txt
 * with {{VERSION}} from package.json, {{CHECKSUMS}} from the two zips of that
 * version in release/, and {{TOOLCHAIN}} from the machine running this.
 *
 * Fails on: an em or en dash; a paragraph of 120+ characters without a single
 * accent in a Latin-script language (quoted English set aside); a Cyrillic
 * letter in a Latin-script text; a version number in a description; an AMO
 * summary over 250 characters; a missing file or zip; a placeholder left over.
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LISTINGS } from './languages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STORE = path.join(ROOT, 'store');
const out = process.argv[2];
if (!out) {
  console.error('usage: payloads.mjs <outdir>');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const fails = [];
const read = (rel) => {
  const f = path.join(STORE, rel);
  if (!fs.existsSync(f)) {
    fails.push(`${rel}: absent`);
    return '';
  }
  return fs.readFileSync(f, 'utf8').trim();
};

// Built from code points so this file never carries the characters it hunts.
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
// Latin-1 to Extended-B (Romanian ș ț), plus Extended Additional (Vietnamese).
const DIACRITIC = new RegExp(`[${String.fromCharCode(0xc0)}-${String.fromCharCode(0x24f)}${String.fromCharCode(0x1e00)}-${String.fromCharCode(0x1eff)}]`);
const CYRILLIC = new RegExp(`[${String.fromCharCode(0x400)}-${String.fromCharCode(0x4ff)}]`);

const check = (label, lang, text) => {
  if (!text) return;
  if (DASH.test(text)) fails.push(`${label}: tiret cadratin ou demi-cadratin`);
  const kind = LISTINGS[lang]?.check;
  if (!kind) return;
  const cyr = text.match(CYRILLIC);
  if (cyr) fails.push(`${label}: lettre cyrillique dans un texte latin, "${text.slice(Math.max(0, cyr.index - 15), cyr.index + 15)}"`);
  if (kind !== 'accents') return;
  // Per paragraph: one accented header once let six ASCII paragraphs through.
  for (const p of text.split(/\n\s*\n/)) {
    const own = p.replace(/"[^"]*"|«[^»]*»|“[^”]*”/g, '');
    if (own.trim().length >= 120 && !DIACRITIC.test(own)) fails.push(`${label}: paragraphe sans accent, "${p.trim().slice(0, 50)}..."`);
  }
};

// Chinese and Japanese lines join without a space; Korean separates words.
const CJK = /[　-ヿ㐀-鿿＀-￯]/;
const unwrap = (s) => {
  const lines = [];
  for (const raw of s.split('\n')) {
    const l = raw.trim();
    const prev = lines[lines.length - 1];
    if (!l) lines.push('');
    else if (prev && !/^- /.test(l)) lines[lines.length - 1] = prev + (CJK.test(prev.slice(-1)) && CJK.test(l[0]) ? '' : ' ') + l;
    else lines.push(l);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

// The name is the manifest's, so both stores carry the same one per language.
const extName = (lang) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'public/_locales', LISTINGS[lang].dir, 'messages.json'), 'utf8')).extName.message;
const ON_AMO = Object.entries(LISTINGS).filter(([, l]) => l.amo.length);

const name = {};
const summary = {};
const description = {};
for (const [lang, { amo: locales }] of ON_AMO) {
  const n = extName(lang);
  const s = read(`amo/summary/${lang}.txt`);
  const d = read(`amo/description/${lang}.txt`);
  check(`resume AMO ${lang}`, lang, s);
  check(`description AMO ${lang}`, lang, d);
  if ([...s].length > 250) fails.push(`resume AMO ${lang}: ${[...s].length} caracteres, 250 max`);
  for (const loc of locales) (name[loc] = n), (summary[loc] = s), (description[loc] = d);
}

// Release notes in English only since 3.6.3 (kil): AMO shows the default
// locale's notes wherever a translation is missing.
const notes = {};
for (const [lang, { amo: locales }] of ON_AMO) {
  if (lang !== 'en') continue;
  const text = unwrap(read(`notes/${lang}.txt`));
  check(`note ${lang}`, lang, text);
  for (const loc of locales) notes[loc] = text;
}

const cws = {};
for (const lang of Object.keys(LISTINGS)) {
  const text = read(`chrome/description/${lang}.txt`);
  check(`description Chrome ${lang}`, lang, text);
  const v = text.match(/\b\d+\.\d+\.\d+\b/);
  if (v) fails.push(`description Chrome ${lang}: numero de version ${v[0]}, elle vieillirait a chaque release`);
  cws[lang] = text;
}

// Reviewer notes, filled with what this build actually is.
const zips = ['chromium', 'firefox'].map((t) => [t, path.join(ROOT, 'release', `kick-chat-translator-${VERSION}-${t}.zip`)]);
const lines = zips.map(([t, f]) => {
  if (!fs.existsSync(f)) {
    fails.push(`${path.basename(f)}: absent, construire les paquets avant`);
    return '';
  }
  const b = fs.readFileSync(f);
  return `  ${t.padEnd(9)} ${crypto.createHash('sha256').update(b).digest('hex')}  ${b.length} bytes`;
});
const osName = { linux: 'Linux', win32: 'Windows', darwin: 'macOS' }[process.platform] ?? process.platform;
let npm = '?';
try {
  npm = execSync('npm -v', { encoding: 'utf8' }).trim();
} catch {}
const toolchain = `Node ${process.version}, npm ${npm}, on ${osName}${process.env.GITHUB_ACTIONS ? ' (GitHub Actions)' : ''}`;
const rev = read('amo/reviewer-notes.txt')
  .split('{{VERSION}}').join(VERSION)
  .replace('{{CHECKSUMS}}', lines.join('\n'))
  .replace('{{TOOLCHAIN}}', toolchain);
if (/\{\{[A-Z]+\}\}/.test(rev)) fails.push(`notes relecteurs: ${rev.match(/\{\{[A-Z]+\}\}/)[0]} non rempli`);
check('notes relecteurs', 'en', rev);

if (fails.length) {
  console.error(fails.length + ' probleme(s), rien ecrit :');
  for (const f of fails) console.error('  x ' + f);
  process.exit(1);
}
fs.writeFileSync(path.join(out, 'amo-notes.json'), JSON.stringify({ notes, rev }));
fs.writeFileSync(path.join(out, 'amo-listing.json'), JSON.stringify({ name, summary, description }));
for (const [lang, text] of Object.entries(cws)) fs.writeFileSync(path.join(out, `cws-description-${lang}.txt`), text + '\n');
console.log(`${VERSION} | notes ${Object.keys(notes).length} locales | fiche AMO ${Object.keys(summary).length} locales | fiche Chrome ${Object.keys(cws).length} langues | ${toolchain}`);
console.log(`-> ${out}`);
