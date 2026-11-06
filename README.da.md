<div align="center">

<img src="public/icons/icon128.png" alt="" width="80" height="80">

# Kick Chat Translator

Læs enhver Kick-chat på dit eget sprog, og svar på kanalens.<br>
Gratis, uden konto, intet at sætte op. 43 sprog, i chatten og i selve udvidelsen.

**[Føj til Chrome, Brave eller Edge](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)** &nbsp;·&nbsp; **[Føj til Firefox](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)** &nbsp;·&nbsp; [Discord](https://discord.gg/udDzxQRyQ9)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=Chrome%20Web%20Store&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Chrome-brugere](https://img.shields.io/chrome-web-store/users/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=brugere&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Firefox Add-on](https://img.shields.io/amo/v/kick-chat-translator?label=Firefox%20Add-on&color=53fc18)](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)
[![CI](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Portugal)](README.pt-PT.md) · [Português (Brasil)](README.pt-BR.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Svenska](README.sv.md) · [Čeština](README.cs.md) · [Slovenčina](README.sk.md) · [Română](README.ro.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [العربية](README.ar.md) · [עברית](README.he.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [हिन्दी](README.hi.md) · [Suomi](README.fi.md) · [Norsk](README.no.md) · [Ελληνικά](README.el.md) · [Magyar](README.hu.md) · [Български](README.bg.md) · [Català](README.ca.md) · [Slovenščina](README.sl.md) · [Eesti](README.et.md) · [Lietuvių](README.lt.md) · [Latviešu](README.lv.md) · [فارسی](README.fa.md) · [বাংলা](README.bn.md) · [தமிழ்](README.ta.md) · [Bahasa Melayu](README.ms.md) · [Filipino](README.tl.md) · [粵語](README.yue.md)

<img src="screenshots/demo.gif" alt="Spanske chatbeskeder dukker op én ad gangen, hver med sin engelske oversættelse nedenunder; derefter skrives et engelsk svar, en spansk forhåndsvisning vises over chatfeltet, og Tab sætter den ind" width="360">

[Se det i en rigtig chat](https://www.youtube.com/watch?v=NoGJeUrwy9o)

</div>

## Sådan virker det

1. Installer den og åbn en vilkårlig Kick-stream. En grøn bjælke øverst i chatten viser, at den er slået til.
2. Hver besked får sin oversættelse lige under sig, så snart den kommer, på din browsers sprog. Både
   livestreams og VOD-genafspilninger.
3. Skriv et svar på dit eget sprog. En forhåndsvisning over chatfeltet viser det på kanalens sprog: tryk på
   Tab eller klik på den, så erstatter den version det, du skrev.

Kanalens sprog læses direkte fra Kick, så der er intet at indstille. Begge sprog kan ændres i indstillingerne,
og et læsesprog kan huskes pr. kanal.

## Det får du

- **43 sprog**, også fra højre mod venstre (arabisk, hebraisk, persisk), med regionale varianter holdt adskilt
  (brasiliansk og europæisk portugisisk, forenklet og traditionelt kinesisk, kantonesisk)
- **Udvidelsen taler dem også**: indstillinger, popup og chatbjælke på alle 43, valgt i en menu med flag
- **Gratis fra start** med Google Translate. Tilføj din egen gratis DeepL-nøgle for bedre europæiske sprog;
  MyMemory og Lingva overtager, når en motor fejler
- **Oversættelse på enheden** i Chrome og Edge, hvor browseren tilbyder det: 22 ms i stedet for 1,6 s, og
  teksten forlader aldrig din computer
- **Filtre**: spring bots over, gør brugere eller kanaler tavse, skjul linjer med et bestemt ord, oversæt kun
  de sprog, du vælger
- **Lavet til hurtige chats**: 7TV-emotes bliver, som de er, emoji-spam og links fjernes, før noget sendes,
  en ordliste til navne, som motorerne ødelægger, en oversættelsescache
- **Fire visningsstile**: under beskeden, på samme linje, i stedet for den, eller kun ved hover
- **Sæt én kanal på pause** fra chatbjælken uden at stoppe de andre. Skift af kanal eller opdatering af
  udvidelsen lader åbne faner fortsætte med at oversætte, uden genindlæsning
- Chrome, Brave, Edge og Firefox

| Chat, oversat mens den ruller | Popup'en i værktøjslinjen |
|---|---|
| <img src="screenshots/chat.png" alt="Kick-chat, hvor hver spansk besked har sin engelske oversættelse nedenunder, med udvidelsens statusbjælke over listen" width="360"> | <img src="screenshots/popup.png" alt="Udvidelsens popup med målsprog, visningstilstand, udbyderliste og dagens antal forespørgsler" width="360"> |

| Det, du skriver, før du sender det | Vælg et sprog, eller lad den vælge |
|---|---|
| <img src="screenshots/compose.png" alt="Chatfeltet med en engelsk besked og over det en forhåndsvisning af den spanske version, der bliver sendt" width="360"> | <img src="screenshots/languages.png" alt="Et søgbart gitter af sprogflag og navne, med kanalens eget sprog først" width="360"> |

<sub>Taget med den udgivne build i et chatrum, som dette repository selv finder på: brugernavnene og
beskederne er opfundet, og oversættelserne besvares lokalt, så intet rigtigt brugernavn ender på denne side.</sub>

## Installation

[Chrome, Brave, Edge: Chrome Web Store](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
&nbsp;·&nbsp;
[Firefox: Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)

Kopier fra butikkerne opdaterer sig selv.

<details>
<summary>Installer manuelt, fra en release-zip</summary>

Hent zip-filen til din browser fra [Releases](https://github.com/Pkkls/kick-chat-translator/releases/latest) og pak den ud.

- Chrome, Brave, Edge (`…-chromium.zip`): åbn `chrome://extensions`, slå Udviklertilstand til, klik på Indlæs upakket og vælg mappen.
- Firefox 121+ (`…-firefox.zip`): åbn `about:debugging#/runtime/this-firefox`, klik på Indlæs midlertidigt tilføjelsesprogram og vælg `manifest.json`.

Hvis butiksversionen også er installeret, så slå den fra først, ellers bliver hver besked oversat to gange.
En kopi installeret på den måde opdaterer ikke sig selv: Dens ikon viser et badge, når der findes en nyere
version, og popup'en linker til butikken.

</details>

## Oversættelsesmotorer

Fire udbydere i kæde: Når én fejler, overtager den næste. Rækkefølgen bestemmer du selv.

| Udbyder | Nøgle | Note |
|---|---|---|
| Google | ingen | standarden, virker fra start |
| DeepL | gratis | den bedste kvalitet, [gratis nøgle](https://www.deepl.com/pro-api) til 1 million tegn om måneden |
| MyMemory | ingen | reserve |
| Lingva | ingen | reserve, på en offentlig instans, medmindre du peger den mod din egen |

Chromiums indbyggede oversætter er hurtigere end dem alle. Målt på en live kanal: 22 ms fra en besked dukker
op, til oversættelsen står på skærmen, mod 1618 ms gennem skykæden, uden netværk og uden kvote. Chrome og Edge
138 og nyere kan tilbyde den, men ikke alle kopier gør det, og hvert sprogpar skal have hentet sin model én gang,
med ét klik fra bjælken. Firefox har den ikke. Hvor den mangler, overtager skykæden, og intet går i stykker.

## Indstillinger

Klik på tandhjulet i chatbjælken, eller højreklik på udvidelsens ikon og vælg Indstillinger.

- **Udbydere**: motorernes rækkefølge, din DeepL-nøgle og tilstanden: først på enheden, først skyen eller kun
  på enheden
- **Visning**: målsprog, visningsstil, originaltekst og sprogbadge, tekststørrelse, linjeafstand,
  skrifttype, accentfarve, chattema, forhåndsvisningen under skrivning og hvad et klik på den gør
- **Filtre**: bots, brugere, kanaler, nøgleord, kildesprog og en ordliste med erstatninger
- **Avanceret**: cachens størrelse og levetid, samtidige forespørgsler, en grænse pr. kanal, sikkerhedskopi og gendannelse
- **Aktivitet**: oversatte beskeder, cache-hits, hvert sprog set i chatten, og hvorfor hver af de sidste 50
  linjer blev oversat eller ladet være
- **Tastatur**: Alt+T slår chatoversættelse til eller fra, Alt+W forhåndsvisningen under skrivning
- Sprogknappen i chattens handlingsbjælke: ét klik skifter mellem kanalens sprog og dit sidste valg, hold den
  nede for at åbne listen, skriv to bogstaver for at filtrere den

## Understøttede sprog

Engelsk · Fransk · Spansk · Portugisisk · Portugisisk (Brasilien) · Tysk · Italiensk · Hollandsk · Polsk · Svensk · Tjekkisk · Slovakisk · Rumænsk · Russisk · Ukrainsk · Tyrkisk · Arabisk · Hebraisk · Japansk · Koreansk · Kinesisk (forenklet) · Kinesisk (traditionelt) · Thai · Vietnamesisk · Indonesisk · Hindi · Finsk · Norsk · Dansk · Græsk · Ungarsk · Bulgarsk · Catalansk · Slovensk · Estisk · Litauisk · Lettisk · Persisk · Bengali · Tamil · Malajisk · Filippinsk · Kantonesisk

Chatten oversættes til ethvert af dem, og udvidelsens eget interface findes på hvert af dem.

## Privatliv

Ingen konto, ingen min server og ingen analyser, medmindre du tilmelder dig en daglig anonym optælling sendt til Google Analytics (brugte motorer, fejl, hastighed, aldrig dine beskeder, navne eller kanaler). Chatbeskeder går til den oversættelsesudbyder, du har valgt, og
ingen andre steder, og i tilstanden på enheden ikke engang dertil. En kopi installeret fra en butik laver ingen
andre forespørgsler. En manuelt installeret kopi spørger GitHub om det seneste release-tag, højst hver sjette
time, for at vide, om den skal vise sit opdateringsbadge. [Detaljer](PRIVACY.md)

## FAQ

**Beskeder bliver ikke oversat.**
Åbn fanen Aktivitet i indstillingerne og tryk på "Hent afgørelser": Den viser de sidste 50 linjer og siger,
hvorfor hver blev oversat eller ladet være. De fleste oversprungne linjer springes over med vilje. I én
livesession var 213 af 234 den samme bruger, der gentog sig selv, 9 var for korte, 7 var kun emojis eller
latter, og 1 var allerede på læsesproget. Viser fanen slet ingenting, ser udvidelsen ikke chatten: Opret
venligst et issue.

**Den grønne bjælke forsvandt.**
Opdater siden. Sker det igen, så opret et [issue](https://github.com/Pkkls/kick-chat-translator/issues)
med kanalen og det, du gjorde før.

**Hvordan får jeg bedre oversættelser?**
Tilføj en gratis DeepL-nøgle i indstillingerne. Det gratis abonnement dækker en million tegn om måneden, og
DeepL bruges kun på de sprogpar, hvor det slår de gratis motorer.

**Hvilken visningsstil skal jeg bruge?**
Under beskeden. De tre andre virker og bliver stadig justeret.

**Kan jeg bruge udvidelsen på mit eget sprog?**
Ja. Den følger din browsers sprog, og menuen øverst i indstillingerne skifter den til et hvilket som helst af de 43.

**Virker det på VOD-genafspilninger?**
Ja, på samme måde som på livestreams.

**Den gik i stykker efter en Kick-opdatering.**
Kick ændrer somme tider, hvordan dens chat er bygget op. Opret et [issue](https://github.com/Pkkls/kick-chat-translator/issues),
så bliver det rettet.

**Er den lavet af Kick?**
Nej. Det er et uafhængigt open source-projekt, uden tilknytning til Kick.

## Nyt

I 3.2.0:

- Indstillingerne, popup'en og chatbjælken taler alle 43 sprog, som udvidelsen oversætter til, ikke 10, med hebraisk og persisk fra højre mod venstre ligesom arabisk
- De ti sprog, den allerede talte, er skrevet om, så de læses, som om de var skrevet på det sprog, ikke ord for ord fra engelsk
- Menuen til interfacesprog viser hvert sprogs flag og kan betjenes med tastaturet

Hver udgivelse, med hvad der ændrede sig og målingen bag:
[Releases](https://github.com/Pkkls/kick-chat-translator/releases) og [CHANGELOG.md](CHANGELOG.md).

## Udvikling

```bash
git clone https://github.com/Pkkls/kick-chat-translator.git
cd kick-chat-translator
npm ci
npm run release:check    # typecheck, lint, unit tests, build: the gate every package goes through
npm run build:firefox    # Firefox build, same dist/ folder
npm run package:all      # both zips, in release/
npm run dev              # HMR
```

Buildene er reproducerbare: Det samme commit giver byte-identiske zip-filer på enhver maskine, kontrolleret
ved at bygge et `git archive` af tagget i en tom mappe og sammenligne hashes.

Ud over unit-testene indlæser 42 offline gates den byggede udvidelse i en rigtig browser, styrer den og
kontrollerer, hvad den gør, med siden serveret lokalt og oversættelsesmotoren besvaret lokalt. De kræver
Playwright, som med vilje ikke er en afhængighed: Peg `UX_KIT` på en mappe, hvis `node_modules` indeholder det,
eller kør `npm i -D playwright`.

```bash
node test/e2e/run-gates.mjs --headless                  # all 42, no window
node test/e2e/store-shots-fixture.mjs --lang=ja         # the store screenshots, in one listing language
node test/e2e/store-shots-fixture.mjs --gif             # English store screenshots, the README images and this GIF
```

Interfacetekster ligger i `src/shared/i18n/` (popup og indstillinger, nøglet på den engelske tekst) og
`src/content/i18n/` (chatbjælke, nøglet på id med den engelske tekst som reserve), én fil pr. sprog; testene
kræver det fulde nøglesæt af hver fil. Butikstekster ligger i [store/](store/), og en udgivelse er et
versionstag: CI'en bygger, kontrollerer og udgiver det i begge butikker.

Stack: Manifest V3, Vite, TypeScript, Preact, Tailwind.

## Relaterede projekter

- [kick-ad-blocker](https://github.com/Pkkls/kick-ad-blocker), blokerer Kicks pre-roll- og overlay-reklamer
- [kick-core](https://github.com/Pkkls/kick-core), realtime-gateway-klienten, som disse udvidelser deler
- [kickbus](https://github.com/Pkkls/kickbus), officielle Kick-webhooks videresendt til lokale bots via SSE
- [kick-drops-miner](https://github.com/Pkkls/kick-drops-miner), Windows-app, der får Kick-drops' sendetid til at tælle op

## Licens

MIT. Uden tilknytning til Kick.
