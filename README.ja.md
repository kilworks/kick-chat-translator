<div align="center">

<img src="public/icons/icon128.png" alt="" width="80" height="80">

# Kick Chat Translator

Kick のどの配信のチャットも自分の言語で読み、チャンネルの言語で返信できます。<br>
無料、アカウント不要、設定も不要。チャットでも拡張機能の画面でも、43 言語に対応。

**[Chrome、Brave、Edge に追加](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)** &nbsp;·&nbsp; **[Firefox に追加](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)** &nbsp;·&nbsp; [Discord](https://discord.gg/udDzxQRyQ9)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=Chrome%20Web%20Store&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Chrome users](https://img.shields.io/chrome-web-store/users/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=users&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Firefox Add-on](https://img.shields.io/amo/v/kick-chat-translator?label=Firefox%20Add-on&color=53fc18)](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)
[![CI](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Portugal)](README.pt-PT.md) · [Português (Brasil)](README.pt-BR.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Svenska](README.sv.md) · [Čeština](README.cs.md) · [Slovenčina](README.sk.md) · [Română](README.ro.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [العربية](README.ar.md) · [עברית](README.he.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [हिन्दी](README.hi.md) · [Suomi](README.fi.md) · [Norsk](README.no.md) · [Dansk](README.da.md) · [Ελληνικά](README.el.md) · [Magyar](README.hu.md) · [Български](README.bg.md) · [Català](README.ca.md) · [Slovenščina](README.sl.md) · [Eesti](README.et.md) · [Lietuvių](README.lt.md) · [Latviešu](README.lv.md) · [فارسی](README.fa.md) · [বাংলা](README.bn.md) · [தமிழ்](README.ta.md) · [Bahasa Melayu](README.ms.md) · [Filipino](README.tl.md) · [粵語](README.yue.md)

<img src="screenshots/demo.gif" alt="スペイン語のチャットが一件ずつ届き、それぞれの下に英語の訳が付く。続いて英語の返信を入力すると、チャット欄の上にスペイン語のプレビューが現れ、Tab で置き換わる" width="360">

[実際のチャットで動いている様子を見る](https://www.youtube.com/watch?v=NoGJeUrwy9o)

</div>

## 使い方

1. インストールして、Kick の配信を開きます。チャット上部の緑のバーが、動作中であることを示します。
2. メッセージが届くたびに、そのすぐ下にブラウザの言語で訳が表示されます。ライブ配信でも VOD のアーカイブでも同じです。
3. 返信は自分の言語で入力します。チャット欄の上にチャンネルの言語でプレビューが表示され、Tab を押すかクリックすると、入力した文がその訳に置き換わります。

チャンネルの言語は Kick から直接読み取るので、設定は要りません。どちらの言語も設定で変更でき、読む言語はチャンネルごとに記憶させることもできます。

## 主な機能

- **43 言語**。右から左に書く言語（アラビア語、ヘブライ語、ペルシア語）も含み、地域の変種は別扱いです（ブラジル・ポルトガル語とヨーロッパ・ポルトガル語、簡体字と繁体字の中国語、広東語）
- **拡張機能自体も 43 言語で表示**: 設定、ポップアップ、チャットのバーが対応し、国旗つきのメニューから選べます
- **そのまま無料**で使える Google 翻訳。ヨーロッパ言語の品質を上げたいなら、自分の無料 DeepL キーを追加できます。エンジンが失敗したときは MyMemory と Lingva が引き継ぎます
- **端末内翻訳**: ブラウザが提供する場合、Chrome と Edge で使えます。1.6 秒かかるところが 22 ms になり、テキストはマシンの外に出ません
- **フィルター**: ボットを飛ばす、ユーザーやチャンネルをミュート、特定の単語を含む行を隠す、選んだ言語だけを翻訳
- **流れの速いチャット向け**: 7TV のエモートはそのまま残し、絵文字の連投とリンクは送信前に取り除きます。エンジンが崩す名前のための用語集と、翻訳キャッシュもあります
- **四つの表示スタイル**: メッセージの下、同じ行、メッセージと置き換え、ホバー時のみ
- **一つのチャンネルだけ一時停止**: チャットバーから操作でき、ほかのチャンネルは止まりません。チャンネルを切り替えても、拡張機能を更新しても、開いているタブは再読み込みなしで翻訳を続けます
- Chrome、Brave、Edge、Firefox

| 流れるチャットをそのまま翻訳 | ツールバーのポップアップ |
|---|---|
| <img src="screenshots/chat.png" alt="スペイン語の各メッセージの下に英語の訳が付いた Kick のチャット。一覧の上に拡張機能のステータスバー" width="360"> | <img src="screenshots/popup.png" alt="翻訳先の言語、表示モード、プロバイダーの一覧、その日のリクエスト数が並ぶ拡張機能のポップアップ" width="360"> |

| 送信する前の入力文 | 言語を選ぶ、または任せる |
|---|---|
| <img src="screenshots/compose.png" alt="英語のメッセージが入ったチャット欄と、その上に送信されるスペイン語版のプレビュー" width="360"> | <img src="screenshots/languages.png" alt="国旗と言語名を検索できる一覧。チャンネルの言語が先頭" width="360"> |

<sub>このリポジトリが作った架空のチャットルームで、公開中のビルドから撮影しています。ユーザー名とメッセージは架空で、翻訳はローカルで返しているため、実在の人のハンドルはこのページに載りません。</sub>

## インストール

[Chrome、Brave、Edge: Chrome ウェブストア](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
&nbsp;·&nbsp;
[Firefox: Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)

ストア版は自動で更新されます。

<details>
<summary>リリースの zip から手動でインストール</summary>

[Releases](https://github.com/Pkkls/kick-chat-translator/releases/latest) からブラウザに合った zip をダウンロードして展開します。

- Chrome、Brave、Edge（`…-chromium.zip`）: `chrome://extensions` を開き、デベロッパーモードをオンにして「パッケージ化されていない拡張機能を読み込む」からフォルダを選びます。
- Firefox 121 以降（`…-firefox.zip`）: `about:debugging#/runtime/this-firefox` を開き、「一時的なアドオンを読み込む」から `manifest.json` を選びます。

ストア版も入っている場合は先にオフにしてください。そうしないと、すべてのメッセージが二重に翻訳されます。この方法で入れたものは自動更新されません。新しいバージョンがあるとアイコンにバッジが付き、ポップアップからストアに移動できます。

</details>

## 翻訳エンジン

四つのプロバイダーをつないでいます。一つが失敗すると次が引き継ぎます。順番は自分で決められます。

| プロバイダー | キー | 備考 |
|---|---|---|
| Google | 不要 | 既定、すぐに使えます |
| DeepL | 無料 | 最高品質、[無料キー](https://www.deepl.com/pro-api)で月 100 万文字 |
| MyMemory | 不要 | 予備 |
| Lingva | 不要 | 予備、自分のインスタンスを指定しない限り公開インスタンス |

Chromium 内蔵の翻訳機はどれよりも速く動きます。ライブ配信で計測すると、メッセージが現れてから訳が画面に出るまで 22 ms、クラウド経由では 1618 ms でした。ネットワークもクォータも使いません。Chrome と Edge 138 以降で使える場合がありますが、すべての環境で使えるわけではなく、言語ペアごとにバーからワンクリックでモデルを一度ダウンロードする必要があります。Firefox にはありません。使えない環境ではクラウドが引き継ぎ、何も壊れません。

## 設定

チャットのバーの歯車をクリックするか、拡張機能のアイコンを右クリックして「オプション」を選びます。

- **プロバイダー**: エンジンの順番、DeepL キー、モード（端末内を優先、クラウドを優先、端末内のみ）
- **表示**: 翻訳先の言語、表示スタイル、原文と翻訳元言語のバッジ、文字サイズ、行間、書体、アクセントカラー、チャットのテーマ、入力プレビューとそのクリック時の動作
- **フィルター**: ボット、ユーザー、チャンネル、キーワード、翻訳元の言語、置換の用語集
- **詳細**: キャッシュのサイズと期限、同時リクエスト数、チャンネルごとのレート制限、バックアップと復元
- **アクティビティ**: 翻訳したメッセージ数、キャッシュのヒット、チャットで見かけた全言語、直近 50 行それぞれを訳した理由と訳さなかった理由
- **キーボード**: Alt+T でチャット翻訳、Alt+W で入力プレビューをオン・オフ
- チャットのアクションバーにある言語ボタン: クリックでチャンネルの言語と直前の選択を切り替え、長押しで一覧、二文字入力で絞り込み

## 対応言語

英語 · フランス語 · スペイン語 · ポルトガル語 · ポルトガル語（ブラジル） · ドイツ語 · イタリア語 · オランダ語 · ポーランド語 · スウェーデン語 · チェコ語 · スロバキア語 · ルーマニア語 · ロシア語 · ウクライナ語 · トルコ語 · アラビア語 · ヘブライ語 · 日本語 · 韓国語 · 中国語（簡体字） · 中国語（繁体字） · タイ語 · ベトナム語 · インドネシア語 · ヒンディー語 · フィンランド語 · ノルウェー語 · デンマーク語 · ギリシャ語 · ハンガリー語 · ブルガリア語 · カタルーニャ語 · スロベニア語 · エストニア語 · リトアニア語 · ラトビア語 · ペルシア語 · ベンガル語 · タミル語 · マレー語 · フィリピン語 · 広東語

チャットはどの言語にも翻訳でき、拡張機能自体の画面もそれぞれの言語で表示できます。

## プライバシー

アカウントも私のサーバーもありません。アクセス解析は、同意した場合に1日1回 Google Analytics へ送る匿名集計（使ったエンジン、エラー、速度）だけで、メッセージ、名前、チャンネルは一切送りません。チャットのメッセージは選んだ翻訳プロバイダーにだけ送られ、端末内モードではそこにも送られません。ストアから入れた拡張機能はほかに何も通信しません。手動で入れたものは、更新バッジを出すかどうかを知るために、最長で六時間に一度 GitHub に最新リリースのタグを問い合わせます。[詳細](PRIVACY.md)

## よくある質問

**メッセージが翻訳されない。**
設定のアクティビティタブで「決定を読む」を押してください。直近 50 行と、それぞれを訳した理由、訳さなかった理由が表示されます。飛ばされた行のほとんどは意図的です。あるライブ配信では、234 行のうち 213 行が同じユーザーの繰り返し、9 行が短すぎ、7 行が絵文字や笑いだけ、1 行がすでに読む言語でした。タブに何も表示されない場合は拡張機能がチャットを見つけられていないので、issue を開いてください。

**緑のバーが消えた。**
ページを再読み込みしてください。また起きたら、チャンネルとその前にしたことを添えて [issue](https://github.com/Pkkls/kick-chat-translator/issues) を開いてください。

**翻訳の質を上げるには？**
設定で無料の DeepL キーを追加してください。無料枠は月 100 万文字で、DeepL は無料エンジンより良くなる言語ペアにだけ使われます。

**どの表示スタイルを使えばいい？**
メッセージの下です。ほかの三つも動きますが、まだ調整中です。

**拡張機能を自分の言語で使える？**
はい。ブラウザの言語に合わせて表示され、設定の上部にあるメニューから 43 言語のどれにも切り替えられます。

**VOD のアーカイブでも動く？**
はい、ライブ配信と同じように動きます。

**Kick の更新のあとで動かなくなった。**
Kick はときどきチャットの構造を変えます。[issue](https://github.com/Pkkls/kick-chat-translator/issues) を開いてもらえれば修正します。

**Kick の公式？**
いいえ。Kick とは関係のない、独立したオープンソースのプロジェクトです。

## 新機能

3.2.0 の変更点：

- 設定、ポップアップ、チャットのバーが、拡張機能が翻訳する43言語すべてで表示されます（従来は10言語）。ヘブライ語とペルシア語はアラビア語と同じく右から左です
- すでに対応していた10言語は、英語からの直訳ではなく、その言語で書かれたように自然に読めるよう書き直しました
- 表示言語のメニューには各言語の国旗が表示され、キーボードでも操作できます

各リリースの変更点とその裏付けの計測は
[Releases](https://github.com/Pkkls/kick-chat-translator/releases) と [CHANGELOG.md](CHANGELOG.md) にあります。

## 開発

```bash
git clone https://github.com/Pkkls/kick-chat-translator.git
cd kick-chat-translator
npm ci
npm run release:check    # typecheck, lint, unit tests, build: the gate every package goes through
npm run build:firefox    # Firefox build, same dist/ folder
npm run package:all      # both zips, in release/
npm run dev              # HMR
```

ビルドは再現可能です。同じコミットからは、どのマシンでもバイト単位で同一の zip ができます。確認は、タグの `git archive` を空のフォルダでビルドしてハッシュを比べて行います。

ユニットテストに加えて、42 のオフラインゲートがビルド済みの拡張機能を実際のブラウザに読み込み、操作して、その動作を検証します。ページはローカルで配信し、翻訳エンジンの応答もローカルです。Playwright が必要ですが、意図的に依存関係には入れていません。`node_modules` に Playwright が入っているフォルダを `UX_KIT` で指定するか、`npm i -D playwright` を実行してください。

```bash
node test/e2e/run-gates.mjs --headless                  # all 42, no window
node test/e2e/store-shots-fixture.mjs --lang=ja         # the store screenshots, in one listing language
node test/e2e/store-shots-fixture.mjs --gif             # English store screenshots, the README images and this GIF
```

インターフェースの文字列は `src/shared/i18n/`（ポップアップとオプション、英語の文をキーにしています）と `src/content/i18n/`（チャットのバー、id をキーにして英語の文を代替とします）にあり、言語ごとに 1 ファイルです。テストはすべてのファイルに完全なキーの集合を求めます。ストア向けの文章は [store/](store/) にあり、リリースはバージョンタグです。CI がビルドと検査を行い、両方のストアに公開します。

技術スタック: Manifest V3、Vite、TypeScript、Preact、Tailwind。

## 関連プロジェクト

- [kick-ad-blocker](https://github.com/Pkkls/kick-ad-blocker)、Kick のプレロール広告とオーバーレイ広告をブロック
- [kick-core](https://github.com/Pkkls/kick-core)、これらの拡張機能で共有するリアルタイムゲートウェイのクライアント
- [kickbus](https://github.com/Pkkls/kickbus)、Kick の公式 Webhook を SSE でローカルのボットに中継
- [kick-drops-miner](https://github.com/Pkkls/kick-drops-miner)、Kick のドロップの視聴時間を進める Windows アプリ

## ライセンス

MIT。Kick とは関係ありません。
