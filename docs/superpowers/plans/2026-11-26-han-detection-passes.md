# Han detection passes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the share of Han-only chat lines named with the right language and script, in three measured passes, without a regression hidden in an aggregate.

**Architecture:** Each pass is one branch off `master`, one pre-registered rule, one reading of the fresh set `ds2`, one pull request. Pass A adds data-chosen bigrams and Japanese-only forms to the rule layer in `src/content/langDetect.ts`; pass B adds a small quantized n-gram model consulted only when the rules are silent; pass C separates the script answer from the language answer so the same-language skip uses the language only. Selection runs in Python outside the repository, the repository carries only the generated tables, the evaluator and the tests.

**Tech Stack:** TypeScript (vitest, tsx, vite), Node 22, Python 3.10 with pyarrow for selection, `gzip -9` for weight.

**Spec:** `docs/superpowers/specs/2026-11-26-han-detection-passes-design.md`

## Global Constraints

- No new visible string, no new permission, no new dependency in `package.json`; never bump vite, crxjs or zod.
- `content.js` gzip at most +4,000 bytes over 99,564 (the `master` figure); pull request 93 already uses +3,275. One command, before and after: `gzip -9 -c < dist/assets/content.js | wc -c`.
- Speed: three alternated runs against `master`, median at most 1.10 times, p95 at most 1.25 times.
- Public repository text in English; no em or en dash, no emoji, no streamer, channel or viewer name, no absolute machine path; invented test lines only, Han and kana written as `\u` escapes in tests.
- One reading of `ds2` per candidate, rule committed before it, a FAIL published as it is. Test split of `ds` is spent.
- `git add` by file name, `git -C <absolute path>` for state changes, commit messages from a file, never force-push, never `gh pr merge --admin`, `--squash`, `--rebase` or `--auto`.
- Gates read by exit code, never piped into `tail`, `head` or `grep`. Tag, release, stores and announcement only on the owner's order.
- Tests that pin totals are re-pinned with the confusion diff, never copied from the other product.

## Review Focus

- A Han-only line with a Latin word or digit inside (`你好ok`): the answer must not change from the same line without the Latin part. Test in Task 2.
- Empty, one-character and 60-character lines: no throw, no answer under two characters. Test in Task 1.
- A mixed Traditional and Simplified line (quote or lyrics): stays unanswered. Test in Task 2.
- A line with kana inside a mention (`@<kana> <Traditional Chinese>`): still Chinese after every pass. Test in Task 3.
- A model answer on a Japanese Han-only line: never a skip on its own. Test in Task 4.

---

### Task 1: Evaluator for lines of known origin

**Files:**
- Create: `test/e2e/han-origin-eval.mjs`
- Create: `src/content/hanOriginEval.test.ts`

**Interfaces:**
- Produces: `node --import tsx test/e2e/han-origin-eval.mjs --data <dir> --split <train|dev|test|fresh> --out <file>` reading `<dir>/<origin>.jsonl` rows `{t, o, src, s?}` for origins `tw hk yue cn ja`, skipping `src === 'sub'`, writing `{origin: {n, shares: {answer: percent}}}`; run from the repository root, no data path hard-coded.
- Consumes: `confidentLanguage(text: string): string | undefined` from `src/content/langDetect.ts`.

- [ ] **Step 1: Write the failing test** `hanOriginEval.test.ts`: `shares` of a three-line fixture returns `{'zh-tw': 33.33, none: 66.67}`; an empty and a one-character line are counted as `none` and do not throw.
- [ ] **Step 2: Run** `npx vitest run src/content/hanOriginEval.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `shares(rows: {t: string}[], answer: (t: string) => string | undefined): {n: number; shares: Record<string, number>}` in `test/e2e/han-origin-eval.mjs` (exported), plus the CLI around it, rounding to two decimals.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add test/e2e/han-origin-eval.mjs src/content/hanOriginEval.test.ts`.

### Task 2: Pass A1, data-chosen bigrams

**Files:**
- Create: `src/content/hanBigrams.ts` (generated table and `bigramScript`)
- Modify: `src/content/langDetect.ts` (`cantonaisOuChinois`, the branch that returns `undefined` when no list decides)
- Modify: `docs/han-detection.md` (rule first, results after)
- Test: `src/content/hanBigrams.test.ts`, `src/content/langDetect.han.test.ts`

**Interfaces:**
- Produces: `bigramScript(text: string): 'zh-tw' | 'zh' | undefined`, synchronous, linear in line length; returns an answer only when the line has no mixed-script evidence and at least one selected bigram of one script.
- Consumes: the lists already on `master` after pull request 93; `scripts/ds-lists.py` pattern (selection stays outside the repository).

- [ ] **Step 1: Pre-register.** Append to `docs/han-detection.md` the pass A rule from the spec (leak does not rise, +3 points recall on Taiwan or mainland on `ds2`, wrong script at most +0.3, gzip in margin). Commit it before any scoring. Expected: `git log` shows the rule commit before any table commit.
- [ ] **Step 2: Write the failing tests:** a line whose only evidence is a selected Traditional bigram returns `'zh-tw'`; the same with a Simplified bigram returns `'zh'`; a mixed line returns `undefined`; `你好ok` answers like `你好` (Review Focus 1); a line of one character returns `undefined`.
- [ ] **Step 3: Run** `npx vitest run src/content/hanBigrams.test.ts`. Expected: FAIL.
- [ ] **Step 4: Select bigrams** with a Python script (greedy by newly covered Chinese lines per Japanese line flagged, Japanese budget from dev, separate budget for the other script, pruned by gain per byte until gzip fits the margin) writing `src/content/hanBigrams.ts`; implement `bigramScript` with a `Set<string>` lookup per script. Wire it as the last resort in `cantonaisOuChinois`.
- [ ] **Step 5: Verify gates:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, each exit 0; re-pin pinned totals with the confusion diff.
- [ ] **Step 6: Read `ds2` once** with Task 1's CLI against `master` and the candidate; measure weight and speed as in Global Constraints. Write the counts into `docs/han-detection.md`; PASS or FAIL is stated.
- [ ] **Step 7: Commit and open the pull request** (CI three jobs green before any merge by the owner).

### Task 3: Pass A2, Japanese-only forms

**Files:**
- Create: `src/content/hanJaForms.ts`
- Modify: `src/content/langDetect.ts` (`detectByScript`, Han-only branch)
- Test: `src/content/hanJaForms.test.ts`

**Interfaces:**
- Produces: `jaOnlyScore(text: string): number`, the count of characters in the Japanese-only list; the Han-only branch answers `'ja'` only when the score reaches a threshold chosen on dev.
- Consumes: the rule of Task 2 (pre-registered with it).

- [ ] **Step 1: Write the failing tests:** a Han-only line with two Japanese-only forms returns `'ja'`; a Chinese line from the earlier failure (a Chinese line that carries one shared form) does not; `@<kana mention> <Traditional Chinese>` stays `'zh-tw'` (Review Focus 4).
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Select the list** with the Python greedy under the budget "Chinese lines flagged `ja` at most 1 in 500 on dev"; implement the two functions.
- [ ] **Step 4: Gates and one reading** as in Task 2, steps 5 to 7. If it fails the rule it is dropped by a revert commit and recorded, as in the earlier abandoned steps.

### Task 4: Pass B, n-gram model

**Files:**
- Create: `src/content/hanModel.ts` (quantized weights, generated) and `scripts/` none (training stays outside the repository)
- Modify: `src/content/langDetect.ts` (`confidentLanguage`, after the rules, Han-only lines only)
- Test: `src/content/hanModel.test.ts`

**Interfaces:**
- Produces: `classifyHan(text: string): {lang: 'zh-tw' | 'zh' | 'yue' | 'ja'; p: number} | undefined`, synchronous, memoised like `LOOKUP_MEMO` if heavy; `confidentLanguage` uses it only when `p` reaches the threshold set on dev and never returns `'ja'` from it alone.
- Consumes: the final rule layer of passes A.

- [ ] **Step 1: Pre-register** pass B criteria from the spec in `docs/han-detection.md` and commit.
- [ ] **Step 2: Write the failing tests:** probability calibration on a 200-line dev fixture is within 3 points per bin; a Japanese Han-only line never makes `confidentLanguage` return `'ja'` through the model (Review Focus 5); `classifyHan('')` is `undefined`; the weights file stays under the remaining gzip margin (assert on the generated byte length).
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Train** a multinomial model on unigrams and bigrams of `ds` train, calibrate on dev (temperature scaling), quantize to 8 bits, emit `hanModel.ts`; implement `classifyHan` and wire it.
- [ ] **Step 5: Gates and one reading** as in Task 2. If it does not beat the best pass A candidate at equal weight, publish the negative result and do not merge.

### Task 5: Pass C, script and language separately

**Files:**
- Modify: `src/content/langDetect.ts` (export `scriptOf(text: string): 'zh-tw' | 'zh' | 'kana' | undefined`)
- Modify: `src/content/filters.ts` (`skipOnHint`) and `src/content/pipeline.ts` (call sites at the same-language gate)
- Test: `src/content/langDetect.han.test.ts`, `src/content/filters.test.ts`, `src/content/pipeline.test.ts`

**Interfaces:**
- Produces: `scriptOf` as above; `skipOnHint(hint: string | undefined, target: string): boolean` unchanged in signature, its input is now the sure language only.
- Consumes: Tasks 2 to 4.

- [ ] **Step 1: Pre-register** pass C criteria from the spec and commit.
- [ ] **Step 2: Write the failing tests:** a Cantonese line without a marker has `scriptOf` `'zh-tw'` and no sure language, so `skipOnHint` is false for a `zh-tw` reader; a Taiwanese line with a sure language still skips for a `zh-tw` reader; parity test of the bench with the pipeline on 53 lines still identical.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement** `scriptOf`, route the same-language gate through the sure language only, keep `confidentLanguage` as the contract for other callers.
- [ ] **Step 5: Gates, the bench for the five readers on the design set, and one reading of `ds2`.** Expected: Cantonese lines read `zh-tw` within 2 points of `master`, no other origin down by more than 0.3, no `W` cell up by more than 2 lines.

### Task 6: Port to Twitch Chat Translator

**Files:** the region of `src/content/langDetect.ts` that holds the tables (identical to KCT's by the earlier byte comparison), `src/content/filters.ts`, `src/content/pipeline.ts` (contains 2 NUL bytes, edit with the Edit tool, check with `git diff --text`).

**Interfaces:** consumes each validated pass of Tasks 2 to 5 as a patch; produces one pull request per pass in the Twitch repository.

- [ ] **Step 1:** Per validated pass, `git format-patch` from KCT then `git apply --reject` or hand port in the table region; no `--3way`.
- [ ] **Step 2:** Cross-diff the table region of both files; expected: identical except escapes.
- [ ] **Step 3:** Re-pin totals of Twitch with its own confusion diff; run `npm run release:check`, `node .agent/parity-check.mjs`, `node .agent/text-check.mjs`; each exit 0.
- [ ] **Step 4:** Bench on the design set with the extraction commit as reference; commit and open the pull request.

### Task 7: Records after each pass

**Files:** `docs/han-detection.md`, `CHANGELOG.md` (`## [Unreleased]`), the request repository case 002, the Discord `projects-and-researches` embed, the journal `kct-data/han/JOURNAL.md`.

- [ ] **Step 1:** Run `node "$HOME/.claude/skills/readme-check/readme-drift.mjs" . --base <sha>`; read its exit code; decide each `NEW FILE`.
- [ ] **Step 2:** Add counts only (no chat lines) to case 002 and the Discord embed; `python slop_check.py` exits 0 before posting.
- [ ] **Step 3:** Five lines in the journal: pass, SHAs, counts, next step, traps.
