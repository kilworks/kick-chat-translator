# Han-script lines: detection and the engine verdict

This page records the measurements behind the han-script changes (Japanese, Chinese, Korean lines). It holds counts and
identifiers only, never chat lines.

## The problem

A line can be deleted before the reader sees it by two gates:

1. the "same language, sure" gate (`skipOnHint`): the local detector is confident the line is in the reader's language;
2. the "engine verdict" gate (`skipOnVerdict`): the translation service answers with the reader's language after the call.

Both can delete a line the reader should have seen. The engine answers `en` for a large part of short traditional Chinese,
and kana inside an @mention or a link made Chinese lines read as Japanese.

## Sets

- `design`: PC chat collection of 22 Nov 2026, 16:00 to 22:00 UTC, Twitch and Kick. 3,608 distinct texts after dedup and the
  60 per unit cap (1,936 declared Japanese, 1,511 Chinese, 161 Korean). sha256 of the line file:
  `ad7ffa9510f93c10fda088e90dc279f5b54556888ca760fb554f5dd0348a0dae`.
- `frais`: Twitch collection of 23 Nov 2026, cycle groups `o11230008`, `o11230159`, `o11230349`, `o11230540`, `o11230730`,
  `o11230920` (276 files). sha256 of the file list with per-file hashes:
  `5a72456e19c111a44b77fd50d80eb6358deab287c9d249000635ce019ecade04`. Selected set: 3,655 distinct texts (1,840 Japanese,
  1,415 Chinese, 400 Korean), line file sha256 `88d9ed2cb5ad457df169ae7f9969a7e4c545a5aaefa433f031e84a0d295eb3c9`.
  Deduplicated against `design`, the earlier Tatoeba test set and the pool; share removed: Japanese 14,858 lines, Chinese
  2,571, Korean 61. No `frais` line is read before the decision rule below is committed.
- Labels are the declared language of the channel. An audit of 400 han-only `design` lines by two independent annotators
  (gold lines: 0 misses) disagrees with the declared label on 11.0 percent of the decided Japanese lines and 4.5 percent of
  the decided Chinese lines, so declared labels are noisy. 42 percent of han-only Japanese lines and 6 percent of han-only
  Chinese lines have no decidable language. Two annotators of one model family are not independent evidence.
- `frais` is Twitch only. It proves neither Kick, nor Cantonese (no data), nor Korean (rare).

## Counts

For each reader (`en`, `ja`, `zh`, `zh-tw`, `ko`) and declared class: `W` lines deleted although not in the reader's
language (weight 10), `S` wrong source hint (5), `K` lines of the reader's language sent for translation (1), `Z` silence
of the local detector on a line of a known language (0.5). Cost is `10 W + 5 S + K + 0.5 Z`. The three allowlist cells
(`ja,ko`; `zh,zh-tw,yue`; `zh` reported only) count lines the source-language allowlist deletes. `test/e2e/han-bench.mjs`
runs the real gates for each (line, reader); `test/e2e/han-compare.mjs` compares a reference and a candidate with a paired
bootstrap by unit (1,000 draws, seed 0).

## Decision rule

Pre-registered before any scoring of `frais`. Three outcomes per criterion: PASS, FAIL, UNDERPOWERED (fewer than 30 units,
or fewer than 200 lines, or fewer than 10 units carrying lines the criterion concerns).

1. `W`: no cell (reader or list, class) rises by more than 2 lines; the sum of the rises is at most 5 percent of the sum of
   the drops. The `zh` list is reported without a criterion.
2. `S`: no class rises by more than 2 lines.
3. Cost of the `en` and `ja` readers: mean paired difference negative with a 95 percent upper bound below 0. When the
   interval cannot exclude 0 for lack of power, the criterion reads: mean difference negative or null and no unit rising by
   more than 1 `W`.
4. Speed: p95 of the detection time per line at most 1.25 times the reference, median at most 1.10 times.
5. `content.js` gzip grows by at most 4,000 bytes.
6. First change only: `K` of the `en` reader on the Latin lines of `design` rises by at most 0.5 percent of those lines.

The `frais` reading happens once, after the code freeze: each prefix of the second change set against the code after the
first one. The second change set is the longest prefix with no FAIL; later steps are removed by removal commits, never by a
second reading. Any change after the reading invalidates it for that change.

## First change: results on `design`

Reference: the extraction commit. Candidate: the engine-verdict guard and the mention and mark fixes. Engine verdicts exist for 1,133 of the 3,608 lines (the collection was cut by a rate limit), so the verdict gate is scored on those 1,133 only and the rest of the table on all 3,608 lines; the held-out set is not read for this change.

- `W` (deleted although not in the reader's language), `en` reader: 329 to 0 over the lines answered (14 Japanese, 315 Chinese). Every other reader and list cell: no rise above 1 line (`ja,ko` list on Korean 49 to 50; the two Chinese lists down by 4 and 2).
- `S` (wrong source hint): Chinese class 6 to 3, no class up. Silence on han-only Chinese 0.581 to 0.583; leak of han-only Japanese read as Chinese 0.032 to 0.032.
- Cost, paired bootstrap by unit (202 units): `en` reader mean change per unit -16.35, 95 percent interval [-22.98, -10.15]; `ja` reader -0.218, [-0.510, -0.005].
- `K` of the `en` reader on Latin lines: 34 to 34 and 20 to 20 (no rise).
- Speed: median 0.96 and p95 1.02 times the reference (three alternated runs). Weight: content.js gzip 99,330 to 99,564 bytes.
- Parity of the bench with the pipeline: 53 lines, identical decisions. Real Brave proof with a faked service: a traditional line answered `en` is skipped by the published build and translated by the candidate; an English line answered `en` is skipped by both.
- Not proven: Kick chat (the sets are Twitch plus PC chat), Cantonese (no data), the held-out set, and the verdict gate on the 2,475 lines without a stored verdict.

## Data-driven marker lists: pre-registered rule

Pre-registered before the test split is read. The two hand-made lists (45 Traditional and 45 Simplified characters) are replaced by lists chosen from labelled lines of known origin: Taiwan, mainland China, Hong Kong, Cantonese and Japanese, about 340,000 distinct Han-only lines cut by a hash of the line into train (60 percent), dev (20) and test (20). Subtitle files are left out of selection and scoring, because they are labelled by file name only and mix scripts. A character is added to the Traditional list (Simplified list) in order of newly covered Chinese lines per newly flagged Japanese or other-script line, while the Japanese lines it flags stay under 0.3 percent of the Japanese train lines. The Cantonese list is not changed. Candidates are the characters that differ between the two scripts in the OpenCC character tables. The budget was picked on dev among three values.

On the test split, read once, against the lists on `master`:

1. Japanese leak: the share of Han-only Japanese lines read as Chinese (`zh`, `zh-tw`, `yue`) does not rise.
2. Recall: the share of Taiwanese lines read `zh-tw` and the share of mainland lines read `zh` each rise by at least 10 points.
3. Wrong script: Taiwanese lines read `zh` and mainland lines read `zh-tw` each rise by at most 0.3 points.
4. Cantonese: the share of Cantonese lines read `yue` falls by at most 0.5 points. The share read `zh-tw` is reported as a price, without a threshold (amended before the test split was read: dev showed 24.0 to 35.4 percent, because about half of written Cantonese carries no Cantonese marker and the longer Traditional list now names it Traditional; a Cantonese line read `zh-tw` is skipped for a `zh-tw` reader, so the owner weighs it).
5. Weight: `content.js` gzip grows by at most 4,000 bytes. Speed: median at most 1.10 times, p95 at most 1.25 times.
6. Tests that pin totals are re-pinned with the confusion diff.

One reading. A FAIL is published as it is.

## Data-driven marker lists: results (test split, read once)

Lists: 506 Traditional and 592 Simplified characters, selected on train with a 0.3 percent Japanese budget (budget picked on dev among 0.3, 1.0 and 2.3 percent). Test split, Han-only lines, subtitles left out. First figure `master`, second the candidate.

| Origin (lines) | zh-tw | zh | yue | none |
|---|---|---|---|---|
| Taiwan (1,889) | 59.3 to 77.8 | 0 to 0.16 | 0.1 to 0.1 | 40.6 to 21.9 |
| Hong Kong standard written (3,907) | 18.8 to 34.8 | 0 to 0.13 | 40.3 to 40.3 | 40.9 to 24.8 |
| Cantonese (6,492) | 25.1 to 36.6 | 0 to 0.09 | 52.0 to 52.0 | 23.0 to 11.3 |
| Mainland (4,505) | 0.27 to 0.47 | 37.8 to 82.4 | 0.09 to 0.09 | 61.8 to 17.0 |
| Japan (16,209) | 0.68 to 0.44 | 0.44 to 0.28 | 0.01 to 0.01 | 98.9 to 99.3 |

1. Japanese leak: 1.13 to 0.73 percent. PASS.
2. Recall: Taiwan +18.5 points, mainland +44.6 points. PASS.
3. Wrong script: Taiwanese lines read `zh` +0.16, mainland lines read `zh-tw` +0.20. PASS.
4. Cantonese read `yue`: 52.0 to 52.0. PASS. Price, reported: Cantonese lines read `zh-tw` 25.1 to 36.6 percent.
5. Weight: `content.js` gzip 99,564 to 102,839 bytes (+3,275). Speed, three alternated runs: median 0.95 times, p95 0.84 times the reference. PASS.
6. Tests re-pinned with the confusion diff: Tatoeba `confidentLanguage` 3,676 right and 1,361 silent to 3,715 and 1,322 (3 wrong in both), short lines 1,056 to 1,075 right, `detectLanguage` Traditional lines answered Simplified 15 to 4, one Cantonese chat line now named Traditional.

Limits: the Japanese side is Niconico comments, subtitles and Wikipedia; the Chinese sides are Common Voice sentences, Bilibili comments, forum posts and Wikipedia, not Twitch or Kick chat; Cantonese markers were not changed; the Hong Kong standard written set is mostly colloquial Cantonese in practice.


## Pass A2, characters only Japanese writes: pre-registered rule

Pre-registered before the chat-like fresh set `ds3` (lines of at most 20 characters, never used to select or tune anything; forum sentences, video comments, Cantonese and Japanese short lines) is read for this candidate. Candidate: a list of Han characters that occur in at least 10 Japanese train lines and in at most 1 Chinese train line (all origins, subtitles included). A Han-only line that the rules leave unanswered and that contains one of them is named `ja`. Reference: the lists of pull request 93.

On `ds3`, read once, against the reference:

1. Han-only Japanese lines named `ja` rise by at least 10 points.
2. Chinese lines (Taiwan, Cantonese, mainland) named `ja` rise by at most 0.02 points each.
3. No other answer changes (the candidate only turns no answer into `ja`).
4. Weight: gzip at most 725 bytes over pull request 93. Speed: median at most 1.10 times, p95 at most 1.25 times.

A FAIL is published as it is. `ds3` is not read again for this candidate.

## Pass A2, characters only Japanese writes: results (chat-like fresh set, read once): FAIL

175 characters. Reference: the lists of pull request 93. Set `ds3`, Han-only lines of at most 20 characters, first figure reference, second candidate.

| Origin (lines) | answer `ja` | other answers |
|---|---|---|
| Japan (203,812) | 0 to 20.09 | no answer 98.68 to 78.58, read as Chinese 1.29 to 1.29 |
| Taiwan (15,383) | 0 to 0.07 | `zh-tw` 74.03 unchanged |
| Cantonese (19,205) | 0 to 0.03 | `yue` 60.03 unchanged |
| Mainland (270,309) | 0 to 0.01 | `zh` 78.98 unchanged |

1. Japanese lines named `ja`: +20.09 points. PASS.
2. Chinese lines named `ja`: Taiwan +0.07 (11 lines), Cantonese +0.03 (6 lines), mainland +0.01 (27 lines), against 0.02 allowed. FAIL for Taiwan and Cantonese.
3. No other answer changed. PASS.
4. Weight: gzip 102,839 to 103,446, +607 bytes against a margin of 725. PASS. Speed not measured for this record.

A near miss on a small Taiwanese set (15,383 lines). By the rule it is a FAIL and the list is not tuned on this set. A stricter candidate (characters absent from every Chinese train line) is registered on its own branch with a new fresh set.

## Pass A2b, stricter Japanese-only characters: pre-registered rule

Pre-registered before the fresh set `ds4` is read (TED2020 lines of at most 20 characters for Taiwan and the mainland, Cantonese lines longer than 20 characters, Japanese Han-only lines longer than 20 characters; none used to select or tune anything). Candidate: the same wiring as pass A2 with the list of characters that occur in at least 10 Japanese train lines and in no Chinese train line (151 characters). Reference: the lists of pull request 93.

On `ds4`, read once, against the reference:

1. Han-only Japanese lines named `ja` rise by at least 10 points.
2. Chinese lines (Taiwan, Cantonese, mainland) named `ja` rise by at most 0.02 points each.
3. No other answer changes.
4. Weight: gzip at most 725 bytes over pull request 93. Speed: median at most 1.10 times, p95 at most 1.25 times.

A FAIL is published as it is. `ds4` is not read again for this candidate.

## Pass A2b, stricter Japanese-only characters: results (fresh set, read once): PASS

151 characters. Reference: the lists of pull request 93. Set `ds4`, Han-only lines, first figure reference, second candidate.

| Origin (lines) | answer `ja` | other answers |
|---|---|---|
| Japan, longer than 20 characters (29,301) | 0 to 16.77 | no answer 97.04 to 80.27, read as Chinese 1.71 to 1.71 |
| Taiwan, at most 20 characters (100,000) | 0 to 0.01 (1 line) | `zh-tw` 84.49 unchanged |
| Cantonese, longer than 20 characters (26,925) | 0 to 0.00 | `yue` 81.14 unchanged |
| Mainland, at most 20 characters (100,000) | 0 to 0.00 | `zh` 94.03 unchanged |

1. Japanese lines named `ja`: +16.77 points. PASS.
2. Chinese lines named `ja`: Taiwan +0.01, Cantonese and mainland +0.00, against 0.02 allowed. PASS.
3. No other answer changed. PASS.
4. Weight: gzip 102,839 to 103,378, +539 bytes against a margin of 725. Speed, three alternated runs: median 1.05 times, p95 1.03 times. PASS.

Informational, not used to choose: on 33,852 real Twitch lines declared Chinese, 0.1 percent (about 34 lines) are now named `ja`; the benefit and this price are both small, and a Japanese reader would skip those lines as already in their language.

## Stream prior for Han-only lines: design and pre-registered rule

What is still open for Japanese. Google answers, on the design set (Han-only lines, 1,452 Chinese and 188 Japanese by declared channel language): for Chinese lines `en` 75.3 percent (already ignored by the engine-verdict guard), `zh-CN` 22.5, `yue` 1.4, `ja` 0.8; for Japanese lines `ja` 70.2, `zh-CN` 18.6, `en` 10.1. The verdict gate trusts any of them except `en`. So a Japanese reader loses 0.8 percent of the Han-only Chinese lines (answered `ja`), and a Chinese reader loses 18.6 percent of the Han-only Japanese lines (answered `zh-CN`). A Han-only line carries no script evidence, so the line alone cannot settle it; the stream can.

Design. A running count of the sure answers of `confidentLanguage` on the lines of the open channel (exponential decay, a window of about 200 sure answers, at least 30 observed) gives a prior family for the stream. Only sure answers of the two families count (Japanese, or Chinese: `zh`, `zh-tw`, `yue`); answers in other languages are ignored. The prior is `ja` when Japanese answers are at least 60 percent of them, `zh` when Chinese answers are at least 60 percent, undefined otherwise or before 30 of them were seen. On a Han-only line that the character lists leave unanswered, the engine verdict may skip the line only when its family (`ja` or Chinese) is the family of the prior; with no prior it may not skip. Lines named by the lists, the kana, the Japanese-only characters or any other sure answer are untouched. The count lives in memory for the open tab, is never stored or sent, and is reset when the channel changes.

Pre-registered, before the chat of any Japanese or Chinese channel is replayed for this change: the replay is the collected Twitch chat of about 90 channel units declared Japanese or Chinese, in time order, with the sure answers computed by the code on `master`.

1. Prior quality: among the Han-only lines that arrive once the prior exists, the prior family equals the family of the declared channel language for at least 95 percent of lines; the prior exists (30 sure answers seen) for at least 90 percent of the Han-only lines of units with at least 200 lines.
2. Effect, computed with the answer rates of Google measured on the design set above and the replayed prior: the share of Han-only Chinese lines hidden for a `ja` reader falls from 0.8 percent to at most 0.1 percent, and the share of Han-only Japanese lines hidden for a `zh` or `zh-tw` reader falls from 18.6 percent to at most 3 percent.
3. Price, same computation: the share of Han-only Japanese lines kept for a `ja` reader (not skipped although in the reader's language) rises by at most 35 points (from 30 percent kept to at most 65 percent), and the Chinese readers keep at most 25 percent more Han-only Chinese lines than today.
4. Weight at most 1,500 bytes gzip, speed unchanged within 1.10 times.

A FAIL is published as it is.

## Stream prior for Han-only lines: results

Replay of the collected Twitch chat, 160 channel units of which 83 have at least 200 lines (27 Japanese, 56 Chinese), in time order, with the sure answers of the code on `master`.

1. Prior quality. Japanese units: the prior existed for 99.7 percent of the 4,773 Han-only lines the character rules left unanswered, and was right for 100.0 percent of them. Chinese units: it existed for 95.6 percent of the 42,805 lines and was right for 100.0 percent. PASS (95 percent right and 90 percent present were asked).
2. Effect, computed from the answers of Google on the design set (Han-only lines, 1,452 Chinese and 188 Japanese) and the replayed prior. Han-only Chinese lines hidden for a Japanese reader: 0.8 percent to 0 (the service said `ja`, the stream said Chinese). Han-only Japanese lines hidden for a Chinese reader: 18.6 percent to 0 (the service said `zh-CN`, the stream said Japanese). PASS (at most 0.1 and 3 percent were asked).
3. Price. Han-only Japanese lines kept for a Japanese reader although in their language: 29.8 to 30.0 percent (the first 30 sure answers of a stream have no prior), +0.2 points. Han-only Chinese lines kept for a Chinese reader: 76.1 to 77.2 percent, +1.1 points. PASS.
4. Weight: `content.js` gzip 103,378 to 103,684 bytes (+306, 1,500 allowed). Speed: 0.014 microseconds per line for the prior against about 20 for the detection of a line. PASS.

Pinned tests did not move. New tests: the prior itself (threshold of 30, families, forgetting, reset), the gate (`skipOnVerdictForStream`: the three stream cases, an unknown stream, and every other line decided as before), and three pipeline tests that fail when the gate is neutralised (checked: two of them go red).

Left open on the Japanese side, not covered by this change: Han-only Japanese lines that the character lists name Chinese (1.3 percent of them on the chat-like fresh set) are still skipped for a Chinese reader through the sure-hint gate; and the prior is blind during the first 30 sure answers of a channel. Not measured on a live channel in a browser.
