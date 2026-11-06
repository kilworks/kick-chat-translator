<div align="center">

<img src="public/icons/icon128.png" alt="" width="80" height="80">

# Kick Chat Translator

Herhangi bir Kick yayınının sohbetini kendi dilinde oku, kanalın dilinde yanıt ver.<br>
Ücretsiz, hesap yok, kurulacak bir şey yok. 43 dil, hem sohbette hem uzantının kendisinde.

**[Chrome, Brave veya Edge'e ekle](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)** &nbsp;·&nbsp; **[Firefox'a ekle](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)** &nbsp;·&nbsp; [Discord](https://discord.gg/udDzxQRyQ9)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=Chrome%20Web%20Store&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Chrome kullanıcıları](https://img.shields.io/chrome-web-store/users/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=kullan%C4%B1c%C4%B1lar&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Firefox Add-on](https://img.shields.io/amo/v/kick-chat-translator?label=Firefox%20Add-on&color=53fc18)](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)
[![CI](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Portugal)](README.pt-PT.md) · [Português (Brasil)](README.pt-BR.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Svenska](README.sv.md) · [Čeština](README.cs.md) · [Slovenčina](README.sk.md) · [Română](README.ro.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [العربية](README.ar.md) · [עברית](README.he.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [हिन्दी](README.hi.md) · [Suomi](README.fi.md) · [Norsk](README.no.md) · [Dansk](README.da.md) · [Ελληνικά](README.el.md) · [Magyar](README.hu.md) · [Български](README.bg.md) · [Català](README.ca.md) · [Slovenščina](README.sl.md) · [Eesti](README.et.md) · [Lietuvių](README.lt.md) · [Latviešu](README.lv.md) · [فارسی](README.fa.md) · [বাংলা](README.bn.md) · [தமிழ்](README.ta.md) · [Bahasa Melayu](README.ms.md) · [Filipino](README.tl.md) · [粵語](README.yue.md)

<img src="screenshots/demo.gif" alt="İspanyolca sohbet mesajları tek tek geliyor, her birinin altında İngilizce çevirisi var; sonra İngilizce bir yanıt yazılıyor, sohbet kutusunun üstünde İspanyolca bir önizleme beliriyor ve Tab onu yerine geçiriyor" width="360">

[Gerçek bir sohbette izle](https://www.youtube.com/watch?v=NoGJeUrwy9o)

</div>

## Nasıl çalışır

1. Kur ve herhangi bir Kick yayınını aç. Sohbetin üstündeki yeşil çubuk açık olduğunu gösterir.
2. Her mesaj, geldiği anda, hemen altında çevirisini alır; çeviri tarayıcının dilindedir. Canlı yayınlarda
   da VOD tekrarlarında da böyle.
3. Kendi dilinde bir yanıt yaz. Sohbet kutusunun üstündeki önizleme onu kanalın dilinde gösterir: Tab'a bas ya
   da önizlemeye tıkla, o sürüm yazdığının yerine geçer.

Kanalın dili doğrudan Kick'ten okunur, yani ayarlanacak bir şey yok. İki dil de ayarlardan değiştirilebilir,
okuma dili de kanal başına hatırlatılabilir.

## Neler var

- **43 dil**, sağdan sola yazılanlar (Arapça, İbranice, Farsça) dahil; bölgesel varyantlar ayrı tutulur
  (Brezilya ve Avrupa Portekizcesi, Basitleştirilmiş ve Geleneksel Çince, Kantonca)
- **Uzantı da bu dilleri konuşur**: ayarlar, açılır pencere ve sohbet çubuğu 43 dilde, bayraklı bir menüden seçilir
- **Kutudan çıktığı gibi ücretsiz**, Google Çeviri ile. Avrupa dilleri daha iyi olsun diye kendi ücretsiz DeepL
  anahtarını ekleyebilirsin; bir motor başarısız olunca MyMemory ve Lingva devralır
- **Cihaz üzerinde çeviri**, tarayıcı sunuyorsa Chrome ve Edge'de: 1,6 sn yerine 22 ms, ve metin bilgisayarından
  hiç çıkmaz
- **Filtreler**: botları atla, kullanıcıları ya da kanalları sustur, belirli bir kelimeyi içeren satırları
  gizle, yalnızca seçtiğin dilleri çevir
- **Hızlı sohbetler için yapıldı**: 7TV emoteleri olduğu gibi kalır, emoji spamı ve bağlantılar hiçbir şey
  gönderilmeden önce ayıklanır, motorların bozduğu adlar için bir sözlük, bir çeviri önbelleği
- **Dört görüntüleme stili**: mesajın altında, aynı satırda, yerine ya da yalnızca üzerine gelince
- **Tek bir kanalı duraklat**, sohbet çubuğundan, diğerleri durmaz. Kanal değiştirmek ya da uzantıyı güncellemek
  açık sekmelerin çevirmeye devam etmesini sağlar, yeniden yüklemek gerekmez
- Chrome, Brave, Edge ve Firefox

| Sohbet, aktıkça çevrilir | Araç çubuğu açılır penceresi |
|---|---|
| <img src="screenshots/chat.png" alt="Her İspanyolca mesajın altında İngilizce çevirisinin durduğu Kick sohbeti, listenin üstünde uzantının durum çubuğu" width="360"> | <img src="screenshots/popup.png" alt="Hedef dil, görüntüleme modu, sağlayıcı listesi ve günlük istek sayılarını gösteren uzantı açılır penceresi" width="360"> |

| Yazdığın, göndermeden önce | Bir dil seç, ya da kendisi seçsin |
|---|---|
| <img src="screenshots/compose.png" alt="İçinde İngilizce bir mesaj bulunan yazma kutusu ve üstünde gönderilecek İspanyolca sürümü gösteren bir önizleme" width="360"> | <img src="screenshots/languages.png" alt="Dil bayraklarının ve adlarının aranabilir ızgarası, kanalın kendi dili en başta" width="360"> |

<sub>Görüntüler, bu deponun kendi uydurduğu bir sohbet odasında yayınlanan sürümden alındı: kullanıcı adları ve
mesajlar uydurmadır, çeviriler yerelde yanıtlanır, bu yüzden bu sayfada gerçek hiç kimsenin adı yer almaz.</sub>

## Kurulum

[Chrome, Brave, Edge: Chrome Web Store](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
&nbsp;·&nbsp;
[Firefox: Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)

Mağaza kopyaları kendiliğinden güncellenir.

<details>
<summary>Elle kurulum, bir release zip'inden</summary>

Tarayıcın için zip'i [Releases](https://github.com/Pkkls/kick-chat-translator/releases/latest) sayfasından indir ve aç.

- Chrome, Brave, Edge (`…-chromium.zip`): `chrome://extensions` aç, Geliştirici modunu etkinleştir, Paketlenmemiş öğe yükle'ye tıkla, klasörü seç.
- Firefox 121+ (`…-firefox.zip`): `about:debugging#/runtime/this-firefox` aç, Geçici Eklenti Yükle'ye tıkla, `manifest.json` dosyasını seç.

Mağaza sürümü de kuruluysa önce onu kapat, yoksa her mesaj iki kez çevrilir. Bu şekilde kurulan bir kopya
kendiliğinden güncellenmez: daha yeni bir sürüm varsa simgesinde bir rozet çıkar ve açılır pencere mağazaya
bağlantı verir.

</details>

## Çeviri motorları

Zincirlenmiş dört sağlayıcı: biri başarısız olursa sıradaki devralır. Sıralamayı sen belirlersin.

| Sağlayıcı | Anahtar | Not |
|---|---|---|
| Google | yok | varsayılan, kutudan çıktığı gibi çalışır |
| DeepL | ücretsiz | en iyi kalite, ayda 1 milyon karakter için [ücretsiz anahtar](https://www.deepl.com/pro-api) |
| MyMemory | yok | yedek |
| Lingva | yok | yedek, kendi örneğine yönlendirmedikçe herkese açık bir örnekte |

Chromium'un yerleşik çevirmeni hepsinden hızlıdır. Canlı bir kanalda ölçüldü: bir mesajın görünmesinden
çevirisinin ekranda belirmesine 22 ms, bulut zincirinde ise 1618 ms; ağ yok, kota yok. Chrome ve Edge 138 ve
sonrası bunu sunabilir, ancak her kopya sunmaz, ve her dil çiftinin modeli bir kez indirilmelidir, çubuktan tek
tıkla. Firefox'ta yok. Bulunmadığı yerde bulut zinciri devralır ve hiçbir şey bozulmaz.

## Ayarlar

Sohbet çubuğundaki dişliye tıkla, ya da uzantı simgesine sağ tıklayıp Seçenekler'i seç.

- **Sağlayıcılar**: motor sırası, DeepL anahtarın ve mod: önce cihaz üzerinde, önce bulut, ya da yalnızca cihaz
  üzerinde
- **Görünüm**: hedef dil, görüntüleme stili, özgün metin ve dil rozeti, yazı boyutu, satır aralığı, yazı tipi,
  vurgu rengi, sohbet teması, yazma önizlemesi ve ona tıklamanın ne yaptığı
- **Filtreler**: botlar, kullanıcılar, kanallar, anahtar kelimeler, kaynak diller ve bir değiştirme sözlüğü
- **Gelişmiş**: önbellek boyutu ve ömrü, eşzamanlı istekler, kanal başına hız sınırı, yedekleme ve geri yükleme
- **Etkinlik**: çevrilen mesajlar, önbellek isabetleri, sohbette görülen her dil, ve son 50 satırın her biri neden
  çevrildi ya da bırakıldı
- **Klavye**: Alt+T sohbet çevirisini açar ya da kapatır, Alt+W yazma önizlemesini
- Sohbetin eylem çubuğundaki dil düğmesi: tek tık kanalın dili ile son seçimin arasında geçiş yapar, basılı
  tutmak listeyi açar, iki harf yazmak listeyi süzer

## Desteklenen diller

İngilizce · Fransızca · İspanyolca · Portekizce · Portekizce (Brezilya) · Almanca · İtalyanca · Felemenkçe · Lehçe · İsveççe · Çekçe · Slovakça · Romence · Rusça · Ukraynaca · Türkçe · Arapça · İbranice · Japonca · Korece · Çince (Basitleştirilmiş) · Çince (Geleneksel) · Tayca · Vietnamca · Endonezce · Hintçe · Fince · Norveççe · Danca · Yunanca · Macarca · Bulgarca · Katalanca · Slovence · Estonca · Litvanca · Letonca · Farsça · Bengalce · Tamilce · Malayca · Filipince · Kantonca

Sohbet bunların herhangi birine çevrilir, uzantının kendi arayüzü de hepsinde mevcuttur.

## Gizlilik

Hesap yok, bana ait sunucu yok ve sen kabul etmedikçe analitik de yok: Google Analytics'e günlük anonim bir sayım (kullanılan motorlar, hatalar, hız, asla mesajların, adların veya kanalların değil). Sohbet mesajları seçtiğin çeviri sağlayıcısına gider, başka hiçbir
yere, cihaz üzerinde modda oraya bile gitmez. Bir mağazadan kurulan kopya başka hiçbir istek yapmaz. Elle
kurulan kopya, güncelleme rozetini gösterip göstermeyeceğini bilmek için GitHub'dan son release etiketini
en fazla altı saatte bir sorar. [Ayrıntılar](PRIVACY.md)

## SSS

**Mesajlar çevrilmiyor.**
Ayarlardaki Etkinlik sekmesini aç ve "Kararları oku"ya bas: son 50 satırı ve her birinin neden çevrildiğini
ya da bırakıldığını listeler. Atlanan satırların çoğu bilerek atlanır. Tek bir canlı oturumda 234 satırın 213'ü
aynı kullanıcının kendini tekrar etmesiydi, 9'u çok kısaydı, 7'si yalnızca emoji ya da kahkahaydı, 1'i zaten
okuma dilindeydi. Sekme hiçbir şey göstermiyorsa uzantı sohbeti görmüyor demektir: lütfen bir issue aç.

**Yeşil çubuk kayboldu.**
Sayfayı yenile. Tekrar olursa kanalı ve öncesinde ne yaptığını yazarak bir [issue](https://github.com/Pkkls/kick-chat-translator/issues)
aç.

**Daha iyi çeviriyi nasıl alırım?**
Ayarlara ücretsiz bir DeepL anahtarı ekle. Ücretsiz paket ayda bir milyon karakteri kapsar, ve DeepL yalnızca
ücretsiz motorları geçtiği dil çiftlerinde harcanır.

**Hangi görüntüleme stilini kullanmalıyım?**
Mesajın altında. Diğer üçü çalışıyor, ancak hâlâ ayarlanıyor.

**Uzantıyı kendi dilimde kullanabilir miyim?**
Evet. Tarayıcının dilini izler, ayarların üstündeki menü de onu 43 dilden istediğine geçirir.

**VOD tekrarlarında çalışıyor mu?**
Evet, canlı yayınlardaki gibi.

**Kick güncellemesinden sonra bozuldu.**
Kick bazen sohbetinin yapısını değiştirir. Bir [issue](https://github.com/Pkkls/kick-chat-translator/issues)
aç, yamalanır.

**Bunu Kick mi yapıyor?**
Hayır. Bağımsız bir açık kaynak projesi, Kick ile bağlantısı yok.

## Yenilikler

3.2.0'da:

- Ayarlar, açılır pencere ve sohbet çubuğu, eklentinin çevirdiği 43 dilin hepsini konuşuyor, 10 dili değil; İbranice ve Farsça da Arapça gibi sağdan sola okunuyor
- Zaten konuştuğu on dil, İngilizceden kelime kelime çevrilmiş gibi değil, o dilde yazılmış gibi okunsun diye baştan yazıldı
- Arayüz dili menüsü her dilin bayrağını gösteriyor ve klavyeyle çalışıyor

Her sürüm, nelerin değiştiği ve arkasındaki ölçümle birlikte:
[Releases](https://github.com/Pkkls/kick-chat-translator/releases) ve [CHANGELOG.md](CHANGELOG.md).

## Geliştirme

```bash
git clone https://github.com/Pkkls/kick-chat-translator.git
cd kick-chat-translator
npm ci
npm run release:check    # typecheck, lint, birim testleri, derleme: her paketin geçtiği kapı
npm run build:firefox    # Firefox derlemesi, aynı dist/ klasörü
npm run package:all      # iki zip, release/ içinde
npm run dev              # HMR
```

Derlemeler yeniden üretilebilir: aynı commit, herhangi bir makinede bayt bayt aynı zip'leri verir; bu,
etiketin bir `git archive`'ini boş bir klasörde derleyip hash'leri karşılaştırarak doğrulanır.

Birim testlerinin ötesinde, 42 çevrimdışı kapı derlenmiş uzantıyı gerçek bir tarayıcıya yükler, onu çalıştırır
ve yaptığını doğrular; sayfa yerelde sunulur ve çeviri motoru yerelde yanıtlanır. Playwright gerekir, ve bu
bilerek bir bağımlılık değildir: `UX_KIT`'i `node_modules` klasöründe Playwright bulunan bir klasöre yönlendir
ya da `npm i -D playwright` çalıştır.

```bash
node test/e2e/run-gates.mjs --headless                  # 42'sinin hepsi, pencere yok
node test/e2e/store-shots-fixture.mjs --lang=ja         # mağaza görüntüleri, tek bir mağaza dilinde
node test/e2e/store-shots-fixture.mjs --gif             # İngilizce mağaza görüntüleri, README görselleri ve bu GIF
```

Arayüz metinleri `src/shared/i18n/` (açılır pencere ve seçenekler, İngilizce metne göre anahtarlı) ve
`src/content/i18n/` (sohbet çubuğu, kimliğe göre anahtarlı, İngilizce metin yedek olarak) içinde durur, dil
başına bir dosya; testler her dosyadan tam anahtar kümesini ister. Mağaza metinleri [store/](store/) içinde
durur, ve bir release bir sürüm etiketidir: CI onu derler, denetler ve iki mağazada da yayınlar.

Yığın: Manifest V3, Vite, TypeScript, Preact, Tailwind.

## İlgili projeler

- [kick-ad-blocker](https://github.com/Pkkls/kick-ad-blocker), Kick'in pre-roll ve bindirme reklamlarını engeller
- [kick-core](https://github.com/Pkkls/kick-core), bu uzantıların ortak kullandığı gerçek zamanlı ağ geçidi istemcisi
- [kickbus](https://github.com/Pkkls/kickbus), resmi Kick webhook'larını SSE ile yerel botlara aktarır
- [kick-drops-miner](https://github.com/Pkkls/kick-drops-miner), Kick drop izleme süresini ilerleten Windows uygulaması

## Lisans

MIT. Kick ile bağlantısı yok.
