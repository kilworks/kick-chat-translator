# Han-script detection: three measured passes

Status: written for review, nothing implemented. Date: 2026-11-26. Applies to Kick Chat Translator first, Twitch Chat Translator after each validated pass.

## Purpose

A chat line written with Han characters should be named with the right language and script, so that it is neither deleted as "already in my language" nor sent with a wrong source. The owner's order for this stage: push the detection as far as it can go before any release. Rules that do not move: no new visible string, no new permission, no new dependency, `content.js` gzip at most +4,000 bytes over the current `master` figure of 99,564 bytes (pull request 93 already uses +3,275), nothing published without the owner's order.

## What is already known

- The engine-verdict guard and the mention and mark fixes are merged (pull requests 91 and 26).
- Lists of characters chosen from data, with a Japanese leak budget, beat hand-made lists on a held-out split (pull request 93): Taiwanese lines named Traditional 59.3 to 77.8 percent, mainland lines named Simplified 37.8 to 82.4, Han-only Japanese lines read as Chinese 1.13 to 0.73. Price: written Cantonese without a marker is named Traditional more often (25.1 to 36.6 percent).
- Vocabulary markers from the OpenCC tables cover 1 to 4 percent of chat-length lines and are not a lever.
- A line whose only marker is a character Japanese also writes is ambiguous by nature; removing the character trades one error for another.

## Data and measurement protocol (all passes)

- Selection and tuning data: `ds`, about 340,000 distinct Han-only lines of known origin, cut by a hash of the line into train 60, dev 20, test 20 percent. Its test split was read for pull request 93 and is spent for any later candidate.
- Fresh set `ds2`, never used to select or tune anything: Taiwan 338,867 lines (TED2020), mainland 334,479 (TED2020), Cantonese 46,130 (Common Crawl filtered, Tatoeba), Japan 233,113 (Niconico archives not used before, subtitles, Tatoeba). Lines already in `ds` are removed.
- One reading of `ds2` per candidate. The decision rule is committed before the reading. A FAIL is published as it is. A second reading for the same candidate is not allowed; a changed candidate needs a new set.
- Counts per origin, never one aggregate: share named `zh-tw`, `zh`, `yue`, `ja`, no answer, for every origin, and for Japan the share read as Chinese. The bench of the repository (`test/e2e/han-bench.mjs`) is run for the readers `en`, `ja`, `zh`, `zh-tw`, `ko` on the design set as before.
- Informational readings, never used to choose: the 33,852 real Twitch lines declared Chinese, and the Tatoeba totals pinned by the tests.
- Speed: three alternated runs against `master`, median at most 1.10 times and p95 at most 1.25 times. Weight: gzip of the release build, one command, before and after.
- The engine verdicts from the search service are collected slowly in the background for the design set (about 1,570 of 3,608 answered). They are used only to measure the verdict gate, not to choose lists.

## Pass A: richer rules

Add, in order and each as its own commit with its own red-then-green witness: (1) character bigrams for Traditional, Simplified and Japanese-only forms where a single character is ambiguous, (2) a list of characters only Japanese writes, used on Han-only lines. Each addition is greedy under a leak budget on the Japanese train lines, with a separate budget for the other script. Criteria on `ds2`: the Japanese leak does not rise; recall of the expected answer rises by at least 3 points for Taiwan or mainland; wrong-script shares rise by at most 0.3 points; gzip stays inside the margin. Risk: little margin left, so bigrams must be pruned by gain per byte.

## Pass B: character n-gram classifier

A small multinomial model on character unigrams and bigrams, trained on `ds` train, calibrated on dev, applied only to Han-only lines the rules leave unanswered, never as the sole condition of a skip. The weights are quantized and counted in the byte budget. Criteria on `ds2`: beats the best pass A candidate at equal weight; the stated probability matches the observed precision within 3 points in every origin; the Japanese leak does not rise; no origin loses more than 0.3 points of its expected answer. If it does not clear the margin it is published as a negative result and stays out of the product.

## Pass C: script and language answered separately

`confidentLanguage` keeps its contract. A new internal answer carries the script (Traditional, Simplified, kana) beside the language. The same-language skip uses the language only when it is sure; the script alone never skips a line. Criteria: the Cantonese price disappears (Cantonese lines read `zh-tw` returns to within 2 points of `master`) with no other origin losing more than 0.3 points; the bench shows no cell of `W` rising by more than 2 lines for any reader. Risk: an internal interface change, so tests that pin totals are re-pinned with the confusion diff and Twitch Chat Translator is ported by hand, region by region, with a cross-diff to prove identity.

## Delivery

- After each validated pass: the port to Twitch Chat Translator with its own reading on the design set, then the pull requests, which the owner merges. Case 002 and the Discord channel are updated with counts.
- Pull requests 92 and 27 are superseded and are closed only on the owner's word.
- No tag, release, store submission or announcement without the owner's order. Proposed versions when the owner asks: 3.6.4 and 1.1.3.

## Out of scope

The manual start of translation on a new page; the Chrome `LanguageDetector` API (absent from Brave, unavailable in a fresh Chrome profile); the second review remark about Korean; changes to visible strings.

## Open risks

Japanese Han-only lines are a small share of real chat and of the data, so criteria on the Japanese side are powered by the Niconico volume, not by chat. The origin labels of the subtitle and corpus files are by file only. None of the sets is Twitch or Kick chat except the informational reading.
