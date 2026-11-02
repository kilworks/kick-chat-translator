---
name: publish-stores
description: Ship a release to the Chrome Web Store and addons.mozilla.org. A tag vX.Y.Z runs the Release workflow, which builds, checks and publishes through both stores' APIs; store texts live in store/. `npm run stores:preflight` says before the tag what the Chrome dashboard needs by hand (a new permission's justification, changed descriptions) and writes a copy page for it. Covers the versioning rule, the manual dashboard steps, checking what the stores serve, and recovering a store that failed. Use when the user asks to release, upload, publish or ship a version, or to change or check the store listings. Also covers the extension's promo on kil's Kick account StormRock (About panels and channel banner, sources in store/kick/).
---

# Publishing to the stores

## A release, since 3.0.0

1. **On master**, merged through a pull request with CI green: bump `package.json`, move `## [Unreleased]` in CHANGELOG under the new version, write `store/notes/<lang>.txt` for it (what changed, every language), then check locally:
   ```bash
   npm run release:check && npm run package:all && npm run stores:payloads -- <scratchpad>/stores
   ```
2. **Preflight, then the dashboard if it asks**:
   ```bash
   npm run stores:preflight -- --html release/preflight.html
   ```
   It compares HEAD with the last tag that is not this version's and lists what no API can do: the Privacy tab justification of each permission added since (from `store/chrome/dashboard/permission-justifications.txt`), and each Chrome description that changed (pasted per language on the "Fiche Store" page). The HTML page holds every text with a copy button: open it, send the user through it, wait for "done". It fails outright when a shipped permission has no justification or is missing from `PRIVACY.md`. "Nothing to do by hand" means the tag can go at once.
3. **Tag and push**: `git tag -a vX.Y.Z -m "Release X.Y.Z" && git push origin vX.Y.Z`. The Release workflow (`.github/workflows/release.yml`) checks the tag equals package.json, runs release:check and the store clients' self-tests, builds and packs twice and compares the bytes, makes the source archive, builds the payloads and runs the listing audit, cancels a Chrome submission still in review, uploads and submits to Chrome, releases and lists on AMO, and creates the GitHub release with the notes and checksums. Chrome and AMO are independent steps (`continue-on-error`): one store refusing no longer skips the other or the GitHub release, and a final "Stores outcome" step turns the run red and says which store needs what. Started by hand (workflow_dispatch) it is a dry run that sends nothing.
   **When a store step is red**: Chrome with `INVALID_ITEM_METADATA` means the package is uploaded but not submitted, because the dashboard wants something (see step 2); once the user fixed it, `node scripts/stores/cws.mjs publish`. AMO red: rerun `amo.mjs release` then `amo.mjs listing` by hand, from a clean checkout of the tag, with `git archive --format=zip --prefix=kick-chat-translator-X.Y.Z/ -o release/kick-chat-translator-X.Y.Z-source.zip HEAD` for the source and `stores:payloads` for the notes.
4. **After approval**: `npm run stores:verify`, also run weekly by the Stores verify workflow, compares what both stores serve with the repository, language by language.

Secrets, in the repository's Actions settings: `CWS_SERVICE_ACCOUNT_JSON`, `CWS_PUBLISHER_ID`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`. The same credentials live in `~/.config/kick-chat-translator/` for the scripts run by hand.

## Versioning

- **A version exists only when it ships to the stores.** Number, tag and GitHub release are created together by the Release workflow. Work in between stays on master under `## [Unreleased]` in CHANGELOG, with no bump and no tag.
- **Semver on what store users receive**: patch for fixes, minor for a feature, major for a break or a reset.
- **Never backwards.** AMO keeps every version it ever received and refuses a number at or below one of them; Chrome compares with the published one.
- **`release/` between two releases is a dev build** carrying the last released number: never upload it. The Release workflow builds its own from the tag.
- **No release to test the update notice.** 2.12.5 was an empty tag published only for that; `translate-maj` and a stubbed GitHub response show the same thing without a public release.
- **The 3.0.0 reset, 2026-09-26.** 2.9.3 to 2.13.0 were tagged on GitHub while the Chrome Web Store stayed on 2.9.2, so store users would have jumped from 2.9.2 to 2.13.0. 3.0.0 is the next release on both stores and the first under these rules.

## Store texts

`store/` holds every text either store shows, one file per store, field and language (layout and rules in `store/README.md`). Descriptions carry no version number, so Chrome's never go stale with a release; what changed goes in `store/notes/`. The AMO reviewer notes are a template, `store/amo/reviewer-notes.txt`, whose `{{VERSION}}`, `{{CHECKSUMS}}` and `{{TOOLCHAIN}}` are filled at build time from the zips actually built. `payloads.mjs` refuses a dash, a Latin-script paragraph without accents, a Cyrillic letter in a Latin text, or a version in a description; `test/audits/audit_fiche.py` checks the field limits and that every shipped permission is justified. CI runs both on every push.

## Running the scripts by hand

```bash
npm run stores:payloads -- <dir>        # texts and reviewer notes for the current version
node scripts/stores/cws.mjs status | upload <zip> [--publish] | publish | cancel
node scripts/stores/amo.mjs status | release <firefox.zip> <source.zip> <amo-notes.json> | listing <amo-listing.json>
npm run stores:verify                   # what the stores serve against the repository
npm run stores:selftest                 # after touching cws.mjs or amo.mjs
```

## 1. Chrome Web Store: through the API, never a browser

Chrome forbids every extension from reading or driving the Web Store ("The extensions gallery cannot be scripted"): no text, no screenshot, no click through Claude in Chrome. The built-in browser pane refuses to load it, and computer use only reads browsers. Do not try. The package goes through the Chrome Web Store API v2 with a service account:

```bash
node scripts/stores/cws.mjs status
node scripts/stores/cws.mjs upload release/kick-chat-translator-X.Y.Z-chromium.zip --publish
```

`cws.mjs` signs its own JWT with the service account key (Node stdlib, no dependency), so there is no OAuth window and no refresh token expiring after seven days. It reads the key and the publisher ID outside the repository, `~/.config/kick-chat-translator/cws-service-account.json` and `~/.config/kick-chat-translator/cws.json` (`{"publisherId": "..."}`), and never prints either the key or the token. `cws-selftest.mjs` runs it against a fake Google that checks the JWT signature and the zip bytes: run it after touching `cws.mjs`.

One-time setup, done by the user (it creates credentials, never do it for them):
1. Google Cloud Console: enable "Chrome Web Store API" in a project, create a service account (no role needed), create a JSON key for it and save it as the key file above.
2. Developer Dashboard, Account: add the service account's email (one per publisher). Publisher > Settings shows the publisher ID for `cws.json`.

`status` failing with `invalid_grant ... account not found` means the key is not the one registered; a 403 from the store means the email was not added in the dashboard.

Found while setting it up for 2.12.1 (project `kicktranslator`, account `kicktranslator@kicktranslator.iam.gserviceaccount.com`, publisher `ef2a9029-0a4d-4858-bb63-4ca619ffd657`):
- The publisher ID is the UUID in the dashboard's URL, `chrome.google.com/webstore/devconsole/<publisher>`. `tabs_context_mcp` shows the URL even though the page itself cannot be read.
- Where to send the user, since the pages cannot be read: the service account field is on `devconsole/<publisher>/settings` (title "Paramètres", section "Compte de service"), the listing on `devconsole/<publisher>/<item>/edit` (title "Fiche Store"). `/account` is a 404. The user confused Google Cloud's service account pages with the dashboard twice: name the site, not just the section.
- Registration takes effect at once: the first `status` after it returned 200.
- Chrome left the downloaded key as a `.tmp` in Downloads, a save prompt waiting. The `.tmp` already held the whole key: check it parses and its `private_key_id` matches the key the console shows, copy it to the key file, and have the user cancel the pending download so no stray copy remains.
- To check a key before the dashboard step, run `status` with `CWS_PUBLISHER_ID=probe`: a 403 from the store means the token was granted.

The API does not touch the listing. When a file in `store/chrome/description/` changed, the user pastes it per language in the dashboard, and the Privacy tab only if the manifest's permissions changed (`store/chrome/dashboard/permission-justifications.txt`).

## 1b. Chrome listing, driven from outside the browser: `cws-listing.mjs`

No API sets the listing and no extension may act on the dashboard. `scripts/stores/cws-listing.mjs` speaks the Chrome DevTools Protocol itself, over the WebSocket built into Node, to a browser the user started with debugging on a dedicated profile:

```powershell
& "C:\Program Files\BraveSoftware\Brave-Browser\Applicationrave.exe" --remote-debugging-port=9222 --user-data-dir="$env:USERPROFILE\.config\kick-chat-translator\cws-browser" --no-first-run <listing URL>
```

**Start it yourself, whenever needed: `node scripts/stores/cws-listing.mjs launch`.** kil authorized it on 2026-10-12 and set it to allow: do not ask first, do not hand them a command. Run it whenever port 9222 does not answer (`ECONNREFUSED 127.0.0.1:9222`). Signing in stays the user's step: the profile is signed in and stays so; if Google asks for a sign-in, stop and ask. The user added the allow rule `Bash(node scripts/stores/cws-listing.mjs:*)`; run the script exactly as `node scripts/stores/cws-listing.mjs <cmd>` from the repository root, never prefixed with `cd`, or the rule does not match and the call is refused.

| command | what | status |
|---|---|---|
| `inspect [tab]` | read-only survey of a tab (`edit`, `edit/privacy`) | works |
| `links` | the dashboard's own tab URLs, so none is guessed | works |
| `paste [--dry]` | every `store/chrome/description/<lang>.txt`, read back, saved; `CWS_LANGS=he,hi` limits it, `CWS_DEBUG=1` prints the picker's options and the first difference of a failed read-back | works: 42/42 on 3.1.0. Refuses to run while a submission is in review |
| `verify` | reload, compare what Chrome kept with the files. Always run it after `paste` | works: 42/42 identical on 3.1.0 |
| `why` | reads the "why can't I submit" panel the API never explains | works |
| `status` | the "État" tab's words and whether "Envoyer pour examen" is still live. Run it after every submission: the API's PENDING_REVIEW is not proof | works: "en attente d'examen", button greyed out, on 3.2.0 |
| `justify [--dry|--nosave]` | Privacy tab justifications from `permission-justifications.txt` | fields write correctly (a hand click on Save kept exactly what it typed); the save now waits for the dashboard to confirm and falls back to a DOM click. **Not yet seen saving on its own**: check with `why` the first time |\|--nosave]` | Privacy tab justifications from `permission-justifications.txt` | **fields write, save does not persist** (0/4 twice): finish by hand, then `why` |

Languages are matched by the code after the dash in the picker ("anglais – en"), and the dashboard writes `pt-BR`, `pt-PT`, `zh-CN` and `zh-TW` with a hyphen, and Hebrew as `iw` (`cws: 'iw'` in `languages.mjs`). A tab left in the background takes no synthetic click: the script brings it to front first.

## 1c. Chrome listing analytics: GA4 on, for every item

Every Chrome item gets the dashboard's Google Analytics 4 switched on, from its first publication
(kil, 2026-11-02). It is not the extension's own opt-in usage statistics (skill `ga-usage-stats`):
it measures the store page, and it adds the "Google Analytics" entry under Analytics in the
dashboard menu. Kick had it, Twitch 1.0.0 went out without it and nobody saw the gap for ten days.

Where: the item's `edit` page (the "Fiche Play Store" tab), section "Google Analytics 4 (GA4)".
Off reads "Activer Google Analytics"; on reads "Désactiver Google Analytics" plus an "Accéder à
Google Analytics" link to the property Google creates (Twitch: `p561905641`). No terms to accept,
nothing to type: one button, then a confirmation dialog "Activer Google Analytics 4 (GA4) ?" with
"Annuler" and "Activer".

How, with the debug browser (`cws-listing.mjs launch`), over CDP `Runtime.evaluate`: walk the text
nodes for `/activer\s+google/i` and click the node's `closest('button')`, then find the dialog's
"Activer" button the same way (the container of the text `/\(GA4\)\s*\?/` that holds two
buttons). Traps: the label has a no-break space between "Google" and "Analytics", so a literal
"Google Analytics" match finds nothing; `innerText` shows the text while the button search misses
it. Reload and read the section back: "Désactiver Google Analytics" is the proof.

Side effect: right after the switch the "État" tab read "La publication de ce brouillon a été
annulée" while the API (`cws.mjs status`) said PUBLISHED 1.0.2 at 100 %, with no submitted
revision. The API is the authority; on an item still in review, run `cws.mjs status` after the
switch and resubmit (`cws.mjs publish`) if the submission is gone.

## 2. AMO: through the API

`amo.mjs release` uploads the package with `channel=listed`, waits for validation, creates the version with its source archive (multipart: the API refuses a source in JSON), then sets the release notes and the reviewer notes (JSON: the API refuses them in multipart). `amo.mjs listing` sets the name (the manifest's `extName`), summary and description per locale and reads them back. The devhub spells locales `en-us`, the API `en-US`: the script converts.

It signs an HS256 JWT per request with the key in `~/.config/kick-chat-translator/amo-api.json` (`{"issuer": "...", "secret": "..."}`, AMO_API_KEY overrides), never printed. One-time setup, the user's: https://addons.mozilla.org/en-US/developers/addon/api/key/ first asks to confirm the account's email ("Confirm email address" mails a link), then "Generate new credentials" shows the issuer and the secret once. A link read from the user's mailbox is only followed with their explicit yes.

When that file is missing, the browser walk below does the same through Claude in Chrome.

## 2b. AMO: new version, through the browser

Claude in Chrome, the user's session. Slug `kick-chat-translator`, default locale `fr`, AMO has no Arabic locale.

1. `navigate` to `https://addons.mozilla.org/en-US/developers/addon/kick-chat-translator/versions/submit/`.
2. `find` "file input for add-on upload", then `file_upload` the firefox zip. Never click a file input: it opens a native dialog. Wait about 10 s, read the page: expect "validated with no errors". Warnings are listed in `/en-US/developers/upload/<uuid>/json` (the "Duplicate add-on ID" error there is an artefact of reading it outside the add-on; the page is what counts).
3. Compatibility: Firefox only, as preset. Continue. The URL now carries the version id: `/versions/submit/<id>/details`.
4. Go to `/versions/submit/<id>/source`, tick Yes, `file_upload` the source zip into "Upload source code", Continue. **This submits the version immediately**, before any notes. That is fine: the notes go in next, and small versions are auto-approved within minutes.
5. Notes, on `/en-US/developers/addon/kick-chat-translator/versions/<id>`. The Save button does not submit (the locale widget intercepts it), so post the form yourself. Load the JSON without pasting it through a tool call: add a file input outside the form, `find` it, `file_upload` `amo-notes.json` into it, then run:
   ```js
   const inp = Object.assign(document.createElement('input'), { type: 'file', id: 'kt-payload' });
   inp.setAttribute('aria-label', 'kt payload file'); document.body.appendChild(inp);
   ```
   ```js
   const { notes, rev } = JSON.parse(await document.getElementById('kt-payload').files[0].text());
   const form = document.querySelector('[name=approval_notes]').form;
   const fd = new FormData(form);
   fd.set('approval_notes', rev);
   for (const [loc, t] of Object.entries(notes)) fd.set(`release_notes_${loc}`, t);
   const r = await fetch(location.href, { method: 'POST', body: fd, credentials: 'same-origin' });
   r.status
   ```
   Verify by reloading and counting non-empty `textarea[name^=release_notes_]`: one per locale in the JSON.

## 3. AMO: listing, through the browser

The sections of `/edit` load by AJAX. Same file-input trick with `amo-listing.json`, then:

```js
const { summary, description } = JSON.parse(await document.getElementById('kt-payload').files[0].text());
const url = '/en-US/developers/addon/kick-chat-translator/edit_describe/edit';
const h = { 'X-Requested-With': 'XMLHttpRequest' };
const load = async () => new DOMParser().parseFromString(await (await fetch(url, { credentials: 'same-origin', headers: h })).text(), 'text/html').querySelector('form');
const val = (f, n) => f.querySelector(`[name="${n}"]`)?.value ?? null;
const token = document.querySelector('[name=csrfmiddlewaretoken]').value;
const before = await load();
const fd = new FormData(before);
fd.set('csrfmiddlewaretoken', token);
for (const l of Object.keys(summary)) {
  fd.set(`summary_${l}`, summary[l]); fd.set(`description_${l}`, description[l]);
  if (!val(before, `name_${l}`)) fd.set(`name_${l}`, 'Kick Chat Translator');
}
const r = await fetch(url, { method: 'POST', body: fd, credentials: 'same-origin', headers: { ...h, 'X-CSRFToken': token } });
const after = await load();
({ status: r.status, ok: Object.keys(summary).filter(l => val(after, `summary_${l}`) === summary[l] && val(after, `description_${l}`) === description[l]).length + '/' + Object.keys(summary).length })
```

Without the two headers the POST is a 403 and nothing is saved.

## 4. Verify what the public sees

```js
const a = await fetch('https://addons.mozilla.org/api/v5/addons/addon/kick-chat-translator/').then(r => r.json());
({ live: a.current_version?.version === 'X.Y.Z', public: a.current_version?.file?.status === 'public' })
```

Compare as booleans: the tool output masks version strings as tokens. Then open `https://addons.mozilla.org/fr/firefox/addon/kick-chat-translator/` and read the summary and the start of the description.

## 5. Kick: promo panels and banner on StormRock

kil's Kick account **StormRock** advertises the extension on its own channel: 8 About panels (EN, ES, PT, FR, JA, TR, RU, AR, in that order; German was dropped on purpose) and the channel banner. Only on StormRock's own page: never promo messages in other streamers' chats (spam for them, ban risk for the account that farms the drops).

- **Sources** in `store/kick/`: `panels.html` (copy of every language in one `P` object, the 3 chat lines in `LINES`), `banner.html`. Render with `python render.py` (each panel must print OK, max 2x width) and `python render_banner.py` (2400x400 plus `banner-crop-wide.png` / `banner-crop-narrow.png`, what Kick's cover crop shows). Look at every PNG, then show kil the contact sheet **before** any upload.
- **Flags and emoji**: Chrome on Windows draws flag emoji as two letters. They are Twemoji SVGs from jsdelivr (`tw()`), whole, never cropped into circles (the crop made France white). Bind the emoji to the word before it (`emo()` wraps both in a nowrap span; a no-break space alone still lets the image wrap). Arabic text gets `dir="rtl"` explicitly: `dir="auto"` reads the leading "GG" as LTR and puts it on the wrong side.
- **Banner safe band**: Kick shows the banner `object-fit: cover`, about 11.5:1 on a wide screen, centred. Everything that must be read stays in the middle 52..148 px of the 200 px design; the "StormRock is offline" badge covers about the left quarter, so only decorative chips go there.
- **Check the account first**: in a kick.com page, `(await fetch('/api/v1/user').then(r=>r.json())).username` must be `StormRock`.
- **Panels**: `kick.com/stormrock/about`, "Edit Panel" (if its ref does not open the editor, click it from a screenshot). `find` gives the file inputs and the Update buttons of the 8 cards in order; `file_upload` the PNG, click that card's Update, wait 4 s. A new panel: the "+" (Add) button, then "Create". Panel fields: title `Kick Chat Translator (<language>)`, image link = the Chrome store URL, description = one sentence in the language plus the Chrome and Firefox links.
- **Banner**: `kick.com/settings/profile`, Channel Banner "Update Banner image" opens a modal; its file input only exists once the modal is open (`find` it there), then "Apply" on the crop, then "Save".
- **Verify** through the API, not the screen: `GET /api/v2/channels/stormrock/links` (order, title, `image.url` changed against a copy taken before) and `GET /api/v2/channels/stormrock` (`banner_image.url`), then look at the public page.

## Journal: 2.12.0 to 2.12.2, 2026-09-26

Kept so the next release starts from what happened, not from what was assumed.

### Mistakes, and what now stops each one

1. **Zips built from a dirty working tree.** The 2.12.0 archives in `release/` held another session's uncommitted feature (`blockedKeywords`). My first check said they were clean: `unzip -p zip '*.js' | grep` read nothing and counted 0. Now: build only in a clean `git worktree` of the tag, and check archive contents after extracting them, with a positive control (the same grep must find the marker in a known-bad zip).
2. **A tag that did not match the shipped code.** `v2.12.0` sat on the feature branch tip, while the listing, CHANGELOG and AMO notes described later commits. Now: the AMO notes carry checksums, and a rebuild from the tagged commit must land on them.
3. **Grey boxes shipped instead of flags.** A built 2.12.1 had them on every translated line; 39 gates were green because none looked at the drawing. Now: the `flag-surfaces` gate.
4. **AMO version submitted without notes.** I left `/details` for `/source`, and the source step's Continue submits. Then the Save button on the version page posted nothing and I believed the page state until a reload. Now: the API (`amo.mjs`), or in the browser a `fetch` POST verified by reload.
5. **AMO listing POST refused (403)** without the CSRF and AJAX headers.
6. **Accents lost.** The release notes in `NOUVEAUTES.md` and the French and Turkish manifest descriptions were ASCII (the latter live on the Chrome store for months). Now: `payloads.mjs` refuses a Latin-script text without diacritics.
7. **`pt` and `zh` locales ignored by the Chrome store for months**, found only by reading the public page with `hl=pt-BR` and `hl=zh-CN`. Now: `locales.test.ts` holds every `_locales` directory to Chrome's list.
8. **Wrong dashboard page guessed** (`/account` is a 404), and the user sent to "Compte de service" without naming the site: twice they landed in Google Cloud instead (a second service account created, an "import key" dialog opened). Now: section 1 gives the exact URLs and names the site.
9. **A Chrome with a remote-debugging port, to drive the dashboard through Playwright**, was denied by the permission classifier. Never retried, by any route.
10. **Tooling slips.** Several heredocs in one bash call broke parsing (use Write for multi-line files). The Write tool turned `\u2013` escapes into the characters themselves, so `payloads.mjs` matched its own dash search (now built with `String.fromCharCode`). The CJK unwrap first joined Korean without spaces.
11. **2.12.2 submitted with the old Chrome descriptions.** The detailed descriptions cannot be set by any tool available here (next section), so the package went into review with the listing as it stood; the texts wait in the paste page. `cws.mjs cancel` reopens the draft if they must go in before approval.
12. **A false alarm on the AMO listing.** The first `amo.mjs listing` read back 0/16 although the PATCH had stored every text: AMO serves descriptions with URLs turned into outgoing links, even with `wrap_outgoing_links=false`. The comparison now strips the markup (16/16), and the fake AMO in the self-test wraps links the same way.
13. **The AMO key by mail.** I clicked "Confirm email address" and searched the connected Gmail: nothing arrived within the hour, spam included. The user generated the key and pasted it in the chat, so the secret sits in that transcript until it is regenerated (then replace `amo-api.json`).

14. **2.12.3: a gate that encoded the old requirement.** `translate-maj` asserted that the update banner leads to GitHub; the release changed that on purpose, and the gate failed three runs out of three. The consistency told it apart from the snapshot race (which fails once, then passes). The fix was the gate's expectation, in its own commit, with the rest of the check untouched.
15. **Descriptions pasted for the previous version.** The user pasted the Chrome texts cut for 2.12.2 ("NEW IN 2.12.2"), then 2.12.3 shipped over them with only its package. Paste the texts `payloads.mjs` produces for the version that will actually be submitted.

16. **An accent check too weak to matter.** `payloads.mjs` asked for one accented letter per text, so a single header ("ZOBRAZENÍ") passed six ASCII paragraphs in five Chrome descriptions and two in the French AMO one, and all of them reached the stores, pasted by the user or sent by `amo.mjs`. The Czech text also hid a Cyrillic "а" in "Lista". Now: one accent per paragraph of 120+ characters once quoted English is set aside, no Cyrillic letter in a Latin-script text. Against the old listing it names exactly the 32 paragraphs and the Cyrillic letter; the corrections were checked to change nothing but accents (the texts compared with accents and case stripped).

### What worked

- Byte-reproducible builds, checked three ways each time: two consecutive runs, a third from another checkout path, and a rebuild from the tagged commit, all on the same SHA-256.
- AMO 2.12.1 in full: package, `git archive` source, release notes in 16 locales, reviewer notes explaining the validator's warnings, listing in 16 locales; approved automatically within minutes.
- The Chrome service account: JWT signed with the Node standard library, key taken from Chrome's pending `.tmp` without being displayed, publisher ID read from the tab URL, a 403 with `CWS_PUBLISHER_ID=probe` proving the token before the dashboard knew the account, then 200 on the first call after registration.
- Chrome 2.12.2 through the API: `upload` SUCCEEDED on the tagged zip, `publish` returned PENDING_REVIEW.
- 2.12.3 shipped on both stores with the six commands and nothing else, the Chrome part being `cancel` (2.12.2 was in review, and the store refuses a package during a review), `upload`, `publish`. The listing texts pasted in the draft survived the cancel and the new upload.
- 2.13.0 (the blocked-keyword filter, visible to store users) went out the same way through the skill itself: section 0 checked (tag on origin, both zip hashes in the AMO notes, source archive present), then `cancel` of the 2.12.3 review, `upload`, `amo.mjs release`, `amo.mjs listing` (16/16), `publish`. The Chrome descriptions were left as pasted for 2.12.2 because the user asked for the upload at once.
- 2.12.4 (the toolbar badge) only changes what copies installed by hand see: store copies never get the update notice. It shipped as a tag and a GitHub release, and was not submitted to either store, so the Chrome review of 2.12.3 was not restarted for nothing its users would notice. Rule: submit to the stores when store users would see the difference.
- AMO 2.12.2 without a browser: `amo.mjs release` (upload 201, validation 0 errors and the usual 5 warnings, version created with its source, release notes in 16 locales) then `amo.mjs listing` (16/16 read back). The first real run of both scripts.
- Every script has a check that fails when it should: `cws-selftest` and `amo-selftest` (5/5 each against fake stores), `payloads.mjs` rejecting a trapped copy, `locales.test.ts` failing on a bare `pt`, `flag-surfaces` failing on both reintroduced defects.

### What stays manual, and why

- **Chrome detailed descriptions.** The API v2 has five methods (upload, publish, fetchStatus, cancelSubmission, setPublishedDeployPercentage; discovery document read 2026-09-26) and no listing schema. The dashboard refuses Claude in Chrome, the built-in pane refuses to load it, computer use only reads browsers, and the remote-debugging route is denied. The user pastes from the page `payloads.mjs` feeds (`cws-description-XX.txt`), then `cws.mjs publish`; a copy page was published for 2.12.2 at https://claude.ai/artifact/CZ28h6CwWsMeFVjUWFNNwu.
- **One-time registrations, both done 2026-09-26**: the service account email in the dashboard, and the AMO API key (Mozilla releases it only after the account's email is confirmed through a mailed link).

## Journal: 3.0.2, 2026-10-07

- **A new permission went out without its dashboard justification.** `scripting` was justified in `permission-justifications.txt` and the audit was green, but the text also has to be pasted in the dashboard's Privacy tab, and nothing said so before the tag. Chrome uploaded the package and refused the submission: `INVALID_ITEM_METADATA`, the API giving no detail. Now: `stores:preflight` lists that paste before the tag.
- **One store's refusal skipped everything after it.** The Chrome step failed, so AMO and the GitHub release never ran; both were sent by hand with the commands above. Now: independent store steps and a final outcome step.
- **`PRIVACY.md` did not name the new permission.** Now: `audit_fiche.py` fails when a shipped permission is missing from it, and so does preflight.
- **The Chrome descriptions' permission sentence was wrong** after `scripting` was added, in all eleven languages. Fixed in `store/chrome/description/`; preflight lists them for pasting since they changed.
- **This skill was not loaded** in a session started outside the repository. A user-level pointer, `~/.claude/skills/publish-stores/SKILL.md`, sends to this file.
- **Brave blocks the dashboard too.** Asked to paste the descriptions by driving the menus, Claude in Chrome running in Brave opened the devconsole page and then refused every action on it: "Can't interact with browser-internal or unparseable URLs". The Web Store is protected the same way in every Chromium browser. Do not try again; the copy page from preflight is the answer.
- **Even with the justification pasted, Chrome kept refusing** with the same error: the dashboard's own "why can't I submit" list is the only place that names the missing field. Ask the user to read it rather than retrying `publish`.
- **The listing could be driven after all, from outside.** `cws-listing.mjs` pasted and verified the eleven descriptions, which had been stale since 2.12.2 in every language, and read the dashboard's own refusal: the scripting justification had been pasted into the host permission field. The Privacy tab was finished by hand and the user submitted from the dashboard; `cws.mjs status` then read PENDING_REVIEW for 3.0.2.

## Journal: promo video swap, 2026-10-10

- **`Input.insertText` does not wake the dashboard form.** The promo video URL was typed into both fields, read back right, and "Enregistrer le brouillon" stayed disabled; after a reload the old URL was back. Now: type with real `Input.dispatchKeyEvent` (one per character) then Tab, and check the save button is enabled before clicking it. Always reload and read back from the server.
- **Two promo video fields, not one.** "Vidéo promotionnelle internationale" plus a "localisée" field per listing language (empty = the international one applies). Only `en` held a localized URL. Match each input by the text of its own field block, not the closest section: a section holding both labels made the first script read the wrong field.
- **An invisible, empty `[role=dialog]` sits on the page.** A script that looks for buttons inside "the open dialog" found it and clicked nothing. Ignore dialogs whose `innerText` is empty. The submit confirmation does open on an element `.click()`; a synthetic mouse click on "Envoyer pour examen" opened nothing.
- **"Envoyer pour examen" greyed out, or refused after confirming: "Impossible d'accéder au lien vers les règles de confidentialité".** The privacy URL was the GitHub `blob/master/PRIVACY.md` page, which answers 503 to a Googlebot user agent (200 to a browser). `raw.githubusercontent.com/.../PRIVACY.md` answers 200 to both. The check is flaky (the button came back once after a reload, then the confirmation refused). Changing the privacy URL is a listing change: ask the user first. Read the refusal with `cws-listing.mjs why`.
- **Before any submission, check the draft holds nothing else:** Package tab, draft version equals published version; default-language description equals the public page.
- **Store screenshots harness and Google batches.** `test/e2e/store-shots-fixture.mjs` answers the engine from the GET `q` parameter only. Since PR #26 a batch goes out as `POST translate_a/t` with one `q` field per line and expects `[[translation, lang], ...]`. Not re-run on the fixture yet; a capture script that handled both (motion-studio `scripts/capture.mjs`) translated all 24 lines. Run the fixture and check the chat shot before the next release.
- **The e2e Playwright wrapper needs `UX_KIT`** (`C:/Users/kil/.claude/ux-ui-agent-skills` holds `node_modules/playwright`); without it every e2e script stops at "Playwright introuvable".

## Journal: 3.1.0, 2026-10-12

- **42 listing languages.** The list lives in `scripts/stores/languages.mjs`; payloads, verify, rank and cws-listing read it. New Chrome languages appear in the dashboard's picker only once a package carrying their `_locales` is uploaded, so their descriptions are pasted after the tag, then `cws.mjs cancel` and `publish` to resubmit.
- **AMO "0/34 relues identiques" was a false alarm, again.** Version, source, notes and listing were all stored. AMO renders the "1." step lines as an `<ol>` (numbers and line breaks gone once tags are stripped) and drops Persian's zero-width non-joiner. The readback in `amo.mjs` and `verify.mjs` now sets numbering, ZWNJ and whitespace aside. Before rerunning AMO after a red step, read the step's log: a `POST .../versions/ -> 201` means the version exists and a rerun would be refused.
- **Pasted into a draft in review: 0/42.** Chrome was PENDING_REVIEW after the tag, and a draft in review is frozen: every field types, nothing sticks. The dashboard's "État" tab said so ("Ce brouillon est en attente d'examen") and I did not read it before pasting; kil had to point it out. Now `paste` asks the API first and stops on a review.
- **The page check took `/edit/status` for `/edit`** (a prefix test), so `paste` did not navigate and found nothing. Now an exact URL match.
- **Text typed into the previous language.** The picker sometimes switches late: Hindi landed in the Hebrew listing and Japanese in the Italian one while `paste` said done. Only `verify` caught it. Now `chooseLanguage` waits until the picker shows the language; its text ends with the Material icon ligature ("– ararrow_drop_down"), stripped before matching, or every language reads "not offered". Always `verify` after `paste`.
- **Hebrew is `iw` in the dashboard**, not `he`. bn once failed to be picked and passed alone on a retry.
- **`cws.mjs publish` is not enough after a listing change.** The API answered PENDING_REVIEW, but the dashboard still offered "Envoyer pour examen" for the edited listing, and kil clicked it. After pasting: `cws.mjs cancel` before, then `paste`, `verify`, and "Envoyer pour examen" in the dashboard (check the "État" tab says "en attente d'examen" afterwards).
- **The debug browser is mine to start.** kil authorized `cws-listing.mjs launch` on 2026-10-12 and set it to allow. I sent a command to paste instead, and my first message announcing it had lost the command itself.

## Journal: 3.2.0, 2026-10-12

kil counted more than four passes over the 42 Chrome languages in one day. Each one was a defect of the tool or of the order, not bad luck:

1. **Pasting into a draft in review** (0/42), then **the picker typing into the previous language** (he got Hindi, it got Japanese), then **the picker missing a language at random** (bn, es), then **the last save cut off by closing at once** (vi, zh-TW, zh kept the old text while `paste` said 42/42). Fixed in `cws-listing.mjs`: refuses a draft in review, waits for the picker to show the language, retries the pick three times, waits 5 s after the last save. Proof after the fix: one `paste` then one `verify`, 42/42 and 42/42, no rerun. **One paste, one verify. If verify is not 42/42, fix the script before a second paste.**
2. **A new version for a new build, always.** Asked to replace the 3.1.0 in review with the updated build, the version became 3.2.0: AMO already held 3.1.0 and `v3.1.0` pointed at the old code. Order that worked: `cws.mjs cancel`, `launch`, `paste`, `verify`, PR merged, then the tag.
3. **Every listing claim follows the code.** All 70 descriptions said "interface in 10 languages" after the interface went to 43; caught only while preparing the release. When a feature changes a fact the listing states, grep `store/` for it in the same PR.
4. **`git merge origin/master` without `git fetch`** merged a stale ref and left out the PR it was meant to bring. Fetch first.
5. **`npm run release:check` stops at lint** on a local, untracked `.claude/hillclimb/*.ts`; CI never sees it. Run typecheck, `eslint --ignore-pattern ".claude/**"`, vitest and build one by one rather than reading the chain's first error as a failure of the change.
6. **Translation at scale (43 languages, 84 catalogues).** Sonnet agents, three languages each, one brief file plus a checker script in the scratchpad (`check-ui.mjs`, `check-chat.mjs`: exact keys, placeholders, no dash, not left in English). What went wrong: a session limit killed half of them mid-file (state on disk read back with the checkers, the rest relaunched); agents overwrote each other's helper scripts in the shared scratchpad (now: helpers named with their language codes); German shipped the chip as "Local" because its agent died before aligning it (the coverage test's English-identical list caught it).
7. **AMO "33/34", the fa summary.** AMO drops Persian's zero-width non-joiner from the summary too, not only from the description; the listing was stored. Both readbacks (`amo.mjs`, `verify.mjs`) now set ZWNJ aside in the summary. A red AMO step with `POST .../versions/ -> 201` and one locale "differentes" is this class: compare that locale with the API before rerunning anything.
8. **Submission checked on the dashboard, not assumed.** `cws-listing.mjs status` reads the "État" tab and the submit button. On 3.2.0, pasting before the tag and letting the workflow publish gave "en attente d'examen" with the button greyed out: no click needed.
