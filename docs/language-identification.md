# On-device language identification (research, paused)

Status on 2026-11-23: paused, nothing released. The work lives on the
[`feat/lid-inference`](https://github.com/kilworks/kick-chat-translator/tree/feat/lid-inference) branch. Version
3.6.2 in the stores does not contain it.

## Goal

When no rule recognises a chat line, the extension falls back to franc to guess its language. That guess feeds the
English skip, the source allowlist, the language flag and the on-device source. A wrong guess hides a message the
reader wanted, or translates it from the wrong language. The project trains a small language classifier that runs
in the content script, with no server, and replaces the franc fallback.

## How a model is judged

Every detection error is priced by what it costs the reader, then averaged per message (lower is better):

| Error | Cost |
| --- | --- |
| a message hidden although the reader wanted it | 10 |
| a message translated from the wrong source language | 5 |
| a wrong language flag | 1 |
| a message sent without a source language, or translated into the language it is already in | 0.5 |

The cost is averaged over several simulated readers (different target languages, one with a source allowlist) and
measured on three paths: Brave (no browser detector), Chrome and Firefox (each with its own detector, used as the
extension uses it). Two models are compared line by line, with a 95 % bootstrap interval over channels. A model wins
only if the whole interval is below zero.

The verdict comes from **test2**: 5,974 lines collected after the training cutoff (2026-11-22 21:00 UTC), labelled
by two independent annotators, kept where they agree. That leaves 5,248 language lines from 1,020 channels.
Thresholds are chosen on the even half of the dev set, never on test2. test2 was checked with a control: a model
known to be worse is detected as worse (difference interval [+0.017, +0.047]), which the dev set could not do. Chat
lines belong to other people, so the data stays outside the repository.

## Results on test2

| Configuration | Brave | Chrome | Firefox |
| --- | --- | --- | --- |
| 3.6.2, rules and franc (what users have today) | 0.626 | 0.494 | 0.472 |
| The branch as it stands: model `base-b15`, threshold 0.5, no source language sent | 0.459 | 0.472 | 0.472 |
| Retrained linear model `st3all-lin`, thresholds 0.9 / 0.9 | 0.261 | 0.259 | 0.276 |
| Same, with per-channel adaptation (not in the extension) | 0.188 | 0.187 | 0.197 |
| Neural network `st3all-lr003-d32-h128`, with per-channel adaptation | 0.197 | 0.193 | 0.203 |

As it stands, the branch lowers the cost by 27 % on Brave, 4 % on Chrome and not at all on Firefox, where the
browser's detector answers first. With `st3all-lin` and its thresholds, the cost is 42 to 58 % lower than 3.6.2 on
all three browsers, without channel adaptation. That model was measured once on test2, as the reference of the
neural network verdict below.

Per-channel adaptation means a doubtful line leans toward the languages already seen on the same channel. It is
measured in the bench only; the extension does not do it.

## The neural network did not win

Both models read the same hashed character 1 to 4-grams and words (65,536 buckets). The linear model is a
multinomial logistic regression. The network adds a 32-dimension embedding and a 128-unit hidden layer. Both were
trained on about 360,000 pseudo-labelled Kick and Twitch chat lines collected before the cutoff, on cloud VMs. The budget was three waves, fifteen trainings, all used.

The network was picked on the dev set before test2 was read, then measured once against `st3all-lin`:

- with adaptation, mean of the three paths: 0.1907 to 0.1975, interval [-0.0049, +0.0181], not decided;
- on Brave alone: 0.1878 to 0.1966, interval [-0.0028, +0.0205];
- line by line without adaptation, its cost is 0.022 higher, over the +0.01 limit set before the run.

It hides fewer messages by mistake but names the wrong language more often. Every network gave its best after one
or two passes over the data, then overfitted; wider or slower ones did no better. A TypeScript port of the network
matches the Python output to 1e-7 in 0.03 ms a line; it is kept out of the branch, since no network won.

## Before any release

An audit of the branch against 3.6.2 left seven items. The first three block a release.

1. **44 unit tests fail.** They pin 3.6.2's detection counts on real chat corpora, and most failures are
   improvements (one corpus goes from 67 wrong lines to 4). Re-pin the counts that improved, and decide whether an
   ASCII line nobody recognises should still count as English, as it did in 3.6.2.
2. **Two detection regressions.** Mongolian Cyrillic is named Russian again, which 3.6.2 had fixed; a reader who
   filters Russian loses those lines. Five short simplified Chinese lines are no longer named Chinese, and a single
   Han character gets `zh-tw`. Fix: do not call the model on Mongolian Cyrillic or on Han-only text, as 3.6.2 did,
   just before the `lidPredict` call in `src/content/langDetect.ts`.
3. **Machine-specific paths in `tools/lid`.** Several scripts default to a local data folder and a local tools
   folder. Make `--data` required and read the VM tooling folder from the environment only.
4. **The branch does not ship the best measured configuration.** Install `st3all-lin` with `tools/lid/install.py`
   and set the thresholds to 0.9 / 0.9, then check the model tests still pass, including the one that wants no
   confident answer on emoji or on a script the model never saw.
5. **Firefox carries the weights for no measured effect.** The cost on Firefox is identical with and without the
   model. Leave the model out of the Firefox build, or measure again after item 4.
6. **Research code in the product repository.** `tools/lid` holds about 45 files and 5,000 lines of collection and
   training tooling. Keep `install.py`, `featurize.mjs`, `cost.py` and `cost-cases.json`, which the extension's
   tests and model install use, and move the rest to a research repository.
7. **A heavier content script.** `content.js` weighs 2.27 MB, about 2 MB of it the weights in base64, loaded on
   every Kick page. Shipping the weights as a binary file loaded once saves a third. The page cost was not measured.

The next step is a decision: release after items 1 to 3 (Brave only), or after items 1 to 4 (all three browsers).
