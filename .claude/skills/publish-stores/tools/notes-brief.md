# Release notes X.Y.Z, Kick Chat Translator: translate en.txt (brief for translation agents)

Source: `<notes-dir>/en.txt`, written first by hand. Repository (read only): `<repo>`. Replace <notes-dir> and <repo> before handing this brief out.

For each language code you are given, write `<code>.txt` in THIS folder (`<notes-dir>/`), UTF-8, LF, as many paragraphs as en.txt separated by one blank line, same content as en.txt, nothing added, nothing dropped.

Rules (the store pipeline refuses the file otherwise):
1. Plain text. No Markdown, no bullets.
2. NO em dash or en dash anywhere (U+2014, U+2013). Use a comma, a colon or parentheses.
3. Real accents and diacritics of the language. Every paragraph of 120+ characters in a Latin-script language must carry at least one accented letter. No Cyrillic letter inside a Latin-script word.
4. Straight ASCII quotes `"` only, never curly quotes. Keep quoted examples and proper names (Kick, Discord, DeepL, Twitch Chat Translator...) exactly as in en.txt.
5. Button and tab names must be the exact labels the extension's interface shows in that language. Read them in `<repo>/src/shared/i18n/<ui>.ts`: keys `'Clear cache'`, `'Options'`, `'About'`, and the on-device / cloud wording (search `'On-device'`, `'cloud'`). File mapping: pt-BR -> pt.ts, pt-PT -> pt-pt.ts, zh -> zh.ts, zh-TW -> zh-tw.ts, others same code.
6. Register and terminology: SAME register as the previous note (vous/Sie/usted if it used them; 3.4.0 agents switched fr, de, es to tu/du/tú). Read the previous release note in the same language, `<repo>/store/notes/<code>.txt`, and follow it (how it says engine, on-device, emotes, translation).
7. Natural, plain, written by a person, not literal. Then round-trip each paragraph back to English in your head and fix any meaning drift.

When done, run for your files:
`LC_ALL=C.UTF-8 grep -nP '[\x{2013}\x{2014}\x{2018}\x{2019}\x{201C}\x{201D}]' <files>` must print nothing.
Then run `python <repo>/.claude/skills/publish-stores/tools/check_notes.py <notes-dir> <repo>/store/notes` (exit 0 required).
Report: the files written, and for each, the three UI labels you used (Clear cache / Options / About).
