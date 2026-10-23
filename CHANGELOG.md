# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The About tab links to Twitch Chat Translator, the same extension for Twitch.

## [3.3.0] - 2026-10-16

### Added

- **Bots: the real Kick ones, plus your own.** "Ignore chat bots" now means
  BotRix, Fossabot, KickBot, Sery_Bot and Kicklet (it listed StreamElements
  and Nightbot, Twitch bots that never post on Kick), and a field takes any
  other bot a channel uses.
- **The options pages say "Work in progress"** while they are being reworked.

- **Optional anonymous usage statistics, off unless you say yes.** Once a
  day: translations by engine, provider errors, skipped lines, compose
  previews and inserts, cloud latency, version, browser and languages.
  Never message text, names or channels. Chrome asks once in the popup and
  Options > About can change it; Firefox uses its own data-collection
  consent and sends nothing before Firefox 140. Sent to GA4 without any new
  permission. GA property set up and verified with the `ga-usage-stats`
  skill. Before the tag: check the Chrome dashboard's privacy declaration
  against `PRIVACY.md`.

### Fixed

- **Tab no longer fights Kick's and 7TV's emote and @mention completion.**
  While a Kick list is open Tab completes there; with 7TV, Tab completes the
  word first and inserts the translation only when there was nothing to
  complete.
- **Emotes survive a translated message.** They stay where they were typed
  (one typed between words moves after them) and are kept out of what the
  engine reads: sent as placeholders they had Chinese come back blank on 7
  lines out of 36.
- **Brand and person names are no longer deleted before translation**
  (iPhone, YouTube, PlayStation, LeBron, McDonald's, xQc): the emote-name
  filter took every mixed-case word. 7TV emote names typed as text are
  still removed.
- **"Hide messages containing" hides what is already on screen.** A keyword
  only applied to new messages, so adding "!fish" once the chat was full of
  it left every line there visible.
- **The Filters lists can be typed in again.** Each box was rewritten on
  every key: Enter vanished at once, so no second line could be typed, a
  space split "good game" in two, and the glossary lost its capitals.
- **The on-device engine is offered again.** With the target language on
  "Auto", the default, its download chip never showed.
- **@mentions come back in incoming translations**, so a reply in
  "replace" display still says who it answers.
- **The compose preview**: no longer covers Kick's lists or the emote
  picker, comes back once they close, no longer flashes an older message's
  translation or offers text that is already in the box, Escape no longer
  takes the caret out of the box, and a two-line message no longer gains an
  empty line.

### Changed

- **Filters: the "channels you have watched" list is gone.**
- **The script injected into each Kick page is 35% smaller** (364.6 KB to
  236.3 KB): the chat's 42 language tables stay in the background and the
  page receives only its own.

## [3.2.0] - 2026-10-12

### Added

- **The interface speaks the 43 languages the extension translates into**,
  not 10: popup, options (Providers, Display, Filters, Advanced, Activity,
  About) and the chat bar. European Portuguese, Traditional Chinese and
  Cantonese have their own text; Hebrew and Persian lay out right to left
  like Arabic. The browser's language is matched through its variants
  (pt-BR, zh-Hant-TW, nb, fil, iw).
- **The interface language menu shows each language's flag**, in a list
  that works with the keyboard (arrows, Home, End, Enter, Escape).

### Changed

- **The ten existing translations were rewritten** to read as written in
  that language, not word for word from English: one term per concept,
  each platform's conventions for buttons and capitalisation, and the
  chat chip named the same in the chat and in the help text that cites it.
- **Live counters in Advanced read "Label: number"** instead of "number +
  word", which no table can make agree in Polish, Czech, Russian or Arabic.
- **The DeepL free-plan hint was English in every language**; it goes
  through the catalogue now.

## [3.1.0] - 2026-10-10

### Added

- **The store listings speak 42 languages instead of 11.** Every Chrome Web
  Store locale of a language the extension translates into now has its own
  name, short description and detailed description, and AMO gets 17 more
  locales (European Portuguese no longer borrows the Brazilian text). The
  language list lives in `scripts/stores/languages.mjs`, read by every store
  script.
- **English chat abbreviations are spelled out before translating** for
  other readers (ngl, idc, lmk, wyd, goat). On 34 chat lines into the 42
  other languages, 952 of 1386 abbreviations came back as typed; spelled
  out first, none did.
- **The override table answers in more languages.** valeu, fala, yatta,
  coucou, forza and the common romaji are translated into the 26 Latin
  targets too, and common greetings into Hebrew, Persian, Greek, Ukrainian,
  Bulgarian, Bengali, Tamil, Traditional Chinese and Cantonese.

### Fixed

- **Lines in another language than the rest of a Google batch came back
  untranslated** and were dropped. A batch now goes as one multi-line
  request with each line detected alone: 84 of 84 foreign lines and 252 of
  252 English lines equal to their translation alone.
- **The English skip deleted short foreign lines** franc called English
  (10 of 1085 in the chat corpora). A letter English does not write now
  vetoes the skip.
- **The emote-name stripper deleted ordinary words** ending in lul, kek,
  jam and the like (Romanian felul, Turkish erkek, Portuguese sejam).
- **Common Arabic chat greetings were read as Persian**, and franc's `arb`
  was unmapped. Arabic goes from 19 right / 8 wrong to 31 / 2 on the new
  Arabic/Persian chat corpus, Persian unchanged.
- **Reply previews lost their @mention and link in Cantonese** when the
  engine padded the placeholder with spaces.
- **Traditional Chinese on the device engine came back simplified**: the
  engine is now asked for `zh-Hant`.
- **The device engine translated from franc's guess**, wrong on 166 of 264
  chat lines (Danish as Swedish, Catalan as Spanish). Those lines now go to
  the cloud, which detects per line; looked-up languages and English stay
  on device.
- **Firefox ran two content scripts in a tab after an update**, each
  taking every chat message. The newest copy now names itself and the
  other stops.
- **The DeepL quota and privacy claims in the store texts** were wrong: the
  500,000-character free plan can no longer be subscribed, and DeepL
  receives the last chat lines as context with their usernames.

### Changed

- **The service worker sleeps when no Kick tab is open**; the keepalive
  alarm kept it resident all day.
- **Less work per chat message**: language detection runs once per line
  instead of five times (122 to 51 microseconds), the replace-style
  `:has()` rule is scoped, no layout is forced per translated line, and the
  unused second copy of the content script is no longer shipped.
- Toolchain moved to Vite 8, TypeScript 6, ESLint 10 and zod 4. The store
  listings were rewritten.

## [3.0.2] - 2026-10-07

### Fixed

- **The bar's pause turned translation off everywhere.** It wrote the global
  switch, so pausing one stream stopped every channel in every tab until the
  popup was found. It now pauses the channel it was clicked on, and a channel
  stays paused when you come back to it: the new channel's rows could reach
  the observer before the URL poll saw the switch, and were translated with
  the view of the channel being left.
- **Switching channels without a reload stopped translation** until the page
  was refreshed. Kick keeps the previous chat as a hidden copy with its rows,
  and the observer bound to that copy. Lists and panels on screen now win, and
  the observer leaves a container that has been hidden. Measured live: 0 of 13
  new lines before, 12 of 14 after.
- **A Kick tab open during an install or an update stopped translating** while
  its bar still read "Translating". The service worker re-injects the content
  script into open kick.com tabs, the new script clears the bar and language
  menu its predecessor left, and its row marks are signed so an orphaned 3.0.1
  script cannot make it skip new messages.

- **The chat and bar strings had no accents in French, Spanish, Portuguese
  and Turkish** ("Traduction desactivee", "Ceviri kapali", "Voce escreve"),
  nor twenty popup and options strings. 145 strings restored, and a test
  fails on any form that only exists without its accent.

### Added

- Until a first translation, the popup opened outside Kick says to open a
  channel and offers a button that does, in place of a day's numbers that
  would all read zero.
- The bar's pause tooltip says it acts on this channel.
- The popup says when the channel in the current tab is paused and offers
  Resume. The row takes the place of the day's numbers while it shows, which
  keeps the default popup under Chrome's 600px ceiling.
- The `scripting` permission, for the re-injection above. Justified in the
  store text.

A design pass over the chat, the popup and the options page, run through the
UX kit's audit and its gates. The flags on translated lines, the audit's worst
finding, had already been fixed in 2.12.1.

### Fixed

- **The compose preview covered the language chip** that sets its language,
  18 of its 24px, with the bottom of the chip's outline showing under the
  panel. It now sits above the chip, and the store fixture fails on any
  overlap.
- **The floating bar's language list ran over the chat** when no ancestor of
  the bar clipped. The panel took the 24px button it hangs from for the chat
  column, capped itself at 80px, and let its list spill below its own
  background. An unknown column no longer caps anything, and the bar panel
  gate now opens it without a clipping ancestor.
- **Text size and line spacing sliders** were the browser's blue, the only
  blue in the product, and 16px tall. They take the accent green and a 24px
  target (WCAG 2.5.8).
- **Four chat notices were English in every language**: translation copied,
  every provider down, quota reached, provider switched.
- **The Activity tab was untranslated** in the nine other interface languages.

### Changed

- The on-device model chips show each language's flag, which the hint above
  them already promised, and an unavailable pair is muted with a title instead
  of a ✕ that read as "remove".
- Channel and user filters are an allowlist and blocklists, like the
  source-language allowlist on the same tab.
- One product name everywhere, Kick Chat Translator, window titles included.
- The popup's toggles read Enable, Keep original and Language badge, in the
  sentence case the rest of the popup uses.
- The compose preview's description no longer promises a DeepL-first chain it
  does not use.
- The note under the display styles says what it means: the recommended style
  is the most tested, and the other three may still change.
- No long dash left in interface text.
- The lead card of the Activity and About tabs drops its border, a control's
  3:1 stroke drawn on a card, which the art direction rules out.
- The Spanish sample line in the Display preview keeps its question mark at the
  end in a right-to-left interface.

## [3.0.0] - 2026-09-26

The first store release since 2.9.2 on the Chrome Web Store. It gathers
2.9.3 to 2.13.0, tagged on GitHub while the store stayed on 2.9.2, and
starts a numbering where a version exists only once it ships to the stores.

### Added

- **Hide chat lines that contain a blocked keyword.** A list in the filter
  settings, one keyword per line, matched in any case: bot commands such as
  !fish no longer flood the chat.
- **A copy installed by hand shows a pending update on its toolbar icon**, a
  green badge, as well as in the popup. Store copies update themselves and
  show neither.

### Fixed

- The store descriptions in French, Spanish, Brazilian Portuguese, Turkish and
  Czech had lost their accents.

## [2.12.3] - 2026-09-26

### Fixed

- **Firefox users were told to download a zip.** The popup's "Update available"
  button recognised a store install only by the Chrome Web Store's id, so every
  AMO copy fell through and pointed at a GitHub release their browser would not
  install. An AMO copy updates itself, like a Chrome Web Store one, and now says
  nothing either.

### Changed

- On a copy installed by hand, the button opens the Chrome Web Store listing
  instead of the GitHub releases page: installed from there, the extension
  updates itself and the notice never has to appear again.

## [2.12.2] - 2026-09-26

The Chrome Web Store listing in every language the listing is written in.

### Fixed

- **Brazilian Portuguese and Chinese readers got the English listing.** The
  package named those locales `pt` and `zh`, which the Chrome Web Store does
  not recognise, so it offered no listing in either and fell back to English:
  on the public page, French and Japanese were localised, pt-BR and zh-CN were
  not. They are `pt_BR` and `zh_CN` now, and a test holds every locale to the
  store's list.
- The French and Turkish store blurbs had lost their accents.

### Added

- **Czech listing.** The store offers a listing language only for a locale the
  package ships, and the Czech text had nowhere to go.

## [2.12.1] - 2026-09-26

The options page says what each setting is doing. 2.12.0 was tagged and never
published, and the store is still on 2.9.2, so this release carries 2.12.0 as
well.

### Changed

- **The options page shows what it is doing.** Eleven settings, and for nine of
  them the number that says what the setting does already existed in the code
  and was not shown. "Cache max entries" sat above a cache that could not report
  how many entries it held; the per-channel budget could not say whether it had
  ever held anything back; the language allowlist offered 43 checkboxes while
  the count of every language actually seen in chat lived two tabs away in ISO
  codes; and the list of channels watched was collected by four call sites and
  read by nothing at all, next to a text box whose example content was
  "some-channel". Each setting now carries its own measurement, and each
  language in the list carries how many lines of it came through the chat.
- **The language list on the options page draws flags** instead of two-letter
  codes, the same 43 the chat draws, and stays in alphabetical order: the
  alphabet is the order anyone searches in, and the filter field above the list
  is what makes finding fast.
- **The Debug tab is called Activity**, because what it shows is the total of
  messages translated, what the cache saved and the languages seen, none of
  which is debugging. Calling it Debug told the reader it was not for them. The
  card in Advanced that really is maintenance is called Maintenance.
- **The cache hit rate is readable.** It was seven bars 40 pixels tall whose
  value existed only in a `title`: invisible to the keyboard, to a screen
  reader and to a finger, and two neighbouring days at 90 and 95 % looked two
  pixels apart. Each bar now carries its number and its date.
- **The About tab describes this extension.** It still spoke of translating
  "non-English messages" and stopped there, with no mention of the 43
  languages, the on-device engine or the compose preview, and it did not carry
  its own version, which is the first thing anyone comes here for. It now
  carries the version, the language count, how many providers are ready and how
  many messages have been translated.
- **The DeepL quota sits next to the DeepL settings.** It was asked for by the
  popup and by the popup alone.
- Invented example data is gone from the channel and user boxes. The glossary
  keeps its example, because it shows a syntax rather than inventing a fact.

### Fixed

- `.kt-hint` carried a width and nothing else: no size, no colour. A note at the
  foot of a card therefore rendered as large as the content it was commenting
  on.
- **The flag on a translated line and on the compose preview was a grey box.**
  The flag classes sat on a badge that paints its own background, and the
  badge's background won: in the light theme since 2.12.0, in both themes once
  the flags moved to a sheet shared with the options page. The flag is now an
  element of its own inside the badge, and the badge's pill is only drawn
  behind the two letters of a language that has no flag.
- Changing the reading language from the options page or the chip repainted
  the direction arrow on the bar as a flag and left the old flag in place.

## [2.12.0] - 2026-09-25

The extension stops deciding three things on the reader's behalf, and says
which of its two bars does what.

### Added

- **Tab swaps what you typed for its translation.** The compose preview could
  only be accepted with Ctrl/Cmd+Enter, a two-handed chord in the middle of
  typing. Tab is taken only while the preview is on screen, so an empty box
  never loses it, and Shift+Tab is left alone in every case so walking
  backwards out of the message box always works. Escape hides the preview and
  hands Tab back. A setting gives Tab back entirely for anyone who navigates by
  keyboard.
- **Text size, line spacing and face for the translated line.** The size
  multiplies whatever Kick gives the chat line rather than replacing it, so a
  reader who has already enlarged Kick's own chat keeps that choice. System
  stacks only, no font file and no network request. The "high legibility"
  option is named after what it can deliver and not after a condition it
  cannot guarantee to serve.
- **Density of the translated block**, three steps. A chat that scrolls fast
  reads better tight, a slow one reads better airy, and neither setting is
  right for the other.
- **Accent colour**, four choices. A closed list and not a colour picker:
  every value is measured against the contrast bars the theme file states, and
  the generated stylesheet carries the ratio beside each one. Kick's own green
  holds 12.74:1 on a dark surface and 1.37:1 on white, which is why a free
  picker would mostly produce unreadable results.
- **Chat theme**, pinned dark or light instead of following the channel.
- **Two keyboard shortcuts**, Alt+T for chat translation and Alt+W for the
  compose preview. Two and not four: every shortcut taken is one taken away
  from the browser and from other extensions.
- **A reading language remembered per channel**, off by default. A known
  channel restores its language, an unknown one changes nothing. Bounded to
  fifty channels, because the object shares a storage key with every other
  setting and one that never empties breaks the saving of all of them.

### Changed

- **The two bars now say which is which.** The bar at the top of the chat
  translates what other viewers write, the chip at the bottom translates what
  you write, and nothing on screen separated them. A down arrow on one, an up
  arrow on the other, vertical so they do not lie in an Arabic interface where
  the bar mirrors.
- **The per-message language badge draws a flag** instead of two letters. The
  letters were a leftover: the language table carries text in a field named
  flag while the stylesheet has drawn 43 real flags all along, used only by the
  language picker. The composer chip, which had no flag at all, has one now.
  Languages without a flag keep their two letters, because a flag names a
  country and not a language.
- **The language panel shows the selected language.** It carried the state on a
  background measured at 1.21:1 against its own surface, where hover sits at
  1.87, so the two were indistinguishable while the focus ring at 12.74 was the
  brightest thing in a panel it only passes through. It now carries the tint, the
  word in the accent and a rail. Flags rest desaturated and come back to full
  under the pointer and on the current language, so colour is a signal rather
  than a wall of 43 saturated rectangles.
- **Language names stop being cut.** The pin icon sat invisible in every row's
  layout, spending 17 percent of each column to show nothing, and the grid kept
  three columns whatever the chat width. Columns now follow the measured width.
  "Chinese (Taiwan)" was rendering as "Chinese (...", undecidable beside
  "Chinese".

### Fixed

- Control borders inside the language panel sat at 1.80:1 on dark and 1.42:1 on
  light, against the 3:1 the theme file states for a control's own boundary. The
  panel's local aliases had inverted the global ones, so the filter field and
  the pinned tiles were drawing with the quiet separator token.
- The compose preview's badge and the language panel now follow the light theme
  through the shared tokens rather than through per-component blocks; five such
  blocks were dead and are gone, without a pixel moving.

## [2.11.0] - 2026-09-24

The store is still on 2.9.2, so this release carries 2.10.0 as well.

Everything below is one thing: the language the extension tells the engine a
message is written in. That answer decides whether a line is translated, what
it is translated from, and whether it is dropped as "already in your language"
without the reader ever seeing it. It was wrong more often than it looked.

The numbers come from a 5040-line bench, 42 languages, 120 sentences each, from
Tatoeba, plus six hand-written chat corpora because prose and chat are not the
same register. Three outcomes are counted and never added together: right, the
language the line is in; SILENT, which hands the line to the engine with no
source language and is the safe outcome; and wrong.

### Added

- **Cantonese, the 43rd language.** It is `yue` and not `zh-hk`: Cantonese and
  Mandarin are different languages sharing a script, and a Hong Kong viewer
  reading `zh-tw` gets a register they do not speak. No language library carries
  it, so it is read off a table of characters standard Chinese does not write,
  唔 嘅 喺 咗 哋 佢, plus words like 點解 and 鍾意. 114 of its 120 bench lines, and
  91 % on a separate hand-written chat bench that was written before the rule
  existed. The six it misses carry no Cantonese word at all.
- **Roughly 450 new detection rules**, each one measured on ten benches before
  it shipped and removed again if it gained nothing. Letters one language writes
  and no other, sequences inside words, word endings, function words, and gates:
  a letter that names a small set of languages, and a word behind it that picks
  one. They are written to generalise rather than to memorise the bench, which
  is why the numbers move on corpora the rules never saw.

### Changed

- **The source language sent to the engine is right 2.9 times more often and
  wrong 97 % less.** On the same 5040 lines: 1262 right and 90 wrong before,
  3731 right and THREE wrong now. Wrong there means asking the engine to
  translate from a language the text is not in, which is the expensive mistake.
- **No language scores zero any more, against twenty-six before.** Catalan went
  from 20 lines of 120 to 65, Slovak from 16 to 52, Hungarian to 79, Bulgarian
  to 94, German from 28 to 92, Dutch to 108, Danish from 30 to 56, Vietnamese
  from 81 to 119.
- **On chat it never saw, the detector now names 57 % of lines against 48 %**,
  and on Malay/Indonesian chat 65 % against 48 %. Those two are the product's
  real register, which is why they are measured separately.
- The raw detector, which is what decides whether a line is dropped as already
  in your language, is wrong on 498 lines instead of 1217.

### Fixed

- **Any Cyrillic line the detector could not name was called Russian.** It was a
  guess sitting on the path that is supposed to contain no guesses, and it cost
  72 of the 90 wrong answers on that path. Bulgarian and Ukrainian lines went to
  the engine as Russian; `bg -> ru` alone was 50 lines. Both pairs are gone from
  the confusion table.
- **Any Arabic-script line it could not name was called Arabic**, the same defect
  one script over. Persian lines written without a Persian letter went to the
  engine as Arabic. Arabic now has to name itself, and when nothing does, the
  line stays silent.
- **Traditional Chinese was read as simplified on 120 lines out of 120**, flag
  included. It is a character set and there was no rule for it.
- **Cantonese shipped without its flag.** The language panel drew an empty square
  where Hong Kong should be, since the Cantonese release. A static check now
  fails on any flag code handed out without a rule behind it.
- Persian, Jawi Malay, Hebrew, Bengali, Tamil, Greek and Ukrainian are read
  correctly where they were being handed to a neighbour.

### Interface

- **Every colour is decided in one file.** The three surfaces carried three
  palettes: the injected stylesheet had 76 colour literals and 41 hand-written
  light-theme blocks restating them one component at a time, and the popup and
  options page had a fourth set of their own. It showed as six different dark
  greens doing one job and two reds per theme. Two values that did not meet
  their contrast bar were folded into the neighbour that did rather than kept:
  a control border measured 2.74:1 against the 3:1 a boundary owes.
- **The language panel stays inside the chat column.** It was bounded by the
  window and by nothing else: 408 px wide inside a 340 px column, hanging 68 px
  past both edges, opaque, with no elevation, over a near-black chat. It read as
  the chat having disappeared rather than having been covered. It now measures
  the column it opens in, and carries the one drop shadow in the product because
  a layer that covers the chat has to say it is a layer.
- The light theme follows the attribute the extension stamps on the page, never
  the operating system: Kick owns its own theme, and a light desktop reading a
  dark chat was being handed light text on a dark ground.

### Weight

The injected script grows by 14.9 KB raw and 5.2 KB gzipped, which is 5 % of the
content bundle. The gate that watches it is updated in the same commit with the
split measured rather than guessed: 14 472 bytes are the detection rules and 510
are the Cantonese integration outside the detector.

## [2.10.0] - 2026-08-31

Two versions were tagged and never published, 2.9.3 and 2.9.4. Everything they
carried is folded in here, so this entry covers everything since 2.9.2.

Most of what follows is language detection. The reason it got a whole release is
that a wrong answer there is not a wrong flag, it is a message the reader never
sees: a line detected as the reader's own language is skipped as "already in
your language", in silence.

### Added

- **Written laughter has a dictionary, by language, with its sources.** 45 forms
  across nine writing systems: jajaja, jejeje and jsjsjs for Spanish, kkkk and
  rsrs and huehue for Brazilian Portuguese, mdr and ptdr for French, asg for
  Swedish, høhøhø for Danish, wkwk and wakaka for Indonesian, 555 for Thai, 2333
  for Chinese, ｗｗｗ for Japanese, ㅋㅋㅋ, хахаха, ههههه, חחחח, 哈哈, हाहा. Laughter is
  the most repeated thing in a chat and the hardest thing to detect, since a
  detector is unreliable under about twenty characters and "kkkkk" is five. Each
  form is skipped before a provider is called, and the ones that are unambiguous
  also say which language the line is in. haha, lol and xd mark nothing, because
  they are used everywhere.

- **Keyboard smash is no longer translated.** asdasdasd came back as Portuguese,
  zxcvbnm as Spanish, hjkhjkhjk as Dutch. The signal is the share of adjacent
  letter pairs living on the same keyboard row, measured against 15 smashes and
  33 real words picked as the worst case. The absence of vowels was tried first
  and rejected: it also catches krk, prst, smrt and vlk, which are ordinary Czech
  words. Held letters and stretched words are safe, so siiiiiii and NOOOOOO still
  go through.

- **Four writing systems typed on a Latin keyboard are recognised.** Arabizi,
  the Arabic chat alphabet with its digits for the letters that have no Latin
  shape. Russian, Greek and Japanese romanised. And Bulgarian in Latin letters,
  the shlyokavitsa a Bulgarian chat writes daily. All four were being read as
  some Latin language: romanised Russian came out Indonesian, Czech, Italian,
  Swedish or Polish depending on the sentence, and shlyokavitsa came out
  Romanian, Polish, Indonesian or Swedish. None of these is sent to the engine as
  a source language, since announcing Cyrillic on Latin letters would make it
  translate from a script that is not there.

- **Short expressions that came back spelled instead of translated.** Every
  engine answers a short Latin word aimed at a distant script by writing its
  sounds down: bonjour to Japanese returned ボンジュール, the syllables of the
  French word, where a translation says こんにちは. Measured on 90 pairs of a
  common chat expression and a non-Latin target through the shipped provider, 18
  came back as a phonetic spelling and 8 more as the wrong sense of a real word,
  coucou read as the cuckoo bird in four target languages of five. Roughly ninety
  common expressions now have an answer that ships with the extension, which also
  means they cost no network call at all.

- **Malay and Hebrew are identified.** Two of the 42 offered languages, and the
  listing sells Hebrew in its right-to-left claim. They were translated all along
  with the engine guessing; what is new is a correct source language and a
  correct badge.

### Fixed

- **A batch told the engine one message's source language for all of them.**
  Messages are grouped by target language and sent together. The joined request
  borrowed the first message's fields, so a batch carrying a Japanese line and an
  Arabic one went out declaring Japanese for both, and the engine translated the
  Arabic line from the wrong language. Disagreeing hints now declare nothing.

- **An emoji erased a line's writing system, and no chat is emoji-free.** The
  check that reads Arabic, Cyrillic, Hangul, kana, Thai, Hebrew, Devanagari and
  Han decided on a majority of every non-ASCII character, and an emoji is
  non-ASCII while belonging to no script. "да" plus two emoji fell to no
  majority and returned nothing; "رائع" plus four emoji fell the same way and the
  fallback answered Persian on Arabic text. Only script-bearing characters count
  now, and the four test languages hold through six emoji.

- **Persian was declared Arabic, and declared it with confidence.** Twelve
  Persian lines of twelve came out as Arabic, and came out through the path that
  hands the engine a source language, so the engine translated from the wrong
  language, the flag was wrong on every line, and an Arabic-reading viewer had
  every Persian line skipped as already in their language. The Arabic script is
  not a language: Persian adds six letters, Urdu adds seven more on top of
  Persian. Persian 11 of 12 now, Arabic 12 of 12 with no false positive.

- **Mongolian, Ukrainian and Bulgarian were declared Russian, with confidence.**
  Same defect on another writing system, reported by a viewer testing a Mongolian
  channel. Twenty Mongolian lines of twenty, eight Ukrainian of eight, twelve
  Bulgarian of twelve. Mongolian is separated by two vowels Russian does not
  have, Ukrainian takes its own code, and Bulgarian is separated by an absence,
  since Russian writes ы, э and ё and Bulgarian writes none of the three.
  Measured on lines written after the rules, and with no false positive on 44
  Russian, Ukrainian and Mongolian lines held aside.

- **A hostname was read as Japanese laughter.** www is laughter in Japanese, and
  the vote is taken on tokens, so www.kick.com produced the tokens www, kick and
  com and the first one voted alone. Three real hostnames of four went to the
  engine declared Japanese. Half-width www stays laughter and marks nothing;
  full-width ｗｗ takes the mark instead, since no hostname is written that way.

- **xdxd was translated while every other repeated laughter was skipped.** The
  pattern caught xd, xdd and xddd and missed the repeated syllable, where jaja,
  haha, rsrs, huehue, lolol, hehe and hihi were all handled.

- **Three controls were too small to hit.** The pause button was 26 by 18, the
  settings gear 25 by 19, and the retry arrow on every translated line 10 by 15,
  where WCAG 2.5.8 asks 24 by 24. Measured across ten window widths on the
  shipped build. All three are 24 tall now and the bar keeps its height.

- **Ordinary words were deleted before translation.** The pass that strips inline
  emote names was eating iPhone, McDonald and PlayStation out of a message.

- **The extension's own resources were reachable from a kick.com page.**

- **The bar sets its own box model instead of borrowing the page's.**

### Changed

- **The short-word table holds the words a sentence contains, not greetings.** It
  was hola, merci, danke, grazie, obrigado, which is what one writes thinking
  about chat and not what an arbitrary message carries. Half of the lines
  detection could not name were perfectly ordinary Portuguese and Turkish
  carrying none of them. Structure words separate the Spanish and Portuguese
  pairs that spelling distinguishes cleanly: nao against no, hoje against hoy,
  agora against ahora. On a 176-line bench in 19 languages: 152 right to 157,
  silences 11 to 8, silent losses 8 to 6, and not one extra provider call.

- **1754 bytes of prose stopped travelling to every viewer.** The laughter
  table's provenance notes were strings in the shipped script, 0.85 percent of
  everything a reader downloads, about half of what that table costs. They are
  test-only data now and the bundler drops them. The injected script is smaller
  than the 2.9.2 reference despite everything above.

## [2.9.2] - 2026-08-30

### Fixed

- **The bar's language panel showed six entries out of forty.** Measured on a
  live channel: 1200px of list inside a panel of 236x281, so five sixths of it
  was a scroll. Each row also spent 38px of its 218 on an ISO code column, 17
  percent of the width, repeating what the flag beside it and the name after it
  already said, and the favourite tiles printed that code again under the flag
  at 9px. The code is gone from both, which is what frees the width for three
  columns; the tiles give the room to the flag instead, 20x15 to 28x21, and keep
  the full language name as their accessible name and tooltip. Twenty-five rows
  are on screen now instead of six, and the list is 433px instead of 1200.

  It is the same shape and width as the chip's menu on purpose. Two lists of the
  same 42 languages had two different looks, which is a thing to fix and not a
  thing to keep.

- **Arrow keys in that panel follow the grid.** Down and Up crossed one entry
  where the layout now has three across. They move a whole grid row, Left and
  Right move one tile, and the column count is set in one place that both the
  grid and the keys read.

## [2.9.1] - 2026-08-30

### Fixed

- **The language list opens on a plain click.** It was reachable through a caret
  measuring 10x6 CSS pixels on a chip of 45x24, where WCAG 2.5.8 asks 24x24 of a
  target: 60 square pixels offered against 576 due. Miss it and the click did
  something else entirely, toggling between the channel's language and the first
  favourite. The other two ways in were a 400ms press-and-hold, which no pointer
  advertises, and the Down arrow. One click opens the list now, wherever on the
  chip it lands, and the hold is gone with it. The caret stays as the sign that
  a list exists rather than as a target of its own.

  No harness had caught this. With no favourite stored the old code opened the
  list on any click, and a throwaway profile has no favourite, so every
  automated pass measured the easy path and never the one a user reaches after
  their first language pick.

### Changed

- **Russian shows Russia's flag.** It showed Ukraine's. A flag in this list says
  which language a row is and nothing else, which is how the other 41 rows are
  already read.

## [2.9.0] - 2026-08-29

### Changed

- **The language list shows flags instead of two-letter codes, in a grid.** It
  listed 43 languages one per line as codes: 202x894px on a 950px window,
  measured on a live channel, so it ran the full height of the screen and every
  entry had to be read letter by letter. Three columns of drawn flags bring the
  same 43 entries and their names into 408x518, 42 percent less height, with
  every row at exactly 30px. The flags are drawn in CSS rather than shipped as
  images or emoji: flag emoji do not render on Windows, where the system falls
  back to the very letters being replaced. Arrow keys follow the grid, Down and
  Up moving a whole row.

### Fixed

- **Kick's own interface no longer paints over the language menu.** The menu
  declared a z-index of 2147483000 and was still covered at 5 of 9 sampled
  points once the page was scrolled, by a element at z-index 101 and by two at
  auto. A z-index only ranks an element inside its own stacking context, and
  inside Kick's chat action bar no value wins against a sibling context ranked
  elsewhere on the page. The menu is mounted on the document body now, the way
  the compose preview already was, and measures 0 of 9 covered at 1500x950,
  1280x720 and 1100x800.

- **Every drawn flag was dimmed, padded and, in the light theme, painted over.**
  Two different rules were called `.kt-flag`: the source-language badge on a
  chat line, which is text, and the drawn 16x12 flag. The badge lent every flag
  its 0.65 opacity and its 4px side padding, and its light-theme rule outranked
  each flag's own gradient on specificity, 0,2,1 against 0,1,0, repainting all
  of them a flat grey. The badge is `.kt-src-flag` now.

## [2.8.1] - 2026-08-28

### Changed

- **Translations arrive about twice as fast on an ordinary chat.** Lines were
  held for a batching window before being sent, and the window only earns its
  latency if another line turns up during it. Expected arrivals are rate times
  window, so 180ms needs roughly five and a half lines a second; the threshold
  opened at three lines per ten seconds. Measured on a live channel over ninety
  seconds: 217ms from message to translation at the median, of which 186ms was
  that wait, while the translation call itself answered in 43ms. Twenty-four of
  twenty-seven dispatches carried a single message. It is 111ms now, and no
  extra request is sent, because the dispatches that changed were carrying one
  message anyway. Nothing changes on a fast chat, which was the only case the
  old threshold ever served.

- The rate the window reads was also counting the wrong thing. It incremented
  only when a window opened, so it counted windows rather than messages and
  could never read much above five a second, which put the fast-chat threshold
  out of reach entirely.

### Fixed

- **A failed batch no longer translates forty messages one at a time.** When the
  provider hands back a different number of lines than it was given, each
  message is retried on its own. That retry ran strictly in sequence, forty
  round trips end to end, while the concurrency setting sat unused. It runs
  under that setting now, and results stay aligned to their own chat lines.


### Added

- A fourth display style. "Replace" had been a fourth value in the settings
  schema that no control could select, and the style it named rendered the same
  9 messages at the same row height as "Inline" while leaving the original
  standing beside it. It replaces the message now: 12 messages where inline
  shows 9, and it no longer follows the "keep original" switch, because
  replacing and keeping are the same request twice.

- A caret on the language button. The list opened on press-and-hold or the Down
  arrow, which nothing on screen suggested. A click on the code still toggles
  the language; a click on the caret opens the list.

- A filter above the source-language allowlist in Options → Filters. It listed
  all 42 languages inside a 260px scroll box, which is the same "walk the list"
  problem the chip's menu had and takes the same answer: type two letters.
  Matching covers the ISO code as well as the name, since the names render in
  the interface language.

- **A language button inside Kick's message box.** Switching the language you
  write in used to mean travelling to the bar at the top of the chat and back;
  the chip sits next to the emote button instead, so the pointer never leaves
  the text field. One click toggles between the channel's language and your
  last pick, press-and-hold (or the Down arrow) opens the list.
- Favourites, seeded by use rather than configured. The list starts empty, the
  first language picked becomes the first favourite, and it stops reordering
  once you have one, and a list that shuffles between two clicks makes you miss
  the click.
- **Every** language menu now renders in the interface language, and sorts for
  it: the popup, both menus on the Options page, the source-language allowlist,
  and the bar at the top of the chat. Only the new chip had been fixed at
  first, which left the very menu the bug was reported against untouched. The
  list also keys on the extension's own UI setting rather than the browser's
  language, so choosing Japanese in the extension is enough.
- The language list now renders in the interface language. It used to be
  English whatever the extension was set to, so a Japanese user configuring a
  fully translated extension still met a list they could not read.
  `Intl.DisplayNames` supplies the names, which is 0 strings to maintain
  instead of 42 languages x 11 locales.
- Sorting now uses the interface locale's collation. A plain sort puts
  Čeština after Zulu; measured, ja/tr/cs all disagree with it.
- A filter box at the top of the list. 42 languages fit in no list at screen
  height, so the list was never meant to be walked: type two letters and press
  Enter. Matching folds accents and also covers the ISO code, because someone
  reading a Japanese interface sees フランス語 but types "fr".
- `Show the language button in the message box` in Options → Display.

### Changed

- The chat, the bar and the language menus follow the interface language you
  chose, not the browser's. 39 strings that were English whatever the extension
  was set to now come from the catalogue, and the shipped locale files went
  from 3 languages to 10.

- Controls in the popup carry a visible boundary and a focus ring. The select,
  the text field and the outline buttons drew their edge at 1.18:1, which WCAG
  holds to 3:1, and `outline: none` had removed the only focus indicator the
  browser gave them.

- Explanatory text on the Options page wraps at a readable width. It ran 105 to
  114 characters a line, in 11px type, because the page is wide for the sake of
  the controls rather than the sentences.

- The bar at the top of the chat says **Translating** instead of
  "Translating → EN". Measured on a live channel: that label took 133px of a
  420px bar (a third of it), and the "→ EN" half repeated the language menu
  sitting immediately beside it. The resolved language moved to the tooltip.
- The provider name is no longer printed in the bar. It held 39px permanently
  to name a service the reader has no decision to make about while it works;
  which engine answered matters when one stops answering, and the Options page
  reports that. It is in the state pill's tooltip now.

- The popup fits without scrolling again. Measured with realistic settings it
  stood at 669px against a 600px target; it is now 594px. The 7-day cache graph
  (36px) and the per-language pills (23px) moved to Options → Debug, and the
  help line under "translate what I type" went altogether, since it explained a
  behaviour nobody configures, and the Options page already carries it.
  Nothing was resized to get there: two blocks left and one moved.
  Verified by rendering the built popup in all ten interface languages. Spanish
  was the one that still overflowed, at 606px, because "mantener original" and
  "insignia de idioma" each wrapped to a second line; both are shortened, and
  the nine others were already fine, and measuring only English would have shipped
  the bug.

- With "keep original text visible" off, the translation now behaves as the
  message rather than as an annotation of it: inline, full size, full contrast,
  no tint and no rule. Measured on a 24-message chat in a fixed window, this
  went from 8 messages on screen to 14, with a row dropping from 40.0px to 18.2px.
  The previous styling kept the translation on its own line even with nothing
  above it, so hiding the original made rows *taller* (41.7px against 39.98px)
  while claiming to save room.

### Fixed

- **The injected interface followed the desktop's light/dark setting instead of
  Kick's.** A light desktop reading Kick's dark chat was handed the light
  palette on a dark ground: the translation measured 1.01:1 against what it sat
  on, which is invisible. It reads the chat's own background now, and follows
  Kick's theme switch without a reload. Measured after the fix: 10.98:1.

- **The language list could open off the top of the screen.** It only clamped
  itself when an ancestor clipped it, and otherwise let CSS place it, which
  knows nothing about the window: at 420x520 its top landed 132px above the
  edge, with a third of the list unreachable. Rows also came out uneven, because
  the two codes carrying a region, `pt-br` and `zh-tw`, wrapped onto a second
  line. All 43 rows are one height now.

- **Picking a language dropped keyboard focus on the page body.** Escape had
  always returned it to the button; choosing with Enter did not, so a keyboard
  user who had just set their language had to tab in from the top of the page.

- **A failed translation took a row of its own**, and it never fails alone:
  when a provider is down every line in the chat grew one, and the chat went
  from 13 messages on screen to 8. The message sits on its line now.

- **The retry control answered only to a mouse.** It was not in the tab order,
  never reached in six tab presses, and on a touch device it stayed invisible
  forever because it was revealed by hover. It takes Enter and Space now, shows
  itself on focus, and is visible at rest wherever hovering is impossible.

- **One unbreakable token pushed the whole chat sideways.** A spam run, a long
  URL or a wall of CJK took the translation to 530px inside a 356px column and
  scrolled the page by up to 186px. Only the "Below" style had ever carried a
  break rule.

- **The chat did not mirror for right-to-left reading.** The green rule sat at
  the end of the line instead of the start, and the language badge ran into the
  message. So did the popup and the Options page, where the switch, its knob,
  the debug table and the language grid were all positioned physically. Arabic
  is a shipped interface language.

- **The "On hover" style put a label under every message**, whether or not you
  ever hovered it: rows went from 31.4px to 50.6px and the chat lost a third of
  what it could show. The marker costs nothing now, measured against an
  untouched row.

- **Hiding the original ate the emotes.** Nine of twelve cases lost their emote
  boxes along with the text they sat in.

- The Options page scrolled sideways in a narrow window. The tab bar wanted
  491px against 366px available, so two tabs were only reachable by scrolling
  the page itself.

- The tab bar had no ARIA at all: six buttons, none announced as a tab, none
  saying which section was showing, five tab presses to cross it and arrow keys
  that did nothing. It is one tab stop now, with the arrows, Home and End.

- Five controls had no accessible name and two switches shared one. Four
  textareas on the Filters tab had a visible label sitting right above them
  with nothing connecting the two, and both popup switches were called
  "enable".

- Nine strings rendered in English in all nine translated interfaces, including
  the tab bar's own accessible name.

- Animation kept running for people who asked their system to stop it. The
  policy named the language button and nothing else, leaving the toast, the
  compose panel's loading pulse, the retry reveal and the floating bar moving.

- The language menu's edge measured 1.87:1 against its own fill, and its fill
  measures 1.13:1 against Kick's chat, so nothing separated the two.

- The compose panel drew a shadow Kick never uses, and its border measured
  1.46:1. Icon-only buttons and the About links fell under the 24px minimum
  target size.

- Four pieces of chat text were below AA and had never been measured. Worst
  first: the **error message** sat at 3.19:1, unreadable at the one moment it
  exists for, and the **hover-mode placeholder**, the only thing on screen
  saying a translation is available, sat at 2.17:1, the least readable text in
  the extension. The provider badge and the loading marker were both 3.78:1.
  Now 5.53, 5.52, 6.26 and 6.26.

- **The chip landed under the message box instead of inside it.** Found by
  loading the extension on a live channel rather than in a harness. The row
  holding the shield, the field and the emote button measures 380x77 while the
  field is 293x46, so judging the row by "not much taller than the field"
  rejected it by 7px and the chip fell through to the field's own wrapper, 49px
  too low. A row is now recognised by its children sitting side by side, which
  does not depend on Kick's spacing. The chip also inserts beside the emote
  button rather than after it.
- **The language list ran off the chat column and over the video player**, and
  off the top of short windows. Its placement clamped only the right edge and
  assumed 320px of height the window may not have. Every edge is clamped now,
  and the height is what actually fits on the side it opens towards.

- **The whole Options page and popup failed AA on secondary text.** The `muted`
  token was `#6b7888`, which measures 4.30:1 on the page ground, 3.96 on a card
  and 3.18 on an active green card, which is most of the explanatory text in the
  extension. It is now Kick's own `#9FA6AD`: 7.87 / 7.24 / 7.52 / 5.82 on those
  same grounds. One token, 180 failures across the six tabs.
- Every select and numeric field on the Options page and in the popup now has an
  accessible name. They had a visible `<label>` beside them but nothing tying
  the two together, so a screen reader announced "combo box" with no clue which
  setting it belonged to. axe rated this critical on four of the six tabs.
- The language codes of unavailable on-device models were drawn at 50% opacity
  (2.76:1). WCAG allows that for a disabled control, but the label *is* the
  information: it names which pair has no model. Now 75%, which keeps AA.

- The "Replace" display style rendered its text at 0.8em, about 10.4px.
  Measured against the other styles it bought nothing for that: the same 7
  messages on screen as Inline, the same opacity, just smaller. It now shares
  Inline's 0.85em.
- The language select in the bar at the top of the chat now uses the same
  surface, stroke and text as the chip in the message box, one control in two
  places rather than two unrelated widgets. Its border was
  `rgba(255,255,255,.15)`, which flattens to 1.62:1 against the bar when WCAG
  1.4.11 asks 3:1 of a control's boundary. `#5F5F60` measures 3.04 there and
  3.08 on the chat ground, so a single value now covers both surfaces.
- Same fault in the light theme, where the bar's controls were outlined in
  `rgba(0,0,0,.15)`, 1.42:1. `#8D8D8E` gives 3.11 on the bar, 3.02 on the chip
  surface and 3.32 on white.

- The waiting state used to fade its label in and out, which dropped the text
  to 2.22:1 against its own background. The pulse moved to the border, which
  is held to 3:1 rather than 4.5:1, so the label keeps its full contrast.
- Selected-row text in the light theme measured 4.20:1 against the green
  highlight, below AA. Found by rendering the component rather than by
  reading the stylesheet.
- The popup wrapped its filter field in a `listbox`, which may only contain
  options, a critical ARIA violation. It is now a combobox owning a separate
  listbox.

## [2.7.0] - 2026-08-16

### Fixed
- **Changing the reading language now changes what is already on screen.** Picking a new language
  from the bar only affected messages that arrived afterwards; everything already visible kept the
  previous language until you reloaded the page. The mark that stops a line being handled twice was
  built from the row, the name and the text, and never from the language, so an already-translated
  line still matched its own mark and was skipped. The same held for the display style and the two
  badges. All four now redraw the lines on screen, and only a language change costs a request; a
  style or badge change is redrawn from memory.
- **A message the translation services gave up on is no longer sent back to them over and over.**
  The extension re-checks the visible chat when you come back to the tab and when you stop
  scrolling, to catch anything it missed. That check only recognised lines that had been
  translated, so a line carrying a failure marker looked untouched and was sent again on every
  scroll pause, for the whole minute or five that a service stays in cooldown. On a full chat panel
  that is around thirty needless calls each time you stop scrolling, which is exactly the quota you
  have least of when a service is already struggling. Such a line now keeps its marker and its
  retry button, and goes back out only when you click it.
- **A stretched message is no longer left untranslated.** Chat writes "muuuuy biennnn" and
  "BINNNNNNNGOOOOOOO", and the translation services hand those straight back unchanged. When that
  happens the line is now tried once more on its flattened text, which returns "très bien" and
  "BINGO". Only after a refusal, never before: the services already handle some stretching well,
  and flattening everything up front made those cases worse. Japanese words that legitimately carry
  a long vowel, like コーヒー or ラーメン, are left exactly as written.
- **The compose preview no longer tells the service what language you wrote in unless it is sure.**
  It was passing a guess, and on short text that guess is wrong about two thirds of the time, which
  makes the service translate from a language your message is not in: the preview then shows either
  your own text back or something you did not say. It now says nothing when it does not know, and
  the service works it out itself, which it does well.
- **The extension no longer stays silent on a page when the browser was slow to wake it.** Its
  background worker is shut down when idle, and the first request after that wakes it. If that
  request lost the race, the page ended up with no translation at all and nothing said so. It now
  waits and asks again before giving up.

### Changed
- **Your DeepL key stays on the machine you typed it on.** It was stored with the rest of the
  settings, which sync across every Chrome signed into the same account, so a key entered on one
  computer arrived on all the others, work and shared profiles included. It now lives in local
  storage. An existing key is moved across automatically the first time this version runs, and
  nothing is asked of you.
- **The extension is 15% lighter on every Kick page.** The content script carried a settings
  validation library, 13.7 KB compressed, to re-check data the extension had written itself. It now
  asks the background worker, which already held it. 81.3 KB down to 69.0 KB compressed.
- **The store listing is served in the reader's own language.** The name and the short description
  are what store search matches on, and they were English only. They are now published in Turkish
  and Arabic as well, which together account for a fifth of everyone who reaches the listing.

## [2.6.0] - 2026-08-14

### Added
- **The chat bar can now be used, not just read.** It carries a reading language picker and a
  pause button, the two settings people touch most and the only ones that used to force a whole
  options page open. Pause and resume were already there, as a click anywhere on the bar, which
  nothing announced; that still works and now has a button that says so.
- **A Debug tab in the options page, showing the last 50 calls the extension made.** Press "Read
  decisions" and it asks an open Kick tab what it recently translated and what it left alone, with
  the reason for each. The list lives in that tab's memory only, is never written to storage, and
  disappears when the page does. If no Kick tab is open, or the open one has not loaded the
  extension yet, it says so instead of failing. Until now the debug setting only wrote to the
  browser console, where nobody was going to look.
- **A line that was not translated now says why.** Hover it and its tooltip gives the reason, for
  example "Not translated: it is already in your language", "it is only emoji, symbols or laughter",
  "it is shorter than your 2 character minimum" or "this user is on your blocked list". Every reason
  the extension can skip a message for is covered, including the ones that used to give up without a
  word once a translation had already come back. Nothing about which messages get translated
  changes, only whether you can find out why. The reason is dropped as soon as a row is reused for
  another message, so it never explains the wrong line.
- **Export / import your settings** from the Advanced tab. Export writes a JSON backup, import
  restores it and reloads the page. A backup from an older build still imports: missing fields
  fall back to their defaults and unknown ones are dropped, so the file never breaks storage.
- **Minimum message length is now a setting** (Filters tab). The floor below which a message is
  left untranslated used to be fixed at 2 characters; raise it to spend less provider quota on a
  busy chat. Existing installs keep the old value, so nothing changes until you move it.
- **Common chat words are now recognised directly.** Below about 20 characters the statistical
  language detector often gives up or answers confidently wrong ("ok merci" came back as
  Hungarian, and that wrong code was passed to the translation service as the source language).
  A short list of everyday words in Spanish, French, Portuguese, German, Italian and Turkish is
  now checked first, and words that disagree with each other leave the message unlabelled rather
  than guessing. This covers the words on that list; it is not a general accuracy improvement.
- **Cache hit rate trend in the popup.** Usage stats now retain the last 7 days instead of being
  wiped at midnight, and the popup draws them as a small bar chart under the counters. Days with
  no traffic are skipped rather than drawn as 0%. The trend appears once two days have been
  recorded, so it stays empty on a fresh install until history builds up.

### Removed
- **The WebSocket path to Kick's chat relay is gone, and with it the Connection mode setting.** It
  opened a socket to a host the extension never declared, using an application key hard-coded years
  ago that the relay has been rejecting with "App key not in this cluster" for as long as it was
  measured. It only ever warmed the cache; every translation you saw came from reading the page.
  Nothing you can see changes, the setting that chose between the two paths is removed because only
  one path was ever real, and the extension no longer contacts a host it did not declare.

### Changed
- **A busy channel that hits its own rate cap now says so once, not once per message.** The cap is
  a fact about the channel, so painting a red marker on every message over it repeated the same
  sentence dozens of times a minute and buried the failures that were really about a line. The
  floating bar shows the throttle instead and those lines stay bare. Every other failure reason
  keeps its own marker with its retry button.
- **Very long non-Latin messages no longer stall on Lingva.** Lingva receives the message inside
  the URL, where non-Latin text expands to roughly nine times its size, so a long Japanese or
  Chinese line could produce a request too large for some servers to accept. Those messages now go
  straight to the next translation service instead. Lingva keeps its place in the chain for
  everything else.
- **The cache now warms the languages you actually use.** On startup the worker pulled the first
  200 stored translations into memory, but stored keys are ordered by target language, so it
  loaded whichever language happened to sort first and often skipped yours entirely. It now warms
  the language you read first, then the ones seen most in chat, so repeated lines are answered
  from memory right away instead of going back to storage.
- The ASCII check in language detection now uses `\p{ASCII}` instead of a literal control-character
  range. Same behaviour, but the source file no longer contains a NUL byte, so Git treats it as text
  and changes to it show up as readable diffs.

### Added
- **The glossary is editable at last.** It has always been in the settings and the translator has
  always applied it, but the only way to put anything in it was to hand-edit an exported file. It
  now has its own box on the Filters tab, with the expected format shown in the empty box.
- **The empty channel and user lists now show what goes in them.** They were blank boxes with no
  hint of one-entry-per-line, and two of them used real streamer names as examples. The examples
  are now neutral placeholders.
- **The Connection and Cache groups in Advanced now say what they are for.** Two of the four groups
  on that tab opened straight onto number fields with no explanation of what they affect. Each now
  carries a one-line description under its heading, like the other two already did. No setting was
  added, removed or renamed.
- **The Display tab now shows what each style looks like.** Picking between Below, Inline, Replace
  and Hover used to be a guess from four short descriptions. A sample chat line now sits under the
  four cards and re-renders in whichever style is selected, using the same code and the same
  stylesheet that draw a real translation, so it cannot drift from what you will actually see. It
  also follows the source-language badge, the provider badge and the keep-original toggles.

### Added
- **The interface is available in Korean.** Korean chat is the one this extension reads most
  reliably, every line of the saved sample identified from its writing system alone, and it was the
  last language with that kind of presence and no settings to read in it. All 140 strings are
  covered, none left in English.
- **The interface is available in Turkish.** Turkey is one of this extension's largest audiences,
  and Turkish was one of the two languages worst hit by the bug that refused every language written
  in the Latin alphabet. Reading the settings in Turkish should not have come last. All 140 strings
  are covered.
- **The interface is available in Spanish.** It was already one of the languages the extension
  translates into and one of the languages its README is written in, but not one you could read the
  settings in. All 140 strings are covered, so nothing falls back to English.

### Fixed
- **The language menus are readable again, in the chat bar and in the settings page.** Opening one
  gave a white panel where only the row under the pointer could be read. The browser paints that
  list from the control's own colours rather than from the page, so a control left transparent left
  the list white while the option text stayed near white. The colours are now named on the options
  themselves, and the picker in the chat bar is opaque. The language picker in the settings header
  was missed the first time round because it carries its own classes and never had the shared one.
- **The chat bar can no longer end up showing stale state.** Kick leaves a second copy of the chat
  panel in the page carrying the same id, and it comes first. Mounting the bar was already taught to
  ignore that copy, but everything that updated the bar afterwards, the label, the counter, the
  throttle indicator and the on device chip, still searched the whole page and would have found the
  dead copy first. They all go through the same lookup as the mount now. Removing the bar stays
  page wide on purpose, so it can never strand a copy behind.
- **The Debug tab no longer gives two different answers for what looks like one case.** Three
  separate checks can end a message with "already readable", and two of them were phrased
  identically, so the list showed two verdicts and no way to tell them apart. Each now says who
  decided and when: one names the setting that skipped it, one says it was already in your language,
  and the third says the translation service reported that only after being asked. Messages in the
  list are also cut at the column edge with an ellipsis instead of through the middle of a word, and
  the whole message is on the hover.
- **The settings button is back inside the chat bar.** Adding the language menu and the pause button
  pushed it out of the frame on a normal Kick chat panel, and it is the only way to reach the
  options page from Kick, so it left no way back in. The bar now gives up room in a fixed order:
  the status text shortens with an ellipsis first, then the language menu narrows. The settings
  button and the pause button never shrink.
- **Dropdown menus are readable again.** Opening the language menu on the chat bar showed a white
  panel where only the line under the pointer could be read, and the menus in the options page and
  the popup showed pale grey text on white. The list a menu opens is drawn by the browser, and with
  no colour scheme declared it drew itself light while our text stayed light. Each menu now declares
  one. On the chat bar it follows the light or dark theme rather than being fixed, so it stays
  readable either way.
- **The bar at the top of chat kept disappearing, and the extension never noticed.** Kick can leave
  a second copy of the chat panel in the page, carrying the same id, hidden inside a placeholder its
  renderer never removed. That copy comes first, so the bar was mounted into it and was invisible
  from the start, while the panel you were actually reading had no bar. Measured live on one
  channel: two panels present, the visible one holding 30 messages and no bar, the hidden one
  holding no messages and the bar. Worse, the check for "is the bar already there" asked the whole
  page rather than the panel on screen, found the buried one and concluded all was well, so it was
  never put back. The bar is now mounted into the panel that actually holds the chat, any copy
  stranded elsewhere is cleared, and the check asks the visible panel.
- **Nothing written in the Latin alphabet was translated when your language was English.** The
  service worker refused to send a message to any engine when the target was English and the text
  was more than 85% basic Latin characters, on the assumption that it was already English. An ASCII
  ratio cannot tell English from Spanish, Turkish, Finnish, French or Portuguese, so it turned away
  every one of them, while Japanese, Korean, Russian and Arabic went through untouched because of
  their writing system. That is why a mixed chat looked like only the Japanese was being translated.
  Measured on saved chat with an English target, the check dropped 66 of the 76 Spanish lines and 40
  of the 51 Turkish lines that reached the worker, against 0 of 43 Korean. It is gone. Deciding what
  is already in your language is left to the detector that honours your ignoreEnglish setting, which
  runs before the worker is called at all.
- **Spanish and Turkish messages often came back wrong, or not at all, while Japanese was fine.**
  The extension told the translation engine which language a message was in, including when that
  language had only been guessed at by the statistical detector. Measured on saved chat with an
  English target, the guess was wrong for 21 of the 76 Spanish lines and 11 of the 51 Turkish lines
  that reached the engine, against 0 of 43 Korean ones, which is why languages written in their own
  script looked fine. Forcing a wrong source language made Google hand back the original text for 4
  of the 11 Turkish lines checked, and those lines were then dropped without a word; most of the
  rest came back saying something other than what was written. The source language is now sent only
  when it was read off the text, by chat-word lookup or writing system, and left out otherwise so
  the engine detects it itself. Wrong source languages went from 21 to 0 on the Spanish sample and
  11 to 0 on the Turkish one. English is still left untranslated when you asked for that.
- **Korean written with bare letters was not recognised as Korean.** Chat writes laughter and short
  replies as standalone jamo (ㅋㅋ, ㅠㅠ, ㅇㅇ), which sit in a different part of Unicode from
  syllables. Only syllables were counted, so those letters padded the total without counting as
  Korean and a short line like "시발 ㅋㅋ" fell below the majority needed to call it Korean. They
  now count. On the saved Korean sample this restores 43 lines out of 43 to a language read
  straight off the writing system.
- **A line the translation services gave up on can now be retried.** It used to lose its translation
  and, with it, the retry button that lived inside, so it looked exactly like a line that was never
  meant to be translated and there was nothing left to click. Such a line now keeps a small marker
  naming the reason, with the retry button on it. A retry that fails again keeps the button instead
  of deleting it. Lines skipped on purpose, by the glossary, by the same language check or by the
  identical text check, stay silent as before.
- **Hiding the original now works when a chat emote extension is running.** With "Keep original
  text visible" turned off, the original stayed on screen for anyone using 7TV. That extension hides
  the text Kick writes and renders its own copy next to it, and only Kick's copy was being hidden,
  so the setting did nothing at all. Both are hidden now, emotes included.
- **Hiding the original now works on replies too.** With "Keep original text visible" turned off, a
  reply kept showing its original text while every other line hid it. Kick nests the message of a
  reply one level deeper than a plain line, and the rule only reached text sitting directly beside
  the translation. It now keys on the element holding the translation, which reaches both shapes.
  The quoted message a reply points at stays readable, as it should.
- **"Keep original text visible" now does something.** The switch was offered in both the options
  page and the popup and was saved correctly, but no part of the extension ever read it, so turning
  it off left the chat exactly as it was. Turning it off now hides Kick's own text on the lines that
  carry a translation, and only on those lines: a line that was never translated, or one the chat's
  virtual scrolling reused, keeps its text.
- **The Replace display style paid for the same translation over and over.** Three checks asking
  "has this line already been translated?" listed the Below and Inline classes but not the separate
  class Replace uses, so on that style every translated line still read as untranslated. Coming
  back to the tab, and every pause after scrolling, re-submitted every visible line to a translation
  service. The same blind spot let the recycled-row rescue overwrite a line's translation with a
  different message's. All three now share one selector built from the display styles themselves.
- **The Replace display style described itself wrongly.** Its card in the options page said the
  translation appears below the message. It appears on the same line, right after it, in smaller
  italics. Corrected in English and in all six translated interfaces.
- **The Replace display style was unreadable.** Its translation had no green tint, no copy cursor
  and a re-translate button that could never be revealed, because those three CSS rules named
  `.kt-translation` and `.kt-translation-inline` but not the separate `.kt-translation-compact`
  class that Replace actually uses. It now carries the same cue as the other styles, keeping its
  smaller italic text, and it reads correctly on a light OS theme too. Inline gains the green
  left edge that Below already had; Below and Hover are unchanged.
- **The extension could bind to the wrong part of the chat page.** It picked the first element
  matching its chat-container selector. Kick's layout has three matching elements, and the first is
  a horizontal scroller that holds no messages: on the three channels checked, one offline and two
  live, that element contained none of the chat. It now picks the candidate that actually holds
  chat messages, and keeps looking while the chat is still empty instead of settling on the wrong
  one.
- **Switching channels no longer leaves background watchers behind.** Each channel switch started a
  page-wide DOM watcher without dropping the previous one, so they piled up and every one of them
  ran on every change anywhere on the page. Long sessions hopping between channels should feel
  lighter.
- **Compact display no longer stacks duplicate translations.** In the compact display style, a
  re-translation (the retry button, or the same message being processed again) added a second
  translation under the message instead of replacing the first, and they piled up. The other
  display styles were unaffected.
- **The compose preview no longer overwrites your clipboard for nothing.** When a translation came
  back identical to what you had typed, inserting it left the box looking unchanged, which the
  extension read as "the editor rejected it" and fell back to copying the text over whatever you
  had on your clipboard. It now only falls back when the translation would actually have changed
  the box.
- **Glossary entries with non-Latin text now work.** Every rule whose source term was not plain
  ASCII was silently ignored, including the documented `草→lol` example, along with Cyrillic and
  accented words like `café`. Rules on ASCII words still match whole words only.
- **Turkish names and words are now matched regardless of capitalisation.** Lowercasing a Turkish
  capital İ leaves an extra invisible mark behind, so the same name written in a different case no
  longer looked like the same name: a blacklisted Turkish user kept coming through, and the same
  Turkish word in two capitalisations was translated and paid for twice instead of being reused
  from cache. Dotted and dotless i stay distinct, as they are genuinely different letters.
- **Username detection was broken by a Kick layout change, which silently disabled the user
  filters.** Kick now renders the sender's name directly on a button instead of inside a span, so
  the extension read every message as having no author: blacklisted users were still translated,
  the bot filter had nothing to match on, and the "same user repeated themselves" check never
  fired, so spam was re-translated at your providers' expense. Checked against live chat, where
  none of the previous detection paths matched a single message.

## [2.5.0] — 2026-06-04

### Added
- **The extension UI is now available in 7 languages** — English, Japanese, French, Chinese,
  Arabic, Russian, and Portuguese. The options page and popup auto-detect your browser language
  and can be switched live from a picker in the options header; Arabic renders right-to-left.
  Missing strings fall back to English, so the UI is never blank.

### Fixed
- **Firefox (AMO) data-consent.** Added the now-required
  `browser_specific_settings.gecko.data_collection_permissions` key, declaring that the extension
  transmits chat message text (website content) to the user-selected translation provider and
  nothing else. This unblocks Firefox Add-ons validation.

## [2.4.1] — 2026-06-03

### Fixed
- **Firefox build compatibility.** `strict_min_version` is now `121.0` (the version that supports
  ES-module background scripts and `storage.session`) instead of an incorrect `109.0` that left the
  background non-functional on Firefox 109–120 and failed `web-ext lint`. The keepalive now guards
  `storage.session`. `web-ext lint` → 0 errors. (Promise-based `chrome.*` works natively on Firefox MV3,
  so no polyfill is needed.)

## [2.4.0] — 2026-06-03

### Improved
- **Outgoing (compose) quality, especially into Japanese.** The compose translation now feeds DeepL
  the recent channel lines as `context` (free — DeepL doesn't bill context characters) so the wording
  fits the conversation, and requests the **polite register** (`formality: prefer_more` → keigo for
  Japanese) where DeepL supports it. Compose also **remembers a channel's broadcast language**, so an
  offline Japanese channel still targets Japanese instead of defaulting to English.

## [2.3.1] — 2026-06-03

### Fixed
- **Compose preview stayed up after you cleared the chat box.** Kick's Lexical composer never fires a
  catchable `input` event on delete-to-empty (only `beforeinput`/`keyup`), so clearing your draft left
  the translation panel visible. It now also re-evaluates on `keyup`, so an empty box hides the panel.

## [2.3.0] — 2026-06-03

### Added
- **"Update available" indicator** — the popup checks the latest GitHub release (cached 6h) and shows
  a one-click banner linking to the release when a newer version is published; the header now shows the
  installed version. New read-only host permission: `https://api.github.com/*`.

## [2.2.1] — 2026-06-03

### Fixed
- **Critical: incoming chat translation was completely broken** (v2.1.0–v2.2.0). The pipeline's
  `effTarget` getter referenced itself instead of `settings.targetLang`, causing infinite recursion
  (`RangeError`) on every incoming message — `prepare()` threw and the rejection was swallowed by the
  observer, so messages were marked seen but never translated (0 requests reached the service worker).
  Compose ("translate what I type") was unaffected. Added a regression test (`pipeline.test.ts`) and a
  postmortem (`docs/postmortem-2026-06-03-efftarget-recursion.md`).

## [2.2.0] — 2026-06-02

Quality + reach polish, and a correct two-store release pipeline.

### Added
- **Budget-aware DeepL routing** (`deeplSmartRouting`, default on): DeepL is spent only
  on the European language pairs where it measurably beats the free engines; other
  targets (Japanese, Korean, Chinese, Arabic, Hindi, Thai…) demote it to a last-resort
  fallback — stretching the Free **1,000,000 chars/month** quota much further. Toggle in
  Options → Providers → DeepL.

### Changed / Fixed
- **Compose panel placement** now tracks the **visual viewport**, so it rides above the
  on-screen keyboard instead of hiding behind it, and lifts clear of Kick's emote / emoji
  picker when one opens over the composer.
- **MyMemory** regional codes: variants are sent as RFC-3066 (`pt-BR`, `zh-CN`, `zh-TW`,
  `no`) instead of a bare 2-letter code, improving 3rd-tier fallback quality.
- **Release pipeline**: the Chrome and Firefox bundles are now packed from their *own*
  builds — previously the published `-chromium` asset actually contained the Firefox
  build and no correct Firefox zip was produced. `build:firefox` is now cross-platform
  (`cross-env`); new `package:all` produces both store zips locally.
- Corrected the stale DeepL Free quota copy (500k → 1,000,000 chars/month).

### Tests
- 116 unit tests (was 91): budget routing, MyMemory code mapping, compose-panel geometry.

## [2.1.0] — 2026-06-02

International auto-detection + a compose preview. Works for any user on any channel
with zero configuration.

### Added
- **Compose preview** — translate what *you* type, live, in a floating panel above the
  chat box; click or **Ctrl/Cmd+Enter** to insert, **Esc** to dismiss.
- **Zero-config language detection, both directions:** reading target defaults to your
  **browser language** (`targetLang: 'auto'`); compose target is the **channel's
  language**, auto-detected from Kick's API (`livestream.lang_iso`) — no manual picking.
- **+11 languages** (31 total): Catalan, Slovenian, Estonian, Lithuanian, Latvian,
  Persian, Bengali, Tamil, Malay, Filipino, Slovak; plus **Brazilian Portuguese**.
- **RTL rendering** (`dir="auto"`) for Arabic / Hebrew / Persian.

### Changed / Fixed
- Chinese is no longer mislabelled as Japanese (kana-vs-Han script detection).
- Regional variants kept distinct (pt-BR, zh-TW); base-language comparison avoids
  pointless self-translation.
- DeepL: correct `PT-BR` / `ZH-HANS` / `ZH-HANT` / `NB` targets, valid base-code
  `source_lang` (was sending an invalid `EN-US`), and unsupported targets skip cleanly
  to Google without cooling DeepL down. Google: regional `tl` codes.
- Channel-meta fetches de-duplicated and tolerant of Cloudflare 403/503; invalid
  language settings coerced back to `auto`.
- Floating bar showed the literal `AUTO` sentinel instead of the resolved language.
- Compose was blocked for ASCII source languages (bonjour → "good") by the background's
  English-only same-language heuristic.

### Tests
- 91 unit tests (was 57).

## [2.0.0] — 2026-05-28

Complete rewrite. Not backwards-compatible with 1.x settings.

### Added
- **WebSocket-first ingestion** via Kick's Pusher endpoint
  (`App\Events\ChatMessageEvent`), with a DOM observer fallback.
- **Multi-provider chain**: Google Translate (free, no key), DeepL Free/Pro,
  MyMemory, and any Lingva / LibreTranslate instance.
- **Auto-failover** with per-provider exponential cooldown.
- **IndexedDB cache** with TTL + LRU + in-memory front layer.
- **Per-channel token-bucket rate limiter** to protect provider quotas.
- **Dedicated options page** (Preact + Tailwind) with tabs:
  Providers, Display, Filters, Advanced, About.
- **Hover-to-translate** display mode (on-demand, zero passive cost).
- **Source-language allowlist** to translate only specific languages.
- **Bot/user/channel filters** with whitelist + blacklist support.
- **`franc-min`-based language detection** replacing the naive heuristic.
- **Kick `[emote:id:name]` parser** + `@mention` / URL stripping before
  translation, so we don't ship emote text to the provider.
- **Daily usage stats**: requests, cache hit rate, errors, top languages.
- **Firefox MV3 build target** alongside Chrome.
- **Vitest test suite** and **GitHub Actions CI**.
- **Privacy policy** (`PRIVACY.md`) and **LICENSE** (MIT).

### Changed
- Build: Webpack → **Vite 5 + @crxjs/vite-plugin v2** + TypeScript strict.
- UI: vanilla TS → **Preact + Tailwind** for popup + options.
- Service worker: keepalive via `chrome.alarms` (instead of dying mid-burst).

### Removed
- The promised-but-never-implemented DeepL backend from v1 (now real).
- The dead `libretranslate.com` public endpoint (replaced by configurable
  Lingva, which still proxies LibreTranslate engines).
- Inline styles scattered across the codebase (now in `inject.css`).

### Fixed
- XSS surface in injection (no more `innerHTML` on untrusted content).
- Cache lost on every service-worker idle (now persisted to IndexedDB).
- Identical-text "translations" pollute the chat (now suppressed).
