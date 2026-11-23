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
- Known anomaly: TCT versions (1.0.x, 1.1.0) also land in the KCT property; the
  report counts them on a "hors 3.x" line. 1.0.0 shipped the KCT id; 1.0.2+ is unexplained.
