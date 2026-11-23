---
name: add-language
description: Add a language to the extension, or change how an existing one is routed. Walks the provider reality check, the detection bench, the thirteen code touchpoints and the release gates. Use when adding a locale, a regional or script variant, a macrolanguage member (Cantonese, Hakka, Nynorsk, Serbian Latin), or when a language is being silently folded into another one.
---

# Adding a language

Forty-two languages ship today. Adding the forty-third is not one line in `LANGUAGES`: it is thirteen decisions, most of which are invisible until a real chat line hits them.

Work in this order. Do not write code before step 2 is measured.

## 0. Classify the language first

The whole shape of the change follows from which of these it is.

| Kind | Example in repo | What it needs |
|---|---|---|
| New base language | `tl`, `bn` | Entry, franc mapping, provider codes |
| Regional variant of a supported base | `pt-br` | Entry, `REGION_VARIANTS`, per-provider code, and a decision in `filters.ts` on whether it is interchangeable with its base |
| Script variant | `zh-tw` vs `zh` | Same, plus a transliteration-guard entry, plus a flag decision |
| Macrolanguage member with its own grammar | Cantonese under Chinese | All of the above, plus a detection rule, because no general detector separates it, and an **asymmetric** readability relation |

The fourth kind is the expensive one. A member language is not a dialect of a code already in the list: the reader of the member can usually read the standard, the reverse is false, and `filters.ts` assumes the relation is symmetric.

Write which kind it is and why before continuing.

## 1. Provider reality check, before anything else

Four providers, four different answers, and a documentation page is not one of them. Run the probe:

```bash
node .claude/skills/add-language/probe-provider.mjs <code> "<a real sentence in that language>"
```

Read the output against these rules:

- **A 200 is not support.** MyMemory answers 200 for codes it does not have and silently falls back. Judge the returned text, not the status.
- **A short greeting proves nothing.** "hello" renders identically across many related languages. Probe with a sentence that carries the grammar and vocabulary that make the language distinct.
- **The free Google endpoint and Cloud Translation are different engines with different language lists.** The extension calls the free one (`translate.googleapis.com/translate_a/single`). Verify against that, not against `cloud.google.com/translate/docs/languages`.
- **Google soft-blocks.** A 429 is not "unsupported". `google.ts` rotates two clients; space the probes and try both before concluding.
- **Lingva is a Google proxy with its own shorter list.** `GET https://lingva.lunar.icu/api/v1/languages` is authoritative for it.

A provider without the language must return `unsupported` so the chain cascades to the next one. It must never throw a generic error, which counts as a failure against the provider and pushes it out of rotation. Add a test for that cascade.

## 2. Detection, measured or not shipped

`franc-min` is the general detector. It is the wrong tool more often than it looks:

- It works on Latin script and fails below roughly 20 characters, which is most of a chat line.
- It returns ISO 639-3, so a `FRANC_MAP` entry is required or the answer is dropped.
- It has no model for many variants. It answers `cmn` for Cantonese, `und` for short Chinese. Check what it actually returns before assuming a gap or a match.
- `confidentLanguage` deliberately withholds franc's answer from the engine. Only lookups (script check, chat-word lexicon, trivial tokens) are trusted enough to become a source hint.

So a variant usually needs a rule in `detectByScript`, alongside the existing Hebrew, Cyrillic and Arabic discriminators.

Two shapes of rule, and they cost differently:

- **Majority rule** (`> 0.5` of scored characters). Safe. Works when the script itself identifies the language.
- **Presence rule** (one marker character is enough). Necessary when the markers are rare inside otherwise-shared text. Produces false positives by construction, so it needs the bench below.

### The bench

Not optional, and the repo's existing rules all carry their numbers in a comment. Match that.

1. Collect real chat lines. `test/e2e/` has the corpus collector. **No channel or streamer name in the repo**, in code, tests or fixtures: pass them as arguments or environment variables.
2. Label at least three buckets: the new language, the language it is most confusable with, and a mixed bucket with English inside it.
3. Report two numbers separately: recall on the new bucket, and false positives on the confusable bucket. The second is the one that protects: a rule that steals lines from a language that works today is a regression, not a feature.
4. Hold a set out. The lines used to write the rule do not score it. Write both numbers and say which is which.
5. Compare end to end. Run the same lines through the provider with the new source code and with the old behaviour. If the new code does not translate better, say so and stop. The feature has no reason to exist.

## 3. The thirteen touchpoints

Every one of these is a decision. Confirm the line numbers with your own pass, they drift.

| File | What it decides |
|---|---|
| `src/shared/languages.ts` `LANGUAGES` | Code, English label, native label, flag key |
| `src/shared/languages.ts` `FRANC_MAP` | What franc's ISO 639-3 answer becomes, if anything |
| `src/shared/languages.ts` `REGION_VARIANTS` | Which locale tags fold into this code, and which ones must stop folding elsewhere |
| `src/shared/languages.ts` `normalizeLang` | Splits on the hyphen to reach a base code. A code with no base falls through it |
| `src/shared/flags.ts` | Flag. Read the comment on `zh-tw` first: one entry there is a deliberate choice, not a convention to copy blindly. A language that crosses borders may deserve a glyph instead of a flag. Raise it, do not decide alone |
| `src/shared/langTiers.ts` `CONTEXT_CRITICAL` | Pro-drop languages that need prior chat lines to get the grammatical person right. Verify on examples, do not infer from the family |
| `src/shared/transliterationGuard.ts` | Non-Latin targets that must be rejected when the engine returns romanised text. It falls back to the base code, so a code with no base needs its own entry |
| `src/content/langDetect.ts` | The detection rule, and where it sits relative to `if (pct(han)) return undefined` and the short-word lexicon |
| `src/content/filters.ts` | Which languages count as already-readable for the reader. Asymmetric relations do not fit the current grouping |
| `src/content/langMenu.ts` | Two codes drawing two flags for what a user reads as one language |
| `src/background/translator/google.ts` `GOOGLE_CODES` | Free endpoint code, only when it differs from ours |
| `src/background/translator/deepl.ts` | `DEEPL_SUPPORTED` and the target map. Absent means `unsupported`, not a crash |
| `src/background/translator/mymemory.ts` | RFC-3066 code. A bare two-letter code resolves to the dominant variant, which is often wrong |
| `public/_locales/` | Extension UI language. Chrome only accepts locale directories from its own list. Check `developer.chrome.com/docs/extensions/reference/api/i18n#locales` before creating a directory Chrome will ignore |

## 4. Tests

These already assert on the language set. Extend them, break none:

```
src/shared/languages.test.ts
src/shared/langTiers.test.ts
src/shared/flags.test.ts
src/shared/transliterationGuard.test.ts
src/content/filters.test.ts
src/content/langChip.i18n.test.ts
src/background/translator/mymemory.test.ts
```

Add at minimum: one test that the new code round-trips through `normalizeLang`, one that each provider either maps it or refuses it with `unsupported`, and one per bucket of the detection bench.

## 5. Gates

```bash
npm run release:check
```

Not `typecheck` plus `test`. It also runs `lint`, and lint is the step that has silently accumulated errors across past passes.

The content script has a weight budget (69.0 KB gzipped at the last reading). A character table is small, a model is not. Measure before and after and put both numbers in the commit body.

Commit convention, from `docs/HANDOFF.md`: `[item N] Imperative subject`, one item per commit, body giving cause, fix, and how it was witnessed. Read `HANDOFF.md` for the next item number and update it when done.

## Refuse to ship on

- A language claimed supported on a 200 status rather than on inspected output.
- A detection rule with no false-positive count on the confusable bucket.
- A number measured on the same lines that produced the rule.
- A streamer or channel name anywhere in the repo.
- A `_locales` directory Chrome does not accept.
- "Done" on anything not seen running.
