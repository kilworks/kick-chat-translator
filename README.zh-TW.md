<div align="center">

<img src="public/icons/icon128.png" alt="" width="80" height="80">

# Kick Chat Translator

用你自己的語言看任何 Kick 直播的聊天室，再用頻道的語言回覆。<br>
免費、不用註冊帳號、什麼都不用設定。支援 43 種語言，聊天室和擴充功能本身的介面都一樣。

**[加到 Chrome、Brave 或 Edge](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)** &nbsp;·&nbsp; **[加到 Firefox](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)** &nbsp;·&nbsp; [Discord](https://discord.gg/udDzxQRyQ9)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=Chrome%20Web%20Store&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Chrome users](https://img.shields.io/chrome-web-store/users/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=users&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Firefox Add-on](https://img.shields.io/amo/v/kick-chat-translator?label=Firefox%20Add-on&color=53fc18)](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)
[![CI](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Portugal)](README.pt-PT.md) · [Português (Brasil)](README.pt-BR.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Svenska](README.sv.md) · [Čeština](README.cs.md) · [Slovenčina](README.sk.md) · [Română](README.ro.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [العربية](README.ar.md) · [עברית](README.he.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [हिन्दी](README.hi.md) · [Suomi](README.fi.md) · [Norsk](README.no.md) · [Dansk](README.da.md) · [Ελληνικά](README.el.md) · [Magyar](README.hu.md) · [Български](README.bg.md) · [Català](README.ca.md) · [Slovenščina](README.sl.md) · [Eesti](README.et.md) · [Lietuvių](README.lt.md) · [Latviešu](README.lv.md) · [فارسی](README.fa.md) · [বাংলা](README.bn.md) · [தமிழ்](README.ta.md) · [Bahasa Melayu](README.ms.md) · [Filipino](README.tl.md) · [粵語](README.yue.md)

<img src="screenshots/demo.gif" alt="西班牙文聊天訊息一則接一則出現，每則下方都附上英文翻譯；接著輸入一則英文回覆，聊天輸入框上方跳出西班牙文預覽，按下 Tab 就會換成預覽的內容" width="360">

[看看它在真實聊天室的表現](https://www.youtube.com/watch?v=NoGJeUrwy9o)

</div>

## 運作方式

1. 安裝後打開任何一個 Kick 直播。聊天室頂端出現綠色列，就代表已經啟用。
2. 每則訊息一出現，翻譯就會直接顯示在它的下方，使用你瀏覽器的語言。直播和 VOD 重播都一樣。
3. 用你自己的語言打字回覆。輸入框上方的預覽會顯示頻道語言的版本：按 Tab 或點一下預覽，你打的內容就會被換成這個版本。

頻道的語言是直接從 Kick 讀取的，所以不用另外設定。兩種語言都能在設定裡更改，閱讀語言還可以依頻道分別記住。

## 功能一覽

- **43 種語言**，包含由右至左書寫的文字（阿拉伯文、希伯來文、波斯文），地區變體也分開處理
  （巴西葡萄牙文和歐洲葡萄牙文、簡體中文和繁體中文、粵語）
- **擴充功能本身也有這 43 種語言**：設定、彈出視窗和聊天列全部支援，從附旗幟的選單選擇
- **裝好就能免費用**，採用 Google 翻譯。想讓歐洲語言翻得更好，可以加上你自己的免費 DeepL 金鑰；
  某個引擎掛掉時，MyMemory 和 Lingva 會接手
- **裝置端翻譯**：Chrome 和 Edge 在瀏覽器有提供時可以使用，22 毫秒就翻好，不用等 1.6 秒，
  文字也不會離開你的電腦
- **篩選**：略過機器人、將使用者或頻道靜音、隱藏含有特定字詞的訊息、只翻譯你選的語言
- **為高速聊天室而生**：7TV 表情符號原樣保留，表情符號洗版和連結在送出前就先濾掉，另外有給引擎常翻錯的名字用的詞彙表，以及翻譯快取
- **四種顯示樣式**：訊息下方、同一行、直接取代原文，或只在滑鼠移過時顯示
- **只暫停單一頻道**，直接在聊天列操作，其他頻道不受影響。切換頻道或更新擴充功能後，已開啟的分頁會繼續翻譯，不用重新整理
- 支援 Chrome、Brave、Edge 和 Firefox

| 聊天室邊捲動邊翻譯 | 工具列彈出視窗 |
|---|---|
| <img src="screenshots/chat.png" alt="Kick 聊天室，每則西班牙文訊息下方都有英文翻譯，清單上方是擴充功能的狀態列" width="360"> | <img src="screenshots/popup.png" alt="擴充功能的彈出視窗，顯示目標語言、顯示樣式、翻譯服務清單和今天的請求次數" width="360"> |

| 送出前，你打的內容 | 自己選語言，或讓它幫你選 |
|---|---|
| <img src="screenshots/compose.png" alt="輸入框裡有一則英文訊息，上方的預覽顯示即將送出的西班牙文版本" width="360"> | <img src="screenshots/languages.png" alt="可搜尋的語言旗幟與名稱格狀清單，頻道本身的語言排在最前面" width="360"> |

<sub>截圖取自正式發行版本，拍攝於本儲存庫自行虛構的聊天室：使用者名稱和訊息都是編的，翻譯也是在本機回應，
所以這個頁面上不會出現任何真人的帳號名稱。</sub>

## 安裝

[Chrome、Brave、Edge：Chrome Web Store](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
&nbsp;·&nbsp;
[Firefox：Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)

從商店安裝的版本會自動更新。

<details>
<summary>從發行的 zip 手動安裝</summary>

從 [Releases](https://github.com/Pkkls/kick-chat-translator/releases/latest) 下載適用於你瀏覽器的 zip 並解壓縮。

- Chrome、Brave、Edge（`…-chromium.zip`）：打開 `chrome://extensions`，開啟開發人員模式，按一下「載入未封裝項目」，選擇該資料夾。
- Firefox 121+（`…-firefox.zip`）：打開 `about:debugging#/runtime/this-firefox`，按一下「載入暫時性附加元件」，選擇 `manifest.json`。

如果商店版本也有裝，請先把它關掉，不然每則訊息都會被翻兩次。這樣安裝的版本不會自動更新：有新版本時，圖示會出現徽章，
彈出視窗也會連到商店。

</details>

## 翻譯引擎

四個翻譯服務串在一起：一個失敗，下一個就接手。順序由你決定。

| 服務 | 金鑰 | 說明 |
|---|---|---|
| Google | 不需要 | 預設值，裝好就能用 |
| DeepL | 免費 | 品質最好，[免費金鑰](https://www.deepl.com/pro-api)每月 100 萬字元 |
| MyMemory | 不需要 | 備援 |
| Lingva | 不需要 | 備援，預設使用公開的伺服器，也可以改指向你自己架的 |

Chromium 內建的翻譯器比上面所有的都快。在真實頻道上實測：從訊息出現到翻譯顯示在畫面上只要 22 毫秒，
走雲端鏈則要 1618 毫秒，而且不用網路、沒有額度限制。Chrome 和 Edge 138 以上的版本可能提供這項功能，
但不是每個安裝都有，而且每個語言配對都要下載一次模型，在聊天列上點一下就行。Firefox 沒有這項功能。
只要沒有它，就由雲端鏈接手，一切照常運作。

## 設定

點聊天列上的齒輪，或在擴充功能圖示上按右鍵，選「選項」。

- **翻譯服務**：引擎順序、你的 DeepL 金鑰，以及模式：優先使用裝置端、優先使用雲端，或僅使用裝置端
- **顯示**：目標語言、顯示樣式、原文和語言標籤、文字大小、行距、字型、強調色、聊天室主題、輸入預覽，以及點它之後的動作
- **篩選**：機器人、使用者、頻道、關鍵字、來源語言，以及用來替換字詞的詞彙表
- **進階**：快取大小和有效時間、同時翻譯數、每個頻道的請求上限、備份和還原
- **動態**：已翻譯的訊息、快取命中、聊天室中出現過的每種語言，以及最近 50 則訊息各自被翻譯或略過的原因
- **鍵盤**：Alt+T 開關聊天室翻譯，Alt+W 開關輸入預覽
- 聊天室動作列上的語言按鈕：按一下在頻道語言和你上次選的語言之間切換，長按會打開清單，輸入兩個字母就能篩選

## 支援的語言

英文 · 法文 · 西班牙文 · 葡萄牙文 · 葡萄牙文（巴西） · 德文 · 義大利文 · 荷蘭文 · 波蘭文 · 瑞典文 · 捷克文 · 斯洛伐克文 · 羅馬尼亞文 · 俄文 · 烏克蘭文 · 土耳其文 · 阿拉伯文 · 希伯來文 · 日文 · 韓文 · 中文（簡體） · 中文（繁體） · 泰文 · 越南文 · 印尼文 · 印地文 · 芬蘭文 · 挪威文 · 丹麥文 · 希臘文 · 匈牙利文 · 保加利亞文 · 加泰隆尼亞文 · 斯洛維尼亞文 · 愛沙尼亞文 · 立陶宛文 · 拉脫維亞文 · 波斯文 · 孟加拉文 · 泰米爾文 · 馬來文 · 菲律賓文 · 粵語

聊天室可以翻譯成其中任何一種，擴充功能本身的介面也都有對應的語言。

## 隱私

沒有帳號，也沒有我的伺服器。除非你同意，否則沒有分析追蹤；同意後每天只傳一次匿名計數到 Google Analytics（使用的引擎、錯誤與速度），絕不包含你的訊息、名稱或頻道。聊天訊息只會送到你選的翻譯服務，不會送到其他地方，
在裝置端模式下連翻譯服務都不會送。從商店安裝的版本不會發出其他任何請求。手動安裝的版本最多每六小時
向 GitHub 查詢一次最新的發行標籤，用來決定要不要顯示更新徽章。[詳細說明](PRIVACY.md)

## 常見問題

**訊息沒有被翻譯。**
打開設定裡的「動態」分頁，按下「讀取判斷」：它會列出最近 50 則訊息，並說明每一則被翻譯或略過的原因。
大多數被略過的訊息都是刻意略過的。在一場直播中，234 則裡有 213 則是同一個使用者在重複發言，9 則太短，
7 則只有表情符號或笑聲，1 則本來就是閱讀語言。如果分頁裡完全沒有東西，代表擴充功能沒看到聊天室：請開一個 issue。

**綠色列不見了。**
重新整理頁面。如果又發生，請開一個 [issue](https://github.com/Pkkls/kick-chat-translator/issues)，
附上頻道和你之前做了什麼。

**怎麼讓翻譯更好？**
在設定裡加上免費的 DeepL 金鑰。免費額度每月 100 萬字元，而且 DeepL 只會用在它比免費引擎強的語言配對上。

**該用哪一種顯示樣式？**
訊息下方。另外三種也能用，還在持續調整。

**擴充功能本身可以用我的語言嗎？**
可以。它會跟著瀏覽器的語言走，設定頂端的選單可以切換成這 43 種語言的任何一種。

**VOD 重播也能用嗎？**
可以，跟直播一樣。

**Kick 更新後壞掉了。**
Kick 有時會改動聊天室的架構。開一個 [issue](https://github.com/Pkkls/kick-chat-translator/issues)，
就會修好。

**這是 Kick 官方做的嗎？**
不是。這是獨立的開源專案，與 Kick 無關。

## 新增內容

3.2.0 版：

- 設定、彈出視窗和聊天列現在支援擴充功能能翻譯的全部 43 種語言，不再只有 10 種，希伯來文和波斯文也和阿拉伯文一樣由右至左顯示
- 原本就支援的十種語言全部重寫，讀起來像直接用那種語言寫的，而不是從英文逐字翻過來
- 介面語言選單會顯示每種語言的旗幟，也可以用鍵盤操作

每個版本的完整內容，包括改了什麼和背後的實測數據：
[Releases](https://github.com/Pkkls/kick-chat-translator/releases) 和 [CHANGELOG.md](CHANGELOG.md)。

## 開發

```bash
git clone https://github.com/Pkkls/kick-chat-translator.git
cd kick-chat-translator
npm ci
npm run release:check    # typecheck, lint, unit tests, build: the gate every package goes through
npm run build:firefox    # Firefox build, same dist/ folder
npm run package:all      # both zips, in release/
npm run dev              # HMR
```

建置可以重現：同一個 commit 在任何機器上都會產出位元組完全相同的 zip，驗證方式是在空資料夾裡建置該 tag 的
`git archive`，再比對雜湊值。

除了單元測試，另有 42 個離線測試關卡，會把建置好的擴充功能載入真實瀏覽器，實際操作並檢查它的行為，
頁面由本機提供，翻譯引擎也由本機回應。這些關卡需要 Playwright，但它刻意不列為相依套件：請把 `UX_KIT`
指向一個 `node_modules` 裡有 Playwright 的資料夾，或執行 `npm i -D playwright`。

```bash
node test/e2e/run-gates.mjs --headless                  # all 42, no window
node test/e2e/store-shots-fixture.mjs --lang=ja         # the store screenshots, in one listing language
node test/e2e/store-shots-fixture.mjs --gif             # English store screenshots, the README images and this GIF
```

介面字串放在 `src/shared/i18n/`（彈出視窗和選項，以英文原文當 key）和
`src/content/i18n/`（聊天列，以 id 當 key，英文原文當後備），每種語言一個檔案；
測試會要求每個檔案都具備完整的 key。商店文案放在 [store/](store/)，發行就是打一個版本 tag：CI 會建置、檢查，
並發布到兩個商店。

技術棧：Manifest V3、Vite、TypeScript、Preact、Tailwind。

## 相關專案

- [kick-ad-blocker](https://github.com/Pkkls/kick-ad-blocker)，封鎖 Kick 的前貼片廣告和浮層廣告
- [kick-core](https://github.com/Pkkls/kick-core)，這些擴充功能共用的即時閘道用戶端
- [kickbus](https://github.com/Pkkls/kickbus)，透過 SSE 將 Kick 官方 webhook 轉送給本機機器人
- [kick-drops-miner](https://github.com/Pkkls/kick-drops-miner)，在 Windows 上累計 Kick 掉寶觀看時數的應用程式

## 授權

MIT。與 Kick 無關。
