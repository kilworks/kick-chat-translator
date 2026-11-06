<div align="center">

<img src="public/icons/icon128.png" alt="" width="80" height="80">

# Kick Chat Translator

Läs vilken Kick-chatt som helst på ditt eget språk och svara på kanalens.<br>
Gratis, utan konto, inget att ställa in. 43 språk, i chatten och i själva tillägget.

**[Lägg till i Chrome, Brave eller Edge](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)** &nbsp;·&nbsp; **[Lägg till i Firefox](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)** &nbsp;·&nbsp; [Discord](https://discord.gg/udDzxQRyQ9)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=Chrome%20Web%20Store&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Chrome-användare](https://img.shields.io/chrome-web-store/users/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=anv%C3%A4ndare&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Firefox Add-on](https://img.shields.io/amo/v/kick-chat-translator?label=Firefox%20Add-on&color=53fc18)](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)
[![CI](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Portugal)](README.pt-PT.md) · [Português (Brasil)](README.pt-BR.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Čeština](README.cs.md) · [Slovenčina](README.sk.md) · [Română](README.ro.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [العربية](README.ar.md) · [עברית](README.he.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [हिन्दी](README.hi.md) · [Suomi](README.fi.md) · [Norsk](README.no.md) · [Dansk](README.da.md) · [Ελληνικά](README.el.md) · [Magyar](README.hu.md) · [Български](README.bg.md) · [Català](README.ca.md) · [Slovenščina](README.sl.md) · [Eesti](README.et.md) · [Lietuvių](README.lt.md) · [Latviešu](README.lv.md) · [فارسی](README.fa.md) · [বাংলা](README.bn.md) · [தமிழ்](README.ta.md) · [Bahasa Melayu](README.ms.md) · [Filipino](README.tl.md) · [粵語](README.yue.md)

<img src="screenshots/demo.gif" alt="Spanska chattmeddelanden dyker upp ett i taget, vart och ett med sin engelska översättning under; sedan skrivs ett engelskt svar, en spansk förhandsvisning visas ovanför chattrutan och Tab byter in den" width="360">

[Se det i en riktig chatt](https://www.youtube.com/watch?v=NoGJeUrwy9o)

</div>

## Så fungerar det

1. Installera det och öppna vilken Kick-stream som helst. Ett grönt fält högst upp i chatten visar att det är på.
2. Varje meddelande får sin översättning direkt under sig så fort det kommer, på webbläsarens språk. Både
   livesändningar och VOD-repriser.
3. Skriv ett svar på ditt eget språk. En förhandsvisning ovanför chattrutan visar det på kanalens språk: tryck
   på Tab eller klicka på den, så ersätter den versionen det du skrev.

Kanalens språk läses direkt från Kick, så det finns inget att ställa in. Båda språken kan ändras i
inställningarna, och ett läsespråk kan sparas per kanal.

## Det här får du

- **43 språk**, även de som skrivs från höger till vänster (arabiska, hebreiska, persiska), med regionala
  varianter hållna isär (brasiliansk och europeisk portugisiska, förenklad och traditionell kinesiska, kantonesiska)
- **Tillägget talar dem också**: inställningar, popup och chattfält på alla 43, valda i en meny med flaggor
- **Gratis direkt** med Google Translate. Lägg till din egen gratis DeepL-nyckel för bättre europeiska språk;
  MyMemory och Lingva tar över när en tjänst fallerar
- **Översättning på enheten** i Chrome och Edge där webbläsaren erbjuder det: 22 ms i stället för 1,6 s, och
  texten lämnar aldrig din dator
- **Filter**: hoppa över bottar, tysta användare eller kanaler, dölj rader som innehåller ett visst ord,
  översätt bara de språk du väljer
- **Byggt för snabba chattar**: 7TV-emotes lämnas som de är, emoji-spam och länkar tas bort innan något
  skickas, en ordlista för namn som tjänsterna förstör, en översättningscache
- **Fyra visningsstilar**: under meddelandet, på samma rad, i stället för det, eller bara vid hover
- **Pausa en kanal** från chattfältet utan att stoppa de andra. Att byta kanal eller uppdatera tillägget
  låter öppna flikar fortsätta översätta, utan omladdning
- Chrome, Brave, Edge och Firefox

| Chatten, översatt medan den rullar | Popupen i verktygsfältet |
|---|---|
| <img src="screenshots/chat.png" alt="Kick-chatt där varje spanskt meddelande har sin engelska översättning under sig, med tilläggets statusfält ovanför listan" width="360"> | <img src="screenshots/popup.png" alt="Tilläggets popup med målspråk, visningsläge, lista över tjänster och dagens antal förfrågningar" width="360"> |

| Det du skriver, innan du skickar det | Välj ett språk, eller låt det välja |
|---|---|
| <img src="screenshots/compose.png" alt="Chattrutan med ett engelskt meddelande och ovanför det en förhandsvisning av den spanska versionen som skickas" width="360"> | <img src="screenshots/languages.png" alt="Ett sökbart rutnät med språkflaggor och namn, med kanalens eget språk först" width="360"> |

<sub>Tagna med den utgivna builden i ett chattrum som det här repot hittar på själv: användarnamnen och
meddelandena är påhittade och översättningarna besvaras lokalt, så ingen verklig persons användarnamn hamnar
på den här sidan.</sub>

## Installera

[Chrome, Brave, Edge: Chrome Web Store](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
&nbsp;·&nbsp;
[Firefox: Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)

Kopior från butikerna uppdaterar sig själva.

<details>
<summary>Installera för hand, från en release-zip</summary>

Ladda ner zip-filen för din webbläsare från [Releases](https://github.com/Pkkls/kick-chat-translator/releases/latest) och packa upp den.

- Chrome, Brave, Edge (`…-chromium.zip`): öppna `chrome://extensions`, slå på Utvecklarläge, klicka på Läs in okomprimerat tillägg och välj mappen.
- Firefox 121+ (`…-firefox.zip`): öppna `about:debugging#/runtime/this-firefox`, klicka på Läs in tillfälligt tillägg och välj `manifest.json`.

Om butiksversionen också är installerad, stäng av den först, annars översätts varje meddelande två gånger.
En kopia som installerats så uppdaterar sig inte själv: Dess ikon visar ett märke när en nyare version finns,
och popupen länkar till butiken.

</details>

## Översättningsmotorer

Fyra tjänster i kedja: När en fallerar tar nästa över. Ordningen bestämmer du själv.

| Tjänst | Nyckel | Anmärkning |
|---|---|---|
| Google | ingen | standardvalet, fungerar direkt |
| DeepL | gratis | bäst kvalitet, [gratis nyckel](https://www.deepl.com/pro-api) för 1 miljon tecken i månaden |
| MyMemory | ingen | reserv |
| Lingva | ingen | reserv, på en publik instans om du inte pekar den mot din egen |

Chromiums inbyggda översättare är snabbare än alla andra. Uppmätt på en live-kanal: 22 ms från att ett
meddelande dyker upp tills översättningen syns på skärmen, mot 1618 ms genom molnkedjan, utan nätverk och utan
kvot. Chrome och Edge 138 och senare kan erbjuda den, men inte alla kopior gör det, och varje språkpar behöver
få sin modell nedladdad en gång, med ett klick från fältet. Firefox har den inte. Där den saknas tar molnkedjan
över och inget går sönder.

## Inställningar

Klicka på kugghjulet i chattfältet, eller högerklicka på tilläggets ikon och välj Inställningar.

- **Tjänster**: motorernas ordning, din DeepL-nyckel och läget: först på enheten, först molnet eller bara på
  enheten
- **Visning**: målspråk, visningsstil, originaltext och språkmärke, textstorlek, radavstånd,
  typsnitt, accentfärg, chattens tema, förhandsvisningen när du skriver och vad ett klick på den gör
- **Filter**: bottar, användare, kanaler, nyckelord, källspråk och en ordlista med ersättningar
- **Avancerat**: cachens storlek och livslängd, samtidiga förfrågningar, en gräns per kanal, säkerhetskopia och återställning
- **Aktivitet**: översatta meddelanden, cacheträffar, varje språk som setts i chatten, och varför var och en av
  de senaste 50 raderna översattes eller lämnades i fred
- **Tangentbord**: Alt+T slår på eller av chattöversättningen, Alt+W förhandsvisningen när du skriver
- Språkknappen i chattens åtgärdsfält: ett klick växlar mellan kanalens språk och ditt senaste val, håll nere
  för att öppna listan, skriv två bokstäver för att filtrera den

## Språk som stöds

Engelska · Franska · Spanska · Portugisiska · Portugisiska (Brasilien) · Tyska · Italienska · Nederländska · Polska · Svenska · Tjeckiska · Slovakiska · Rumänska · Ryska · Ukrainska · Turkiska · Arabiska · Hebreiska · Japanska · Koreanska · Kinesiska (förenklad) · Kinesiska (traditionell) · Thailändska · Vietnamesiska · Indonesiska · Hindi · Finska · Norska · Danska · Grekiska · Ungerska · Bulgariska · Katalanska · Slovenska · Estniska · Litauiska · Lettiska · Persiska · Bengali · Tamil · Malajiska · Filippinska · Kantonesiska

Chatten översätts till vilket som helst av dem, och tilläggets eget gränssnitt finns på vart och ett.

## Integritet

Inget konto, ingen min server och ingen analys om du inte väljer att få en daglig anonym räkning som skickas till Google Analytics (använda motorer, fel, hastighet, aldrig dina meddelanden, namn eller kanaler). Chattmeddelanden går till den översättningstjänst du valt och
ingen annanstans, och i läget på enheten inte ens dit. En kopia installerad från en butik gör inga andra
förfrågningar. En kopia installerad för hand frågar GitHub efter den senaste release-taggen, högst var sjätte
timme, för att veta om den ska visa sitt uppdateringsmärke. [Detaljer](PRIVACY.md)

## FAQ

**Meddelanden översätts inte.**
Öppna fliken Aktivitet i inställningarna och tryck på "Hämta beslut": Den listar de senaste 50 raderna och
säger varför var och en översattes eller lämnades i fred. De flesta överhoppade rader hoppas över med avsikt.
Under en livesession var 213 av 234 samma användare som upprepade sig, 9 var för korta, 7 bara emojis eller
skratt, och 1 var redan på läsespråket. Om fliken inte visar något alls ser tillägget inte chatten: Öppna ett
ärende.

**Det gröna fältet försvann.**
Ladda om sidan. Om det händer igen, öppna ett [ärende](https://github.com/Pkkls/kick-chat-translator/issues)
med kanalen och vad du gjorde innan.

**Hur får jag bättre översättningar?**
Lägg till en gratis DeepL-nyckel i inställningarna. Den gratis nivån täcker en miljon tecken i månaden, och
DeepL används bara på de språkpar där det slår de gratis motorerna.

**Vilken visningsstil ska jag använda?**
Under meddelandet. De andra tre fungerar och justeras fortfarande.

**Kan jag använda tillägget på mitt eget språk?**
Ja. Det följer webbläsarens språk, och menyn högst upp i inställningarna byter det till vilket som helst av de 43.

**Fungerar det på VOD-repriser?**
Ja, på samma sätt som på livesändningar.

**Det slutade fungera efter en Kick-uppdatering.**
Kick ändrar ibland hur chatten är uppbyggd. Öppna ett [ärende](https://github.com/Pkkls/kick-chat-translator/issues)
så fixas det.

**Är det gjort av Kick?**
Nej. Det är ett oberoende open source-projekt, utan koppling till Kick.

## Nytt

I 3.2.0:

- Inställningarna, popupen och chattfältet talar alla 43 språk som tillägget översätter till, inte 10, med hebreiska och persiska från höger till vänster som arabiska
- De tio språk det redan talade skrevs om så att de läses som skrivna på det språket, inte ord för ord från engelskan
- Menyn för gränssnittsspråk visar varje språks flagga och fungerar med tangentbordet

Varje version, med vad som ändrades och mätningen bakom:
[Releases](https://github.com/Pkkls/kick-chat-translator/releases) och [CHANGELOG.md](CHANGELOG.md).

## Utveckling

```bash
git clone https://github.com/Pkkls/kick-chat-translator.git
cd kick-chat-translator
npm ci
npm run release:check    # typecheck, lint, unit tests, build: the gate every package goes through
npm run build:firefox    # Firefox build, same dist/ folder
npm run package:all      # both zips, in release/
npm run dev              # HMR
```

Buildarna är reproducerbara: Samma commit ger byte-identiska zip-filer på vilken maskin som helst, kontrollerat
genom att bygga ett `git archive` av taggen i en tom mapp och jämföra hasharna.

Utöver enhetstesterna laddar 42 offline-gates det byggda tillägget i en riktig webbläsare, styr det och
kontrollerar vad det gör, med sidan serverad lokalt och översättningsmotorn besvarad lokalt. De behöver
Playwright, som medvetet inte är ett beroende: Peka `UX_KIT` mot en mapp vars `node_modules` innehåller det,
eller kör `npm i -D playwright`.

```bash
node test/e2e/run-gates.mjs --headless                  # all 42, no window
node test/e2e/store-shots-fixture.mjs --lang=ja         # the store screenshots, in one listing language
node test/e2e/store-shots-fixture.mjs --gif             # English store screenshots, the README images and this GIF
```

Gränssnittstexterna finns i `src/shared/i18n/` (popup och inställningar, nycklade på den engelska texten) och
`src/content/i18n/` (chattfält, nycklade på id med den engelska texten som reserv), en fil per språk; testerna
kräver hela nyckeluppsättningen av varje fil. Butikstexterna finns i [store/](store/), och en release är en
versionstagg: CI:n bygger, kontrollerar och publicerar den i båda butikerna.

Stack: Manifest V3, Vite, TypeScript, Preact, Tailwind.

## Relaterade projekt

- [kick-ad-blocker](https://github.com/Pkkls/kick-ad-blocker), blockerar Kicks pre-roll- och overlay-annonser
- [kick-core](https://github.com/Pkkls/kick-core), realtidsklienten för gatewayn som de här tilläggen delar
- [kickbus](https://github.com/Pkkls/kickbus), officiella Kick-webhooks vidarebefordrade till lokala bottar via SSE
- [kick-drops-miner](https://github.com/Pkkls/kick-drops-miner), Windows-app som driver upp tittartiden för Kick-drops

## Licens

MIT. Utan koppling till Kick.
