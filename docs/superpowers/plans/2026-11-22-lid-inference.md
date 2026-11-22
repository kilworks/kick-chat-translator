# Language identification by inference: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace franc's guess with a trained, calibrated n-gram classifier shipped in the content script, for every browser.

**Architecture:** Offline Python/numpy training under `tools/lid/` writes int8 weights into a generated TS module. `src/content/lid/model.ts` runs inference; `langDetect.ts` calls it where it called franc, with thresholds chosen by an explicit error cost. Measurement reuses the real TS detection functions through `node --import tsx`.

**Tech Stack:** TypeScript (vitest, vite), Python 3 + numpy (training only, no new npm dependency).

**Spec:** `docs/superpowers/specs/2026-11-22-lid-inference-design.md`

## Global Constraints

- Data folder `C:\Users\kil\kct-data` stays outside git; no absolute path of this machine in a tracked file (scripts take the folder as `--data <dir>`).
- `heldout.jsonl` read once, in Task 6 only; `heldout.sha256` checked before and after.
- The 5040 `LANG_CORPUS` sentences never in training (hash of normalized text).
- No CC BY-SA data in shipped weights. Tatoeba attribution in README.
- No new npm dependency, no manifest change, no visible text.
- Cost table fixed: wrong deletion 10, wrong cloud `sl` 5, wrong on-device source 4, wrong flag 1, silence 0.5, right 0.
- Weights unreadable or checksum wrong: behavior identical to `47cb0ae`.
- p95 inference < 0.3 ms per line.
- English in code, comments, commits; no U+2013/U+2014; no streamer names.

## Review Focus

1. Empty, whitespace, emote-stripped or 1-character text: model must return `undefined`, never throw (test in Task 3).
2. Text in a script the model never saw (e.g. Georgian, emoji only): `und` or below threshold, not a confident Latin language (Task 3).
3. Very long pasted lines (2000+ chars): inference cost bounded (cap on features, Task 3 timing test).
4. Lookup-table answers must never be overridden by the model (Task 5 test on a table line).
5. Hash function identical in Python and TS on non-BMP characters (surrogate pairs) (Task 3 parity fixture includes emoji and CJK Ext-B).

---

### Task 1: Training data

**Files:** Create `tools/lid/fetch_tatoeba.py`, `tools/lid/dataset.py`, `tools/lid/test_dataset.py`, `tools/lid/export_bench.mjs`.

**Interfaces:**
- Produces: `normalize(text: str) -> str` (lowercase, NFKC, runs of the same letter cut to 2, URLs -> ` u `, digits -> `0`); `<data>/lid/train.jsonl`, `<data>/lid/valid.jsonl` with `{"text","lang"}`; languages = the 41 keys of `TATOEBA` in `test/e2e/build-lang-corpus.mjs` plus `zh-tw` (split by its TRAD_ONLY rule).
- `export_bench.mjs` writes `<data>/lid/bench-exclude.txt` (normalized `LANG_CORPUS` texts) by importing `src/content/langCorpus.ts`.

- [ ] Test `test_injected_bench_sentence_fails`: building with one bench sentence added to the source raises `LeakError`. Test `test_dev_heldout_excluded`: no normalized dev/heldout text in train.
- [ ] Implement: full per-language Tatoeba exports (same URL as `build-lang-corpus.mjs`, no Range), cap 20000 sentences per language, dedupe, exclude bench + dev + heldout texts (read heldout texts only to hash them, never printed). Chat captures: drop lines without letters, keep only lines whose dominant script matches the channel language, tagged `src=chat` for the ablation.
- [ ] Run tests, commit.

### Task 2: Training

**Files:** Create `tools/lid/train.py`, `tools/lid/features.py`.

**Interfaces:**
- `features(norm: str) -> list[int]`: char n-grams 1..4 over `" " + norm + " "` and whole words prefixed `w:`, each hashed with FNV-1a 32 over UTF-8 bytes, `mod B`; capped at 512 features.
- Writes `src/content/lid/weights.generated.ts` exporting `LID_WEIGHTS: string` (base64), and `src/content/lid/parity.fixture.json` (500 lines: text, logits).
- Binary format v1: magic `LID1`, u32 B, u32 C, f32 temperature, C label strings (u8 len + bytes), per class f32 bias, f32 row scale per bucket, int8 B x C, u32 FNV checksum of everything before it.

- [ ] Models: multinomial logistic regression (Adam, minibatch 512, label smoothing 0.1, L2), B in {2^14, 2^15, 2^16}. fastText variant only if LR's dev cost leaves room (Task 4 numbers decide). Temperature fitted on dev half A, ECE on half B.
- [ ] Ablation Tatoeba only vs Tatoeba + chat on dev cost; keep the better.
- [ ] Commit scripts with the chosen config in the commit message.

### Task 3: TS inference

**Files:** Create `src/content/lid/model.ts`, `src/content/lid/model.test.ts`.

**Interfaces:**
- Produces `lidPredict(text: string): { lang: string; p: number } | undefined` (top class after temperature softmax; `undefined` for empty input, weights unavailable or `und`), and `lidReady(): boolean`.

- [ ] Tests: parity with fixture to 1e-4; empty, whitespace and `"a"` return undefined; Georgian line and emoji-only line not confident above 0.5; 5000-char line under 2 ms; corrupted base64 makes `lidReady()` false and `lidPredict` undefined.
- [ ] Implement lazy decode on first call, Int8Array view, sparse dot product.
- [ ] Commit.

### Task 4: Cost and thresholds

**Files:** Create `tools/lid/answers.mjs`, `tools/lid/cost.py`, `src/content/lid/costParity.test.ts`.

**Interfaces:**
- `answers.mjs --data <dir> --set dev` runs the branch's real `confidentLanguage`, `detectLanguage` and `lidPredict` per line, writes `<data>/lid/answers-<set>.json`.
- `cost.py` combines them with the stored CLD answers (`detect/answers-chrome.json`, `answers-firefox.json`) using the `detectLanguageWithBrowser` rule, simulates readers fr es pt de en ru tr ar (defaults, plus one allowlist reader), and prints cost per line for paths none / chrome / firefox, bootstrap 95 percent by capture, wrong deletions per target, short band, ECE.
- `costParity.test.ts`: for 50 dev lines, the decision that `cost.py` encodes (skip same language, source allowlist drop, local source) equals what `pipeline.ts` decides. If `prepare` cannot be driven in isolation, assert against the extracted predicates `isSameLanguageAsTarget` and `shouldDropBySourceLang` instead and say so in the commit.

- [ ] Baseline on `47cb0ae` code (franc path) recorded in `<data>/lid/baseline-dev.txt`.
- [ ] Grid `tau_det`, `tau_sl` on dev; per language when >= 50 dev lines.
- [ ] Commit.

### Task 5: Integration

**Files:** Modify `src/content/langDetect.ts` (`detectUncached` franc block near :2769, `detectByLookup` caller in `confidentLanguage`), `test/audits/audit_poids.py` baseline, `README.md` (Tatoeba attribution). Test: `src/content/lid/integration.test.ts`.

- [ ] Tests: table line keeps the table answer; model above `tau_det` answers `detectLanguage`; below it falls to silence (or franc if franc is kept); weights unavailable gives the exact `47cb0ae` answers on 200 dev lines (snapshot generated from master); `confidentLanguage` unchanged unless Task 4 shows the `sl` extension lowers cost.
- [ ] Implement; franc removed only if Task 4 shows the model beats it in every band.
- [ ] `npm run test`, `npm run typecheck`, `npm run lint` by exit code. `langMatrix.test.ts` thresholds updated with numbers in the commit.
- [ ] Commit.

### Task 6: Heldout and B trigger

- [ ] `sha256sum heldout.jsonl` equals `heldout.sha256`; one run of `answers.mjs --set heldout` and `cost.py`; table saved to `<data>/lid/heldout-report.txt`; sha check again.
- [ ] Share of dev lines below `tau_det` and their cost. Under 3 percent or negligible: PLAN entry, no B.

### Task 7: Delivery

- [ ] Full gates (`npm run release:check`), `npm run build:firefox`, weight audit.
- [ ] p95 timing in a release build content script (offline harness).
- [ ] Smoke 15 min on kick.com, fresh anonymous profile.
- [ ] Push branch, PR to `master` with the before/after table, no merge.
