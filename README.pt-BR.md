<div align="center">

<img src="public/icons/icon128.png" alt="" width="80" height="80">

# Kick Chat Translator

Leia o chat de qualquer live da Kick no seu idioma e responda na língua do canal.<br>
Grátis, sem conta, nada para configurar. 43 idiomas, no chat e na própria extensão.

**[Adicionar ao Chrome, Brave ou Edge](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)** &nbsp;·&nbsp; **[Adicionar ao Firefox](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)** &nbsp;·&nbsp; [Discord](https://discord.gg/udDzxQRyQ9)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=Chrome%20Web%20Store&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Usuários do Chrome](https://img.shields.io/chrome-web-store/users/nkkjmbkmacbdkboijmnhjnblcaiclhni?label=usu%C3%A1rios&color=53fc18)](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
[![Firefox Add-on](https://img.shields.io/amo/v/kick-chat-translator?label=Firefox%20Add-on&color=53fc18)](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)
[![CI](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/Pkkls/kick-chat-translator/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Portugal)](README.pt-PT.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Svenska](README.sv.md) · [Čeština](README.cs.md) · [Slovenčina](README.sk.md) · [Română](README.ro.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [العربية](README.ar.md) · [עברית](README.he.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) · [Bahasa Indonesia](README.id.md) · [हिन्दी](README.hi.md) · [Suomi](README.fi.md) · [Norsk](README.no.md) · [Dansk](README.da.md) · [Ελληνικά](README.el.md) · [Magyar](README.hu.md) · [Български](README.bg.md) · [Català](README.ca.md) · [Slovenščina](README.sl.md) · [Eesti](README.et.md) · [Lietuvių](README.lt.md) · [Latviešu](README.lv.md) · [فارسی](README.fa.md) · [বাংলা](README.bn.md) · [தமிழ்](README.ta.md) · [Bahasa Melayu](README.ms.md) · [Filipino](README.tl.md) · [粵語](README.yue.md)

<img src="screenshots/demo.gif" alt="Mensagens de chat em espanhol chegam uma a uma, cada uma com a tradução em inglês logo abaixo; depois uma resposta em inglês é digitada, uma prévia em espanhol aparece acima da caixa de chat e o Tab a coloca no lugar" width="360">

[Veja funcionando em um chat de verdade](https://www.youtube.com/watch?v=NoGJeUrwy9o)

</div>

## Como funciona

1. Instale e abra qualquer live da Kick. Uma barra verde no topo do chat indica que está ligada.
2. Cada mensagem ganha a tradução logo abaixo, à medida que chega, no idioma do seu navegador. Vale para
   lives e para replays de VOD.
3. Digite uma resposta no seu idioma. Uma prévia acima da caixa de chat a mostra no idioma do canal: aperte
   Tab ou clique nela, e essa versão substitui o que você digitou.

O idioma do canal é lido da própria Kick, então não há nada para configurar. Os dois idiomas podem ser
trocados nas configurações, e o idioma de leitura pode ser lembrado por canal.

## O que você leva

- **43 idiomas**, incluindo os escritos da direita para a esquerda (árabe, hebraico, persa), com as variantes
  regionais separadas (português do Brasil e de Portugal, chinês simplificado e tradicional, cantonês)
- **A extensão também fala todos eles**: configurações, janela e barra do chat nos 43, escolhidos num menu com bandeiras
- **Grátis de fábrica** com o Google Tradutor. Adicione sua própria chave gratuita do DeepL para melhorar os
  idiomas europeus; MyMemory e Lingva assumem quando um motor falha
- **Tradução no próprio dispositivo** no Chrome e no Edge quando o navegador oferece: 22 ms em vez de 1,6 s, e
  o texto nunca sai do seu computador
- **Filtros**: pular bots, silenciar usuários ou canais, esconder linhas que contenham uma palavra, traduzir
  só os idiomas que você escolher
- **Feita para chats rápidos**: emotes do 7TV mantidos como estão, spam de emoji e links removidos antes de
  qualquer envio, um glossário para os nomes que os motores estragam, um cache de traduções
- **Quatro estilos de exibição**: abaixo da mensagem, na mesma linha, no lugar dela, ou só ao passar o mouse
- **Pause um canal** pela barra do chat sem parar os outros. Ao trocar de canal ou atualizar a extensão,
  as abas abertas continuam traduzindo, sem recarregar
- Chrome, Brave, Edge e Firefox

| O chat, traduzido enquanto rola | A janela da barra de ferramentas |
|---|---|
| <img src="screenshots/chat.png" alt="Chat da Kick em que cada mensagem em espanhol traz a tradução em inglês logo abaixo, com a barra de status da extensão acima da lista" width="360"> | <img src="screenshots/popup.png" alt="A janela da extensão com o idioma de destino, o modo de exibição, a lista de provedores e as requisições do dia" width="360"> |

| O que você digita, antes de enviar | Escolha um idioma, ou deixe que ela escolha |
|---|---|
| <img src="screenshots/compose.png" alt="A caixa de chat com uma mensagem em inglês e, acima, uma prévia com a versão em espanhol que será enviada" width="360"> | <img src="screenshots/languages.png" alt="Uma grade pesquisável de bandeiras e nomes de idiomas, com o idioma do canal primeiro" width="360"> |

<sub>Capturas da versão publicada numa sala de chat que este repositório inventa: os nomes e as mensagens são
fictícios e as traduções são respondidas localmente, então nenhum usuário real aparece aqui.</sub>

## Instalação

[Chrome, Brave, Edge: Chrome Web Store](https://chromewebstore.google.com/detail/kick-chat-translator/nkkjmbkmacbdkboijmnhjnblcaiclhni)
&nbsp;·&nbsp;
[Firefox: Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/kick-chat-translator/)

As cópias das lojas se atualizam sozinhas.

<details>
<summary>Instalação manual, a partir de um zip de release</summary>

Baixe o zip do seu navegador em [Releases](https://github.com/Pkkls/kick-chat-translator/releases/latest) e descompacte.

- Chrome, Brave, Edge (`…-chromium.zip`): abra `chrome://extensions`, ative o Modo do desenvolvedor, clique em Carregar sem compactação e escolha a pasta.
- Firefox 121+ (`…-firefox.zip`): abra `about:debugging#/runtime/this-firefox`, clique em Carregar extensão temporária e escolha `manifest.json`.

Se a versão da loja também estiver instalada, desative-a primeiro, senão cada mensagem é traduzida duas vezes.
Uma cópia instalada assim não se atualiza sozinha: o ícone dela mostra um selo quando existe uma versão nova,
e a janela leva à loja.

</details>

## Motores de tradução

Quatro provedores encadeados: quando um falha, o próximo assume. A ordem é você quem define.

| Provedor | Chave | Observação |
|---|---|---|
| Google | nenhuma | o padrão, funciona de fábrica |
| DeepL | gratuita | a melhor qualidade, [chave gratuita](https://www.deepl.com/pro-api) para 1 milhão de caracteres por mês |
| MyMemory | nenhuma | reserva |
| Lingva | nenhuma | reserva, numa instância pública a menos que você aponte para a sua |

O tradutor embutido do Chromium é mais rápido que todos eles. Medido num canal ao vivo: 22 ms entre uma
mensagem aparecer e a tradução estar na tela, contra 1618 ms pela cadeia na nuvem, sem rede e sem cota. O
Chrome e o Edge 138 ou mais recentes podem oferecê-lo, embora nem toda cópia ofereça, e cada par de idiomas
precisa baixar o modelo uma vez, com um clique na barra. O Firefox não tem. Onde ele falta, a cadeia na nuvem
assume e nada quebra.

## Configurações

Clique na engrenagem da barra do chat, ou clique com o botão direito no ícone da extensão e escolha Opções.

- **Provedores**: ordem dos motores, sua chave do DeepL e o modo: dispositivo primeiro, nuvem primeiro, ou só
  dispositivo
- **Exibição**: idioma de destino, estilo de exibição, texto original e selo do idioma, tamanho do texto,
  espaçamento entre linhas, fonte, cor de destaque, tema do chat, a prévia de escrita e o que o clique nela faz
- **Filtros**: bots, usuários, canais, palavras-chave, idiomas de origem, e um glossário de substituições
- **Avançado**: tamanho e duração do cache, requisições simultâneas, limite por canal, backup e restauração
- **Atividade**: mensagens traduzidas, acertos do cache, cada idioma visto no chat, e por que cada uma das
  últimas 50 linhas foi traduzida ou não
- **Teclado**: Alt+T liga ou desliga a tradução do chat, Alt+W a prévia de escrita
- O botão de idioma na barra de ações do chat: um clique alterna entre o idioma do canal e a sua última
  escolha, segurar abre a lista, digitar duas letras filtra

## Idiomas

Inglês · Francês · Espanhol · Português · Português (Brasil) · Alemão · Italiano · Holandês · Polonês · Sueco · Tcheco · Eslovaco · Romeno · Russo · Ucraniano · Turco · Árabe · Hebraico · Japonês · Coreano · Chinês (simplificado) · Chinês (tradicional) · Tailandês · Vietnamita · Indonésio · Hindi · Finlandês · Norueguês · Dinamarquês · Grego · Húngaro · Búlgaro · Catalão · Esloveno · Estoniano · Lituano · Letão · Persa · Bengali · Tâmil · Malaio · Filipino · Cantonês

O chat é traduzido para qualquer um deles, e a interface da própria extensão está disponível em cada um.

## Privacidade

Sem conta, sem servidor próprio e sem analytics, a não ser que você aceite uma contagem diária anônima enviada ao Google Analytics (motores usados, erros, velocidade, nunca suas mensagens, nomes ou canais). As mensagens do chat vão para o provedor de tradução que você
escolheu e para nenhum outro lugar, e no modo dispositivo nem para ele. Uma cópia instalada de uma loja não faz
nenhuma outra requisição. Uma cópia instalada à mão pergunta ao GitHub a última tag de release, no máximo a
cada seis horas, para saber se mostra o selo de atualização. [Detalhes](PRIVACY.md)

## Perguntas frequentes

**As mensagens não são traduzidas.**
Abra a aba Atividade nas configurações e aperte "Ler decisões": ela lista as últimas 50 linhas e diz por que
cada uma foi traduzida ou não. A maioria das linhas puladas é pulada de propósito. Numa sessão ao vivo, 213
de 234 eram o mesmo usuário se repetindo, 9 eram curtas demais, 7 eram só emoji ou risada, e 1 já estava no
idioma de leitura. Se a aba não mostra nada, a extensão não está vendo o chat: abra uma issue.

**A barra verde sumiu.**
Recarregue a página. Se acontecer de novo, abra uma [issue](https://github.com/Pkkls/kick-chat-translator/issues)
com o canal e o que você fez antes.

**Como consigo traduções melhores?**
Adicione uma chave gratuita do DeepL nas configurações. O plano gratuito cobre um milhão de caracteres por mês,
e o DeepL só é gasto nos pares de idiomas em que supera os motores gratuitos.

**Qual estilo de exibição devo usar?**
Abaixo da mensagem. Os outros três funcionam e ainda estão sendo ajustados.

**Posso usar a extensão no meu idioma?**
Pode. Ela segue o idioma do seu navegador, e o menu no topo das configurações troca para qualquer um dos 43.

**Funciona em replays de VOD?**
Sim, do mesmo jeito que ao vivo.

**Parou de funcionar depois de uma atualização da Kick.**
A Kick às vezes muda a estrutura do chat. Abra uma [issue](https://github.com/Pkkls/kick-chat-translator/issues)
e ela é corrigida.

**É feita pela Kick?**
Não. É um projeto independente de código aberto, sem vínculo com a Kick.

## Novidades

Na 3.2.0:

- As configurações, o popup e a barra do chat falam os 43 idiomas para os quais a extensão traduz, não 10, com hebraico e persa da direita para a esquerda como o árabe
- Os dez idiomas que ela já falava foram reescritos para soar como escritos naquele idioma, não palavra por palavra do inglês
- O menu de idioma da interface mostra a bandeira de cada idioma e funciona pelo teclado

Cada versão, com o que mudou e a medição por trás:
[Releases](https://github.com/Pkkls/kick-chat-translator/releases) e [CHANGELOG.md](CHANGELOG.md).

## Desenvolvimento

```bash
git clone https://github.com/Pkkls/kick-chat-translator.git
cd kick-chat-translator
npm ci
npm run release:check    # typecheck, lint, testes unitários, build: o controle por onde passa cada pacote
npm run build:firefox    # build do Firefox, na mesma pasta dist/
npm run package:all      # os dois zips, em release/
npm run dev              # HMR
```

Os builds são reproduzíveis: o mesmo commit gera zips idênticos byte a byte em qualquer máquina, verificado
construindo um `git archive` da tag numa pasta vazia e comparando os hashes.

Além dos testes unitários, 42 testes sem rede carregam a extensão construída num navegador real, operam a
extensão e verificam o que ela faz, com a página e o motor de tradução servidos localmente. Eles precisam do
Playwright, que de propósito não é uma dependência: aponte `UX_KIT` para uma pasta cujo `node_modules` o
contenha, ou rode `npm i -D playwright`.

```bash
node test/e2e/run-gates.mjs --headless                  # os 42, sem janela
node test/e2e/store-shots-fixture.mjs --lang=ja         # as capturas da loja, num idioma da página
node test/e2e/store-shots-fixture.mjs --gif             # capturas da loja em inglês, as imagens do README e este GIF
```

Os textos da interface ficam em `src/shared/i18n/` (popup e opções, indexados pelo texto em inglês) e
`src/content/i18n/` (barra do chat, indexados por id com o texto em inglês como reserva), um arquivo por
idioma; os testes exigem de cada arquivo o conjunto completo de chaves. Os textos das lojas ficam em
[store/](store/), e uma release é uma tag de versão: a CI a constrói, verifica e publica nas duas lojas.

Stack: Manifest V3, Vite, TypeScript, Preact, Tailwind.

## Projetos relacionados

- [kick-ad-blocker](https://github.com/Pkkls/kick-ad-blocker), bloqueia os anúncios pre-roll e sobrepostos da Kick
- [kick-core](https://github.com/Pkkls/kick-core), o cliente do gateway em tempo real compartilhado por estas extensões
- [kickbus](https://github.com/Pkkls/kickbus), webhooks oficiais da Kick repassados a bots locais por SSE
- [kick-drops-miner](https://github.com/Pkkls/kick-drops-miner), app de Windows que avança o tempo assistido dos drops da Kick

## Licença

MIT. Sem vínculo com a Kick.
