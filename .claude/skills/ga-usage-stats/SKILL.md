---
name: ga-usage-stats
description: "Set up, wire and verify the Google Analytics 4 property that receives Kick Chat Translator's opt-in daily usage statistics (src/shared/usage.ts, event daily_usage), driven through Claude in Chrome. Use when kil asks to create or fix the GA account, property, stream or Measurement Protocol secret, to plug the measurement ID into the extension, to check that daily_usage events arrive, or to read what the statistics say."
---

# GA4 for the opt-in usage statistics

What the extension sends is defined in `src/shared/usage.ts` and
`src/background/usage.ts` (one `daily_usage` event a day, Measurement Protocol,
`fetch` in `no-cors`, no host permission). `PRIVACY.md` lists the same fields;
`src/background/usage.test.ts` fails if the two drift.

## Who does what

- **kil's clicks, never Claude's**: accepting Google's terms and the final
  "Create" of a GA *account*. Claude fills every field up to that dialog, then
  stops and says exactly which button to press. Creating an account on a
  service is never done by Claude, even with permission.
- **Claude, with kil's authorization of 2026-10-16**: property and stream
  settings, the Measurement Protocol secret, custom definitions, wiring the ID
  into the code, verification. The secret's creation dialog has an
  acknowledgement checkbox: ask in chat before ticking it, each time.

## 0. Is there an editable property already?

kil's only GA account until 2026-10-16 was "Chrome Web Store developer
properties" (account 396987973, property 540541539), managed by the Web Store
and **read-only**: "Ajouter un flux" greyed out, tooltip "Droits de
modification requis". Nothing can be created there. Open the universal picker
(top left, "Ouvrir le sélecteur universel") and look for an account named
`Kick Chat Translator`; if it exists, skip to step 2.

## 1. Account and property (kil validates at the end)

1. `analytics.google.com` > Admin (gear, bottom left) > "Créer" > "Compte".
2. Account name `Kick Chat Translator`; leave the data-sharing boxes unticked
   (least sharing). "Suivant".
3. Property name `Kick Chat Translator extension`, time zone France, currency
   EUR. "Suivant". Business details: small, "Obtenir des insights de
   référence" or the closest analytics-only goal. Stop on the button that
   opens the terms.
4. **Hand over**: tell kil the form is filled and that the next click
   ("Créer" / the terms dialog with its country and "J'accepte") is theirs.
   Wait for "fait".

## 2. Web stream

Admin > Flux de données > "Ajouter un flux" > Web. URL
`github.com/Pkkls/kick-chat-translator`, name `Kick Chat Translator extension`,
enhanced measurement off (there is no website). Read the measurement ID
(`G-...`) from the stream details.

## 3. Measurement Protocol secret

Stream details > "Codes secrets de l'API Measurement Protocol" > "Créer".
Acknowledgement checkbox: ask kil first. Nickname `extension`. Read the value
from the table. It is write-only for this stream: it ships inside the
extension bundle by design (constants.ts says why), so it is not a credential
to hide, but never post it anywhere else.

## 4. Wire it

`src/shared/constants.ts`: `GA_MEASUREMENT_ID`, `GA_API_SECRET`. Then
`npm run build` (release builds send; `KT_DEV=1` builds never do).

## 5. Verify that events arrive

kil's PC resolves `www.google-analytics.com` to nothing (hosts blocklist) and
forcing the resolution was refused as a containment escape: do not retry it.
Send from Oracle instead (`ssh oracle`), the payload built by `buildEvent`:

```bash
# 1. validation: expect {"validationMessages": []}
curl -s -X POST --data-binary @body.json "https://www.google-analytics.com/debug/mp/collect?measurement_id=G-...&api_secret=..."
# 2. real hit, then GA > Rapports > Temps réel: one daily_usage within a minute
curl -s -o /dev/null -w '%{http_code}\n' -X POST --data-binary @body.json "https://www.google-analytics.com/mp/collect?measurement_id=G-...&api_secret=..."
```

Use `client_id` `test.<timestamp>` for test hits so they can be told apart.

## 6. Make the parameters readable

Event parameters only appear in reports once registered: Admin > Définitions
personnalisées. Metrics (event scope): every name in `USAGE_COUNTERS` plus
`lat_p50`, `lat_p95`, `has_7tv`, `local_api`. Dimensions: `ext_version`,
`browser`, `ui_lang`, `target_lang`, `engine_mode`. GA4 allows 50 custom
metrics and 50 dimensions per property; this uses 14 and 5.

## Where it lives (set up 2026-10-16)

- Account `Kick Chat Translator` 412256768, property `Kick Chat Translator
  extension` 559336585, web stream 16143972403, measurement ID
  `G-M3X9D6KZLP`, MP secret nicknamed `extension` (value in constants.ts).
- Realtime: `analytics.google.com/analytics/web/#/a412256768p559336585/realtime/overview`
- Custom definitions: `.../a412256768p559336585/admin/customdefinitions/hub`,
  5 dimensions and 14 metrics, all event scope, unit Standard.

## Journal

- 2026-10-16: the Web Store property is read-only; account creation is kil's
  click. This skill was written at kil's request to drive everything else.
- 2026-10-16, first run, end to end: kil clicked "Créer" and accepted the
  terms; Claude filled the wizard (data-sharing boxes left unticked, objective
  "engagement et rétention"), created the stream (enhanced measurement off),
  asked before the secret's attestation ("Je confirme avoir informé les
  utilisateurs finaux..."), created the secret, wired it, validated the payload
  from Oracle (`validationMessages: []`), sent one hit (HTTP 204) and saw
  `daily_usage` in Realtime within a minute.
- The stream row in the wizard's table does not open on click; "Suivant"
  finishes the wizard and lands on the stream details. The secrets panel needs
  the attestation before "Créer" enables, and the button moves up once it is
  given.
- Custom definitions take fixed positions at a 1568x731 frame: "Créer" at
  (883,108); dimension name (1078,135), parameter (1060,235); metric name
  (1078,77), parameter (1060,178), unit menu (1280,178) then "Standard"
  (1240,213); save (1520,20). Read the table back after each batch.

## 7. Daily report, automatic (since 2026-11-23)

Do not rebuild or rediscover any of this: it runs on its own.

- Oracle cron `0 9 * * *` (Paris time) runs `~/ga-report/ga_report.py`, which reads
  both properties through the GA4 Data API and posts the report in Discord
  `#bot-ops` (channel 1568060531531587675) with the Chat Translator bot token.
  Log `~/ga-report/ga_report.log`. `python3 ga_report.py --dry` prints instead of posting.
- Source: repo `chat-translator-discord`, `ga_report/ga_report.py` (commit fd1e8bd).
  Redeploy = `scp ga_report/ga_report.py oracle:ga-report/`.
- Auth: service account `ga-report@kicktranslator.iam.gserviceaccount.com`
  (GCP project `kicktranslator`, Analytics Data API already enabled, key id
  16c85a7a...), Viewer on GA account 412256768 (so both properties). Key only on
  Oracle `~/ga-report/sa.json` (600), no copy on the PC. PyJWT signs the JWT, no
  google library. `~/ga-report/env` holds only `DISCORD_BOT_TOKEN` (600).
- KCT property 559336585, TCT property 561930909 (stream 16255096729, G-9EZ5ZNVKM0).
- runReport takes at most 10 metrics: the summary is fetched in two calls.
- Reading the numbers: one event = one user-day; counters are per user-day
  averages in the GA UI cards (`has_7tv` 0.28 proves it). The script divides sums by eventCount.
- Since a7a64ac the report starts with a PNG (`~/ga-report/stats.png`, matplotlib
  from apt `python3-matplotlib`, dark palette of the dataviz skill): KPI tiles with
  change vs the week before (rates in points), 28-day users line, translation
  sources, versions/browsers/UI language. It also reads the public store counts
  (Chrome page "N users", AMO `average_daily_users`, 3 tries each): GA only sees
  users who opted in, so the store total is printed beside it; an unreadable store
  shows "indisponible" and the total becomes "au moins N". A failed picture adds
  "image KO" to the text and never blocks it.
- Since d7dfe91 everything posted is in English (the Discord server is English-only,
  kil 2026-11-23), every chart has a legend and UI languages carry a country flag
  (`LANG_FLAG` map, flagcdn PNGs cached in `~/ga-report/flags/`). Before changing the
  picture: `python3 ga_report.py --dry --dump` on Oracle, copy `data.json` and `flags/`
  next to `check_render.py`, then run the matplotlib skill's
  `check_figure.py check_render.py`; only the dark legend frames may stay flagged.
- Public report since 4d7cf1e: `ga_report.py --public` (daily, 7 days) and `--public --weekly`
  (4 full ISO weeks) post silently (flags 4096) in Discord `#stats` 1574503842740174888,
  cron 14:00 UTC (two local hours with a `date -u +%H = 14` guard, so DST never shifts it).
  Only store totals and shares; any group under `K_ANON` = 3 users becomes Other
  (`_self_check`, red with K_ANON=1). The daily picture is force-pushed as the single
  commit of branch `stats` in both repos (deploy keys `~/.ssh/gh_stats_kct|tct`, aliases
  gh-kct / gh-tct; GitHub host keys came from `gh api meta`, ssh-keyscan returns none from
  Oracle) and shown in both READMEs (KCT #88, TCT #23). `store_history.csv` on Oracle logs
  store totals daily for the weekly "vs a week ago" figure (shown once 8 days exist).
  Offline check: `--public [--weekly] --dry --dump`, copy `public-data.json`, run
  `check_figure.py check_public.py`.
- Translate button (583a03a): each public run renders `public[-weekly]-<lang>.png` for
  `PUBLIC_LANGS` (en, ja) and pushes them to branch `stats` before posting; the bot answers a
  click ephemerally in the member's `check-xx` role language, else Discord locale, else English
  (`statsLang` in bot.go, `statsLangs` must equal `PUBLIC_LANGS`). Member roles come from the API:
  the gateway state holds none. A failed public run posts one line in bot-ops and exits 1.
  Check `check_figure.py` on Oracle (Noto Sans CJK JP is only there).
- Gestures that worked on 2026-11-23, from `chat-translator-discord` root unless said:
  - Deploy the script: `scp ga_report/ga_report.py oracle:ga-report/` (no service to restart, cron reads it).
  - Render without posting: `ssh oracle 'cd ~/ga-report && python3 ga_report.py --public [--weekly] --dry --dump'`,
    then `scp` the check script `~/.claude/skills/matplotlib/scripts/check_figure.py` to `/tmp` on Oracle,
    run it on `check_public.py` there (writes `check-<lang>.png`), copy `check-ja.png` back and look at it.
  - Push the pictures only: `python3 -c "import ga_report as g, os; g.push_readme_image(os.path.join(g.HERE, 'public-en.png'))"`.
  - One-off post of one language, silent, no button (kil's test, message 1574511258324177077):
    `python3 -c "import ga_report as g, os; g.send('', open(os.path.join(g.HERE, 'public-ja.png'), 'rb').read(), g.PUBLIC_CHANNEL, silent=True)"`.
  - Add the button to an existing post without reposting: `rest.py PATCH /channels/<stats>/messages/<id>` with
    `components` = one action row, button style 2, label Translate, custom_id `stats_tr:daily|weekly`.
  - Test the button for real: click it from the owner's session in `#stats` (screenshots hang on Discord after an
    ephemeral, read the DOM or the log), then `grep "stats picture" /root/ctd/ctd.log` on the Nano. To test a
    language, PUT the owner on role `check-<lang>` for one click, then DELETE it and read the member back.
  - Test the failure path: `GIT_SSH_COMMAND=false python3 ga_report.py --public` on Oracle: expect exit 1, one
    "Public stats daily failed" line in bot-ops, nothing new in `#stats`.
- Traps: `ssh-keyscan github.com` returns no key from Oracle (add `gh api meta` ssh_keys to known_hosts);
  the bot's gateway state has no roles (`State.Role` fails, use `GuildRoles`); a Bash heredoc eats `\n`
  in a Python patch (write the patch with Write); the probe output with a raw.githubusercontent URL plus query
  is blocked by the browser tool, read the bot log instead.
- To add a language: a `TXT['<code>']` table in ga_report.py, the code in `PUBLIC_LANGS` and in `statsLangs`
  (bot.go), its font on Oracle (Arabic also needs `arabic-reshaper` + `python-bidi`), redeploy the bot
  (`sh bot/nano/redeploy.sh`), render, look, then wait for the 14:00 UTC run.
- Known anomaly: TCT versions (1.0.x, 1.1.0) also land in the KCT property; the
  report counts them on a "hors 3.x" line. 1.0.0 shipped the KCT id; 1.0.2+ is unexplained.
