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

## Second change: additive steps (d) to (f) on `design`

The lists behind these steps were chosen on the even lines of a separate chat file, so the thresholds are computed on the
2,174 `design` lines whose normalized text is not one of those lines (76 han-only Japanese, 814 han-only Chinese); the whole
`design` figures (188 and 1,452) are given beside. The reference for each step is the code before it. `design` has no
Cantonese gold, so nothing here measures Cantonese.

- (d) Japanese-only forms (256 characters): ABANDONED. Han-only Japanese lines named `ja`: 16 of 76 (21.1 percent; whole
  29 of 188), above the 10 percent threshold. Han-only Chinese lines that receive `ja`: 2 of 814 (whole 4 of 1,452), above
  1 in 500. Every flagged line is real Chinese from one unit written with a Japanese form of one character (the caveat of the
  plan). Of the han-only lines named `ja`, 2 of 18 are Chinese (whole 4 of 33). Silence 0.550 to 0.548.
- (e) Compact lists: ABANDONED. List A (first 200 traditional, first 200 simplified, plus the 256 Japanese-only forms):
  silence 0.550 to 0.431 (whole 0.566 to 0.448), Japanese leak 0 of 76 (whole 4 of 188 against 2 of 188 before), but `ja`
  reader on Chinese lines `W` 3 to 5 and `S` 3 to 5 (the same flagged lines as (d)). List B (first 100 of each plus the 145
  top Japanese forms): silence 0.550 to 0.484 (whole 0.500), `W` and `S` unchanged, leak 0. B is 5.3 points above A, more
  than the 3 points allowed, so A is the candidate and A fails the no-rise rule.
- (f) 18 Chinese function characters: KEPT. Silence 0.550 to 0.381 (whole 0.566 to 0.399), Japanese leak 0 to 0 (whole
  0.011 to 0.011), `W` and `S` unchanged in every cell. The `zh` list cell 468 to 461, the three-language Chinese list
  101 to 94. Costs on the Tatoeba bench: 13 traditional lines and 1 Cantonese line now read as `zh` (3 to 17 wrong
  answers of 5,037), and a Cantonese line made of shared characters plus one of the 18 reads as `zh`.

## Second change: tables and bopomofo, on `design`, without engine verdicts

Reference: the code after the first change. Counts over all 3,608 lines.

- Japanese han-only lines read as Chinese: 3.2 percent to 1.1 percent. Silence on han-only Chinese lines: 58.3 percent to 56.6 percent after the table swap.
- `S`: Japanese class 20 to 16. `W` of the Chinese readers on Japanese lines 39 to 35; the `zh,zh-tw,yue` list 179 to 168 then 166; the `ja` reader on Chinese lines 6 to 7 (within the 2-line limit).
- Reported without a criterion: the Chinese-only list deletes more lines, 773 to 790 after the tables and 798 after bopomofo, because more lines are now read as Chinese.
- Cost per unit, paired: `en` -0.158 [-0.295, -0.037], `zh` -0.495 [-0.928, -0.114] for the tables; every reader below 0 for bopomofo.
- Known price: the 11 traditional Tatoeba lines the old table recognised only through characters that left it are now answered by the fallback as simplified Chinese.

The held-out set was not read for this change: the engine verdict collection was cut by a rate limit. This change stays a draft until it is.
