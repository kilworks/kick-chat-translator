<div align="center">

<img src="public/icons/icon128.png" alt="" width="80" height="80">

# Kick Chat Translator

Kick의 어떤 방송 채팅이든 자기 언어로 읽고, 채널의 언어로 답할 수 있습니다.<br>
무료, 계정 불필요, 따로 설정할 것도 없습니다. 채팅에서도 확장 프로그램 화면에서도 43개 언어.

**[Chrome, Brave, Edge에 추가](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)** &nbsp;·&nbsp; **[Firefox에 추가](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)** &nbsp;·&nbsp; [Discord](https://discord.gg/udDzxQRyQ9)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=Chrome%20Web%20Store&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Chrome users](https://img.shields.io/chrome-web-store/users/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=users&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Firefox Add-on](https://img.shields.io/amo/v/kick-chat-translator?label=Firefox%20Add-on&color=53fc18)](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)
[![CI](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Portugal)](README.pt-PT.md) · [Português (Brasil)](README.pt-BR.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Svenska](README.sv.md) · [Čeština](README.cs.md) · [Slovenčina](README.sk.md) · [Română](README.ro.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [العربية](README.ar.md) · [עברית](README.he.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [हिन्दी](README.hi.md) · [Suomi](README.fi.md) · [Norsk](README.no.md) · [Dansk](README.da.md) · [Ελληνικά](README.el.md) · [Magyar](README.hu.md) · [Български](README.bg.md) · [Català](README.ca.md) · [Slovenščina](README.sl.md) · [Eesti](README.et.md) · [Lietuvių](README.lt.md) · [Latviešu](README.lv.md) · [فارسی](README.fa.md) · [বাংলা](README.bn.md) · [தமிழ்](README.ta.md) · [Bahasa Melayu](README.ms.md) · [Filipino](README.tl.md) · [粵語](README.yue.md)

<img src="screenshots/demo.gif" alt="스페인어 채팅 메시지가 하나씩 도착하고 각각 아래에 영어 번역이 붙습니다. 이어서 영어 답장을 입력하면 채팅창 위에 스페인어 미리보기가 나타나고 Tab으로 바꿔 넣습니다" width="360">

[실제 채팅에서 작동하는 모습 보기](https://www.youtube.com/watch?v=NoGJeUrwy9o)

</div>

## 작동 방식

1. 설치하고 아무 Kick 방송이나 여세요. 채팅 위쪽의 초록색 바가 작동 중임을 알려 줍니다.
2. 메시지가 도착하는 대로 바로 아래에 브라우저 언어로 번역이 붙습니다. 생방송에서도 다시보기에서도
   마찬가지입니다.
3. 답장은 내 언어로 입력하세요. 채팅창 위의 미리보기에 채널 언어로 된 버전이 나타납니다. Tab을 누르거나
   클릭하면 입력한 내용이 그 버전으로 바뀝니다.

채널의 언어는 Kick에서 직접 읽어 오므로 설정할 것이 없습니다. 두 언어 모두 설정에서 바꿀 수 있고, 읽기
언어는 채널마다 기억시킬 수 있습니다.

## 제공하는 기능

- **43개 언어**. 오른쪽에서 왼쪽으로 쓰는 문자(아랍어, 히브리어, 페르시아어)도 포함하며, 지역 변형은
  따로 구분합니다(브라질 포르투갈어와 유럽 포르투갈어, 간체와 번체 중국어, 광둥어)
- **확장 프로그램 자체도 43개 언어로 표시**: 설정, 팝업, 채팅 바가 모두 대응하며 국기가 표시된 메뉴에서
  고릅니다
- **설치만 하면 무료**인 Google 번역. 유럽 언어의 품질을 높이려면 무료 DeepL 키를 직접 추가하세요.
  엔진이 실패하면 MyMemory와 Lingva가 넘겨받습니다
- **기기 내 번역**: 브라우저가 지원하는 Chrome과 Edge에서 사용할 수 있습니다. 1.6초 대신 22ms, 텍스트가
  내 컴퓨터를 떠나지 않습니다
- **필터**: 봇 건너뛰기, 사용자나 채널 숨기기, 특정 단어가 들어간 줄 숨기기, 고른 언어만 번역하기
- **빠른 채팅에 맞춘 설계**: 7TV 이모트는 그대로 두고, 이모지 도배와 링크는 전송 전에 제거하며, 번역
  엔진이 망가뜨리는 이름을 위한 용어집과 번역 캐시가 있습니다
- **네 가지 표시 방식**: 메시지 아래, 같은 줄, 메시지 대신, 마우스를 올렸을 때만
- **한 채널만 일시 중지**: 채팅 바에서 하면 다른 채널은 멈추지 않습니다. 채널을 바꾸거나 확장 프로그램을
  업데이트해도 열린 탭은 새로 고침 없이 계속 번역합니다
- Chrome, Brave, Edge, Firefox

| 스크롤되는 대로 번역되는 채팅 | 툴바 팝업 |
|---|---|
| <img src="screenshots/chat.png" alt="스페인어 메시지마다 아래에 영어 번역이 붙은 Kick 채팅과, 목록 위의 확장 프로그램 상태 바" width="360"> | <img src="screenshots/popup.png" alt="번역 대상 언어, 표시 방식, 번역 엔진 목록, 오늘의 요청 수가 보이는 확장 프로그램 팝업" width="360"> |

| 보내기 전에 입력한 내용 | 언어를 고르거나 맡기기 |
|---|---|
| <img src="screenshots/compose.png" alt="영어 메시지가 들어 있는 입력창과, 그 위에 보내질 스페인어 버전을 보여 주는 미리보기" width="360"> | <img src="screenshots/languages.png" alt="채널의 언어가 맨 앞에 오는, 검색 가능한 언어 국기와 이름 목록" width="360"> |

<sub>이 저장소가 직접 만드는 채팅방에서 배포 빌드로 찍었습니다. 사용자 이름과 메시지는 지어낸 것이고
번역은 로컬에서 응답하므로, 실제 사람의 닉네임은 이 페이지에 나오지 않습니다.</sub>

## 설치

[Chrome, Brave, Edge: Chrome Web Store](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
&nbsp;·&nbsp;
[Firefox: Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)

스토어에서 설치한 버전은 자동으로 업데이트됩니다.

<details>
<summary>릴리스 zip으로 직접 설치하기</summary>

[Releases](https://github.com/Pkkls/kick-chat-translator/releases/latest)에서 브라우저에 맞는 zip을 내려받아 압축을 풉니다.

- Chrome, Brave, Edge(`…-chromium.zip`): `chrome://extensions`를 열고 개발자 모드를 켠 뒤, 압축해제된 확장 프로그램 로드를 눌러 폴더를 고릅니다.
- Firefox 121+(`…-firefox.zip`): `about:debugging#/runtime/this-firefox`를 열고 임시 부가 기능 로드를 눌러 `manifest.json`을 고릅니다.

스토어 버전도 설치되어 있다면 먼저 끄세요. 그렇지 않으면 모든 메시지가 두 번 번역됩니다. 이렇게 설치한
버전은 자동으로 업데이트되지 않습니다. 새 버전이 나오면 아이콘에 배지가 붙고, 팝업에서 스토어로
연결됩니다.

</details>

## 번역 엔진

네 개의 제공자가 사슬처럼 이어집니다. 하나가 실패하면 다음이 넘겨받습니다. 순서는 직접 정합니다.

| 제공자 | 키 | 참고 |
|---|---|---|
| Google | 없음 | 기본값, 바로 동작 |
| DeepL | 무료 | 최고 품질, 월 100만 자 [무료 키](https://www.deepl.com/pro-api) |
| MyMemory | 없음 | 예비 |
| Lingva | 없음 | 예비, 자체 인스턴스를 지정하지 않으면 공개 인스턴스 사용 |

Chromium에 내장된 번역기는 이들 모두보다 빠릅니다. 실제 채널에서 측정한 결과, 메시지가 나타나서 번역이
화면에 뜨기까지 22ms였고 클라우드 사슬은 1618ms였습니다. 네트워크도 할당량도 필요 없습니다. Chrome과
Edge 138 이상에서 제공될 수 있지만 모든 설치본에서 되는 것은 아니며, 언어 쌍마다 바에서 한 번 클릭해
모델을 한 번 내려받아야 합니다. Firefox에는 없습니다. 없는 곳에서는 클라우드 사슬이 넘겨받으므로
아무것도 깨지지 않습니다.

## 설정

채팅 바의 톱니바퀴를 누르거나, 확장 프로그램 아이콘을 오른쪽 클릭해 옵션을 고르세요.

- **제공자**: 엔진 순서, DeepL 키, 모드(기기 내 우선, 클라우드 우선, 기기 내만)
- **표시**: 번역 대상 언어, 표시 방식, 원문과 원본 언어 배지, 글자 크기, 줄 간격, 글꼴, 강조 색, 채팅
  테마, 작성 미리보기와 클릭했을 때의 동작
- **필터**: 봇, 사용자, 채널, 키워드, 원본 언어, 바꾸기 용어집
- **고급**: 캐시 크기와 보존 기간, 동시 요청 수, 채널별 속도 제한, 백업과 복원
- **활동**: 번역한 메시지, 캐시 적중, 채팅에서 본 모든 언어, 그리고 마지막 50줄 각각이 번역되었거나 그대로
  남은 이유
- **키보드**: Alt+T로 채팅 번역을 켜고 끄며, Alt+W로 작성 미리보기를 켜고 끕니다
- 채팅 작업 바의 언어 버튼: 한 번 클릭하면 채널 언어와 마지막 선택 사이를 오가고, 길게 누르면 목록이
  열리며, 두 글자를 입력하면 걸러집니다

## 지원 언어

영어 · 프랑스어 · 스페인어 · 포르투갈어 · 포르투갈어(브라질) · 독일어 · 이탈리아어 · 네덜란드어 · 폴란드어 · 스웨덴어 · 체코어 · 슬로바키아어 · 루마니아어 · 러시아어 · 우크라이나어 · 튀르키예어 · 아랍어 · 히브리어 · 일본어 · 한국어 · 중국어(간체) · 중국어(번체) · 태국어 · 베트남어 · 인도네시아어 · 힌디어 · 핀란드어 · 노르웨이어 · 덴마크어 · 그리스어 · 헝가리어 · 불가리아어 · 카탈루냐어 · 슬로베니아어 · 에스토니아어 · 리투아니아어 · 라트비아어 · 페르시아어 · 벵골어 · 타밀어 · 말레이어 · 필리핀어 · 광둥어

채팅은 이 중 어느 언어로든 번역할 수 있고, 확장 프로그램 자체 화면도 각 언어로 볼 수 있습니다.

## 개인정보

계정도, 제 서버도 없습니다. 분석은 동의한 경우에만 하루 한 번 Google Analytics로 보내는 익명 집계(사용한 엔진, 오류, 속도)뿐이며 메시지, 이름, 채널은 절대 보내지 않습니다. 채팅 메시지는 고른 번역 제공자에게만 가고, 기기 내 모드에서는
그곳에도 가지 않습니다. 스토어에서 설치한 버전은 그 밖의 요청을 하지 않습니다. 직접 설치한 버전은
업데이트 배지를 보여 줄지 알기 위해 최대 6시간에 한 번 GitHub에 최신 릴리스 태그를 묻습니다.
[자세히](PRIVACY.md)

## 자주 묻는 질문

**메시지가 번역되지 않아요.**
설정의 활동 탭을 열고 "Read decisions"를 누르세요. 마지막 50줄을 보여 주고, 각 줄이 번역되었거나 그대로
남은 이유를 알려 줍니다. 건너뛴 줄은 대부분 의도된 것입니다. 한 번의 생방송에서 234줄 중 213줄은 같은
사용자의 반복이었고, 9줄은 너무 짧았고, 7줄은 이모지나 웃음뿐이었으며, 1줄은 이미 읽기 언어였습니다.
탭에 아무것도 나오지 않으면 확장 프로그램이 채팅을 보지 못하는 것이니 이슈를 열어 주세요.

**초록색 바가 사라졌어요.**
페이지를 새로 고치세요. 다시 그러면 채널과 그 전에 한 일을 적어
[이슈](https://github.com/Pkkls/kick-chat-translator/issues)를 열어 주세요.

**번역 품질을 높이려면?**
설정에서 무료 DeepL 키를 추가하세요. 무료 요금제는 월 100만 자이며, DeepL은 무료 엔진보다 나은 언어
쌍에서만 사용됩니다.

**어떤 표시 방식을 써야 하나요?**
메시지 아래입니다. 나머지 세 가지도 동작하며 아직 다듬는 중입니다.

**확장 프로그램을 내 언어로 쓸 수 있나요?**
네. 브라우저 언어를 따르고, 설정 맨 위의 메뉴에서 43개 언어 중 어느 것으로든 바꿀 수 있습니다.

**다시보기에서도 작동하나요?**
네, 생방송과 똑같이 작동합니다.

**Kick 업데이트 후에 고장 났어요.**
Kick은 가끔 채팅의 구조를 바꿉니다. [이슈](https://github.com/Pkkls/kick-chat-translator/issues)를 열어
주시면 수정하겠습니다.

**Kick에서 만든 건가요?**
아니요. Kick과 무관한 독립적인 오픈소스 프로젝트입니다.

## 새로운 기능

3.2.0에서:

- 설정, 팝업, 채팅 바가 확장 프로그램이 번역하는 43개 언어 모두로 표시됩니다(이전에는 10개). 히브리어와 페르시아어는 아랍어처럼 오른쪽에서 왼쪽으로 표시됩니다
- 이미 지원하던 10개 언어는 영어를 그대로 옮긴 번역이 아니라 그 언어로 쓴 것처럼 읽히도록 다시 썼습니다
- 화면 언어 메뉴에 각 언어의 국기가 표시되고 키보드로도 조작할 수 있습니다

모든 릴리스의 변경 내용과 그 근거가 된 측정값은
[Releases](https://github.com/Pkkls/kick-chat-translator/releases)와 [CHANGELOG.md](CHANGELOG.md)에 있습니다.

## 개발

```bash
git clone https://github.com/Pkkls/kick-chat-translator.git
cd kick-chat-translator
npm ci
npm run release:check    # typecheck, lint, unit tests, build: the gate every package goes through
npm run build:firefox    # Firefox build, same dist/ folder
npm run package:all      # both zips, in release/
npm run dev              # HMR
```

빌드는 재현 가능합니다. 같은 커밋은 어느 컴퓨터에서든 바이트 단위로 동일한 zip을 만들며, 태그의
`git archive`를 빈 폴더에서 빌드해 해시를 비교하는 방식으로 확인합니다.

단위 테스트 외에도 42개의 오프라인 게이트가 빌드된 확장 프로그램을 실제 브라우저에 불러와 조작하고 그
동작을 검증합니다. 페이지는 로컬에서 제공하고 번역 엔진 응답도 로컬에서 처리합니다. Playwright가
필요하지만 의도적으로 의존성에 넣지 않았습니다. `node_modules`에 Playwright가 들어 있는 폴더를 `UX_KIT`로
지정하거나 `npm i -D playwright`를 실행하세요.

```bash
node test/e2e/run-gates.mjs --headless                  # all 42, no window
node test/e2e/store-shots-fixture.mjs --lang=ja         # the store screenshots, in one listing language
node test/e2e/store-shots-fixture.mjs --gif             # English store screenshots, the README images and this GIF
```

인터페이스 문자열은 `src/shared/i18n/`(팝업과 옵션, 영어 문구를 키로 사용)와 `src/content/i18n/`(채팅 바,
id를 키로 하고 영어 문구를 대체값으로 사용)에 언어마다 파일 하나씩 있으며, 테스트가 모든 파일에 전체 키
집합을 요구합니다. 스토어 문구는 [store/](store/)에 있고, 릴리스는 버전 태그입니다. CI가 빌드하고
검사해서 두 스토어에 게시합니다.

스택: Manifest V3, Vite, TypeScript, Preact, Tailwind.

## 관련 프로젝트

- [kick-ad-blocker](https://github.com/Pkkls/kick-ad-blocker), Kick의 프리롤 광고와 오버레이 광고를 차단
- [kick-core](https://github.com/Pkkls/kick-core), 이 확장 프로그램들이 공유하는 실시간 게이트웨이 클라이언트
- [kickbus](https://github.com/Pkkls/kickbus), Kick 공식 웹훅을 SSE로 로컬 봇에 전달
- [kick-drops-miner](https://github.com/Pkkls/kick-drops-miner), Kick 드롭의 시청 시간을 채워 주는 Windows 앱

## 라이선스

MIT. Kick과 무관합니다.
