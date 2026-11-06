<div align="center">

<img src="public/icons/icon128.png" alt="" width="80" height="80">

# Kick Chat Translator

Lies jeden Kick-Chat in deiner eigenen Sprache und antworte in der des Kanals.<br>
Kostenlos, ohne Konto, nichts einzurichten. 43 Sprachen, im Chat und in der Erweiterung selbst.

**[Zu Chrome, Brave oder Edge hinzufügen](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)** &nbsp;·&nbsp; **[Zu Firefox hinzufügen](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)** &nbsp;·&nbsp; [Discord](https://discord.gg/udDzxQRyQ9)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=Chrome%20Web%20Store&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Chrome-Nutzer](https://img.shields.io/chrome-web-store/users/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=Nutzer&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Firefox Add-on](https://img.shields.io/amo/v/kick-chat-translator?label=Firefox%20Add-on&color=53fc18)](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)
[![CI](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Portugal)](README.pt-PT.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Svenska](README.sv.md) · [Čeština](README.cs.md) · [Slovenčina](README.sk.md) · [Română](README.ro.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [العربية](README.ar.md) · [עברית](README.he.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [हिन्दी](README.hi.md) · [Suomi](README.fi.md) · [Norsk](README.no.md) · [Dansk](README.da.md) · [Ελληνικά](README.el.md) · [Magyar](README.hu.md) · [Български](README.bg.md) · [Català](README.ca.md) · [Slovenščina](README.sl.md) · [Eesti](README.et.md) · [Lietuvių](README.lt.md) · [Latviešu](README.lv.md) · [فارسی](README.fa.md) · [বাংলা](README.bn.md) · [தமிழ்](README.ta.md) · [Bahasa Melayu](README.ms.md) · [Filipino](README.tl.md) · [粵語](README.yue.md)

<img src="screenshots/demo.gif" alt="Spanische Chatnachrichten kommen nacheinander an, jede mit ihrer englischen Übersetzung darunter; dann wird eine englische Antwort getippt, über dem Chatfeld erscheint eine spanische Vorschau, und Tab setzt sie ein" width="360">

[Im echten Chat ansehen](https://www.youtube.com/watch?v=NoGJeUrwy9o)

</div>

## So funktioniert's

1. Installieren und einen beliebigen Kick-Stream öffnen. Eine grüne Leiste oben im Chat zeigt, dass sie läuft.
2. Jede Nachricht bekommt ihre Übersetzung direkt darunter, sobald sie ankommt, in der Sprache deines
   Browsers. Bei Livestreams genauso wie bei VOD-Wiederholungen.
3. Tipp eine Antwort in deiner Sprache. Eine Vorschau über dem Chatfeld zeigt sie in der Sprache des
   Kanals: Drück Tab oder klick darauf, und diese Version ersetzt, was du getippt hast.

Die Sprache des Kanals liest die Erweiterung direkt von Kick, du musst also nichts einstellen. Beide Sprachen
lassen sich in den Einstellungen ändern, und die Lesesprache kann pro Kanal gemerkt werden.

## Das steckt drin

- **43 Sprachen**, auch rechts nach links (Arabisch, Hebräisch, Persisch), mit getrennten Regionalvarianten
  (brasilianisches und europäisches Portugiesisch, vereinfachtes und traditionelles Chinesisch, Kantonesisch)
- **Die Erweiterung spricht sie auch**: Einstellungen, Popup und Chatleiste in allen 43, auswählbar über ein Menü mit Flaggen
- **Kostenlos ab Werk** mit Google Translate. Hinterlege deinen eigenen kostenlosen DeepL-Schlüssel für bessere
  europäische Sprachen; MyMemory und Lingva übernehmen, wenn ein Dienst ausfällt
- **Übersetzung auf dem Gerät** in Chrome und Edge, wo der Browser sie anbietet: 22 ms statt 1,6 s, und
  der Text verlässt deinen Rechner nie
- **Filter**: Bots überspringen, Nutzer oder Kanäle stummschalten, Zeilen mit einem bestimmten Wort ausblenden,
  nur die Sprachen übersetzen, die du auswählst
- **Gebaut für schnelle Chats**: 7TV-Emotes bleiben unverändert, Emoji-Spam und Links werden entfernt, bevor
  etwas gesendet wird, ein Glossar für Namen, die die Dienste verhunzen, ein Übersetzungscache
- **Vier Anzeigestile**: unter der Nachricht, in derselben Zeile, anstelle der Nachricht oder nur beim Darüberfahren
- **Einen Kanal pausieren** über die Chatleiste, ohne die anderen anzuhalten. Beim Kanalwechsel oder beim
  Update der Erweiterung übersetzen offene Tabs weiter, ohne Neuladen
- Chrome, Brave, Edge und Firefox

| Chat, übersetzt beim Scrollen | Das Popup in der Symbolleiste |
|---|---|
| <img src="screenshots/chat.png" alt="Kick-Chat, in dem jede spanische Nachricht ihre englische Übersetzung darunter trägt, mit der Statusleiste der Erweiterung über der Liste" width="360"> | <img src="screenshots/popup.png" alt="Das Popup der Erweiterung mit Zielsprache, Anzeigemodus, Anbieterliste und den Anfragezahlen des Tages" width="360"> |

| Was du tippst, bevor du es abschickst | Wähl eine Sprache, oder lass sie wählen |
|---|---|
| <img src="screenshots/compose.png" alt="Das Chatfeld mit einer englischen Nachricht und darüber einer Vorschau der spanischen Version, die gesendet wird" width="360"> | <img src="screenshots/languages.png" alt="Ein durchsuchbares Raster aus Sprachflaggen und -namen, mit der Sprache des Kanals an erster Stelle" width="360"> |

<sub>Aufgenommen mit dem ausgelieferten Build in einem Chatraum, den dieses Repository selbst erfindet: Die
Nutzernamen und Nachrichten sind ausgedacht und die Übersetzungen werden lokal beantwortet, damit hier kein
echter Nutzername auftaucht.</sub>

## Installation

[Chrome, Brave, Edge: Chrome Web Store](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
&nbsp;·&nbsp;
[Firefox: Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)

Die Store-Versionen aktualisieren sich selbst.

<details>
<summary>Von Hand installieren, aus einem Release-Zip</summary>

Lade das Zip für deinen Browser von [Releases](https://github.com/Pkkls/kick-chat-translator/releases/latest) herunter und entpacke es.

- Chrome, Brave, Edge (`…-chromium.zip`): Öffne `chrome://extensions`, aktiviere den Entwicklermodus, klick auf "Entpackte Erweiterung laden" und wähl den Ordner.
- Firefox 121+ (`…-firefox.zip`): Öffne `about:debugging#/runtime/this-firefox`, klick auf "Temporäres Add-on laden" und wähl `manifest.json`.

Ist die Store-Version auch installiert, schalte sie zuerst aus, sonst wird jede Nachricht doppelt übersetzt.
Eine so installierte Kopie aktualisiert sich nicht selbst: Ihr Symbol zeigt ein Abzeichen, wenn es eine neuere
Version gibt, und das Popup verlinkt auf den Store.

</details>

## Übersetzungsdienste

Vier Anbieter, hintereinandergeschaltet: Fällt einer aus, übernimmt der nächste. Die Reihenfolge bestimmst du.

| Anbieter | Schlüssel | Hinweis |
|---|---|---|
| Google | keiner | der Standard, funktioniert ab Werk |
| DeepL | kostenlos | die beste Qualität, [kostenloser Schlüssel](https://www.deepl.com/pro-api) für 1 Million Zeichen im Monat |
| MyMemory | keiner | Reserve |
| Lingva | keiner | Reserve, auf einer öffentlichen Instanz, es sei denn, du verweist auf deine eigene |

Der eingebaute Übersetzer von Chromium ist schneller als alle anderen. Gemessen in einem Live-Kanal: 22 ms vom
Erscheinen einer Nachricht bis zu ihrer Übersetzung auf dem Bildschirm, gegenüber 1618 ms über die Cloud-Kette,
ohne Netzwerk und ohne Kontingent. Chrome und Edge ab Version 138 können ihn anbieten, wobei nicht jede Kopie
das tut, und für jedes Sprachpaar muss das Modell einmal heruntergeladen werden, mit einem Klick in der Leiste.
Firefox hat ihn nicht. Wo er fehlt, übernimmt die Cloud-Kette und nichts geht kaputt.

## Einstellungen

Klick auf das Zahnrad in der Chatleiste, oder klick mit rechts auf das Erweiterungssymbol und wähl Optionen.

- **Anbieter**: Reihenfolge der Dienste, dein DeepL-Schlüssel und der Modus: zuerst auf dem Gerät, zuerst Cloud
  oder nur auf dem Gerät
- **Anzeige**: Zielsprache, Anzeigestil, Originaltext und Sprach-Badge, Textgröße, Zeilenabstand,
  Schriftart, Akzentfarbe, Chat-Design, die Vorschau beim Schreiben und was ein Klick darauf bewirkt
- **Filter**: Bots, Nutzer, Kanäle, Schlüsselwörter, Ausgangssprachen und ein Glossar mit Ersetzungen
- **Erweitert**: Größe und Lebensdauer des Caches, gleichzeitige Anfragen, ein Limit pro Kanal, Sicherung und Wiederherstellung
- **Aktivität**: übersetzte Nachrichten, Cache-Treffer, jede im Chat gesehene Sprache, und warum jede der letzten
  50 Zeilen übersetzt oder in Ruhe gelassen wurde
- **Tastatur**: Alt+T schaltet die Chat-Übersetzung ein oder aus, Alt+W die Vorschau beim Schreiben
- Der Sprachknopf in der Aktionsleiste des Chats: Ein Klick wechselt zwischen der Sprache des Kanals und deiner
  letzten Wahl, gedrückt halten öffnet die Liste, zwei Buchstaben tippen filtert sie

## Unterstützte Sprachen

Englisch · Französisch · Spanisch · Portugiesisch · Portugiesisch (Brasilien) · Deutsch · Italienisch · Niederländisch · Polnisch · Schwedisch · Tschechisch · Slowakisch · Rumänisch · Russisch · Ukrainisch · Türkisch · Arabisch · Hebräisch · Japanisch · Koreanisch · Chinesisch (vereinfacht) · Chinesisch (traditionell) · Thailändisch · Vietnamesisch · Indonesisch · Hindi · Finnisch · Norwegisch · Dänisch · Griechisch · Ungarisch · Bulgarisch · Katalanisch · Slowenisch · Estnisch · Litauisch · Lettisch · Persisch · Bengalisch · Tamil · Malaiisch · Filipino · Kantonesisch

Der Chat wird in jede davon übersetzt, und die Oberfläche der Erweiterung gibt es in jeder davon.

## Datenschutz

Kein Konto, kein eigener Server und keine Analysen, es sei denn, du stimmst einer täglichen anonymen Zählung zu, die an Google Analytics gesendet wird (genutzte Dienste, Fehler, Geschwindigkeit, nie deine Nachrichten, Namen oder Kanäle). Chatnachrichten gehen an den Übersetzungsanbieter, den du
gewählt hast, und sonst nirgendwohin, und im Modus auf dem Gerät nicht einmal dorthin. Eine aus einem Store
installierte Kopie stellt keine weiteren Anfragen. Eine von Hand installierte Kopie fragt GitHub höchstens
alle sechs Stunden nach dem neuesten Release-Tag, um zu wissen, ob sie ihr Update-Abzeichen zeigen soll. [Details](PRIVACY.md)

## FAQ

**Nachrichten werden nicht übersetzt.**
Öffne in den Einstellungen den Tab Aktivität und drück "Entscheidungen auslesen": Er listet die letzten 50
Zeilen auf und sagt, warum jede übersetzt oder in Ruhe gelassen wurde. Die meisten übersprungenen Zeilen werden
mit Absicht übersprungen. In einer Live-Session waren 213 von 234 derselbe Nutzer, der sich wiederholte, 9
waren zu kurz, 7 nur Emojis oder Gelächter, und 1 war schon in der Lesesprache. Zeigt der Tab gar nichts an,
sieht die Erweiterung den Chat nicht: Bitte eröffne ein Issue.

**Die grüne Leiste ist verschwunden.**
Lad die Seite neu. Passiert es wieder, eröffne ein [Issue](https://github.com/Pkkls/kick-chat-translator/issues)
mit dem Kanal und dem, was du davor gemacht hast.

**Wie bekomme ich bessere Übersetzungen?**
Hinterlege in den Einstellungen einen kostenlosen DeepL-Schlüssel. Das kostenlose Kontingent deckt eine Million
Zeichen im Monat ab, und DeepL wird nur für die Sprachpaare verbraucht, bei denen es die kostenlosen Dienste schlägt.

**Welchen Anzeigestil soll ich nehmen?**
Unter der Nachricht. Die anderen drei funktionieren und werden noch angepasst.

**Kann ich die Erweiterung in meiner Sprache benutzen?**
Ja. Sie folgt der Sprache deines Browsers, und das Menü oben in den Einstellungen stellt sie auf jede der 43 um.

**Funktioniert es bei VOD-Wiederholungen?**
Ja, genauso wie bei Livestreams.

**Nach einem Kick-Update ist es kaputt.**
Kick ändert manchmal den Aufbau seines Chats. Eröffne ein [Issue](https://github.com/Pkkls/kick-chat-translator/issues),
dann wird es gepatcht.

**Kommt das von Kick?**
Nein. Es ist ein unabhängiges Open-Source-Projekt und steht in keiner Verbindung zu Kick.

## Neuigkeiten

In 3.2.0:

- Die Einstellungen, das Popup und die Chatleiste sprechen alle 43 Sprachen, in die die Erweiterung übersetzt, nicht nur 10, wobei Hebräisch und Persisch wie Arabisch von rechts nach links laufen
- Die zehn Sprachen, die sie schon sprach, wurden neu geschrieben, damit sie sich wie in dieser Sprache verfasst lesen und nicht wie Wort für Wort aus dem Englischen
- Das Menü für die Oberflächensprache zeigt die Flagge jeder Sprache und lässt sich per Tastatur bedienen

Jede Version, mit dem, was sich geändert hat, und der Messung dahinter:
[Releases](https://github.com/Pkkls/kick-chat-translator/releases) und [CHANGELOG.md](CHANGELOG.md).

## Entwicklung

```bash
git clone https://github.com/Pkkls/kick-chat-translator.git
cd kick-chat-translator
npm ci
npm run release:check    # typecheck, lint, unit tests, build: the gate every package goes through
npm run build:firefox    # Firefox build, same dist/ folder
npm run package:all      # both zips, in release/
npm run dev              # HMR
```

Die Builds sind reproduzierbar: Derselbe Commit ergibt auf jedem Rechner byteidentische Zips, geprüft, indem
ein `git archive` des Tags in einem leeren Ordner gebaut und die Hashes verglichen werden.

Zusätzlich zu den Unit-Tests laden 42 Offline-Gates die gebaute Erweiterung in einen echten Browser, steuern sie
und prüfen, was sie tut, wobei die Seite lokal ausgeliefert und der Übersetzungsdienst lokal beantwortet wird.
Sie brauchen Playwright, das absichtlich keine Abhängigkeit ist: Verweise mit `UX_KIT` auf einen Ordner, dessen
`node_modules` es enthält, oder führe `npm i -D playwright` aus.

```bash
node test/e2e/run-gates.mjs --headless                  # all 42, no window
node test/e2e/store-shots-fixture.mjs --lang=ja         # the store screenshots, in one listing language
node test/e2e/store-shots-fixture.mjs --gif             # English store screenshots, the README images and this GIF
```

Die Oberflächentexte liegen in `src/shared/i18n/` (Popup und Optionen, nach dem englischen Text indiziert) und
`src/content/i18n/` (Chatleiste, nach ID indiziert, mit dem englischen Text als Fallback), eine Datei pro
Sprache; Tests verlangen von jeder Datei den vollständigen Schlüsselsatz. Die Store-Texte liegen in
[store/](store/), und ein Release ist ein Versions-Tag: Die CI baut, prüft und veröffentlicht es in beiden Stores.

Stack: Manifest V3, Vite, TypeScript, Preact, Tailwind.

## Verwandte Projekte

- [kick-ad-blocker](https://github.com/Pkkls/kick-ad-blocker), blockiert die Pre-Roll- und Overlay-Werbung von Kick
- [kick-core](https://github.com/Pkkls/kick-core), der Realtime-Gateway-Client, den diese Erweiterungen gemeinsam nutzen
- [kickbus](https://github.com/Pkkls/kickbus), offizielle Kick-Webhooks, per SSE an lokale Bots weitergereicht
- [kick-drops-miner](https://github.com/Pkkls/kick-drops-miner), Windows-App, die die Zuschauzeit für Kick-Drops voranbringt

## Lizenz

MIT. Steht in keiner Verbindung zu Kick.
