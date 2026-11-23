#!/usr/bin/env node
// Does each provider actually have this language? Answers by looking at the text
// it returns, not at the status code: MyMemory answers 200 for codes it does not
// have. Node 20+, no dependencies.
//
//   node .claude/skills/add-language/probe-provider.mjs yue "佢哋去咗邊度呀"
//   node .claude/skills/add-language/probe-provider.mjs yue "佢哋去咗邊度呀" --to fr
//
// DeepL is probed only when DEEPL_KEY is set.

const [code, sentence, ...rest] = process.argv.slice(2);
if (!code || !sentence) {
  console.error('usage: probe-provider.mjs <lang-code> "<sentence in that language>" [--to <code>]');
  process.exit(2);
}
const toIdx = rest.indexOf('--to');
const pivot = toIdx >= 0 ? rest[toIdx + 1] : 'en';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const show = (s) => (s.length > 90 ? s.slice(0, 90) + '…' : s);
const row = (provider, verdict, detail) => console.log(`${provider.padEnd(22)} ${verdict.padEnd(12)} ${detail}`);

// Google's free web endpoint. This is the one the extension calls, and its
// language list is NOT the Cloud Translation list. 429 means soft-blocked, not
// unsupported, so both clients are tried before concluding.
async function google(sl, tl, q) {
  for (const client of ['dict-chrome-ex', 'gtx']) {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=${client}` +
      `&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/131.0' } });
    if (res.status === 429) {
      await sleep(3000);
      continue;
    }
    if (!res.ok) return { blocked: false, status: res.status };
    const data = JSON.parse((await res.text()).replace(/,(?=,)/g, ',null'));
    const text = (data[0] ?? []).map((s) => (Array.isArray(s) ? s[0] : '')).join('');
    return { text, detected: data[2], client };
  }
  return { blocked: true };
}

console.log(`probing "${code}" with: ${sentence}\n`);
console.log('provider'.padEnd(22) + 'verdict'.padEnd(13) + 'evidence');
console.log('-'.repeat(78));

// 1. Source direction: can the engine read it?
try {
  const r = await google(code, pivot, sentence);
  if (r.blocked) row(`google ${code}->${pivot}`, 'BLOCKED', '429 on both clients, rerun later');
  else if (r.status) row(`google ${code}->${pivot}`, 'REFUSED', `HTTP ${r.status}`);
  else row(`google ${code}->${pivot}`, r.text ? 'answers' : 'EMPTY', show(r.text ?? ''));
} catch (e) {
  row(`google ${code}->${pivot}`, 'ERROR', e.message);
}
await sleep(2500);

// 2. Target direction: does it produce the language, or its prestige neighbour?
// Compare by eye against the same sentence sent to the neighbour code.
try {
  const r = await google(pivot, code, 'are you serious right now');
  if (r.blocked) row(`google ${pivot}->${code}`, 'BLOCKED', '429 on both clients, rerun later');
  else if (r.status) row(`google ${pivot}->${code}`, 'REFUSED', `HTTP ${r.status}`);
  else row(`google ${pivot}->${code}`, r.text ? 'answers' : 'EMPTY', show(r.text ?? ''));
} catch (e) {
  row(`google ${pivot}->${code}`, 'ERROR', e.message);
}

// 3. Lingva proxies Google but publishes a shorter list. Ask the list directly.
try {
  const res = await fetch('https://lingva.lunar.icu/api/v1/languages');
  const langs = (await res.json()).languages ?? [];
  const hit = langs.find((l) => l.code.toLowerCase() === code.toLowerCase());
  row('lingva', hit ? 'listed' : 'ABSENT', hit ? hit.name : `${langs.length} codes, none matching`);
} catch (e) {
  row('lingva', 'ERROR', e.message);
}

// 4. MyMemory answers 200 for codes it does not have. The tell is a translation
// identical to what the neighbouring language would give, so read the text.
try {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sentence)}&langpair=${code}|${pivot}`;
  const d = await (await fetch(url)).json();
  const m = d.matches?.[0];
  row('mymemory', d.responseStatus === 200 ? 'answers' : 'REFUSED',
    `resolved=${m?.source ?? '?'}->${m?.target ?? '?'} | ${show(d.responseData?.translatedText ?? '')}`);
  console.log(' '.repeat(35) + 'a 200 here is not support: judge the text above');
} catch (e) {
  row('mymemory', 'ERROR', e.message);
}

// 5. DeepL publishes its list. No key, no probe.
if (process.env.DEEPL_KEY) {
  try {
    const host = process.env.DEEPL_KEY.endsWith(':fx') ? 'api-free' : 'api';
    const d = await (await fetch(`https://${host}.deepl.com/v2/languages?type=target`, {
      headers: { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_KEY}` },
    })).json();
    const hit = d.find((l) => l.language.toLowerCase().startsWith(code.toLowerCase()));
    row('deepl', hit ? 'listed' : 'ABSENT', hit ? `${hit.language} ${hit.name}` : `${d.length} target codes`);
  } catch (e) {
    row('deepl', 'ERROR', e.message);
  }
} else {
  row('deepl', 'skipped', 'set DEEPL_KEY to probe');
}

console.log(`
Read this as: a provider that does not have the language must be made to return
'unsupported' so the chain cascades. Anything else counts a failure against it
and pushes it out of rotation.`);
