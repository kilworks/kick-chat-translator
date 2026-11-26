# Manual start of translation on a new channel: design

Status: written for review, nothing implemented. Date: 2026-11-27. Applies to Kick Chat Translator, then Twitch Chat Translator.

## Request

A user wrote that translation of a new page would be better started by hand than automatically: few streams need translation, and adding each stream that does to the whitelist is a chore.

## What exists

Translation starts by itself on every channel page when the extension is enabled. The only way to limit it is the channel whitelist (`whitelistChannels` in the settings, filled in the options page): when it holds at least one channel, only those channels are translated; when it is empty, every channel is. The floating bar has an on and off switch, but it flips the single global `enabled` setting, which persists across pages and tabs.

## Goal

A user who wants it can have every new channel start silent, start the one that needs translation with one action, and not maintain a list. Nothing changes for anyone who does not turn it on.

## Design

- One new setting, `startMode`, `'auto'` (default) or `'manual'`. Default `'auto'` keeps today's behaviour byte for byte.
- In `'manual'`, the pipeline of a tab treats a channel as not started until the user starts it. Started state is per channel and per tab session (kept in `sessionStorage` under the channel slug), so a reload of the same channel stays started and a new tab or a new channel starts silent. It is not written to the synced settings and not sent anywhere.
- The start action is the floating bar switch, which in manual mode starts or stops the open channel instead of flipping the global setting. The popup shows the same state for the active tab. Compose (the reply translator) follows the same started state.
- The whitelist is untouched and still wins: a channel outside a non-empty whitelist is never translated, started or not.
- A line shown before the user starts is not translated and is not marked as skipped; the bar says that translation waits for the user.

## Strings

Four new visible strings, each in the 42 catalogs under `public/_locales/<lang>/messages.json` and in `keys.json`, each checked by the existing catalog tests: the setting label, its two option names (automatic, manual) and its hint, plus the bar text for a channel that is waiting. No other copy changes. Translations of the new strings into the 41 other languages are produced and reviewed the way the existing catalogs are; the English README is the only README touched, if the readme check flags it.

## Tests

Unit tests for the started-state helper (new tab silent, reload stays started, other channel silent, auto mode ignores it); a pipeline test where a line in a not-started channel is neither translated nor marked skipped and the same line is translated after the start; a test that the whitelist still wins; the catalog tests for the new keys; one browser gate for the switch.

## Out of scope

Persisting the started state across browsers, a list of started channels, any change to the whitelist, and any change to the detection work.

## Risks

A user turns on manual mode and forgets that new channels start silent; the bar text and the popup state are the answer, and the default stays automatic. The Twitch extension has no channel-switch hook in its pipeline, so it keys the state on the `channel` of each message, as the stream prior does.

## As built (deviations from the design above)

- The setting is a single toggle in the display options, so one new string (in the 42 catalogs and `keys.json`) instead of four; the bar reuses its existing off state ("Translation off", "Resume on this channel"), so no bar string was added.
- The started channels live in `sessionStorage` (`src/shared/startedChannels.ts`) and enter through `vueDeChaine`, the view every module already reads, so the pipeline, the compose preview and the bar needed no change of their own.
- The popup asks the chat tab (`start.state`), shows its existing pause card with Resume while the channel waits, and Resume starts the channel in that tab (`start.set`). The bar says "Translation paused" while a channel waits, reusing an existing string.
- Twitch Chat Translator: see its own pull request.


## Real Brave check (service faked, throwaway profile)

Manual mode: a Spanish line in a fresh channel is not translated and the bar reads "Translation off"; after the switch in the bar it reads "Translating" and the next line is translated; after a reload of the same channel the next line is translated; in a new tab on the same channel the next line is not translated. Automatic mode (control): the first line is translated at once, a new tab translates too. 8 of 8 checks. Not done: a live channel, and the popup state.
