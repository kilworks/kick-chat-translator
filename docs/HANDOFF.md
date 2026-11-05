# Handoff — kick-chat-translator, 2026-08-16

State document for continuing this work in a fresh session. Covers items 96 to 110
on branch `integration/2026-08-13`, released as 2.7.0.

---

## 1. Where things are

Repo `C:\Users\kil\Downloads\kick-chat-translator`, branch `integration/2026-08-13`,
working tree clean, **nothing pushed**. Published version is 2.6.0; these commits
are not released.

| Commit | Item | What it does |
|---|---|---|
| `7df0ea5` | 96 | Re-translate on-screen lines when the reading language changes |
| `d2a1b14` | 97 | Metrics sink, integration builds only, stripped from releases |
| `c03c179` | 98 | `_locales` en/tr/ar so store search matches the reader's language |
| `92d64f1` | 99 | Turkish and Arabic long store listings, paste-ready |
| `40271d5` | 100 | Same re-translation for `displayStyle` and the badges |
| `818dd46` | 101 | DeepL key moved from `storage.sync` to `storage.local` |
| `c1781ef` | 102 | zod out of the content script, 81.3 → 69.0 KB gzipped |
| `6d66382` | 103 | Bridge so the page can read collected metrics |
| `e986e55` | 104 | Metrics survive a service worker restart |
| `e3ea484` | 105 | This document, plus the chat corpus collector |
| `311d271` | 106 | Probes splitting the wait into its legs |
| `6ac1df7` | 107 | Composer stops sending a guessed source language |
| `05f927e` | 108 | A refused line is retried on its flattened text |
| `4df8fe2` | 109 | Content script survives a cold service worker |

391 tests across 38 files. `npm run release:check` green, `npm run build:metrics` green.

Commit convention: `[item N] Imperative subject`, one item per commit, with a body
explaining cause, fix and how it was witnessed. Next item is **111**.

**Run `npm run release:check`, not just typecheck and test.** It also runs lint,
which the first ten items of this branch never ran; three lint errors had
accumulated in them by item 109.

---

## 2. How to measure

```
npm run build:metrics        # instrumented build into dist/
```

Then load `dist/` unpacked in Chrome. Its id is derived from the install path;
for `C:\Users\kil\Downloads\kick-chat-translator\dist` it is
`igdnhalokbeabohdmncbmogjakkgcheb`.

**Chrome does not pick up a rebuild by itself.** After every `build:metrics`, click
reload on `chrome://extensions`, then reload the Kick tab. Storage survives both,
so earlier samples are kept.

Read the numbers from any Kick tab, in page context:

```js
JSON.parse(document.getElementById('kt-metrics-dump').textContent)
```

Release builds carry none of this. `scripts/check-strip.ts` fails the build if the
marker `kt.metrics.v1` appears in a release bundle, and fails an instrumented build
if it is missing from `assets/content.js`. Both directions are enforced, on purpose:
a check that can only pass is not a check.

---

## 3. What has actually been measured

Live Kick chat, instrumented build, browser-observed. Sample sizes are small; treat
these as directional, not as decisions.

### Latency — settled, do not re-investigate

Item 106 split the wait into its legs. 200 samples on every series, one live
channel, 29 minutes:

| Leg | p50 |
|---|---|
| `e2e.cloud`, message seen to translation painted | 1971 ms |
| `leg.roundtrip`, content to worker and back | 1971 ms |
| `leg.sw.total`, the worker's own share | 2010 ms |
| `leg.coalesce.wait`, the batching window | **182 ms** |
| `leg.cache.lookup`, IndexedDB | **0 ms** |
| `leg.inject`, DOM write | **0 ms** |

**The extension controls about 9% of the wait.** Transport and waking the MV3
worker cost 3 ms, not the hundreds of milliseconds that seemed likely. The cache
lookup and the DOM write are free. Everything else is the provider.

The only extension-controlled cost worth naming is the 182 ms batching window, and
it is a deliberate trade: a batch of 5 costs 1823 ms against 1058 ms for a single
item, so grouping is roughly three times cheaper per message in provider time. Those
182 ms buy call volume, not reader latency. Zero cooldowns were recorded across 821
requests, so nothing has ever hit a rate limit either way.

A warning about how this was nearly got wrong: an earlier reading compared an
`e2e.cloud` p50 against a `provider` p50 taken from **different sample windows**,
because `e2e.cloud` had accumulated since item 97 and the provider series had not.
The 780 ms of "unexplained" latency that produced did not exist. Compare series that
share a window, or the subtraction is meaningless.

### The on-device engine — measured, and it is worth defending

**It is roughly seventy times faster than the cloud.** Both series from one live
session, seen to painted:

| Path | n | min | p50 | p95 |
|---|---|---|---|---|
| `e2e.local` | 8 | 6 ms | **22 ms** | 210 ms |
| `e2e.cloud` | 200 | 353 ms | **1618 ms** | 2134 ms |

**Superseded on 2026-11-05: `cloud-first` is the default.** Blind judges scored the
on-device engine worse than Google on all six languages it served (1.38 penalty a line
against 0.90, 454 outputs). The latency below stays true and is the price paid.

`local-first` as the default is not merely defensible, it is the difference between
a translation that appears with the message and one that arrives after the reader
has scrolled past. Everything in the latency section above concerns only the users
who cannot reach this path.

Two separate things stop them reaching it, and both were mistaken for one another
before being measured.

**The API is absent on some browsers.** `Translator`, `LanguageDetector` and `ai`
are all `undefined` on one Google Chrome 151, where `localEngine.ts` claims Chrome
138 and up. Unresolved and worth resolving: a second browser on the same machine,
also reporting Chrome 151, has them as functions. Same version, different answer.
Flag, profile, hardware gating or policy, nobody knows.

**Where the API exists, only downloaded pairs are served.** Measured on a Japanese
channel with a French target:

```
ja>fr : downloadable      es>fr : downloadable
en>fr : available         ko>fr : downloadable
```

Only `en>fr` had its model. `e2e.local` therefore stopped at 8 samples, all from the
English lines in the chat, and every Japanese line went to the cloud. Downloading a
pair needs a user gesture, which is what the floating bar's local chip is for.

So the honest state of the default engine mode: excellent when it applies, and it
applies to far less traffic than the default implies. How that gets surfaced to a
user who has the API but no model is an open product question, not a bug.

### Why a message never reaches an engine

234 skips in one session, the first sample above the fifty threshold:

| Reason | n |
|---|---|
| **the same user just sent this** | **213** |
| shorter than the 2 character minimum | 9 |
| only emoji, symbols or laughter | 7 |
| the translation came back the same | 4 |
| already in your language | 1 |

**Per-user dedup is 91% of all skips**, and it reframes the cache numbers below. The
in-tab cache measured a 6.7% hit rate, which reads like a cache that does not earn
its place. It is not: dedup catches repeated lines *before* the cache is ever
consulted, so the cache is judged on what dedup left behind. Do not delete either on
the other's numbers.

`retry.normalized` stayed empty despite four lines coming back unchanged: none of
those four was stretched, so item 108 correctly did nothing. That path still has not
been exercised against real traffic.

### Caches, chain, DOM

- `cache.mem` hit rate **0%**, `cache.sw` hit rate **10%**. The in-tab cache earned
  nothing over these windows.
- `chain.depth.1` only: the first provider answered every time, the fallback chain
  never ran.
- `batch.items` p50 **14**, n=2. Too few samples to judge the 180 ms window.
- `dom.row.textEmpty / dom.row.seen` = **54%**. Do not read this as broken
  selectors: `dom.row.seen` counts rows the observer matched, which includes system
  lines and emote-only messages that legitimately carry no text. An external probe
  over `div[data-index]` gave 64-70% on a different channel. Neither number has a
  clean denominator yet; establishing one is worth an item.

### Language detection — the big finding

`franc` is measurably unreliable on chat text.

Corpus: 804 unique messages from a live Spanish channel over 8.5 hours.

| Property | Value |
|---|---|
| Median message length | 15 characters |
| Under 20 characters (franc's own stated floor) | 61% |
| All caps | 67% |
| Single word | 28% |

On a 28-message sample of that corpus, all Spanish:

| Variant | Correct |
|---|---|
| franc, unrestricted | 32% |
| franc restricted to the 45 languages the extension supports | 36% |
| repeated words removed, restricted | 36% |
| only messages with ≥5 distinct words | 56%, covering 57% of chat |
| only messages with ≥6 distinct words | 60%, covering 36% of chat |

**No cheap preprocessing rescues it.** Case is not the problem: 23 of 23 verdicts
were identical between upper and lower case. Failures concentrate on repeated spam
("BINGO BINGO BINGO" → Dutch, "PIUM ×12" → Indonesian) and on short slang.

This corroborates `langDetect.ts:170`, which already records 16 of 85 Spanish lines
and 13 of 51 Turkish lines correct.

---

## 4. The open decision

`confidentLanguage()` returns a language only when it was **looked up** — Unicode
script, the short-word lexicon, the trivial-token table — never when franc guessed.
The cloud path already uses it (`pipeline.ts:297`), which is why cloud translation
is sound: providers detect the language themselves.

`detectLanguage()` does return franc's guess, and `pipeline.prepare()` uses it for
three drop decisions and hands it to the on-device engine as the source language
(`pipeline.ts:253`). So the local engine is asked to translate Spanish from Swahili.

**Proposal, not yet implemented:** give the local branch `confidentLanguage(real)`
instead of `detected`, so the same rule applies on both paths. A Japanese message is
still detected by its script and translates locally; ambiguous Latin text has no
trustworthy source, so it goes to the cloud which detects for itself.

**An idea that was tried and rejected — do not re-propose it.** Using the channel's
broadcast language (`livestream.lang_iso`, already fetched at `index.ts:179` for the
compose path) as the source prior. It breaks on multilingual chats, which is exactly
where a chat translator earns its keep. Counter-example: `kick.com/nanatty`, a
Japanese streamer whose chat runs in five languages at once. Every message must be
judged on its own text.

Still open beyond that: whether the same rule should also cover the three drop
decisions (`ignoreEnglish`, `isSameLanguageAsTarget`, source-language allowlist),
which currently trust franc too. That is a wider change touching the filters.

---

## 5. Store and distribution

Chrome Web Store analytics, 1 July to 16 August: 133 unique visitors, 200 listing
views, **62 installs** (31% of views, 47% of visitors — a strong funnel, leave it
alone).

- US = 28 of 133 visitors. **79% of the audience is outside the US, 68% outside
  every English-speaking country.**
- Listing views by store language: English 148, **Turkish 21, Arabic 17**, Russian
  5, then a tail of Japanese, Czech, Chinese, Hebrew.
- 60% of new users arrive via organic search. Referrals: 1.

Items 98 and 99 addressed this: `_locales` for the searchable fields, and
paste-ready Turkish and Arabic long descriptions in `store-listing.md`.

**Waiting on the user:** paste those two listings into the dashboard (they want a
native reader first — neither was written by a native speaker), and pull the
**uninstall** figures, which no export so far has included and which are the only
number that says whether shipped bugs cost users.

At ~5 listing views a day, a donation button returns approximately nothing. The
free AMO "Contributions" field costs two minutes and is worth having; anything more
elaborate is not the lever. Distribution is.

---

## 6. Traps found the hard way

**Kick API.** Layer 0 is cleared by sending **no** `User-Agent` header at all, not
by a "neutral" one. `node` → 403, `Mozilla/5.0` → 403, empty string → 403, header
absent → 404 on a nonexistent slug, i.e. the app was reached. `kick-api-notes`
records this as "neutral UA", which is wrong: Node's `https.get` simply sends none.

**Pusher chat is dead and lies about it.** `chatroom.<id>` on `ws-us2.pusher.com`
still answers `subscription_succeeded`, then delivers nothing — zero messages in
35 s on a channel with 62 868 viewers. Pusher accepts subscriptions to any public
channel name without checking it exists. `kick-core/gateway.js` is right against
`private-api.md`.

**Discovery that does work, anonymously:** `GET /stream/livestreams/{lang}?page=N&limit=24`
returns 200 with no UA header. The language segment is **not** a filter — `/tr`
returned Spanish streams. Filter client-side on each entry's `language` field. The
listing carries no `chatroom.id`; resolve each slug via `/api/v2/channels/{slug}`.

**Chat corpus comes from the DOM**, not from any API. `kick-chat-collector.js` in
the scratchpad does it with the extension's own selectors.

**Build.** `scripts/bundle-content.ts` re-bundles the content script in its own vite
pass with `configFile: false`, so `vite.config.ts` is never read and any `define`
must be repeated there. This was caught twice: once shipping the live sink into a
release, once stripping it from an instrumented build while the check still passed
because the worker bundle carried the marker.

**MV3.** The service worker is killed whenever it goes idle. Anything holding state
in worker memory must merge with storage rather than overwrite it. That was item 104.

**AMO validation warnings on 2.7.0, all three deliberate. Do not "fix" them.**

Two say `strict_min_version` 121 predates the Firefox 140 (142 on Android) that
introduced `data_collection_permissions`, so that field is ignored on 121 to 139.
Raising the minimum to 140 silences both warnings and drops every Firefox user
below it. The declaration exists for the reviewer, which is what AMO asks, and the
`websiteContent` permission is visible to those users regardless. Keep 121.

The third reports an unsafe `innerHTML` assignment in the i18n chunk. It is Preact's
own diffing code, the branch that handles a `dangerouslySetInnerHTML` prop, present
in every Preact build. `src/` contains no `innerHTML` and no
`dangerouslySetInnerHTML`, so that branch is unreachable here. Not fixable without
forking Preact, and nothing to fix.

Validation result for the record: 0 errors, 3 warnings, all other test categories
clean.

---

## 7. How this work was done

The parts that produced results, kept because they are cheap and they worked:

**Never claim a behaviour that was not observed.** Every commit message ends by
stating its verification level; most say "never seen in a browser, unit tests only".
Only item 104 is confirmed live.

**A check needs a witness.** Every guard added here was watched failing for the
right reason before being kept: remove `displayStyle` from `RERENDER_KEYS` and the
test names the missing key; make `withoutKey` stop stripping and four assertions go
red with `expected 'secret-abc' to be ''`; restore the plain `set` in the metrics
flush and four persistence tests fail, the first with `expected 4 to be 7`, the
production symptom exactly.

**A negative must prove its own measurement.** A witness that "passed" once turned
out to have edited nothing — a CRLF file against an LF pattern. A `check-strip` that
reported green was hiding a half-stripped build. Both were caught by asserting the
probe did something before trusting what it said.

**Derive lists, never hand-keep them.** This codebase has been bitten five times by
a hand-written list that someone forgot to extend: `ARTIFACT_CLASSES` three times
before item 95, the hover placeholder at item 100 (it was a bare string literal, so
the item 95 guard could not see it), and `RERENDER_KEYS` would have been the sixth.
Guards now read the source and derive what they expect.

**Measure before optimising, and publish negative results.** The channel-language
prior, the caps hypothesis and the franc `only:` restriction were all killed by
measurement before any code was written. Those three non-changes are worth more than
the commits.

---

## 8. What to do next, in order

1. **Submit 2.7.0 to both stores.** The smoke test has now been done on a live
   channel: 13 translations on screen, zero errors, observer attached, composer
   bound, and the settings arriving from the worker, which exercises items 102 and
   109, the two that carried the most risk. What is still unexercised against real
   traffic is item 108's retry, which needs a stretched line an engine refuses.
2. **Establish why the Translator API is present on one Chrome 151 and absent on
   another**, section 3. The default engine mode is worth 22 ms against 1618 ms, so
   the question is which users get that and why, not whether the mode is right.
3. **Decide the `confidentLanguage` question in section 4** for the incoming path.
   Item 107 already did it for the composer, so the precedent and the shape exist.
   `compose.skipSameLang.lookedUp` versus `.guessed` is now being counted and will
   say whether that guard should trust a guess at all.
4. **Give `dom.row.textEmpty` an honest denominator** so the 54% figure means
   something. It counts rows the observer matched, which include system lines and
   emote-only messages that legitimately carry no text.
5. **Read the cache counters again after several days.** Measured over one 29-minute
   session: the in-tab cache hit 6.7%, the persistent one 1.0%, 8 hits in 821
   lookups. A persistent cache earns its keep across sessions, which one session
   cannot measure, and it costs 0 ms to read. Do not delete it on that number alone.
6. `stripInlineEmoteNames` in `emoteParser.ts` strips any mixed-case word, so
   `iPhone`, `McDonald` and `PlayStation` are removed before translation. Silent,
   unrelated to the above, still unfixed.
7. Incoming `@mentions` are deleted from the translated line rather than preserved;
   the outgoing path masks and restores them instead. Two opposite strategies for
   the same thing. See `scratchpad/handles-mentions.md`.

## 9. Ideas already tried and rejected, with the measurement

Written down so they are not re-proposed. Each cost a session to kill.

| Idea | Why it died |
|---|---|
| Channel broadcast language as the source prior | Breaks multilingual chats, which is where a chat translator earns its keep. Counter-example: a Japanese channel whose chat runs in five languages. |
| Restrict franc to the 45 supported languages | 32% correct becomes 36%. Changes which wrong answer it gives, nothing more. |
| Remove repeated words before detecting | Also 36%. |
| Uppercase degrades franc | 23 of 23 verdicts identical between cases. franc is case-insensitive. |
| Flatten stretched text before every translation | Google already handles some stretching: "sooo goood" gives "tellement bon", flattened it gives "alors mon Dieu". Item 108 does it only after a refusal, where nothing can be spoiled. |
| Dynamic provider ordering | `chain.depth.1` twelve times out of twelve. The fallback chain has never been used; the sticky provider already does this. |
| Optimise the wait outside the provider call | The extension controls 9% of it. The 780 ms that motivated this were an artefact of comparing two sample windows. |
| `tinyld.light` in place of franc (30 KB off the injected bundle) | 2026-10-16, `langMatrix.test.ts`, 5040 Tatoeba lines: right 4154 to 4291, silent 388 to 10, **wrong 498 to 739**; short lines wrong 230 to 370. It answers where franc stays silent, and a wrong answer is the one that deletes a line (same-language skip, ignoreEnglish). Not worth 30 KB. |
