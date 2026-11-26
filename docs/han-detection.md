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

