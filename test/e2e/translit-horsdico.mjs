// Probe: layer 2 of the rescued guard, isTransliteration, only ever fires on
// what layer 1 did not already answer. On the 90 frozen pairs it fires four
// times and all four are dictionary keys, so it repairs nothing there. Its
// whole value lives in short Latin chat OUTSIDE the dictionary.
//
// Two questions, and the second is the one that decides:
//   1. How often does the shipped provider transliterate an unlisted short
//      Latin line aimed at Japanese?
//   2. When it does, does the NEXT provider in the chain do better? Cascading
//      to an engine that transliterates the same way buys a round trip and
//      nothing else.
//
// Read-only GETs against the same keyless endpoints the product uses, paced.

const GOOGLE = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY = 'https://api.mymemory.translated.net/get';
const LINGVA = ['https://lingva.lunar.icu'];

const KATA = /[゠-ヿㇰ-ㇿ･-ﾟ]/u;

function katakanaRatio(text) {
  const s = text.replace(/[\s\p{P}\p{S}]/gu, '');
  if (!s.length) return 0;
  let k = 0;
  for (const ch of s) if (KATA.test(ch)) k += 1;
  return k / s.length;
}

// Short Latin chat lines, none of them a key of the override dictionary.
// Picked as ordinary stream chat rather than as greetings, since greetings are
// exactly what layer 1 already covers.
const LINES = [
  ['fr', 'trop fort'],
  ['fr', 'quelle horreur'],
  ['fr', 'vas y'],
  ['fr', 'il est chaud'],
  ['fr', 'ca part en vrille'],
  ['es', 'que pasa'],
  ['es', 'muy bueno'],
  ['es', 'dale campeon'],
  ['es', 'no puede ser'],
  ['pt', 'que isso'],
  ['pt', 'muito bom'],
  ['pt', 'vamos la'],
  ['de', 'sehr gut'],
  ['de', 'was ist das'],
  ['it', 'che bello'],
  ['it', 'dai dai dai'],
  ['tr', 'cok iyi'],
  ['tr', 'ne oluyor'],
  ['en', 'insane clutch'],
  ['en', 'so close'],
  ['en', 'big brain'],
  ['en', 'he is cracked'],
  ['en', 'no way'],
  ['en', 'that was clean'],
  ['en', 'absolute cinema'],
];

// Same idea, one token each. The four transliterations the frozen grid found
// were all single words that an engine can mistake for a name: bonjour, merci,
// gracias, ciao. If the defect lives in single tokens rather than in short
// lines, this battery shows it and the previous one being empty is not a
// refutation but a boundary.
const SEULS = [
  ['fr', 'incroyable'],
  ['fr', 'magnifique'],
  ['fr', 'dommage'],
  ['fr', 'enorme'],
  ['fr', 'chaud'],
  ['es', 'increible'],
  ['es', 'tremendo'],
  ['es', 'brutal'],
  ['es', 'crack'],
  ['pt', 'caramba'],
  ['pt', 'demais'],
  ['pt', 'lindo'],
  ['de', 'wahnsinn'],
  ['de', 'unglaublich'],
  ['it', 'bellissimo'],
  ['it', 'assurdo'],
  ['tr', 'harika'],
  ['tr', 'inanilmaz'],
  ['en', 'sheesh'],
  ['en', 'clutch'],
  ['en', 'cracked'],
  ['en', 'goated'],
  ['en', 'unlucky'],
  ['en', 'legend'],
  ['en', 'nasty'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function google(text, tl) {
  const url = new URL(GOOGLE);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', tl);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);
  const res = await fetch(url.toString(), { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('soft block');
  return data[0].map((s) => s[0]).join('');
}

async function myMemory(text, sl, tl) {
  const url = new URL(MYMEMORY);
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${sl}|${tl}`);
  const res = await fetch(url.toString(), { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const t = data?.responseData?.translatedText;
  if (typeof t !== 'string' || !t) throw new Error('empty');
  return t;
}

async function lingva(text, sl, tl) {
  let last = null;
  for (const host of LINGVA) {
    try {
      const res = await fetch(`${host}/api/v1/${sl}/${tl}/${encodeURIComponent(text)}`, {
        credentials: 'omit',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (typeof data?.translation !== 'string' || !data.translation) throw new Error('empty');
      return data.translation;
    } catch (err) {
      last = err;
    }
  }
  throw last ?? new Error('no host');
}

const rows = [];
let googleCalls = 0;

for (const [src, text] of LINES) {
  try {
    const out = await google(text, 'ja');
    googleCalls += 1;
    rows.push({ src, text, out, ratio: katakanaRatio(out) });
  } catch (err) {
    rows.push({ src, text, out: null, err: String(err.message) });
  }
  await sleep(350);
}

if (googleCalls === 0) {
  console.error(`SONDE MUETTE: 0 appel google abouti sur ${LINES.length}.`);
  process.exit(2);
}

const flagged = rows.filter((r) => r.out !== null && r.ratio > 0.8);
console.log(`## Question 1 : frequence hors dictionnaire, cible ja\n`);
console.log(`  appels aboutis ${googleCalls}/${LINES.length}`);
console.log(`  katakana pur (> 0.8) ${flagged.length}/${googleCalls}\n`);
for (const r of rows) {
  if (r.out === null) {
    console.log(`  ERR   ${r.text.padEnd(18)} ${r.err}`);
    continue;
  }
  const mark = r.ratio > 0.8 ? 'KATA' : '    ';
  console.log(`  ${mark}  ${r.text.padEnd(18)} -> ${r.out}   (${r.ratio.toFixed(2)})`);
}

const seulsRows = [];
let seulsCalls = 0;
for (const [src, text] of SEULS) {
  try {
    const out = await google(text, 'ja');
    seulsCalls += 1;
    seulsRows.push({ src, text, out, ratio: katakanaRatio(out) });
  } catch (err) {
    seulsRows.push({ src, text, out: null, err: String(err.message) });
  }
  await sleep(350);
}

if (seulsCalls === 0) {
  console.error(`SONDE MUETTE: 0 appel google abouti sur ${SEULS.length} mots seuls.`);
  process.exit(2);
}

const seulsFlagged = seulsRows.filter((r) => r.out !== null && r.ratio > 0.8);
console.log(`\n## Question 1 bis : un seul mot, hors dictionnaire, cible ja\n`);
console.log(`  appels aboutis ${seulsCalls}/${SEULS.length}`);
console.log(`  katakana pur (> 0.8) ${seulsFlagged.length}/${seulsCalls}\n`);
for (const r of seulsRows) {
  if (r.out === null) {
    console.log(`  ERR   ${r.text.padEnd(14)} ${r.err}`);
    continue;
  }
  const mark = r.ratio > 0.8 ? 'KATA' : '    ';
  console.log(`  ${mark}  ${r.text.padEnd(14)} -> ${r.out}   (${r.ratio.toFixed(2)})`);
}

flagged.push(...seulsFlagged);

console.log(`\n## Question 2 : le fournisseur suivant fait-il mieux ?\n`);
if (flagged.length === 0) {
  console.log(
    '  Aucune ligne signalee. La cascade de la couche 2 ne serait declenchee par',
  );
  console.log('  aucune de ces 25 lignes, ce qui est le resultat et pas une absence.');
} else {
  let better = 0;
  for (const r of flagged) {
    const alts = [];
    for (const [name, fn] of [
      ['mymemory', () => myMemory(r.text, r.src, 'ja')],
      ['lingva', () => lingva(r.text, r.src, 'ja')],
    ]) {
      try {
        const out = await fn();
        alts.push({ name, out, ratio: katakanaRatio(out) });
      } catch (err) {
        alts.push({ name, out: null, err: String(err.message) });
      }
      await sleep(500);
    }
    const escape = alts.find((a) => a.out !== null && a.ratio <= 0.8);
    if (escape) better += 1;
    console.log(`  ${r.text}  google -> ${r.out} (${r.ratio.toFixed(2)})`);
    for (const a of alts) {
      console.log(
        a.out === null
          ? `      ${a.name.padEnd(9)} ECHEC ${a.err}`
          : `      ${a.name.padEnd(9)} ${a.out}  (${a.ratio.toFixed(2)})`,
      );
    }
  }
  console.log(
    `\n  Lignes ou un fournisseur suivant echappe au katakana pur : ${better}/${flagged.length}`,
  );
}
