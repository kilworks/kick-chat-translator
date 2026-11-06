// Swedish UI translations. Keys = verbatim English source strings.
export const sv: Record<string, string> = {
  'options & preferences':
    'inställningar',
  'saved':
    'sparat',
  'ready':
    'redo',
  'Providers':
    'Tjänster',
  'Display':
    'Visning',
  'Filters':
    'Filter',
  'Advanced':
    'Avancerat',
  'Activity':
    'Aktivitet',
  'About':
    'Om',
  'Kick Chat Translator listens to chat in real time and translates non-English (or non-target-language) messages right under the original. No tracking, no account, fully open-source.':
    'Kick Chat Translator följer chatten i realtid och översätter meddelanden som inte är på engelska (eller på målspråket) direkt under originalet. Ingen spårning, inget konto, helt öppen källkod.',
  'Links':
    'Länkar',
  'GitHub repository':
    'GitHub-repository',
  'Privacy policy':
    'Integritetspolicy',
  'Report an issue':
    'Rapportera ett problem',
  'How translation happens':
    'Så fungerar översättningen',
  'The extension reads each chat message from the page as it appears.':
    'Tillägget läser varje chattmeddelande på sidan när det dyker upp.',
  'Each chat message is parsed; emotes and links are stripped before translation.':
    'Varje meddelande delas upp, och emotes och länkar tas bort före översättningen.',
  'The extension picks the first available provider in your chain.':
    'Tillägget väljer den första tillgängliga tjänsten i din kedja.',
  'Translations are cached locally in IndexedDB to avoid duplicate calls.':
    'Översättningar sparas lokalt i IndexedDB så att samma text inte översätts två gånger.',
  'Connection':
    'Anslutning',
  'Cache & performance':
    'Cache och prestanda',
  'Debugging':
    'Felsökning',
  'Pause when tab is hidden':
    'Pausa när fliken är dold',
  'Background Kick tabs won\'t translate (saves DeepL quota while you\'re away).':
    'Kick-flikar i bakgrunden översätter inte (sparar DeepL-kvot när du är borta).',
  'Verbose console logs':
    'Utförliga konsolloggar',
  'Cache max entries':
    'Max antal poster i cachen',
  'Larger = more hits across sessions, more disk space.':
    'Större = fler träffar mellan sessioner, mer diskutrymme.',
  'Cache TTL (hours)':
    'Cachens livslängd (timmar)',
  'After this, entries expire.':
    'Därefter upphör posterna att gälla.',
  'Concurrent translations':
    'Samtidiga översättningar',
  'In-flight provider requests.':
    'Pågående förfrågningar till tjänsterna.',
  'Per-channel budget (req/min)':
    'Budget per kanal (förfr./min)',
  'Hard cap to avoid hammering providers on fast chats.':
    'Hård gräns så att tjänsterna inte överbelastas i snabba chattar.',
  'Clear translation cache':
    'Rensa översättningscachen',
  'Reset usage stats':
    'Nollställ användningsstatistik',
  'Reset all settings to defaults':
    'Återställ alla inställningar',
  'click again to confirm':
    'klicka igen för att bekräfta',
  '"Reset all settings" restores defaults. Use it if translations stop appearing because a filter (channel allowlist or source-language allowlist) was left active.':
    '"Återställ alla inställningar" sätter tillbaka standardvärdena. Använd det om översättningar slutat visas för att ett filter (kanallista eller lista över källspråk) har blivit kvar.',
  'Translation target':
    'Översättningsspråk',
  'Display style':
    'Visningsstil',
  'Compose preview':
    'Förhandsvisning när du skriver',
  'Translate everything to':
    'Översätt allt till',
  'Auto (your browser language)':
    'Auto (webbläsarens språk)',
  'Auto reads incoming chat in your own language, detected from the browser.':
    'Auto läser inkommande chatt på ditt eget språk, hämtat från webbläsaren.',
  'Write my messages in':
    'Språk för mina meddelanden',
  'Auto (the channel\'s language)':
    'Auto (kanalens språk)',
  'Auto detects the channel\'s broadcast language from Kick. No manual picking.':
    'Auto hämtar kanalens sändningsspråk från Kick. Inget manuellt val.',
  'Below':
    'Under',
  'On a new line under the message.':
    'På en ny rad under meddelandet.',
  'Inline':
    'I raden',
  'In a pill after the original text.':
    'I en liten etikett efter originaltexten.',
  'Replace':
    'Ersätt',
  'Show floating bar at top of chat (toggle live)':
    'Visa flytande list överst i chatten (ändras direkt)',
  'Keep original text visible':
    'Behåll originaltexten synlig',
  'Show source language badge':
    'Visa märke för källspråk',
  'Show which provider was used':
    'Visa vilken tjänst som användes',
  'Enable compose preview':
    'Aktivera förhandsvisning',
  'Click inserts into the chat box (off = copy to clipboard instead)':
    'Klick infogar i chattfältet (av = kopiera till urklipp i stället)',
  'Translate what you type before sending. A live preview appears above the chat box; click it to drop the translation in. Uses the same engine and providers as incoming chat.':
    'Översätt det du skriver innan du skickar. En förhandsvisning uppdateras ovanför chattfältet medan du skriver, och med ett klick lägger du in översättningen. Använder samma motor och tjänster som inkommande chatt.',
  'Engine':
    'Motor',
  'on-device:':
    'på enheten:',
  'available ✓':
    'tillgänglig ✓',
  'not supported in this browser':
    'stöds inte i den här webbläsaren',
  'Strategy':
    'Strategi',
  'On-device first, cloud fallback':
    'Först på enheten, molnet som reserv',
  'Cloud first, on-device fallback (recommended)':
    'Först molnet, enheten som reserv (rekommenderas)',
  'On-device only (no network, no cloud)':
    'Bara på enheten (inget nätverk, inget moln)',
  'On-device = local Chromium models: unlimited, instant, private, no rate-limit. Each language needs a one-time model download (click a flag below, or the "Local" chip in chat).':
    'På enheten = lokala Chromium-modeller: obegränsat, direkt, privat och utan hastighetsbegränsning. Varje språk kräver en engångsnedladdning av en modell (klicka på en flagga nedan eller på chipet "Lokal" i chatten).',
  'Enable on-device translation':
    'Aktivera översättning på enheten',
  'Download models →':
    'Ladda ned modeller →',
  'General':
    'Allmänt',
  'Source languages allowlist':
    'Tillåtna källspråk',
  'Channels & users':
    'Kanaler och användare',
  'Leave empty to translate every detected language. Pick specific ones to ONLY translate those (e.g. only JA + KO).':
    'Lämna tomt för att översätta alla upptäckta språk. Välj specifika språk för att BARA översätta dem (t.ex. bara JA + KO).',
  'Skip messages already in target language':
    'Hoppa över meddelanden som redan är på målspråket',
  'Ignore common bot accounts (StreamElements, Nightbot, …)':
    'Ignorera vanliga botkonton (StreamElements, Nightbot, …)',
  'Channel allowlist (only translate on these)':
    'Tillåtna kanaler (översätt bara här)',
  'Channel blocklist':
    'Blockerade kanaler',
  'User blocklist':
    'Blockerade användare',
  'Cloud fallback chain':
    'Reservkedja i molnet',
  'Used when on-device is off or a language pair isn\'t downloaded. Providers are tried in order; failing ones are temporarily skipped (exponential cooldown).':
    'Används när översättning på enheten är avstängd eller språkparet inte är nedladdat. Tjänsterna provas i ordning, och de som fallerar hoppas tillfälligt över (med exponentiellt växande väntetid).',
  'ok':
    'ok',
  'down':
    'nere',
  'Google Translate (free, no key)':
    'Google Translate (gratis, ingen nyckel)',
  'DeepL (best quality, needs key)':
    'DeepL (bäst kvalitet, kräver nyckel)',
  'MyMemory (free, ~1000/day)':
    'MyMemory (gratis, ca 1 000/dag)',
  'Lingva (LibreTranslate front, configurable)':
    'Lingva (gränssnitt för LibreTranslate, konfigurerbart)',
  'API key':
    'API-nyckel',
  'Plan':
    'Abonnemang',
  'Free (api-free.deepl.com)':
    'Gratis (api-free.deepl.com)',
  'Pro (api.deepl.com)':
    'Pro (api.deepl.com)',
  'Smart budget routing':
    'Smart budgetstyrning',
  'Spend DeepL only on the European languages it clearly wins at; other targets (Japanese, Arabic, Hindi…) use the free engines first, so your DeepL quota lasts much longer.':
    'Använd DeepL bara för de europeiska språk där det tydligt är bäst. Andra målspråk (japanska, arabiska, hindi …) går först till de gratis motorerna, så din DeepL-kvot räcker mycket längre.',
  'Lingva instance':
    'Lingva-instans',
  'Custom URL (optional)':
    'Egen URL (valfritt)',
  'Leave blank to use the default public instance.':
    'Lämna tomt för att använda den offentliga standardinstansen.',
  '⬆ Update available':
    '⬆ Uppdatering tillgänglig',
  'Target language':
    'Målspråk',
  'Translate what I type':
    'Översätt det jag skriver',
  'Today':
    'Idag',
  'Auto (your language)':
    'Auto (ditt språk)',
  'Below original':
    'Under originalet',
  'Auto (channel language)':
    'Auto (kanalens språk)',
  'Auto-detects the channel\'s language. Preview shows above the chat box. Click it to insert.':
    'Hämtar kanalens språk automatiskt. Förhandsvisningen visas ovanför chattfältet. Klicka på den för att infoga.',
  'order in options':
    'ordning i inställningarna',
  'DeepL quota':
    'DeepL-kvot',
  'Enable':
    'Aktivera',
  'Keep original':
    'Behåll originalet',
  'Language badge':
    'Språkmärke',
  'Clear cache':
    'Rensa cache',
  'Options':
    'Inställningar',
  'requests':
    'förfrågningar',
  'cache':
    'cache',
  'errors':
    'fel',
  'available':
    'tillgänglig',
  'unavailable':
    'ej tillgänglig',
  'Backup':
    'Säkerhetskopia',
  'Save your configuration to a JSON file, or restore it on another browser.':
    'Spara dina inställningar i en JSON-fil, eller återställ dem i en annan webbläsare.',
  'Export settings':
    'Exportera inställningar',
  'Import settings':
    'Importera inställningar',
  'Invalid settings file':
    'Ogiltig inställningsfil',
  'cache hit rate, last 7 days':
    'cacheträffar, senaste 7 dagarna',
  'Minimum message length':
    'Minsta meddelandelängd',
  'Shorter messages are left alone. Raise it to spend less provider quota on busy chats.':
    'Kortare meddelanden lämnas orörda. Höj värdet för att spara tjänstekvot i livliga chattar.',
  'Preview':
    'Förhandsvisning',
  'is anyone else seeing this?':
    'är det fler som ser det här?',
  'Whether a Kick tab keeps translating once you look away.':
    'Om en Kick-flik fortsätter översätta när du tittar bort.',
  'Reusing past translations, and how hard the engines are pushed on a busy chat. The defaults suit most channels.':
    'Återanvändning av tidigare översättningar, och hur hårt motorerna belastas i en livlig chatt. Standardvärdena passar de flesta kanaler.',
  'one channel name per line':
    'ett kanalnamn per rad',
  'one username per line':
    'ett användarnamn per rad',
  'Hide messages containing':
    'Dölj meddelanden som innehåller',
  'one keyword per line, e.g. !fish':
    'ett nyckelord per rad, t.ex. !fish',
  'Glossary':
    'Ordlista',
  'Words the engines keep getting wrong for your channels. Each line replaces the left side with the right side, after translating.':
    'Ord som motorerna ständigt översätter fel i dina kanaler. Varje rad byter ut vänstersidan mot högersidan efter översättningen.',
  'one rule per line, in the form word→replacement':
    'en regel per rad, på formen ord→ersättning',
  'Debug':
    'Felsökning',
  'Last decisions':
    'Senaste besluten',
  'Why each recent message was translated or left alone. Read from an open Kick tab, kept in memory there, never saved to disk.':
    'Varför varje nyligt meddelande översattes eller lämnades orört. Läses från en öppen Kick-flik, sparas bara i minnet där och skrivs aldrig till disk.',
  'Read decisions':
    'Hämta beslut',
  'No Kick tab is open. Open a channel, let the chat run, then read again.':
    'Ingen Kick-flik är öppen. Öppna en kanal, låt chatten rulla en stund och hämta igen.',
  'The open Kick tab has not loaded the extension yet. Reload the tab, then read again.':
    'Den öppna Kick-fliken har inte läst in tillägget än. Ladda om fliken och hämta igen.',
  'Nothing recorded yet. Let a chat run for a moment, then read again.':
    'Inget registrerat än. Låt chatten rulla en stund och hämta igen.',
  'Filter languages':
    'Filtrera språk',
  'No language matches':
    'Inget språk matchar',
  'Move up':
    'Flytta upp',
  'Move down':
    'Flytta ned',
  'Remove':
    'Ta bort',
  'Settings sections':
    'Inställningsavsnitt',
  'Show the quick language button in chat':
    'Visa snabbknappen för språk i chatten',
  'Usage':
    'Användning',
  'most translated languages':
    'mest översatta språk',
  'Translate the chat':
    'Översätt chatten',
  'In place of the original text. Emotes stay.':
    'I stället för originaltexten. Emotes finns kvar.',
  'The Replace style always hides it.':
    'Stilen Ersätt döljer den alltid.',
  'On hover':
    'Vid hovring',
  'Only when you point at the line. Spares your quota.':
    'Bara när du pekar på raden. Sparar kvot.',
  'recommended':
    'rekommenderas',
  'The recommended style is the most tested. The other three may still change.':
    'Den rekommenderade stilen är den mest testade. De andra tre kan fortfarande ändras.',
  'Text size':
    'Textstorlek',
  'Line spacing':
    'Radavstånd',
  'Font':
    'Typsnitt',
  'Kick\'s own':
    'Kicks eget',
  'System':
    'System',
  'Serif':
    'Serif',
  'Monospace':
    'Monospace',
  'High legibility':
    'Hög läsbarhet',
  'Tab swaps my message for its translation (off = Ctrl/Cmd+Enter only)':
    'Tab byter ut mitt meddelande mot översättningen (av = bara Ctrl/Cmd+Enter)',
  'Density':
    'Täthet',
  'Compact':
    'Kompakt',
  'Normal':
    'Normal',
  'Roomy':
    'Luftig',
  'Accent colour':
    'Accentfärg',
  'Kick green':
    'Kick-grön',
  'Cyan':
    'Cyan',
  'Violet':
    'Violett',
  'Amber':
    'Bärnsten',
  'Chat theme':
    'Chattens tema',
  'Follow Kick':
    'Följ Kick',
  'Always dark':
    'Alltid mörkt',
  'Always light':
    'Alltid ljust',
  'Remember a reading language per channel':
    'Kom ihåg lässpråk per kanal',
  'Kick Chat Translator reads chat as it arrives and puts a translation under each message in the language you read. It also translates what you type before you send it. No account, no tracking, open source.':
    'Kick Chat Translator läser chatten när meddelandena kommer och lägger en översättning under varje meddelande, på det språk du läser. Det översätter också det du skriver innan du skickar. Inget konto, ingen spårning, öppen källkod.',
  'Version':
    'Version',
  'Languages':
    'Språk',
  'Providers ready':
    'Tjänster redo',
  'Messages translated':
    'Översatta meddelanden',
  'How a message becomes a translation':
    'Så blir ett meddelande en översättning',
  'The message is read from the page, emotes and links set aside.':
    'Meddelandet läses från sidan, med emotes och länkar åsidosatta.',
  'Its language is worked out on the spot, from the script and the words it uses. This answer decides everything after it.':
    'Språket avgörs direkt, utifrån skriftsystemet och orden. Det svaret styr allt som följer.',
  'Filters run: already in your language, too short, a bot, a language you did not pick.':
    'Filtren körs: redan på ditt språk, för kort, en bot, ett språk du inte valt.',
  'The cache is asked first, so the same message is never paid for twice.':
    'Cachen tillfrågas först, så samma meddelande aldrig betalas två gånger.',
  'Otherwise the first available provider in your chain answers, or the on-device engine if you enabled it.':
    'Annars svarar den första tillgängliga tjänsten i din kedja, eller motorn på enheten om du har aktiverat den.',
  'The Activity tab shows what each of these steps did for you.':
    'Fliken Aktivitet visar vad vart och ett av de här stegen har gjort för dig.',
  'What changed in this version':
    'Vad som ändrats i den här versionen',
  'Entries:': 'Poster:',
  'Cap used:': 'Gräns använd:',
  'oldest kept in memory:':
    'äldsta i minnet:',
  'Requests sent through this limit:': 'Förfrågningar genom den här gränsen:',
  'never reached so far':
    'har ännu aldrig nåtts',
  'Messages held back by this cap:': 'Meddelanden som hållits tillbaka av den här gränsen:',
  'Maintenance':
    'Underhåll',
  'Nothing picked: every language is translated.':
    'Inget valt: alla språk översätts.',
  'picked: everything else is left alone.':
    'valda: allt annat lämnas orört.',
  'channels you have watched':
    'kanaler du har tittat på',
  'Only here':
    'Bara här',
  'Never here':
    'Aldrig här',
  'No key yet, so DeepL is skipped and the chain moves on.':
    'Ingen nyckel än, så DeepL hoppas över och kedjan går vidare.',
  'used this month':
    'använt den här månaden',
  'messages translated':
    'översatta meddelanden',
  'served from cache':
    'från cachen',
  'sent to a provider':
    'skickade till en tjänst',
  'languages seen in chat':
    'språk som setts i chatten',
  'These are the languages the allowlist in Filters decides between.':
    'Det här är de språk som listan i Filter väljer bland.',
  'Paused on this channel':
    'Pausad på den här kanalen',
  'Resume':
    'Återuppta',
  'Open a Kick channel: its chat is translated as it arrives.':
    'Öppna en Kick-kanal: chatten översätts när meddelandena kommer.',
  'Open Kick':
    'Öppna Kick',
  'Free plan: 1,000,000 characters a month. Free keys end with :fx.':
    'Gratisabonnemang: 1 000 000 tecken per månad. Gratisnycklar slutar på :fx.',
  'Get a key:':
    'Skaffa en nyckel:',
  "Help improve Kick Chat Translator?": "Vill du hjälpa till att förbättra Kick Chat Translator?",
  "Once a day, anonymous counts: engines used, errors, speed. Never your messages, names or channels.": "En gång om dagen, anonyma räkningar: använda tjänster, fel, hastighet. Aldrig dina meddelanden, namn eller kanaler.",
  "No thanks": "Nej tack",
  "Share": "Dela",
  "Share anonymous usage statistics": "Dela anonym användningsstatistik",
  "Ignore chat bots": "Ignorera chattbottar",
  "Always ignored:": "Ignoreras alltid:",
  "Other bots to ignore": "Andra bottar att ignorera",
  "one bot name per line": "ett bottnamn per rad",
  "Work in progress": "Arbete pågår",
};
