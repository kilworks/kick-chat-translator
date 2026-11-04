# Work queue

Marks: `- [ ]` open, `- [k]` waiting on kil, `- [x]` done. `state.mjs` counts
them and lifts the `[k]` lines into `ETAT.json`, so keep the marks exact.

Every entry carries the number that justifies it. An entry without one is a
hunch, and hunches go at the bottom until someone measures them.

---

## Dependency graph

Disjoint sets, named so the hypervisor can read them rather than guess. A unit
is spawnable when its set appears here and does not intersect another running
one.

```
ATTRACTORS, root only
  src/content/inject.css
  src/content/injector.ts

A. gate coverage        test/e2e/run-gates.mjs
                        test/e2e/*.mjs (the orphans)
                        .agent/state.mjs
   independent of everything below

B. repository hygiene   .gitattributes, .nvmrc, package.json
                        git history (node_modules)
   independent of A

C. live verification    test/e2e/compose-kick-live.mjs
                        test/e2e/lang-menu-live.mjs
                        test/e2e/bar-panel-mesure.mjs
   blocked on kil for the emote picker, open for the rest

D. store listing        store/
                        screenshots
   blocked on kil for review and submission

A and B do not intersect and can run at once. C touches only harness files but
reads dist/, so it serialises behind any build. D touches no code.
```

---

## Open

- [x] **Translation quality, research items 1 to 10, S1 and S2 (2026-11-03,
  branch `feat/translation-quality`).** From the study in
  `kick-translator-research`, each commit witnessed red first: sticky provider
  expires at 60 s (867f7f1), cache key keeps digit runs (51bcdf6), overrides
  through edge punctuation and stretching (c12d8b8), blind corpus 4 of 500
  lines (cb44f75), confident path vetoes on chat words (f02a639: corpus 4
  wrong 17 to 6, Tatoeba right 3731 to 3716, wrong 3), one-word CJK and more
  noise (06da9c8: 27 of 30 and 56 of 60 on fresh sets), on-device unchanged
  goes to the cloud in local-first (81cff2e), DeepL batch keeps a shared
  source and sends NB (673971f), two stale statements (0939934). The study's
  `verify-handover-claims.mjs` runs again: 48 of 67, the 19 others are counts
  grown since 2.10.0.
- [ ] **The blind bar is not met, and corpus 5 says it is further off than
  corpus 4 did.** Bar written before: at most one confident wrong answer per
  set, 0.7 % overall. Corpus 4 ended at 1.2 % and was read twice, so blind
  corpus 5 was written to the same brief (2026-11-04, 1c743c4): 13 of 500
  (2.6 %) before any rule, 3 native, 3 romanised, **7 of 25 laughter**. The
  Russian -yy adjective form (tuned on a separate 50-line bench, 10 confident
  wrong to 2) takes corpus 4 romanised from 4 to 2 and changes nothing on
  corpus 5. Laughter next (2026-11-04), tuned on a scratch bench of 141 mixed
  culture lines (73 confident wrong to 1): a laugh no longer votes beside a
  word the table does not know, mdr and ptdr leave the word table for the
  laughter table, and a laugh in another script no longer decides the script
  check. The raw path keeps the laugh vote before franc. Corpus 5, read a
  second time in totals: 13 to 6 of 500 (1.2 %), laughter 7 to 0, native right
  190 to 185 and still 3 wrong. Corpus 5 is no longer blind. Next: the 3 native
  and 3 romanised, tuned on a bench, judged on a corpus 6.
- [ ] **e2e: one gate out of 42 fails at random under 24 parallel.** Four full
  runs on 2026-11-04: extension-load, then green, then translate-cache, then
  nav-monde, each green when run alone (2 to 3 times). Not traced.
- [ ] **DeepL changes never observed.** No key on this machine. The batch
  `source_lang` and NB for Norwegian are pinned by tests on the request body
  only; NB as a source code comes from the DeepL list as recalled, not
  re-read. Check with one real key before calling it done.

- [x] **A fast chat lost its foreign lines inside the Google batch, and some
  that survived were shown wrong.** The coalescer joins up to forty lines into
  one Google request and Google detects one source for the whole of it.
  Measured 2026-10-10 on the live endpoint, one batch per reader language for
  all 42 targets, six English corpus lines and two foreign ones: right 5 of 84
  foreign lines, untouched 41 (dropped by the content script as "came back the
  same"), garbled 38 and displayed (Danish spelled in hanzi, Hebrew "same thing
  again" rendered in Dutch as "I think it is fine"). Every one was right alone.
  Lines now join only with the same looked-up source, else the same franc guess
  (`langGuess`, never sent as `sl`), else go alone, and unchanged lines in a
  guessed group are asked again. Replayed: 83 of 84 right, 0 untouched, English
  majority unchanged at 247 of 252. Cost: 215 requests for those 42 mixed
  batches against 42. **Superseded the same day**: `translate_a/t` takes each
  line as its own `q` and detects each one, so a batch is one POST again.
  Replayed: 84 of 84 foreign and 252 of 252 English lines equal to their
  translation alone, per-line detection right on 182 of 184, 42 requests; the
  real `googleProvider` was run once against the live endpoint. Not measured:
  the same-language scenario on all 42 (the run crashed and Google throttled
  this IP to about one answer every ten seconds), only en:en, 12 of 12 lost.
- [x] **The emote-name stripper deleted ordinary words.** The suffix rule took
  anything ending in lul, kek, jam, hug, love, wave or dab. On the 30000 most
  frequent words of 37 languages (wordfreq; et, th, tl absent from it), 309
  words, 23 per 10000 words of Romanian text. Now 2, emote recall 28/31 unchanged.
- [x] **The override table answered in 7 targets, and Google is wrong far
  beyond them.** Probed 2026-10-10: valeu came back "it cost" into every
  target tried, Latin or not; merci and gracias as "mercy" and "grace" in
  el, bn, ta; bonjour as "good luck" in yue; romaji left as is; zh-tw fell
  back on the Simplified column. Rows now carry a meaning, nine more non-Latin
  languages answer all 94 rows, and eleven rows answer the 26 Latin targets.
- [x] **English chat abbreviations reached other readers untranslated.**
  34 chat lines into the 42 other languages (2026-10-10): 952 of 1386
  abbreviations came back as typed, some as something else (idc as "I don't
  know", lmk as "kkkkk", goat as the animal). `abbreviations.ts` spells them
  out on lines read as English for a non-English reader: 0 left, 0 of 6005
  foreign corpus lines rewritten.
- [x] **Chrome's on-device engine translated from franc's guess.** It has no
  auto-detect. franc's non-English guesses name the wrong language on 166 of
  264 chat lines (Tatoeba 470 of 834), so those lines now go to the cloud;
  looked-up languages, English guesses and local-only stay on device.
- [x] **Pruning franc's 102 KB of models to the product's languages: measured,
  not done.** Every one of its 66 models wins lines on the corpora; the 44
  outside the product act as the reject class. `only:` halves franc's time
  (44 to 24 µs) but turns 339 silent lines into 293 wrong ones on Tatoeba.
- [k] **Native read of the new override wording.** fa, bn and ta above were
  written without a native speaker; the Latin column too, though plainer.
  Probed only into en, fr, es, pt, de, tr, pl and the nine non-Latin targets.
- [x] **Provider language codes.** Google detects `iw` and `zh-CN`, DeepL `NB`:
  normalised. Lingva (lingva-scraper 1.1.0) rejected he, zh-tw, pt-br: mapped.


- [x] **Platform-injected text is settled without a corpus.** The category was
  blocked on a live chat capture. Kick's own i18n payload, inlined in the page
  it serves, answers most of it. The notices live under two namespaces:
  `EventBanner` carries `"<username/> has subscribed for <count/> {monthCount,
  plural, ...}"` and the gift and host equivalents, `ChatroomEvents` carries
  `"<user/> has subscribed! They have been subscribed for a total of
  <months/>"`. They are ICU strings with plurals and substitution tags, which
  means they render in the viewer's interface language rather than the
  channel's. Running the real strings through the pipeline settles the damage:
  an English notice is detected `en`, so it equals an English target and is not
  translated, and against any other target `ignoreEnglish` drops it; a French
  notice is detected `fr` and equals a French target. Both common
  configurations neutralise the notice with no rule at all. The residue is a
  Spanish notice detected Portuguese and therefore translated, which is the
  short-text detection weakness already measured elsewhere, not a category of
  its own. Two corrections on the way there: a first reading claimed
  `kick.com/locales/en.json` was a 349 KB lexicon, when it returns the SPA
  shell and the keys found in it were the page's own inlined payload; and a
  search for hard-coded notice sentences in the 66 chunks found none, which was
  the clue that they are localised rather than the absence of evidence it first
  looked like. What stays open is narrow: whether these rows carry `data-index`
  at all. `EventBanner` reads like a banner outside the message list and
  `ChatroomEvents` like a row inside it. Only a real DOM settles it, and given
  the measurement above the answer changes little.

- [x] **The bench covered five of the ten languages the product speaks, and the
  five it missed were exactly the non-Latin ones.** The product translates into
  42 languages but it SPEAKS ten: its interface and its store listing exist in
  en, ar, es, fr, ja, ko, pt, ru, tr and zh, which `ls src/content/i18n/`
  settles. The corpus was 51 lines in 14 languages, all Latin, so every figure
  published on detection was a Latin figure and ar, ja, ko, ru and zh had never
  been looked at once. Extended to 176 lines in 19 languages, 25 per missing
  language, all ten covered. Read per language, never as a total: **ar 25/25,
  ja 25/25, ko 25/25, ru 25/25, zh 24/25**, against es 3/8, fr 4/5, pt 3/6,
  tr 1/4. Silent losses: 0 of 1125 pairs on the non-Latin half, 8 of 483 on the
  Latin half. The whole of the damage measured over the previous passes lives in
  the Latin half, and the half that is decided by writing system is clean. That
  is not a compliment to the code, it is the reason the two halves must never be
  averaged again.
- [x] **The non-Latin bench now lives in the repository, not in a scratchpad.**
  `src/content/langDetect.dix.test.ts` carries the 125 lines for ar, ja, ko, ru
  and zh with a floor per language: 25 of 25 identified and 25 of 25 handed to
  the engine as a source language for the four the table decides, and for
  Chinese 24 of 25 identified with 0 of 25 confident, which pins the asymmetry
  in place. This is what happened to the 41-case grid, measured then lost then
  measured again, and the Latin corpus is heading the same way. A test file
  weighs nothing in the shipped bundle and that is checked rather than assumed:
  `audit-poids` reads the same +0.32 percent before and after adding it. The
  Latin half stays out because a floor there would be noise, 1 of 4 to 4 of 5
  depending on the language; it is covered case by case instead.

- [x] **An emoji diluted the writing system out of a line, and a chat without
  emoji does not exist.** `detectByScript` decided on a strict majority of all
  non-ASCII characters, and an emoji is non-ASCII while feeding none of the
  eight scripts, so it inflated the denominator without ever being able to win.
  Measured on the five languages this check is the only mechanism for: "да" plus
  two emoji fell to 2 of 4, no strict majority, `undefined`; "رائع" plus four
  emoji fell the same way and franc took over to answer **Persian** on Arabic.
  The denominator counts only script-bearing characters now, and all four test
  languages hold through six emoji. The earlier fix that gave bare Korean jamo
  their own bucket was this same bug treated locally: its comment said those
  letters "counted toward the total while feeding no script", which is the
  general defect, described once and fixed in one place.
- [k] **The Persian split is measured but never observed running.** The rule
  changes what detection returns for an entire writing system, so the flag, the
  badge name and the right-to-left rendering of a Persian line all move, and
  none of that has been looked at. kil's ruling: a Persian stream is too hard to
  find to make a live harness worth building, so this one stays theoretical, on
  tests and measurement only. Written down as a `[k]` rather than as done,
  because "never say done about behaviour you have not observed" does not stop
  applying just because looking is expensive.
- [x] **Persian was declared Arabic, and declared it as a confident source
  language.** The Arabic script is not a language. Measured on twelve Persian
  lines: twelve of twelve returned `ar`, and returned it through
  `confidentLanguage`, so the engine was told `sl=ar` on Persian text, the flag
  was wrong on every line, and an Arabic-reading viewer had every Persian line
  skipped as already in their language. Persian is one of the 42 and the store
  listing sells right-to-left as "Arabic, Hebrew, Persian". franc knew, answering
  `pes` on seven of eight, and was never consulted because the script answered
  first. What separates the three is letters, not statistics: Persian adds peh,
  tcheh, jeh, gaf, keheh and farsi yeh, and Urdu adds seven more on top of
  Persian, so Urdu is tested first or its Persian letters make it Persian.
  Measured: Persian 11/12, Arabic 12/12 with no false positive, Urdu 4/4. Urdu
  returns undefined rather than a code, since it is not among the 42 and naming
  it would ask for a flag nothing can draw. The one Persian line missed carries
  no letter outside the Arabic set and nothing in the text separates it.
- [x] **The two-character floor was measured and kept, and its price is
  written down.** At a floor of one, "Amazing play" spelled with a Cyrillic A
  becomes Russian and so does "so good" with a Cyrillic o, which is a homoglyph
  trick chat sees every day. At two, those are safe and the price is the CJK
  message of a single character: 草, は, 네 stay unread. Both sides have a
  witness in the test file.
- [x] **The non-Latin half of code-switching and laughter is clean, and here is
  the measurement that shows the probe looked.** Eight mixed lines: `gg やばい`
  reads ja, `gg 대박` ko, `omg 太厉害了` zh, `gg давай` ru, `thanks شكرا` ar,
  seven of eight. The eighth is an English sentence carrying one kana, which the
  floor leaves undefined, and undefined is the right answer there since it sends
  the line out with the engine deciding for itself. This is the mirror of the
  Latin case that was reverted two commits ago, and the difference is principled:
  a script is a fact about the text, franc's guess is not. Eight laughter forms
  across five writing systems, 草, 草草草, wwwww, ㅋㅋㅋㅋ, 233333, ｗｗｗ, хахаха,
  ههههه, are all dropped by `isNoise` before any of this runs.
- [x] **Nothing maps franc's `arb`, its own top answer for Arabic. Kept that
  way, on measurement.** The gap was not latent: an Arabic line that
  `arabeOuPersan` cannot read falls to franc, and franc says `arb` on some.
  Mapped on 2026-10-09 and measured on Tatoeba plus 80 Arabic and Persian chat
  lines (`LANG_CHAT_AR_FA`, PR #18): five Arabic lines silent to right
  (`تمام`, `ابداع`, `وحش`, `اهلا`, `اهلا وسهلا`), three Persian silent to
  wrong (`اعتراض!`, `ممنون`, `نترس`), and an Urdu witness that needed its own
  guard. The common greetings franc misread (`مرحبا`, `منور`, `شو صار`) are
  taken by Arabic-only chat words in #18 instead, which move no Persian line.
  A wrong `ar` hides a Persian line from an Arabic reader; a silent Arabic
  line goes to the engine, which reads it. Reverted; the reason sits by the
  table and `langDetect.test.ts` holds `ممنون` and `نترس` silent.
- [x] **Arabic chat greetings were read as Persian.** `مرحبا`, `منور`,
  `شو صار` carry no letter or function word of standard Arabic, leave
  `arabeOuPersan` without an answer, and franc read them `pes`. Measured
  2026-10-09 on `LANG_CHAT_AR_FA` (40 Arabic dialect chat lines, 40 Persian,
  hand-written before tuning by the session that then picked the words):
  Arabic 19 right / 13 silent / 8 wrong (7 of them `fa`) before, 31 / 7 / 2
  after; Persian 30 / 9 / 1 before and after. Ten Arabic-only chat words
  (`MOTS_ARABES_CHAT`) feed `detectLanguage` only, not `sl`. Out on purpose:
  `ممتاز`, `تمام`, `خلاص`, `بس`, which Persian writes too (the corpus carries
  them as Persian traps). Tatoeba matrix unchanged. Still wanted: real Kick
  chat in Arabic and Persian to check the words against.
- [x] **Chinese never gets a confident source language, alone among the five.**
  ar, ja, ko and ru all come out of `detectByScript` as looked-up facts and go
  to the engine as `sl`; zh is deferred to franc by `if (pct(han)) return
  undefined`, so `confidentLanguage` withholds it and every Chinese line leaves
  with the engine guessing. Measured: zh 24/25 identified, 0/25 with a confident
  source. The deferral is deliberate, Han-only text can be Japanese, and the
  cost is small since engines auto-detect Chinese well. Recorded so the
  asymmetry is a decision rather than a surprise.
  **Re-measured 2026-10-07, the entry was stale.** `cantonaisOuChinois` now returns `zh` or `zh-tw` from simplified or traditional markers: on the four corpora, simplified 90/120 lines leave with a confident source, traditional 105/120 (ja, ko 120/120, ar 119, ru 97). The 30 simplified lines left use only characters both scripts share, and announcing `zh` on them would mislabel kanji-only Japanese. Nothing to change.

- [x] **The short-text residue has its damage measured, and two repairs were
  measured and thrown away.** 51 short chat lines in 14 languages through the
  real detection: 28 right, 10 silent, 13 confidently wrong. The wrong answers
  are the interesting half, because `prepare()` kills a line on `detectLanguage`
  alone through `isSameLanguageAsTarget`, which does not require the wrong
  answer to be English, only that it equals the reader's target. Over the 663
  (message, target) pairs that need a translation, 11 are silently skipped as
  "already in your language", 1.7 percent, and 11 of the 51 messages are lost at
  at least one target. All 11 are on non-English targets, fr 4, pt 3, de 2, es 1,
  id 1, so this is a second silent-loss path beside the one `ignoreEnglish`
  owns. **Repair A, only a table answer may skip a line**: takes the 11 losses to
  0 and adds 37 provider calls over the same pairs, and only 2 of the 51 messages
  have a table answer at all, so in the configuration that matters (a Spanish
  reader on a Spanish stream) it sends every line to an endpoint that soft-bans
  per IP. Rejected on the same ground as the coalescing floor. **Repair B, a
  length floor under the guess**: 11 losses at 15 characters, 6 at 20, 3 at 22,
  0 at 30, against 0, 6, 10 then 23 correct skips lost out of 26. No knee, the
  same shape as tinyld's confidence bar. Rejected. What ships instead is the
  table reach below.

- [x] **The short-word table was given a 30 character reach, and it is taken
  back.** `SHORT_TEXT_MAX` was 20 and eight of the thirteen wrong answers sat
  between 21 and 26 characters, out of the table's reach. Measured at 20, 25,
  30, 35 and 40 on two benches of the same lengths: 13 foreign lines carrying a
  table word, 10 read right at 20, 12 at 30, 13 at 35; and 8 English chat lines
  also carrying a table word, 2 wrong at 20, 3 at 30, **8 at 35**. Length does
  not separate the two, it lets them in together, the same answer repair B gave.
  franc does separate them, answering `eng` on 6 of the 8 English lines and on
  none of the 13 foreign ones, so an explicit `eng` cancelling the table's vote
  paid for the extension: 12 of 13 right, English damage unchanged at 2 of 8, 51
  bytes, one extra franc call at 23.5 to 38.9 microseconds per message. It
  shipped on that measurement and is reverted on the next one.
- [x] **What the bench could not see was the message that changes language
  mid-sentence, and it is the case that decides.** Eight mixed lines through the
  real order: at `SHORT_TEXT_MAX` 20, three are killed before the call and none
  gets a source language declared on one half; at 30, six are killed and four
  do. "merci bro that was insane" is one French word in an English sentence,
  and at 30 it leaves as `sl=fr` and disappears for a French reader. The franc
  veto rescues nothing there, because franc answers `eng` on none of the eight.
  A single foreign word inside another language is more common in a chat than a
  25 character foreign sentence, so the bound stays at 20. It stays there on
  this measurement, not because 20 was ever measured as optimal. The witness is
  in the test file: raising the constant turns it red on the source language,
  which is the half of the damage that reaches the engine.

- [x] **The experiment the weight item was waiting on has been run, twice, and
  the first run was wrong in two ways.** `franc(text, { only: [...] })` is
  exactly a model reduced to a list, so the before and after costs nothing to
  measure. **First correction, the list.** It was built by pushing three
  sentences through `francAll`, which only ever returns the languages of those
  sentences' scripts: 21 codes, missing `cmn`, `jpn`, `kor`, `tha`, `hin` and
  `pes`. Since `only` also filters the final answer, the reduced variant was
  destroying Chinese, Japanese and Korean detection outright, so the run
  measured that hole and nothing else. The list is read out of the package now,
  `data.js` for the trigrams and `expressions.js` for the script regexes: 76
  codes, 29 mapped. **Second correction, the target set.** The published delta,
  11 silent losses becoming 13, was counted against 14 targets including nl, id,
  cs, ro, sv and vi, which the product does not speak. Against the ten it
  speaks, the same measurement gives 8 and 8: the trim costs nothing at all on
  the number that decides. Against all 42 targets it gives 43 and 50.
  Rerun on 176 messages through the whole detection: right 152 to 158, silences
  11 to 1, wrong 13 to 17. Still not shipped, and the reason is now the only one
  that survives: `only:` frees zero bytes. The 61 KB stays in the bundle either
  way, so the weight motive that justified the experiment does not exist, and
  what remains is an accuracy trade that changes sign with the target set.
- [x] **franc-min carries trigram data for four scripts only**: Latin,
  Cyrillic, Arabic and Devanagari. The other sixteen it recognises with a single
  regex per script that returns one language, which is where `cmn`, `jpn` and
  `kor` come from. So for Chinese, Japanese and Korean, franc is not a second
  opinion on top of `detectByScript`, it is the same idea one level down. The
  comment saying pure Han is deferred to franc "so Chinese isn't mislabelled as
  Japanese" is true in effect and misleading in mechanism.
- [x] **The ten silences are not franc saying `und`.** They are franc answering
  Somali, Lingala, Fulfulde, Uzbek, Hausa, Croatian, Sundanese and Javanese on
  Spanish, Portuguese, Italian, Turkish, Polish and Indonesian chat, and
  `francToIso2` returning undefined because the product does not translate those
  languages. The 40 unmapped languages are absorbing wrong answers, which is
  worth knowing before anyone trims them to save bytes, and it is also why the
  trim above turns silences into answers rather than fixing anything.
- [x] **The short-word table was built from greetings, and a chat message is not
  a greeting.** hola, merci, danke, grazie, obrigado: that is what you write when
  you picture a chat, and it is not what an arbitrary message contains. Measured
  cost: of the eleven lines detection could not name, half were ordinary
  Portuguese and Turkish, "nao acredito nisso", "vamos ganhar essa", "ne oluyor
  burada", carrying no table word at all. The second set of entries is STRUCTURE
  words, the ones that turn up in any sentence, under the table's own rule, and
  that rule is what picks the es/pt pairs since spelling separates them cleanly:
  nao against no, hoje against hoy, agora against ahora, pode against puede,
  estao against estan, essa against esa. Measured over the 176-line bench: right
  152 to **157**, silent 11 to **8**, confidently wrong 13 to **11**, silently
  lost pairs 8 to **6**; over the ten alone, right 138/152 to **143/152** and
  losses 5 to **3**. Six lines moved on the Latin bench, all in the right
  direction, two of them from wrong to right, and five gained a correct source
  language for the engine. 530 bytes, and not one extra provider call.
- [x] **The Latin bench is in the repository too, as a ledger rather than a
  floor.** `src/content/langDetect.latin.test.ts` pins all 51 lines with what
  detection returns today and what it dares send as a source language. Where the
  verdict differs from the truth the line is a known defect, written as such.
  A floor would be noise here since the rates run from 1 of 4 to 4 of 5, so what
  the file guarantees instead is that any change to the detector turns exactly
  the lines that moved red. It earned that in the same pass: the structure words
  above turned six red, and reading them was how the direction of the change was
  checked rather than assumed. Two invariants sit beside the ledger and are real
  rules rather than records: no non-English line may be classified English, and
  no confident source language may ever be wrong.
- [x] **The source allowlist was fixed one layer below itself.**
  `shouldDropBySourceLang` returns `lang_unknown` when detection is silent, and
  the line dies before any call with that reason left on it, so it is visible to
  whoever hovers rather than silent in the strict sense. The rate this item first
  carried, one short message in five, was a Latin rate; on the full bench it was
  11 of 176, and exactly one of those 11 was non-Latin. The obvious repair, let
  the line through and decide on the engine's own `detectedLang` after the call,
  was measured and cannot be right for both readers, because **the two sides are
  the same lines**: what the viewer whose allowlist matches the chat loses is
  precisely what the viewer whose allowlist does not match would newly pay for,
  message for message. The option promises "ONLY translate those", so both
  readings are legitimate and no threshold arbitrates between them. So it was
  fixed in detection instead, where it costs nothing and serves both: pt from 3
  lost of 6 to 1, tr from 2 of 4 to 1, bench total 11 to 8. What remains, per
  language rather than as one rate: id 2/3, es 1/8, pt 1/6, it 1/4, tr 1/4,
  pl 1/3, zh 1/25, zero for ar, ja, ko and ru. Reopening the allowlist itself
  needs a case detection cannot reach.

- [x] **Three impurity categories rebuilt with their intent written down first,
  and the tenth probe that accused working code.** The deleted grid left
  identity at 3 of 5, no-language at 5 of 6 and slang at 6 of 7, and what was
  missing from it was not the cases but the definition of correct: a case
  without a stated intent gets judged afterwards, and always in favour of what
  the product already does. Rebuilt on 21 cases with the intent stated per
  category and run in the pipeline's real order. **The probe's first version
  accused the product on four of them**: it judged the raw text, and
  `parseKickContent` already strips `@mentions` and scheme-carrying URLs, so
  `@handle`, two handles, a bare `https://` URL and a handle followed by a URL
  all come out of the parser as an empty string and die on `minTextLength`
  before anything looks at them. A fix was written for that non-problem, wiring
  `isLinkOrMentionOnly` from `composeLogic` into `prepare()` with a localised
  reason in nine catalogues, and the pipeline test written for it failed by
  reporting the length reason instead, which is what exposed the mistake. All of
  it reverted.
- [x] **A hostname was read as Japanese laughter and declared Japanese to the
  engine.** kil's remark, that `wwwww` and even `www` are laughter in Japanese
  chat, was aimed at the scheme-less domain idea below. It turned out to name a
  defect that was already live in the opposite direction. The laughter table
  carried `ja` on `/^w{3,}$/i` with the note "three or more, so it cannot be a
  bare www host". That argument reads the whole message; the vote runs per
  token, and `detectByShortWords` splits on non-letters, so `www.kick.com`
  becomes the tokens www, kick, com and the first one votes alone. Measured:
  three real hostnames of four came out `ja` **with `sl=ja`**, asking the engine
  to translate a URL from Japanese. The table's own rule settles it, an entry
  earns a language only when it is unambiguous, and `www` is not. The half-width
  form stays laughter and marks nothing; the full-width `ｗｗ` takes the mark
  instead, since no hostname is ever written in full-width letters, and that is
  a gain rather than a swap: `sugoi ｗｗｗ` reads ja now and did not before. The
  price is written down too: romaji Japanese followed by half-width `www` leaves
  with an empty `sl` and the engine detects for itself.
- [x] **The `note` field of a language table is a value, not a comment, and it
  ships.** Writing the reasoning above into two notes cost 770 bytes on every
  Kick page, +0.68 percent against the reference where the pass had been sitting
  at +0.35, and the build is what caught it. Moved into a `//` comment, which
  the minifier erases, and the notes are back to the length of their neighbours.
- [x] **Switching stream needed a second page load, and the gate that watched it
  was green.** Reported by kil on his own build. Root cause measured, not
  reasoned: `index.ts` had two triggers for re-attaching to a route, a patch of
  `history.pushState` and a `popstate` listener. `popstate` does not fire on a
  `pushState`, it is back and forward only. That leaves the patch, and a content
  script lives in an ISOLATED WORLD: its `history` is a different JavaScript
  object over the same session history, so patching there intercepts nothing the
  site's router calls. Read from the main world, `String(history.pushState)` is
  `function pushState() { [native code] }`.
  **Why the gate lied.** The observer has a net of its own, a `containerWatcher`
  that re-attaches when the container leaves the document. It rescues the
  incoming translations, which is all `translate-navigation` asserts, and nothing
  `attachForRoute` carries above them. Measured over three channels visited
  without a reload: Kick's API was queried for the first one only, so the compose
  preview kept writing in the language of a channel the reader had left. Three of
  three after the fix, which is reading `location.pathname` twice a second: no
  world, no event the site chooses to emit, and it works on Firefox, which has no
  Navigation API. **On master**, 40/40 gates, four channels of four queried.
  **Not established, and it is the part only kil can close:** his exact symptom.
  This fixes the route re-attachment and everything it carries. The incoming
  translations survived a navigation in both simulated shapes, so if they do not
  survive on his Brave there is a third shape no fixture reproduces.
  `nav-recon.mjs` looked at the real site twice, the second time clicking a
  channel link FROM a channel page, which is kil's own gesture: one main-frame
  navigation, so a full reload, and the product recovers by itself, bar mounted
  and 24 rows back at two seconds. The remaining difference is the session. An
  app that server-renders for an anonymous visitor very ordinarily routes on the
  client for a signed-in one. Signing in is not something I do, so that half is
  his. What matters: the fix covers exactly the case I cannot observe.
  **Brave itself is no longer a variable.** `KT_BROWSER=<brave.exe>` runs the
  probe on kil's own browser with a fresh profile and no session: identical to
  Chromium, four channels of four queried, so the fix works there. The same run
  reproduces his SECOND report in his own browser, pausing one channel turning
  off the next. What is left needs a signed-in session, and entering credentials
  is not something I do. That is a boundary, not a skipped step.
  **And the unblock is smaller than I said.** I repeated from a June note that a
  registry key had to be copied to Brave. Read from the registry instead: the key
  is there, the manifest and host are valid, and the Claude extension is installed
  in Brave's Default profile at v1.0.90 while Brave is running. Yet
  `list_connected_browsers` returns empty. So it is neither the registry nor the
  install: the extension simply is not CONNECTED, which is a click in its own UI.
  Once it is, a session can look at the signed-in site and this closes.
  **Six ways in were tried and the journal lists them** so nobody redoes it. The
  only one that would have shown a signed-in client-side route is kil's real
  browser through claude-in-chrome, and it is shut: `list_connected_browsers`
  returns empty, which the Brave bridge note has said since 2026-08-16. The
  unblock is a native-messaging registry key copied from Chrome to Brave.
  Touching the registry is not something I do, so that one is kil's, and it is
  worth more than this bug: it reopens the whole 'look at the real signed-in
  site' path for every future pass.
  **A seventh way was tried and it produced the direct proof.** On a real channel
  page in Brave, anonymously: Kick is Next, `window.next.router` is reachable, and
  `history.pushState` in the main world is NOT native. Kick's own router has
  already replaced it, so the content script's isolated-world patch could never
  fire. That is the diagnosis read off the page kil opens rather than argued from
  how worlds work. Asking that router to navigate still produced a full document
  load, on every anonymous path measured.
  **An eighth eliminated the last cause I could test without him.** "Needing a
  second load" is the signature of a RACE, so six arrivals on real channel pages
  in Brave were counted on `data-kt-id`, the mark the observer leaves on a row it
  saw: 3 of 3 attached first time, the other three being offline channels with no
  chat at all. No race on that path. What is left is one variable, the session.
  **And the check that needs it is no longer tedious, which is what kil actually
  flagged.** `scripts/kick-switch-check.js` pastes into the console of a channel
  page, in his browser with his session, and prints a verdict across a switch. It
  reads only, and it tells a client route from a reload by whether a
  `sessionStorage` marker survived. Verified both ways in Brave on a client-side
  route: with the extension it says it works without reloading, without it says
  the content script is absent and that this is not the route re-attachment. It
  separates three causes, so whichever one he hits comes back named.
  The check is one build and one switch: `npm run build`, load `dist/` unpacked,
  switch stream from the sidebar, and see whether the next channel translates
  without a reload.
- [x] **Per-channel pause: on master, all four quarters observed.** The bar's
  control wrote `settings.enabled`, which is global and synced, so pausing on one
  stream turned the product off on every other stream, in every tab, durably.
  That was kil's second report. It writes `pausedChannels` now and one derived
  view, `vueLocale`, is the single place the rule lives; the pipeline, the compose
  controller and the bar take that view and none of them changed. Ported from
  `feat/nav-monde-isole` onto 3.0.1, where the URL poll had already landed.

      pause clicked, same channel        stops translating     OK
      resume clicked, same channel       translates again      OK
      next channel after a pause         translates            OK   <- the report
      returning to a paused channel      stays paused          OK   <- was MISS

  **The miss was a race, not a missing push.** The new channel's rows can reach
  the observer before the URL poll sees the change, up to `ROUTE_POLL_MS` later.
  They were handled with the view of the channel being left. The observer marks a
  row `data-kt-id` before its callback runs, so the reset the poll triggers never
  took them back: a row translated in that window stayed translated. The callback
  now compares the live slug with `currentSlug` and catches the route up first.
  Witness: `nav-monde` red on line D with the port alone, green with the catch-up,
  the 39 other gates green both times. `nav-monde` is now in the runner, so it is
  no longer an orphan.
  **Not observed on kick.com.** Every line above is the fixture. The live check is
  one pause, one channel switch, one return.
- [x] **The bar's pause does not say it is per channel.** Its tooltip still reads
  "Pause translation", which was true when it was global. "Pause on this channel"
  needs a new string in every UI language, and the native-review item below is
  what keeps new strings honest, so it waits on that rather than on a guess.
  **2026-10-07:** done without waiting: "Pause on this channel" and "Resume on this channel" in the ten interface languages, short enough to need no native read beyond the review already listed.
- [x] **The popup knows the channel is paused.** With the pause scoped to a
  channel, the popup's switch read "on" over a tab that translated nothing. The
  popup now reads the active tab's URL (host_permissions covers kick.com, so no
  `tabs` permission and no re-consent) and shows "Paused on this channel" with a
  Resume button that removes only that slug. Measured before it shipped: the
  default popup (compose and stats both on by default) is 586px, the row adds
  56 + 12, so 654px against Chrome's 600px ceiling. The row takes the place of
  the day's numbers (91px) while the tab is paused: 551px in all ten interface
  languages. `measure-popup` now measures both states and fails as a mute probe
  if the paused row is not on screen; putting the numbers back beside the row
  turns it red at 654px. Unit test mounts the popup in happy-dom: red with the
  row removed.
- [x] **A Kick tab open during an install or an update keeps working.** Chrome
  injects a content script only into pages loaded after an install, and an
  update cuts off the copy in open pages while leaving it in the DOM. Measured
  on the fixture: after the update the bar still read "Translating" and the next
  message was not translated. Every release would have done that to every Kick
  tab open at that moment. Three parts, each with its own red:
  1. `onInstalled` re-injects `assets/content.js` into open kick.com tabs
     (`scripting` permission, justified in the store text). Without it:
     `mise-a-jour` red.
  2. The row mark is signed per instance. A 3.0.1 orphan has no way to stop, its
     MutationObserver was created first, so it marked each new row with the bare
     id before the new script saw it, and the new script skipped it. Measured
     with a real update from the published 3.0.1 package (`KT_EXT_AVANT`): red
     without the signature, green with it.
  3. At start the script removes a predecessor's bar and language menu (the menu
     was doubled under the same id), and an orphan of this version and later
     stops its own observers on the first tick where `chrome.runtime.id` is gone.
  **The probe lied twice before it measured.** `chrome.runtime.reload()` on a
  command-line extension leaves it disabled under Playwright, and so does a
  reload from `chrome://extensions` with developer mode off
  (`disableReasons.unsupportedDeveloperExtension`). Both runs measured a dead
  extension, not an update. Developer mode on, then `developerPrivate.reload`:
  the worker comes back and `onInstalled` runs.
- [x] **The chat strings had no accents in four languages.** fr, es, pt and tr
  chat and bar strings were ASCII from end to end ("Traduction desactivee",
  "Ceviri kapali", "Voce escreve", French elisions as "l envoyer"), plus twenty
  popup and options strings. 145 restored, placeholders checked, and
  `i18n.accents.test.ts` fails on any form that only exists unaccented: all
  eight of its cases fail against the old tables.
- [x] **A new install is pointed to Kick.** Until a first translation (zero
  requests and an empty history), the popup opened outside Kick offers to open
  a channel, at the top, in place of a day of zeros. Russian, the longest,
  wraps to three lines: 567px of 600.
- [x] **Re-injection on Firefox left two live copies in every open tab.**
  Firefox, unlike Chrome, injects the new content script into open tabs on
  its own after an update, and `onInstalled` then injects it a second time.
  Both copies have a valid `chrome.runtime`, so the orphan check never split
  them: each took every message and the second replaced the first's line.
  Nothing showed in the piece counts (one bar, one chip, one menu), which is
  why `KT_DOUBLE` read green on Brave. Playwright's Firefox still cannot load
  the extension, so `mise-a-jour --firefox` replays that sequence on Chromium
  and counts the copies that sign a new row's `data-kt-id`: 2 before, 1 after.
  The newest copy now names itself on the root (`data-kt-instance`) and any
  other stops on its next tick, the route poll at most 500 ms later. CI
  witness: `index.relais.test.ts` loads the module twice, red without the
  hand-off. Not measured on a real Firefox: no Firefox in the session that
  wrote this. The probe's first message now waits for its translation instead
  of a fixed 4 s, and a silent probe prints what the page held: in a sandbox
  without internet, 2 runs in 12 came out silent with the row marked and the
  bar mounted, so the engine answer was what was missing, not the script.
  Two copies starting within milliseconds also crashed the older one's
  `main` (`sondageRoute` read before its `const`); witnessed by the second
  case of the same test.
- [k] **Tab insertion after an update, on kick.com.** `mise-a-jour` now types
  in the composer across an update from 3.0.1: the preview shows, Enter is not
  blocked, one panel. Insertion itself is not measured: Tab does not replace
  the text on the fixture even before any update, and no gate measures it off
  the live site.
- [k] **`scripting` on a store update: confirm no prompt.** Chrome documents no
  install warning for `scripting` on its own, and the unpacked 3.0.1 to this
  build reload stayed ENABLED, but an unpacked reload is not the store's update
  path. What is needed: after publishing, check on one machine updated from the
  store that the extension is still enabled and no "new permissions" banner
  appeared. A disabled-pending-approval extension across thousands of installs
  is the failure this guards against.
- [x] **`translate-navigation` asserts less than its name promises.** It replaces
  the container wholesale, which the observer's own net rescues, so it stays
  green while every other consequence of a channel switch is broken. It wants the
  four assertions `nav-monde.mjs` makes, per channel: translations resume, the
  bar is there, the channel language is re-queried, and the pause state follows
  the channel. Until then a green run on it means less than it looks.
  **2026-10-07:** `nav-monde` is in the runner now and makes the four assertions per channel, so the guard this asked for exists. `translate-navigation` stays as it is: it still guards the observer re-attaching when the container is replaced.

- [x] **CI had been red for fifteen days and forty-eight runs, and the defect it
  named was real.** Found by rendering the README to look at it: the badge at the
  top said `failing`. Last green run 2026-08-16. Nothing surfaced it because the
  39 offline gates are green, the unit tests are green on this machine, and the
  badge lives on a page nobody reopens.
  **The two failing assertions were not flakes.** `localLangName` promised in its
  own comment to fall back to the native name when the engine answers nothing,
  and did not: `Intl.DisplayNames` defaults to `fallback: 'code'`, which echoes
  the code back rather than answering nothing. Measured, `of('xx')` returns
  `"xx"`, truthy, so `|| fallback` never ran and a reader got `xx` in a language
  row. `of('zzzz')` throws instead, being malformed rather than unknown, and only
  on some runtimes: the test covered only that path, so it passed here and failed
  on CI while the defect neither described went unexercised.
  **Then the fix did not take, because there were three implementations.**
  `langChip.ts` carried the same defect; `langMenu.ts` avoided it with an
  `n !== code` guard written against the symptom, which also drops a legitimate
  name equal to its code. Both delegate to `shared/languages.ts` now. Green on
  two consecutive runs after the fix.
- [x] **The gates run without opening a window.** The repository had concluded
  headless was impossible for an MV3 extension. True of Playwright's
  `headless: true`, false of Chromium's `--headless=new`. Measured on one build
  and one page: windowed-off-screen and `--headless=new` both inject the content
  script and start the worker, `headless: true` does neither. `run-gates.mjs
  --headless` sets `KT_HEADLESS=1` and `playwright.mjs` reads it once for all 39
  harnesses, so it is one edit and not thirty-nine; a `channel` option still
  means the machine's Chrome and is left alone. All 39 pass either way, pixel
  assertions included, and with no window there is no contention: **50.1s at
  `--jobs 8` against 83.6s at `--jobs 3` headed**. The probe asserts the user
  agent says `HeadlessChrome` rather than trusting the flag it passed, and its
  first version ran the windowed control through the shim under test, so all four
  rows agreed and the control witnessed nothing.
- [x] **The README shows the product, and nobody real is in it.** It carried one
  capture of a live Japanese channel with four real chatters' handles and their
  messages, plus two images hosted outside the repository: one whose alt text
  described a chat while showing the popup, one showing real usernames beside a
  status bar from a version that no longer exists. All three are gone from the
  four README files, replaced by four generated from the fabricated room the
  screenshot harness was written for. Frames are derived from the DOM rather than
  written as pixel rectangles, and each image is checked for its own subject
  before it counts. Five release-note sections moved out to the CHANGELOG they
  duplicated, which takes Install from line 156 to line 80, and a Tests section
  now documents the gates and why the obvious headless flag is the wrong one.
  A row cut in half at a frame's top edge took a real diagnosis: `scrollTop` did
  nothing because the list is `justify-content: flex-end` and content overflowing
  the START of a flex container is unreachable by scrolling, so the rows the
  frame cannot show are removed instead.
- [x] **The screenshots cannot go stale in silence any more.** The harness that
  makes them was in no runner, so a redesign could empty a panel while the four
  README files kept showing a product that no longer exists, with every test
  green. It is the 40th gate now, `captures-readme`, which the headless mode made
  affordable: 26.9s, and the whole suite is 73.5s at `--jobs 6`. It does not
  compare the committed images, it checks the harness can still produce valid
  ones, which is the half that a machine can judge. Witness, measured: renaming
  the language panel's selector the way a redesign would turns it red on both
  halves, "no element found, nothing to frame" and "does not show its subject",
  instead of writing a picture of an empty page.
- [k] **The three localised READMEs are behind, in two ways that differ.** Their
  images are fixed, so no real person's handle is on any of them any more. What
  is not fixed: their release-note sections stop at 2.8.1 while the product is at
  2.10.0, and the alt strings written for the new images were written without a
  native reader, in es, pt-BR and ja. That is the same class as the store listing
  item below, and it wants the same answer rather than more of me guessing.
  **2026-10-07:** the release-note half is gone, all four READMEs point to the releases and CHANGELOG instead of copying them. What remains is the native read of the image alt strings in es, pt-BR and ja, which belongs with the store text review.

- [x] **The transliteration guard is rescued, measured against the real
  provider, and wired.** 427 lines that existed on one disk, untracked since
  2026-06-08 in a stale second clone, addressing a hole this branch does not
  touch: a provider that answers a short Latin-script message with a phonetic
  spelling in the target's script instead of a translation. Committed verbatim
  first, wiring second, on `feat/transliteration-guard`, pushed. I did not write
  it and cannot claim it; a fresh session has no record of the work and the file
  carries no authorship.
  **What 90 pairs through the endpoint the product actually calls said**, with
  the intent per category written before the counting. Transliteration, the
  input's sounds in the target's script and no meaning delivered: ja 4/18,
  ko 5/18, zh 2/18, ru 5/18, ar 2/18, so 18 of 90. A second defect the guard was
  not built for and repairs by accident, the wrong sense of a real word, `coucou`
  read as the cuckoo bird in four targets of five and `merci` as mercy in ko and
  ar: 8 of 90. The remaining 64 are fine, register differences included.
  **The dictionary is mostly a zero-latency cache and its own header does not say
  so**: it repairs 26 of the 90, replaces 35 already-correct answers with its own
  chat register, matches 29, and answers all 90 without touching an endpoint that
  soft-bans per IP. Recorded as `local`, not `google`.
  **The cascade ships with its ceiling written beside it.** It can only see
  Japanese, since pure katakana out of Latin input is visible while a phonetic
  spelling in hangul, hanzi, Cyrillic or Arabic looks exactly like a word, so 14
  of the 18 are invisible to it. On 50 short Latin lines outside the dictionary
  it fires three times and one is repaired by the next provider; the other two
  are `clutch` and `sheesh`, whose katakana is correct Japanese. A false positive
  costs one round trip and never a worse answer.
  **A free repair measured and thrown away**: the provider returns the source
  language it detected, so gating the cascade on "not English" looked free. It is
  anti-correlated. Google answers `en` for bonjour, merci, gracias, ciao and
  lindo precisely because it failed to identify them, so the rule kills five
  repairs of six and keeps none of the six controls.
  **Weight is the question that was open and it is now a measurement**: +0.82
  percent before and after, because the 90-entry dictionary is tree-shaken out of
  the content script entirely. The DeepL hint moved out of `compose.ts`, where
  the rescued wiring built it and it cost 380 bytes on every Kick page for a
  field only one provider reads, into `deepl.ts`.
  Three witnesses, each seen red, including a new offline gate,
  `translate-override`, that drives the real extension with a Japanese target.
- [x] **Both branches landed as 2.10.0, on kil's order, and the release is
  published.** `feat/transliteration-guard` merged into `feat/metriques-hors-ligne`
  with no conflict, the pair verified as one tree, then merged into `master` as a
  single no-fast-forward commit. Minor and not a patch: the release adds
  behaviour rather than only fixing it. 2.9.3 and 2.9.4 were tagged and never
  published, so the changelog folds both in and the entry covers everything since
  2.9.2; neither ever reached a user.
  **What was verified is the archive and not `dist/`.** The chromium zip was
  unpacked and loaded into Chromium through its own manifest: the content script
  arrives, a chat row is translated, and the new override path answers from
  inside the archive. `pack.ts` notes that `.nvmrc` pins node 20 while this
  machine runs 22, as it has for every archive built here.
  Published: 39/39 gates, typecheck 0, lint 0, 1032 tests, and `state.mjs`
  reports the release at HTTP 200 with both assets and **zero divergence**
  between the local packages and what is on the release, which is what the 2.9.2
  entry above was about.
- [x] **The 1754 bytes of prose no longer travel, and the field did not need a
  build step to stop.** 42 of the laughter table's 45 notes were in the shipped
  content script, 0.85 percent of it, about half of what that table was measured
  to cost. The plan called for stripping the field at build time; the cheaper
  answer was that `note` did not have to be a field. It is `LAUGHTER_NOTES` now,
  keyed by the source of the pattern it describes, exported for the test and
  never referenced by shipped code, so the bundler drops it with no build
  configuration at all. Keyed rather than indexed because a parallel array would
  shift silently on an insertion and the parity test could only see a length
  mismatch. Weight went from +0.82 percent against the reference to **-0.10**:
  2.1 KB left the page for 1754 bytes of prose, the field names and the entry
  structure paying the difference. The discipline is untouched, one note over
  eight characters per form, plus a new assertion against a note whose form is
  gone. The probe that measured this now measures zero by construction, so it was
  retargeted into a tracked gate, `poids-notes`, that asserts the same property
  from the other side. It covers what `audit-poids` cannot: 0.85 percent fits
  inside a 2 percent margin without a word. **The witness is worth keeping**:
  referencing `LAUGHTER_NOTES` from `isLaughter` with a CONSTANT key does not
  turn the gate red, because esbuild folds the lookup and the object still
  leaves; with a dynamic key it goes red on all thirty notes. The first witness
  proved nothing and looked like it did.
- [x] **Bulgarian in Latin letters is read, and what a marker table cannot do is
  the finding.** The item called shlyokavitsa "a third table of the
  `romanised.ts` kind". It is a fourth language in that one, which is what made
  it small: the file defines itself as languages written in Latin letters that
  are not written that way. Markers built from grammatical paradigms take 10 of
  20 lines written alongside them and **zero of the 4 written the day before**,
  before the list existed. A paradigm gives a textbook's words; a chat writes
  "mnogo dobre igra" and "az sam tuk", which carry none of them, and the words a
  chat writes are the ambiguous ones, `dobre` Polish, `az` Hungarian, `sam` an
  English given name, `mnogo` and `smeshno` romanised Russian. One decides
  nothing, two in a line decide: **zero false positives over the repository's own
  187 bench lines in 19 languages**, and 3 of the 4 held-out lines against 0.
  The table's five-letter floor then rejected nine strong markers and was
  respected rather than worked around; held-out recall did not move. End to end,
  three lines become right and none becomes wrong, and `sl` stays empty on all
  eight, asserted. **The collision is named**: `mnogo` and `smeshno` are spelled
  the same in both romanisations, so a Russian line carrying only those comes out
  `bg`; two of four trap lines are held by a strong `ru` marker and two are
  taken, and what detection returned on those two before was `undefined` and
  `pl`. Not covered by anyone: shlyokavitsa substitutes digits for letters, 6 for
  sh and 4 for ch, so "6te" and "4ovek", and no marker sees it.
- [ ] **The domain written without a scheme stays as it is, and kil's reason is
  better than the measurement.** `kick.com/somechannel` is detected Spanish and
  `www.example.com/watch` French, so both reach the engine as text, pay for a
  call and wear a wrong flag. The obvious half of the repair was to match `www.`
  on its own. `www` is Japanese laughter, so that rule would fight the table on
  every Japanese line that ends in a full stop, and the collision is not
  hypothetical: the entry above had to be demoted for the mirror image of it.
  A bare domain still needs a list of what looks like a TLD, and widening the
  parser's URL rule also changes what renders as a link in the row. Left alone.

- [ ] **The install rate is 40.5 percent and nothing is tuned against it.**
  Eighty-five installs for two hundred and ten first visits, over eight months.
  Fifty-eight percent of arrivals come from organic search, thirty-one direct,
  six from an AI assistant.
  **Correction, and it was published wrong.** This entry said the listing "has
  never been updated past 2.5.0". Read off the two store pages instead of
  inherited: Chrome carries **2.9.2, updated 2026-08-30, 75 users**, and its
  description opens on "NEW IN 2.9.2", so the text was rewritten for that
  release and is not a page nobody has touched. AMO carries **2.7.0, reviewed
  2026-08-16, 4 daily users**. The 2.5.0 figure came from a note written in June
  and repeated without being re-derived, which is the whole of the mistake: it
  was read, not measured. What that does to the item is remove its excuse. The
  40.5 percent was produced by a current listing, so it is a verdict on the text
  and not a baseline for a stale one, and the experiment is a rewrite rather than
  a resubmission. Blocked on kil either way, since the accounts are his.

- [x] **The 2.9.2 archive divergence is closed by 2.9.3.** The branch carried
  four user-visible fixes past 2.9.2, so it is packaged as 2.9.3: chromium
  `a9bb7488b0a6e7b5`, firefox `43e2c81d4cc6d8e9`, both byte-reproducible across
  two consecutive runs. The Chrome archive is 271.4 KB against 2.9.2's 287.5 KB,
  and the difference is accounted for: `src/content/inject.css`, 59747 bytes
  uncompressed, is no longer emitted now that nothing exposes it, and the
  stylesheet has always been inlined into the content bundle.

- [k] **`node_modules` in the history: the cost is measured, the consequences
  turn out to be nearly nil, and the one real risk is a person.** 4695 objects
  belong to it, **9.49 MB of 16.41 MB on disk, 57.8 percent of the repository**,
  and it sits in exactly two commits: `c30564b`, the root commit, and `c4bd837`,
  which untracked it. Nothing is tracked at HEAD. A rewrite would take the repo
  to about 6.9 MB and every clone pays the difference today.
  **What it costs downstream, measured rather than feared**: the repository has
  0 forks, 0 stars, 0 watchers and 0 open pull requests. Nobody downstream has a
  history to break, which is what "a decision with consequences" was standing in
  for and it is no longer true. What does move: all 324 commits change SHA since
  the root is rewritten, the 8 tags move with them, the 8 remote branches move,
  and `devcopy`, a different repository sharing this history, diverges unless it
  is rewritten in the same operation. The GitHub release for v2.9.2 keeps its
  attached archives, which hang off the release and not the tag, but its tag
  points somewhere new.
  **The risk that remains is not technical, and it now has a number.** A sweep
  of every git repository on the machine found a **second clone of this
  repository** at a different path, still pointing at the same `origin`, with
  its HEAD three months stale. What a rewrite would do to it: the three
  local-only commits it holds are README edits from 2026-05-30 that this clone
  holds too, so nothing unique is lost, but every SHA it knows becomes unknown
  and it has to be re-cloned rather than pulled. What matters far more is what
  sits in it uncommitted: `src/shared/transliterationGuard.ts` and its test, 427
  lines, untracked since 2026-06-08, plus 57 lines of wiring across three source
  files. It solves a problem this branch does not touch, an engine returning a
  phonetic transliteration instead of a translation, and nothing on this branch
  or on any remote has a copy. Rescuing that is a separate decision from the
  rewrite, and it has to happen first, because it is the only unique thing in
  the way. **Done, and it is no longer in the way**: `feat/transliteration-guard`
  is pushed, the two files committed verbatim first and the wiring second. The
  second clone still holds the working-tree copy; nothing there is unique any
  more, so it can be re-cloned rather than merged when the rewrite happens. See
  the entry below for what the measurement said about it.
  **Tooling**: `git filter-repo` is not installed and neither is its Python
  module, so the operation needs `pip install git-filter-repo` first;
  `filter-branch` over 324 commits is the slow fallback nobody should pick.
  Prepared and stopped here. Rewriting a public history and force-pushing is on
  kil's explicit order, like merging and tagging, and "we should start cleaning
  this up" is a direction rather than that order.

- [x] **The duplicate remote is gone.** `public` pointed at `origin`'s URL with
  a stale tracking ref, so a naive read reported one remote current and the
  other 16 commits behind for the same repository. Removed locally; `devcopy` is
  a different repository and stays. Restore with `git remote add public` and the
  URL if it is ever wanted back.

- [x] **`c6cb904`'s truncated commit message stays as it is.** Fixing it means
  rewriting a commit already on a public master, so every clone and every fork
  point moves to spare one word in one message. The cost is larger than the
  defect. Closed as a decision, not as a fix.

---

## Waiting on kil

- [k] **A real chat capture, once, so the frequencies stop being guesses.**
  Three items now end on the same sentence: the damage is measured and the
  frequency is not, because every corpus here is hand-written. Four decisions
  are waiting on that number, and each of them is currently taken by refusing to
  move: whether the short-text losses are worth more provider calls, whether
  trimming franc's 40 unmapped languages is a gain or a regression, whether a
  source allowlist should let an unidentified line through, and what share of a
  real chat is code-switched. `scripts/kick-chat-collector.js` pastes into the
  console of a kick.com tab and `copy(ktCorpus.dump())` puts the capture on the
  clipboard. A few thousand lines from two or three channels of different
  languages is enough. Asked once; the work continues without it.

- [k] **Emote picker dodge: only the Kick-specific half is still blocked.** The
  mechanism is verified offline now. A synthetic overlay meeting the size gate,
  40 by 40 and sitting directly above the composer, moves the preview from
  625-663 to 403-441, clear of the overlay's top at 447, and disabling
  `findOverlayTopAbove` leaves all 621 unit tests green while turning that gate
  red. What remains, and it genuinely needs kil's own Chrome, is whether Kick's
  real emote picker matches any of the six selectors in `OVERLAY_SELECTORS`:
  Kick serves an `auth-modal` to the Playwright context, so the real picker
  cannot be opened here.

- [k] **Native review of the store text.** 8 languages of 10 on the Chrome side
  and 8 of 10 on AMO were written without a native reader, which the file states
  about itself. ZH and KO are the least certain.

- [k] **Store submissions.** The 2.10.0 archives exist and are published on
  GitHub, listing text, dashboard fields and reviewer notes are ready; the
  accounts are kil's.
  **Where the two stores actually stand**, read off their own pages on
  2026-08-31 rather than taken from a note: Chrome Web Store **2.9.2**, updated
  2026-08-30, 75 users, 290 KiB, 8 languages. Firefox AMO **2.7.0**, reviewed
  2026-08-16, 4 daily users, public. So Chrome is one release behind and AMO is
  four, and the two are not in step with each other. An earlier version of this
  file said both were on 2.5.0; that was inherited from a June note and never
  re-derived. Do not take a store version from this file: it is a page, it
  changes without a commit, and it has already rotted once here.

- [x] **Two controls were too small to hit, and no gate looked at them.** The
  accessibility audits run on the dumps of the chip menu and the language panel,
  where the bar itself does not appear, and `bar-live` measures the bar's
  placement without measuring its buttons. Measured across ten window widths
  from 340 to 1500 on the shipped build: the pause button was 26 by 18, the
  settings gear 25 by 19, and the retry arrow on every translated line 10 by 15,
  where WCAG 2.5.8 asks 24 by 24. Same defect as the language chip's caret, a 10
  by 6 inside a 45 by 24, which was fixed on kil's report two days ago; these
  had simply never been measured. All three are 24 tall now, the bar stays 37px
  and `chat-live` still passes on density, so nothing moved: negative block
  margins give the added height back to the line. `bar-widths` is a gate, and
  removing the rule turns it red at all ten widths.
- [x] **The rest of the interactive surface is clean, checked rather than
  assumed.** The same sweep over the compose preview, the popup and the options
  page found nothing else. The popup's one-pixel inputs and the options
  checkboxes are deliberate: a real input under a styled control, wrapped in the
  label that is the actual target, both documented in their own components. The
  one short link, `deepl.com/pro#developer` at 126 by 15, sits inside a sentence
  and falls under 2.5.8's inline exception.
- [x] **`package:all` used to leave `dist/` as the Firefox build.** It builds
  Chrome, packs, builds Firefox, packs, and stopped there, so the working
  directory kept the Firefox manifest: a `gecko` block and `background.scripts`
  where Chrome wants a `service_worker`. Chrome starts nothing from it, so no
  content script arrives and the whole interface disappears. Anyone running
  `dist/` as an unpacked extension had a silent extension after a routine
  packaging run, and the symptom said nothing about the cause. This is what
  broke kil's browser after the 2.9.3 packaging. The script ends on
  `npm run build` now, and `extension-load` names the cause before reporting
  the missing content script, so the next occurrence reads as itself. Two
  witnesses: building Firefox makes the gate say which build is in `dist/`, and
  `package:all` leaves a Chrome manifest behind. The shipped archives were never
  affected; both 2.9.3 zips hash the same before and after.
- [x] **The screenshots no longer show anybody.** What was waiting on a decision
  was that the images carried a real broadcaster's channel, their branding and
  real viewers' handles. `store-shots-fixture.mjs` takes the same five on a
  fabricated page with invented handles and a locally answered engine, so
  nothing third-party appears and nothing leaves the machine, while the shipped
  build does the translating in the image. Five PNGs at exactly the 1280x800 the
  Chrome Web Store requires, each checked for its subject before it counts as
  taken. The older live set stays in `test/e2e/store/` and the listing
  says not to submit it.

---

## Done, kept for the record

- [x] **Transliteration is closed: 0 of 5 to 5 of 5.** Russian, Greek and
  Japanese typed on a Latin keyboard keep their language and lose their script,
  so the script pre-check sees nothing and the detector answers for a Latin
  language. Measured before writing a line: `privet kak dela segodnya` was
  Indonesian, `spasibo bolshoe za stream` Czech, `pozhaluysta pomogite mne`
  Italian, `khorosho ochen khorosho` Swedish, and the Greek and Japanese
  sentences were nothing at all. Russian was the worst of the three, a confident
  wrong answer: with a source allowlist it came out `lang_not_allowed`, and with
  Indonesian as target it was not translated at all.
- [x] **32 markers, one rule, and the words deliberately left out.** An entry
  earns a language only if it is unambiguous against common English and against
  the other entries, which is the rule the short-word table already states about
  itself. That is what keeps `kawaii`, `sugoi`, `senpai`, `baka`, `desu` and
  `sensei` out: English internet slang adopted them, and a reader writes them
  without a word of Japanese. Same for Greek `malaka`, and for `net`, `poka` and
  `davai`, too short or too common elsewhere. A test asserts every marker is at
  least five letters so that door stays shut. Measured: 20 transliterated
  sentences marked, 0 false positives on 20 traps.
- [x] **Not a confident answer, for the same reason as arabizi.** Declaring
  `sl=ru` on Latin-script text asks the engine to read Cyrillic where there is
  none. The markers feed ordinary detection, which feeds the filters and the
  badge; the engine keeps guessing. Cost: 617 bytes, +0.26 percent, well inside
  the margin.
## Done, kept for the record

- [x] **franc against tinyld-light: franc keeps the job, and the first verdict I
  published was wrong.** A first duel on 30 messages had tinyld winning
  everything, including the number declared decisive before the experiment:
  non-English messages classified English and therefore dropped in silence by
  `ignoreEnglish`, franc 1 of 30 against tinyld 0. Four more messages were then
  added, taken from the tests the swap had broken, and the decisive number
  reversed: **franc 1 of 34, tinyld 5**. tinyld calls `guten abend`, `tebrikler`
  and `velmi dobre` English. The first corpus was too small to contain the cases
  that decide, which is the whole reason that number was chosen in advance.
- [x] **No threshold design rescues it, and the reason is instructive.** tinyld
  returns a confidence score where franc returns none, so the obvious repair is
  to stay silent below a bar. It makes things worse: below the bar the ASCII
  fallback calls the message English, so a stricter bar anglicises more, 20 of
  34 at 0.15. Applying the bar only to the English verdict takes 5 down to 4 and
  costs English recognition, 9 of 10 down to 5, and the result is flat from 0.2
  to 0.8, meaning tinyld is confidently wrong on those three rather than
  hesitant.
- [x] **What tinyld does win, for the record.** Global accuracy, 18 correct
  against 11, and 4 silences against 9. Coverage is a tie, 25 against 26 on one
  phrase per language across the product's 42, and franc misses Arabic and
  Hebrew entirely. And weight: bundled and minified, 81121 bytes against 174824,
  which is 93703 and forty percent of the injected script. That saving is real
  and it is not available: it costs four readers their message for every one it
  saves. The margin cannot be bought this way.


- [x] **Arabizi is detected, and the damage it did was not what the grid
  assumed.** The grid scored it 0 of 5 for returning no language. Measured
  properly, an absent language costs nothing on the engine path: the `sl` sent
  is `auto` for arabizi and for correctly detected Spanish alike, because
  `confidentLanguage` withholds everything franc guesses. The real harm is in
  the filters. With a source allowlist set, an arabizi message came out
  `lang_unknown`, so an Arabic-reading user who restricts sources to `ar` lost
  exactly the messages they asked for.
- [x] **The arabizi signal, and the trap it had to survive.** Arabizi replaces
  Arabic consonants with digits chosen for their shape: 3 for ع, 5 for خ, 7 for
  ح, 9 for ق. Latin SMS also puts digits in words, but chosen for their sound:
  8 for eight, 4 for four, 2 for two, 1 for one. The two sets overlap only on 2,
  6 and 8, so keeping [3579] keeps the signal and drops the collision. Measured
  on 12 arabizi sentences and 29 traps including team names `c9`, `g2`, `d4`,
  `k9`, `s1mple`: with the wide digit set, 3 false positives; with [3579],
  12 of 12 and none. No proportion threshold is needed, one word is enough.
- [x] **It is deliberately not a confident answer.** `confidentLanguage` feeds
  the `sl` sent to the engine, and declaring `sl=ar` on Latin-script text asks
  the engine to read Arabic where there is no Arabic script, which is not
  measured here. Arabizi therefore sits in ordinary detection, which feeds the
  filters and the badge, and the engine keeps guessing for itself.
- [x] **A first version of these tests could not fail.** They exercised
  `isArabizi` alone, so removing the wiring from `langDetect` broke nothing:
  863 tests stayed green with the repair deleted. The repair has its own test
  now, and deleting the wiring fails it.
- [x] **The weight gate went red, as predicted, and the reference is raised with
  its accounting.** 233217 bytes against 228460, +4757 and +2.08 percent.
  Measured per module, minified and in isolation: the laughter table 3791, the
  smash filter 424, arabizi 227, which is 4442; the remaining ~315 are the
  2.9.3 and 2.9.4 product fixes. The way to buy the margin back is identified
  rather than guessed: franc's data is 98 KB in this file and
  `tinyld.light.browser` is 68 KB under MIT, so 30 KB and thirteen percent of
  the bundle ride on an accuracy experiment that has not been run.
## Done, kept for the record

- [x] **Keyboard smash is filtered, and the earlier claim about it was wrong.**
  Yesterday's note said eleven of fifteen smashes were already dropped through
  the English rule. Measured directly on `detectLanguage`: **zero of eleven** were
  dropped, all eleven reached the engine, and three came back with a language,
  `asdasdasd` Portuguese, `zxcvbnm` Spanish, `hjkhjkhjk` Dutch. The error was
  conflating `franc()` returning `und` with `detectLanguage` returning `'en'`: at
  the `minLength: 3` floor franc returns codes that map to nothing, so detection
  returns undefined and nothing drops the message. `isKeyboardSmash` now catches
  15 of 15 with 0 false positives.
- [x] **The obvious criterion for smash was measured and thrown away.** Absence
  of vowels catches every smash and also `krk`, `prst`, `smrt` and `vlk`, which
  are real Czech words. The criterion kept is the share of adjacent letter pairs
  living on the same keyboard row: against 15 smashes and 33 real words chosen
  as the worst case, Slavic consonant clusters included, 0.6 still leaves two
  false positives and 0.65 upward leaves none. 0.7 with a six-letter floor is
  what shipped, with margin on both sides.
- [x] **Stretched words broke the first version, and are witnesses now.** A held
  letter necessarily lives on one row, so `siiiiiiii` and `NOOOOOO` carried the
  smash signature and were dropped as noise. What separates them is the number
  of distinct letters, or a repeated GROUP rather than a held letter:
  `asdasdasd` is three times "asd", `holaaaaa` is "hola" plus a held a. Thirteen
  stretched words are in the test battery for that reason.
- [x] **The seven impurity categories have their damage measured**, on 41 cases
  through the real pipeline order: 23 behave as intended, up from 19 before this
  pass. Platform text 3/8, identity 3/5, input artefacts 5/7, code-switching
  1/3, transliteration **0/5**, no-language 5/6, gaming slang 6/7. Frequency is
  a separate number and it needs a corpus that does not exist here.

## Done, kept for the record

- [x] **Written laughter has a dictionary, by language, with its sources.** It
  was handled in two unrelated places grown by hand: an alternation of about ten
  forms inside `isNoise`, and two French entries in the short-word table. Nothing
  reusable exists to import, which was checked rather than assumed: the academic
  work on social-media normalisation treats laughter as a category and publishes
  no lexicon, the popular write-ups are prose, and the one machine-readable list
  on GitHub carries no licence at all. `src/shared/laughter.ts` records 43 forms
  drawn from three cross-checked sources, each with a note saying where it is
  attested, and 22 of them mark a language.
- [x] **A laugh is a fact about the text, so it feeds the confident path.**
  `confidentLanguage` returns only what was looked up in a table, never what
  franc guessed, and that value is what goes to the engine as the source
  language. Laughter now votes in the same token lookup as the chat-word table,
  under the same conflict rule. Measured on ten mixed messages of the shape
  "jajaja que bueno eso": 3 of 10 had a usable source language before, 10 of 10
  after, and two of the three franc had guessed were wrong, calling that Spanish
  line Portuguese and a Portuguese one French. Forms used everywhere, `haha`,
  `lol`, `xd`, mark nothing, because a wrong answer here is handed to an engine.
  It costs 3555 bytes on every page, 1.55 percent, inside the weight gate's 2
  percent margin and close enough to it that the next addition trips the gate.
- [x] **The `minLength: 3` floor under franc stays, and the measurement says
  why.** It looks like a mistake against franc's own documented unreliability,
  and removing it makes things worse. Measured on 30 short non-English chat
  messages: at the shipped floor of 3, franc is wrong more often than right, 7
  right against 14 wrong, but only 1 of 30 messages ends up classified English.
  At franc's default floor of 10 the wrong answers halve, to 8, and 11 of 30 are
  classified English instead, because a floor raises how often franc says `und`
  and `und` on ASCII becomes English, which `ignoreEnglish` then drops in
  silence. Franc's wrong identities are already withheld from the engine by
  `confidentLanguage`; its silence is not. The low floor is protecting foreign
  chat, not undermining it.
- [x] **Keyboard smash is mostly already handled, by accident.** Fifteen forms
  attested in the sources, Turkish `askfhsjkd` among them: eleven return `und`
  from franc and are dropped through the English rule, and four get a confident
  wrong language, `asdasdasd` as Portuguese, `zxcvbnm` as Spanish. The first
  measurement said fifteen of fifteen reach the engine, which was wrong: it
  checked `isNoise` and `isSlangOnly` and left out the drop that actually
  catches them. What remains is four wasted calls and four wrong badges, which
  is small enough not to justify a detector of its own yet.
- [x] **A batch inherited one message's source language and declared it for all
  the others.** The coalescer groups by TARGET language and nothing else, so a
  batch mixes sources, and `batchCall` built its joined request as
  `{ ...reqs[0], text: joined }`. Measured on a multilingual corpus: a request
  went out with `sl=ja` carrying a Japanese line and an Arabic one. `call` only
  sends `sl` when the language was looked up rather than guessed, precisely
  because a wrong `sl` makes the engine translate from the wrong language and
  return either the original or something else; taking the first message's hint
  for all the rest is that same fault by another route. When the hints disagree
  the request now declares none, which is what an unknown language already
  sends. Witness: the test fails with `expected [ 'ja' ] to deeply equal
  [ 'auto' ]`, and a second keeps a single-language batch declaring `es`, so
  never declaring anything would not pass either.
- [x] **Two of the 42 offered languages were never identified.** Malay: franc
  emits `zlm` and the table knew only `msa` and `zsm`. Hebrew: franc-min does
  not cover it at all, returning `und`, and the Unicode pre-check had ranges for
  Arabic, Cyrillic, Thai, Devanagari, Hangul and kana but not Hebrew, though the
  store listing sells right-to-left support as "Arabic, Hebrew, Persian". What
  it cost is smaller than it first looked, and the measurement says so: an
  unidentified language is not dropped, it goes out with `sl=auto`, so those
  messages were translated all along. What changes is that the engine is told
  the right source and the reader sees the right source badge. Three tests, one
  of them the boundary between the Hebrew and Arabic blocks.
- [x] **Where the injected bundle's bytes go, measured in the shipped file.**
  `content.js` is 228896 bytes and franc's trigram data is 100394 of them,
  43.9 percent, across 65 blocks; the inlined stylesheet is 30474, 13.3 percent.
  A first reading claimed 48.8 percent from an esbuild metafile whose
  `bytesInOutput` disagreed with the source file by more than a factor of two;
  the artefact settles it. Of the 61 languages franc-min can return, 21 map to
  something the product translates and 40 do not, carrying about 61 KB. Trimming
  them is not free and is not done: dropping a language franc would have chosen
  makes it choose another, and a mapped wrong answer is worse than an unmapped
  right one. Measuring detection quality before and after is the experiment that
  would settle it.
- [x] **The two reworked menus have an accessibility pass.** axe reports zero
  violations on the chip menu in both themes, checked against a doctored copy
  that it does report; target size passes with 96 targets. The kit's keyboard
  gate fails on the saved HTML because a dump carries the DOM and not the
  listeners, so the arrows were measured where they exist instead: Down +3,
  Right +1, Up -3, three columns, in dark, light and RTL. Asserted now, with
  forcing the column count to 1 as the witness.

- [x] **Czech added to both listings, on measurement rather than inference.**
  A first pass mapped country to language and named Polish as the biggest
  uncovered group. The page-title report says which localised store page people
  actually land on, and Polish appears on none of them: the order is English,
  Turkish, Arabic, then Czech, which is ahead of Russian, Japanese, Chinese and
  Korean, all four of which already had text. Czech had none. Eleven languages
  each side now, 34 fields inside their limits, and the shape check caught the
  same duplicated privacy paragraph in the derived Czech that it caught in the
  other eight.

- [x] **The one cost every reader pays now has a budget.** Store analytics were
  offered as a basis for optimisation and could not serve as one: they describe
  the listing page, a sixth of that traffic is on phones and another eighth on
  browsers that cannot install a Chrome extension, and there is no install or
  usage figure in them. The extension ships no telemetry on purpose. So the
  question became what can be measured here, and the answer was the injected
  script: `assets/content.js` is parsed on every kick.com page whether or not
  anyone opens anything, with `inject.css` inlined into it. Read out of the
  published archives rather than out of a note: flat at 199.4 KB from 2.7.0 to
  2.8.1, then 224.3 at 2.9.0, up 12.5 percent in one version for the drawn flags
  and the shared panel, unseen for three days. `audit_poids.py` compares against
  a baseline that lives in the file itself, since a JSON beside it would be
  gitignored and would not survive a machine. Checked both ways: green at the
  current size, red against a baseline 12 percent lower, which is the jump it
  would have caught.

  Not done, on purpose: the flag rules are 10.9 KB of that bundle, 45 rules and
  7.5 KB of SVG data URIs, and moving them to a stylesheet injected on first use
  would save 4.9 percent of the bundle and a sub-millisecond parse. That is
  optimising a number rather than an experience.

- [x] **The live suite was not non-deterministic; three probes were broken.**
  Filed as a systemic property of live gates, which was the wrong shape. The
  flapping was `live-kick` setting `.value` and dispatching `change` on the
  bar's language control, which stopped being a `<select>` when the shared panel
  replaced it: on a button that does nothing at all, so the target was never
  changed and the count that followed measured the default target. It passed or
  failed with the language of whatever channel `/browse` served. It clicks the
  button, picks French from the panel, and refuses to count until the control
  itself reads FR. Three runs after: 6, 5 and 2 translations, zero errors, the
  verdict steady while the count follows the traffic, which is what it should
  do. The other two flaps were a null crash in my own keyboard probe and one
  unexplained `kick-dom-recon`, so the systemic claim rested on one real
  unknown, not three.

- [x] **`latency` runs.** It reads counters only a metrics build emits, and
  every pass builds normally, so it had never run once: it exited 2 and said
  why, honestly and uselessly. `run-live.mjs` gives it its own phase, last and
  alone since it rewrites dist/, which builds metrics, measures, and restores
  the ordinary build even when the measurement fails. First run: green, 108.3s.
- [x] **The node version is printed where it matters.** The 2.9.x packages went
  out on node 22 while `.nvmrc` pins 20 and CI builds on 20, and nothing
  objected because `engines` allows both. `pack.ts` prints the running version
  and the full sha256 with every archive, and says when it differs from the pin.
  A warning, not a failure: refusing would contradict `engines`.

- [x] **Runner coverage: 31 harnesses of 33.** 21 offline gates plus 10 in
  `run-live.mjs`. The six left have a stated reason rather than a silence:
  `flag-render`, `lang-panel-shoot`, `probe-row-space` and `bar-select` assert
  nothing and exist to draw or print for a human; `store-shots` produces the
  listing screenshots; `live-profile` is the window someone signs into by hand.
  Wiring an assertion-free script buys runtime and no verdict.

- [x] **A `position: fixed` panel that was not viewport-relative.** Found by a
  harness nothing was running. `bar-panel-live` reported the bar's language
  panel 4px off the left of the window; live at 1000x750 it hung 362px below
  the bottom, with a third of the list unreachable. The placement code was
  right all along, writing `top: 222px` inline while the panel rendered at
  y=711: `.kt-float` carries a `backdrop-filter`, which makes it the containing
  block for any fixed descendant, and 489 + 222 = 711 to the pixel. Our CSS,
  not Kick's. The panel hangs off the body now, like the compose preview and
  the chip's menu, and measures clean at 1000x750, 1280x900 and 1500x950.
- [x] **A live runner.** `run-live.mjs`, two workers by default rather than six:
  these open real pages on one host. The three that need a signed-in profile are
  excluded unless asked for, since failing because nobody signed in is noise.
- [x] **Three offline harnesses wired into the runner**, `bar-panel-live`,
  `flags-preview` and `lang-panel-measure`. Three others stay out and the runner
  says why: they draw images and assert nothing, so running them would buy time
  and no verdict.
- [x] **The quality apparatus is tracked.** It was on one machine and nowhere
  else: `git ls-files scratchpad/` returned 0 while `PROMPT.md` told the next
  session to run a gate runner a fresh clone would not have. 40 files enter, 291
  KB: 35 harnesses and 5 audits. The output stays out, which is the whole
  argument, 272 MB of screenshots, HTML dumps, bundles and browser profiles
  against 422 KB of scripts. The French working prompts under `scratchpad/*.md`
  stay private too.
- [x] **No machine path left in the harnesses.** 33 files carried the same
  absolute path into one home directory as Playwright's fallback location,
  invisible while everything was ignored and unusable the moment it was not.
  They import `./playwright.mjs` now, which looks at `$UX_KIT`, then a
  gitignored `scratchpad/uxkit.path`, then the repository's own
  `node_modules`, and exits 2 with the three ways to fix it when none is there.
  Exit 2 rather than 1 on purpose: a missing prerequisite is not a failed gate.
- [x] **The archive itself is exercised, not just `dist/`.** `KT_EXT` points the
  harnesses at an unpacked package, and all eleven translate modes plus
  `extension-load` pass against the 2.9.3 Chrome zip. Nobody had ever run a gate
  against the thing that would actually be submitted.
- [x] **Store screenshots at the size the store accepts.** The five fixture
  images were coming out 2560x1600, because this harness had drifted to
  `deviceScaleFactor: 2` while the live one carried a comment saying to keep it
  at 1. The Chrome Web Store takes exactly 1280x800 or 640x400 and rejects the
  rest, so the submission would have bounced with nothing here to say why. The
  harness asserts the dimensions now, read out of the PNG header.
- [x] **Every shipped permission is checked against its justification.** The
  listing gate reads `dist/manifest.json` and requires each of the ten entries,
  two permissions and eight hosts, to appear in the Chrome dashboard section.
  Adding a permission and forgetting to justify it is a rejection reason that
  otherwise surfaces a week later. Witness: two invented entries produce two
  named failures. And the metadata section pointed submitters at
  `test/e2e/store/`, the older set taken on a live channel; it names
  `store-fixture/` now and says not to submit the other one.
- [x] **The listing is at 2.9.3 in all eleven languages**, each with a paragraph
  on what changed: whole messages again, a recycled row translated, no file
  published to the page. `audit_fiche.py` is a gate and counts 44 fields against
  their limits in UTF-16 code units, which is what the web forms count, plus the
  ten shipped `description` values read from `public/_locales` rather than from
  the prose. Its first version accused a healthy field, counting the explanatory
  text around the manifest value and reporting 376 characters for a value of 90.
- [x] **Words were being deleted from messages before translation.** The
  inline emote-name stripper carried two rules that hit ordinary language.
  `ez` in the suffix list deleted every Turkish negative aorist, a productive
  grammatical form: `etmez`, `istemez`, `gitmez`, `gerekmez`, `gondermez`, plus
  Spanish `vez`, Czech `bez`, `kez`. Turkish is the second most read of the
  localised listings. And a rule deleting any all-lowercase word of thirteen
  characters or more took `completamente`, `almacenamiento`, `armazenamento`,
  `justifications`, `communications`, `certifications`, `creditworthiness`,
  `conditionally`. Measured over 11583 words of the store listings: 30 distinct
  ordinary words destroyed, and the reader saw a translation of a sentence
  nobody wrote, with nothing to show a word had gone. After: 13, all of them
  brand names caught by the mixed-case rule that earns its place, and emote
  coverage unchanged at 10 of 13 sampled names. The long-word rule now needs a
  digit; the suffix list lost `ez` and `gg`, which costs no emote since OMEGALUL
  is still caught by `lul`. Eight regression tests, seven of which fail against
  the old rules while the ten existing parser tests passed either way.
- [x] **The extension's own box model no longer comes from the host page.** One
  `box-sizing` declaration existed in the whole stylesheet, on a fixed-position
  element; everything else inherited Kick's Tailwind reset. Measured on a page
  without that reset, the language list ran 416px of content in a 398px frame,
  18px over, which is exactly twice the `padding-inline: 9px` of a row set to
  `inline-size: 100%`. The third column left the frame and a horizontal
  scrollbar appeared, and the ellipsis the row CSS already had could not apply.
  With the rule the same page measures 390 for 390 and the panel is 408 wide as
  designed rather than 416. A project that asserts pixels cannot leave its box
  model to somebody else's stylesheet. `bar-panel-live` asserts the overflow now,
  on a stage that deliberately sets no reset. Note on the witness: removing the
  rule does make that harness exit 1, but at a click that moves out of reach
  before the assertion is read, so the honest evidence is the direct
  measurement, 416/398 before and 390/390 after.
- [x] **The compose side is covered offline.** Writing a reply and seeing it in
  the channel's language is half the product, and it was only ever verified
  live. The property that matters is not that a preview appears, it is which
  language it targets: the channel's, read from Kick, and not the reader's.
  Getting that wrong sends a polite sentence in the wrong language in front of
  everyone. The fixture answers `lang_iso: es` on Kick's API while incoming chat
  goes to English, so the two are told apart. Clean coverage, measured: never
  handing the channel language to the compose controller leaves all 621 unit
  tests green and turns this gate red. The product's fallback is sound, by the
  way: with no channel language it shows nothing rather than translating to the
  wrong one.
- [x] **The version check is covered end to end.** The extension reads the
  latest GitHub release to tell a reader a newer version exists, and that read
  is one of the permissions both store listings have to justify. If it breaks,
  everyone stays on an old version and nothing says so.
  `updateChecker.store.test.ts` covers the decision with `fetch` stubbed and the
  function called directly; what nothing covered is the trip itself, popup asks
  the service worker, worker asks GitHub, popup draws the banner. The gate
  serves a release announcing v99.0.0 and reads the banner's text and link.
  Clean coverage, measured: forcing the worker's answer to "no update" leaves
  all 621 unit tests green and turns this gate red.
- [x] **Both caches are measured, on cost and on display.** The same line comes
  round constantly in chat, and two caches are meant to catch it: the in-tab one
  in `pipeline.ts` and the service worker's. Neither was checked end to end,
  though it is a direct cost to the reader, in money at DeepL and in soft bans
  at Google. The gate posts a line, waits for its translation, then posts the
  same text under a different username, since the per-user skip in `prepare()`
  would otherwise drop it without consulting any cache and the zero would prove
  nothing. Two witnesses. Blinding both caches makes the repeat cost one call.
  And a cache hit that returns without applying leaves all 621 unit tests green
  while turning the gate red, which is the worse failure of the two: every
  repeated message would silently show nothing.
- [x] **The 7TV DOM contract is exercised.** On a page where 7TV renders the
  chat, the message is not in Kick's `span.font-normal` but in
  `span.seventv-text-token`, which `extractMessageText` reads first. A row whose
  text exists only in those tokens is sent to the engine once and translated.
  Witness: removing the preference means the message is never sent at all. A
  unit test catches that same break, so the coverage is not unique; what the
  gate adds is the whole chain on a 7TV-rendered row. It deliberately does not
  claim to reproduce the native+7TV duplicate the source comment names: two row
  shapes were tried and neither produces it, because `joinTexts` reads only an
  element's own text nodes, and inventing a third shape would prove nothing.
- [x] **Choosing a language in the bar reaches the page without a reload.** The
  gate drives the product's own control rather than writing settings by hand,
  and reads back the `tl` parameter the engine actually received, so the
  assertion is about the language requested and not about a label. Clean
  coverage, measured: cutting `pipeline.updateSettings` leaves all 621 unit
  tests green and turns this gate red. A first version wrote a partial settings
  object straight into `chrome.storage` and did not propagate, which says
  nothing about the product: a partial object is not what the bar writes.
- [x] **The hover mode's economy claim is measured.** Both store listings sell
  hover mode on a number: roughly ten times less consumption on a fast chat.
  That only holds if nothing is requested before the pointer arrives, which only
  a real browser can say. The gate sets `displayStyle` from the extension's own
  service worker, waits, and asserts zero engine calls, then hovers and asserts
  one. Clean coverage, measured: short-circuiting `armHoverTranslate` so the
  line translates immediately leaves all 621 unit tests green and turns this
  gate red on three counts.
- [x] **The chat fixture was missing the element the product injects into.**
  `pickInjectionTarget` looks for `div.w-full.min-w-0.shrink-0` first and falls
  back to the row's first child, which in the fixture was the username button.
  Translations were landing inside the username, visible in earlier output as
  `pseudo1ESZZTRADUCTIONZZ:...` and never questioned, and hover mode armed the
  username instead of the message. The fixture carries the wrapper now. This
  does not touch the recycling finding, where the observer never delivered the
  row at all.
- [x] **Changing channel is covered offline.** Kick switches channel by
  navigating the app: the URL moves and the chat is remounted, with no reload.
  If the extension does not rebind, translation stops for good and nothing says
  so. The content script patches `history.pushState` to notice, but it lives in
  an isolated world and Kick's router calls its own in the main world, where
  that patch does not exist, so the harness navigates from the main world like
  the site does. The product survives it: the container watcher rescans. Clean
  coverage, measured: disabling that rescan leaves all 621 unit tests green and
  turns this gate red.
- [x] **A recycled chat row was never re-translated.** Kick's virtual scroller
  reuses rows by replacing their CONTENTS, which makes the row the mutation
  TARGET and never an added node. The observer collected candidates from added
  nodes and their descendants only, so it walked straight past the row: measured
  with the extension loaded, eight recycled rows carried no translation, no
  reason on the line, and produced no provider call. The comment above that code
  said the case was covered; the code did not do it. `enclosingMessageRow` walks
  up from the mutation target. Two witnesses: the new gate goes from 9 of 9 to 1
  of 9 without it, and a unit test in `observer.test.ts` fails without it. That
  test needed the test double to stop discarding the `MutationObserver`
  callback, which is why nothing in the unit suite could reach this branch.
- [x] **The fallback chain is tested offline, and it covers ground nothing else
  does.** When the first engine rate-limits a reader mid-stream, the next one is
  supposed to take over. That was verified only by `live-fallback`, which kills
  providers at the DNS resolver because its first version routed with
  `page.route` and measured nothing: in MV3 the translation requests leave from
  the service worker. `ctx.route`, at the context level, does see them, measured
  here. So `translate-offline --bascule` returns 429 from the first engine and a
  canned answer from the second, and asserts both were called and that the text
  on screen came from the second. Truncating the runtime cascade to one provider
  in `background/translator/index.ts` leaves all 620 unit tests green and turns
  this gate red. Removing the chain from the default settings is caught by a
  unit test, but that one asserts a constant and says nothing about the chain
  running.
- [x] **The product's one job is tested offline.** A message arrives in chat and
  its translation appears under it: nothing offline verified that. `chat-live`
  calls `inject()` by hand and measures rendering, the 620 unit tests stub at
  module boundaries, and the only end-to-end coverage was live harnesses that
  open the real kick.com. `translate-offline` loads the real extension, serves a
  local chat fixture taken from `observer.test.ts`, and answers the translation
  engine with a made-up string, so the assertion is exact. Witness: breaking
  `font-normal` in `selectors.ts` turns it red. Measured limit, stated in the
  file: removing the engine's host permission does not turn it red, because the
  interception answers before the permission matters.
- [x] **`extension-load` was hitting the real network and said it was not.**
  Playwright's glob does not match `*.kick.com` against `kick.com`, so the
  document navigation went to the real site while its subresources were
  intercepted, which is why the run reported 70 interceptions and looked right.
  A regular expression takes both forms. The claim that nothing left the machine
  was false when it was written.
- [x] **The extension exposes nothing to kick.com pages any more.** The built
  manifest listed six web-accessible resources: a stylesheet, an icon glob, and
  four ESM chunks crxjs adds for the loader that `scripts/bundle-content.ts`
  replaced. Measured on the built bundle: zero `getURL`, zero
  `chrome-extension`, zero dynamic import, zero icon reference, and all 22
  `url()` in the stylesheet are inline `data:` SVG. Nothing was reachable for a
  reason, and what was listed gave any script on a kick.com page a stable URL to
  request as a test for whether the extension is installed. This matters here:
  the site already walls off what it detects. Removed at the source and dropped
  again after crxjs, in both the Chrome and Firefox builds.
- [x] **A gate that loads the real extension.** Every other offline gate mounts
  components by hand and never touches the manifest, `content_scripts`, or the
  path Chrome actually injects through. The only harnesses that did open the
  real kick.com, so they need the network and do not run in the suite: the
  defect `bundle-content.ts` exists to fix, a dynamic import losing its race and
  injecting nothing silently, was invisible to every gate. `extension-load`
  intercepts `https://kick.com/**` and serves a local fixture, so the document
  keeps its kick.com URL, Chrome injects, and nothing leaves the machine. Two
  witnesses: pointing `content_scripts` at a missing file, and re-exposing one
  chunk. It needs a window, since a headless run loads no extension at all, and
  the window is pushed off screen.
- [x] **The offline gates no longer need a Google Chrome on the machine.**
  Seventeen gates and three shooters launched `channel: 'chrome'`, which makes
  the browser a property of the machine, in an apparatus that was just made
  tracked so a clone could run it. They use Playwright's own Chromium now, which
  `package.json` pins. Speed is not what decided it: the system Chrome is
  faster, 914 to 1443 ms against 1474 to 2256 ms on one gate over three launches
  each. An apparatus that may run on either browser produces two sets of numbers
  and these gates assert pixels. Both agreed on the day of the change, and they
  are two version streams with no reason to keep agreeing. `live-kick` and
  `compose-kick-live` keep the real Chrome: they open the real kick.com, where
  the profile and the site's bot detection are part of what is measured.
- [x] **Both reworked menus audited, and the audit made permanent.** axe 0
  violations and 96 targets at or above 24x24 on each, in dark, light and RTL.
  The kit's keyboard gate reads a saved dump, which carries no listeners, so
  arrow behaviour is measured live instead: Down +3, Right +1, Up -3, 3 columns,
  asserted and witnessed by forcing `MENU_COLS` to 1. The audits hang off
  `chip-live` and `bar-panel-live` rather than being a gate of their own,
  because a pooled runner could schedule a separate gate before the harness that
  writes its input. Four dumps per sweep, about 4.4s.
- [x] **A dump audited in the wrong state reads as coverage.** The bar panel's
  first dump was taken with the filter still holding "por", leaving 2 of 39 rows
  visible, and both accessibility gates stayed green on it: the target-size gate
  measures the targets it finds and does not count them. The harness now
  measures visible rows as it writes the file. Witness: taking the dump filtered
  gives 2 of 39 and exit 1, axe still green on the same run.
- [x] **`npm run lint` was red and nothing said so**, since `e3ea484` added
  `scripts/kick-chat-collector.js`: a console-paste snippet under a directory
  `tsconfig` includes without `allowJs`, which the type-aware parser fails on
  before it lints anything else. Ignored like `scripts/pack.ts`, with a witness
  proving the rule still fires on real code.
- [x] Language list drawn as a grid of flags, chip menu: 202x894 to 408x518,
  every row at 30px.
- [x] Chip menu lifted out of Kick's stacking context: covered at 5 of 9 sampled
  points, then 0 of 9 at three window sizes.
- [x] One click opens the list. The caret was a 10x6 target on a 45x24 chip,
  where WCAG 2.5.8 asks 24x24.
- [x] Bar panel reworked: 6 visible rows of 40 to 25, list 1200px to 433.
- [x] `.kt-flag` declared twice, lending every drawn flag a 0.65 opacity and a
  4px padding, and repainting them flat grey in the light theme on specificity.
- [x] Compose panel measured live for the first time: 219x54 at exactly
  `COMPOSE_PANEL_GAP` above the composer, uncovered at z-index 9999, border at
  3.75:1 against Kick's real ground rather than 3.33 against an invented one.
- [x] Both store listings at ten languages each, 31 fields inside their limits.
- [x] AMO reviewer notes with a byte-reproducible build, verified by two
  consecutive runs producing one SHA-256.
