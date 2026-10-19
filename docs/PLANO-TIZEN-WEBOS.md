# Saimo TV para Samsung (Tizen) e LG (webOS) — plano

Escrito em 19/10/2026. **Status (19/10/2026): as fases 1, 2 e 5 estão feitas; a fase 3 foi feita
sem o AVPlay; a fase 0 (prova nas TVs reais) e a fase 4 (desempenho) dependem de uma TV de
verdade e ainda não foram executadas.** O que existe hoje está em "Estado atual" no fim.

## 1. Decisão principal: reaproveitar o site, não escrever app novo

Samsung (Tizen) e LG (webOS) rodam **apps web** (HTML + JS num Chromium da própria TV).
O site (`Saimo-TV`, React + Vite) já tem quase tudo o que um app de TV precisa:

| Já existe no site | Onde |
|---|---|
| Navegação por setas / OK / voltar (D-pad) | `src/contexts/DpadContext.tsx`, `src/hooks/useDpadNavigation.ts`, `src/styles/dpad-navigation.css` |
| Players HLS, MPEG-TS e DASH | `hls.js`, `mpegts.js`, `shaka-player` (`VideoPlayer.tsx`, `MoviePlayer.tsx`, `services/dashPlayer.ts`) |
| Catálogo sem listas no código, endereços em Ajustes > Listas | `services/listas.ts`, `utils/enderecoLista.ts` |
| Guia (EPG), filmes, séries, rádios, eventos, favoritos, continuar assistindo | todo o app |
| Controle parental (código 1010, desbloqueio, Extras) | intocado — vem junto, igual |
| Telemetria por amostra (5%) | `services/telemetria.ts` |

Escrever um app nativo separado para cada TV seria refazer 5–6 mil linhas de player e
telas que já funcionam. O caminho é **um código só (o do site) com uma camada "TV"**.

## 2. Formato do app: casca empacotada + código vindo do Pages

Existem três jeitos de colocar um app web numa TV. A escolha:

| Formato | Como é | Prós | Contras |
|---|---|---|---|
| Empacotado puro | Todo o JS dentro do `.wgt`/`.ipk` | Funciona offline; origem local, sem CORS/mixed content | Cada correção = reinstalar na TV (e instalar na TV é a parte difícil, ver §6) |
| Hospedado puro | O app só redireciona para `https://saimo-tv2.pages.dev/tv/` | Atualiza na hora | Página https: vídeo `http://` vira conteúdo misto; CORS igual ao navegador → precisa do `/api/proxy` (custa pedidos de Worker no plano de US$ 10) |
| **Casca + código remoto (escolhido)** | O pacote tem um `index.html` pequeno (o "carregador") que baixa o JS/CSS da versão atual do Pages como `<script>` comum e roda **dentro da origem local do pacote** | Atualiza sem reinstalar **e** mantém os privilégios do pacote (vídeo http, AVPlay da Samsung, teclas do controle) | Precisa do carregador e de um manifesto de versão; tem que validar cedo (Fase 0) que as duas TVs deixam `<script src="https://…">` rodar a partir do pacote |

Fluxo do carregador:

1. Abre instantâneo com a tela de abertura que já vem no pacote.
2. Lê `https://saimo-tv2.pages.dev/tv/manifesto.json` (`{versao, js:[…], css:[…], minimoCasca}`).
3. Injeta os arquivos como `<script>`/`<link>` clássicos (sem `type="module"`: no webOS,
   módulo a partir de `file://` é bloqueado).
4. Sem rede ou manifesto quebrado: usa a cópia do código que veio no próprio pacote.
5. `minimoCasca` maior que a casca instalada → mostra "Instale a versão nova do app" com
   o link curto (`saimo-tv2.pages.dev/samsung` ou `/lg`).

Assim a casca quase nunca muda; o app em si atualiza junto com o site, na hora.

## 3. TVs suportadas

O Chromium da TV é antigo e fixo por ano de fabricação. Proposta: **TVs de 2020 em diante**.

| Ano | Samsung | LG | Chromium aproximado |
|---|---|---|---|
| 2020 | Tizen 5.5 | webOS 5 | 68–69 |
| 2021 | Tizen 6.0 | webOS 6 | 76–79 |
| 2022 | Tizen 6.5 | webOS 22 | 85–87 |
| 2023+ | Tizen 7+ | webOS 23+ | 94+ |

Consequência: o build de TV precisa sair transpilado para Chrome 68 (sem `?.`/`??` nativos,
sem `structuredClone`, etc.), com polyfills, via `@vitejs/plugin-legacy` ou `build.target`.
TVs de 2017–2019 (Chromium 47–63) ficam de fora no começo; dá para estudar depois.
As versões de Chromium acima são aproximadas e precisam ser confirmadas na Fase 0.

## 4. O que muda no código

Tudo no repositório `Saimo-TV`, num build separado (`bun run build:tv`), sem afetar o site.

### 4.1 Estrutura nova
```
tv/
  comum/carregador.js        carregador (§2), manifesto, cópia de reserva
  tizen/config.xml           id, privilégios (internet, tv.inputdevice, avplay), <access origin="*">
  tizen/icon.png, index.html
  webos/appinfo.json         id, ícones, "disableBackHistoryAPI": true
  webos/icon.png, largeIcon.png, index.html
scripts/montar_tv.sh         gera dist-tv/, empacota .wgt (tizen CLI) e .ipk (ares-package)
src/plataforma/tv.ts         detecção e ponte com as APIs de cada TV
src/services/players/        adaptador de player (§4.3)
```

### 4.2 Camada de plataforma (`src/plataforma/tv.ts`)
- **Detectar**: `window.tizen` (Samsung), `window.webOS`/`PalmSystem` (LG). Expõe
  `ehTV`, `marca`, `versaoCasca`.
- **Teclas**: a Samsung só entrega teclas registradas → `tizen.tvinputdevice.registerKey`
  para números 0–9 (o código 1010 do parental precisa delas), Play/Pausa, CH+/CH−,
  cores, Info. Mapear **Voltar**: `10009` (Samsung) e `461` (LG) para a ação `back` que o
  `DpadContext` já entende. CH+/CH− trocam de canal no player ao vivo.
- **Sair**: voltar na tela inicial pergunta "Sair do Saimo TV?" e chama
  `tizen.application.getCurrentApplication().exit()` / `window.close()` no webOS.
- **Tela**: viewport fixo 1920×1080 (`<meta name="viewport" content="width=1920">`), modo
  TV forçado (sem hover, foco grande, sem layout de celular).

### 4.3 Player
- **Samsung**: AVPlay (`webapis.avplay`) para ao vivo e filmes — decodifica no hardware,
  toca HLS, MPEG-TS e MP4 por `http` sem CORS. É o que os apps grandes usam.
  `hls.js`/`mpegts.js` ficam como segunda tentativa.
- **LG**: `<video>` nativo toca HLS direto (também sem CORS); `hls.js`/`mpegts.js`/`shaka`
  como segunda tentativa.
- Interface comum (`tocar`, `pausar`, `buscar`, `faixasDeAudio`, `legendas`, eventos) para
  que `VideoPlayer.tsx` e `MoviePlayer.tsx` não saibam em que TV estão. A ordem de
  fontes e o "pula para a próxima fonte" continuam iguais.
- **Proxy desligado na TV**: `needsProxy()` retorna falso quando `ehTV` — nada de
  `/api/proxy`, então a TV **não gasta pedidos de Worker** (bom para o teto de US$ 10).

### 4.4 Desempenho (TV tem 1–2 GB de RAM e CPU fraca)
- Listas longas (canais, filmes) virtualizadas — só desenha o que está na tela.
- Capas no tamanho certo, carregamento preguiçoso, limite de imagens em memória.
- Sem `backdrop-filter`/blur e sombras pesadas no modo TV.
- O guia (EPG) já roda em worker; conferir o custo de memória.
- Meta: abrir em < 4 s e trocar de canal em < 2 s numa TV de 2020.

### 4.5 O resto
- **Parental**: nenhuma mudança. Mesmo código, mesmas regras.
- **Listas**: os dois endereços já vêm embutidos e ativos, como nos outros apps.
- **Telemetria**: `platform` passa a ser `tizen` ou `webos` (monitor separa nas abas).
- **Armazenamento**: `localStorage` (no webOS o app empacotado perde os dados ao reinstalar;
  como a casca quase não muda, isso é raro).
- **Saimo Connect / celular como controle**: reaproveitar o que o site já tiver; não é bloqueio.

## 5. Atualização
- **Código do app**: pelo manifesto no Pages, toda vez que o site é publicado (`publicar_site.sh`
  passa a publicar também `dist-tv/` em `/tv/`).
- **Casca**: o `release.sh` ganha `SaimoTV-Samsung.wgt` e `SaimoTV-LG.ipk` no release, e o
  `versao.json` ganha `arquivos.tizen` e `arquivos.webos`. Links curtos novos no site:
  `/samsung` e `/lg`.

## 6. Instalação na TV — o ponto mais difícil

| Caminho | Samsung | LG |
|---|---|---|
| Loja oficial | Samsung Seller Office: revisão de semanas, regras de conteúdo | LG Seller Lounge: idem |
| Modo desenvolvedor | Ligar o modo desenvolvedor, gerar certificado Samsung com o ID da TV (DUID), instalar por `sdb`/`tizen install` | Conta LG + app "Developer Mode"; a sessão **expira a cada ~50 h** e os apps instalados param |
| Comunidade | Instaladores prontos (estilo Jellyfin2Samsung) fazem certificado + instalação sozinhos | Homebrew Channel (só em firmwares vulneráveis, via root) |
| Sem instalar nada | Navegador da TV abrindo `saimo-tv2.pages.dev` | Idem |

Recomendação, em ordem:
1. **Navegador da TV (já, sem instalar)**: o site detecta TV pelo user agent e liga o modo TV.
   Funciona hoje com o proxy; é o caminho para "testar no sábado".
2. **Samsung por modo desenvolvedor, com instalador nosso**: botão "Instalar na TV Samsung"
   no app do Mac/Windows que acha a TV na rede, gera o certificado e instala o `.wgt`.
   Instalou uma vez, atualiza sozinho pelo manifesto.
3. **LG**: modo desenvolvedor para testes e para quem topar renovar; Homebrew Channel para
   quem tiver TV compatível. É frágil — deixar claro na página de download.
4. **Lojas**: possível no futuro **só com um build de loja** (sem endereços embutidos, o
   usuário informa a própria lista — o modelo dos "IPTV players" que existem nas lojas). As
   lojas não aceitam conteúdo adulto: um build de loja exigiria tirar o parental/Extras,
   o que contraria a regra de não mexer no parental. **Decisão sua**; por isso fica fora
   do escopo inicial.

## 7. Fases

| Fase | O que | Pronto quando | Esforço |
|---|---|---|---|
| **0. Prova** | Casca mínima nas duas TVs (emulador Tizen + simulador webOS e, principalmente, TVs reais): carregador com script remoto, fetch do catálogo, vídeo `http` HLS e TS no AVPlay e no `<video>` do LG, teclas, Voltar. Confirmar versões de Chromium | Um canal toca nas duas TVs a partir do pacote, sem proxy | 2–3 dias |
| **1. Modo TV no navegador** | Detectar TV pelo user agent, layout 1920×1080, foco, teclas Voltar | Site navegável só com o controle no navegador da Samsung e da LG | 2 dias |
| **2. Build de TV** | `build:tv` transpilado para Chrome 68, `src/plataforma/tv.ts`, manifesto, carregador, `montar_tv.sh` gerando `.wgt` e `.ipk` | App instalado abre, lista canais e filmes, atualiza pelo manifesto | 4–5 dias |
| **3. Player nativo** | Adaptador AVPlay (Samsung) e `<video>` nativo (LG), fallback hls.js/mpegts, CH+/CH−, áudio e legendas, proxy desligado | Ao vivo, filmes e séries tocam com troca de fonte | 5–7 dias |
| **4. Desempenho e acabamento** | Virtualização, imagens, memória, tela de saída, telemetria `tizen`/`webos`, parental testado no controle | Metas do §4.4 numa TV de 2020 | 3–4 dias |
| **5. Distribuição** | `release.sh` + `versao.json` + `/samsung` e `/lg` no site; instalador Samsung no app do Mac/Windows; guia de instalação LG; READMEs | Uma pessoa leiga instala na Samsung seguindo a página | 4–6 dias |

Total estimado: **~4 semanas** de trabalho, sendo a Fase 0 a que decide o resto. Se a Fase 0
mostrar que alguma TV não deixa carregar o código remoto a partir do pacote, o plano B é
empacotado puro (atualização reinstalando) naquela marca.

## 8. Riscos

- **Instalação** (§6) é o maior risco — principalmente LG.
- **Fontes que só tocam pelo proxy** (cabeçalhos/Referer exigidos pelo servidor): o AVPlay
  aceita alguns cabeçalhos; o `<video>` não. Medir na Fase 0 quantas fontes caem nisso.
- **Chromium antigo**: React 19 + bibliotecas precisam do build transpilado; testar em 2020.
- **Memória**: catálogo grande e capas podem derrubar o app em TV fraca.
- **Política das empresas**: firmware novo pode fechar o modo desenvolvedor ou o root.

## 9. O que preciso de você

1. **Quais TVs você tem para teste?** (marca, modelo e ano de uma Samsung e uma LG.) Emulador
   não testa AVPlay nem desempenho de verdade.
2. Confirmar o corte em **TVs de 2020+**.
3. Loja oficial: fica fora agora (por causa do parental)? Ou quer avaliar um build de loja depois?
4. Ordem: começo pela **Fase 0 + Fase 1** (prova nas TVs e modo TV no navegador, que já dá
   resultado sem instalar nada)?

## Fontes consultadas
- Samsung — Hosted Applications Q&A: https://developer.samsung.com/smarttv/develop/faq/hosted-applications.html
- LG — Web App Types: https://webostv.developer.lge.com/develop/getting-started/web-app-types
- LG fórum — CORS em app empacotado: https://forum.webostv.developer.lge.com/t/how-are-we-supposted-to-handle-cors-with-a-non-hosted-app/28241
- LG fórum — módulo bloqueado em `file://`: https://forum.webostv.developer.lge.com/t/module-script-loads-blocked-under-file-origin-for-installed-webos-app-no-cors-workaround-found/28351
- Modo desenvolvedor LG e expiração: https://elis.nu/blog/2022/07/keeping-webos-developer-mode-alive-with-home-assistant/
- Instalação Samsung sem Tizen Studio: https://jellywatch.app/blog/jellyfin-samsung-tv-tizen-install-sideload-guide-2026


## Estado atual (implementado em 19/10/2026)

| Item | Onde | Situação |
|---|---|---|
| Detecção Samsung/LG, teclas do controle (Voltar 10009/461, Play/Pausa, números), sair do app | `src/plataforma/tv.ts` | feito, ligado em `src/main.tsx` |
| HTTP e CORS: na TV nada começa pelo proxy; `http://` abre direto; proxy do site fica como última tentativa | `src/utils/streamUrl.ts`, `VideoPlayer.tsx`, `MoviePlayer.tsx` | feito e coberto por `tests/modoTv.test.mjs` |
| HLS nativo da TV como primeira tentativa (sem CORS, com aceleração) e hls.js depois | `streamUrl.ts` (`Attempt.nativo`), `VideoPlayer.tsx` | feito |
| Build de TV: um `saimo.js` clássico (IIFE), alvo Chrome 68 e polyfills (core-js), worker do guia embutido | `vite build --mode tv`, `src/entrada-tv.ts`, `vite.config.ts` | feito |
| Carregador (código novo do site ao abrir, cópia de reserva no pacote) | `tv/comum/carregador.js` | feito e testado contra o site publicado |
| Pacotes `.wgt` (Samsung) e `.ipk` (LG) | `scripts/montar_tv.sh` | feito; o `.wgt` sai sem assinatura |
| Código das TVs publicado em `/tv/` + manifesto | `scripts/publicar_site.sh`, `scripts/tv_codigo.sh` | feito |
| Links curtos `/samsung` e `/lg`, abas Samsung/LG na página de download | `functions/`, `AppDownload.tsx` | feito |
| `release.sh` coloca os pacotes no release e `tizen`/`webos` no `versao.json` | `SaimoPlayer/release.sh` | feito |

### O que NÃO foi feito (e por quê)
- **Nenhum teste em TV de verdade.** Tudo foi verificado no navegador (pacote servido por
  localhost, com o modo TV forçado) e nos testes automáticos. Não dá para garantir, sem uma
  Samsung e uma LG, que cada fonte toque: depende do Chromium da TV, de CORS no webOS e de
  codecs. O desenho abre várias saídas (HLS nativo, hls.js direto, proxy do site) justamente
  para isso, mas a prova é a Fase 0.
- **AVPlay (Samsung).** Fica como reserva para fontes que o `<video>` não abrir (cabeçalhos
  Referer/User-Agent, áudio AC3/E-AC3). Só vale a pena medir depois da Fase 0.
- **Serviço local no webOS** (proxy dentro da TV): plano B se o webOS bloquear CORS no pacote.
- **Assinatura do `.wgt`**: precisa do certificado Samsung ligado ao ID da TV (Tizen Studio).
  O `montar_tv.sh` assina sozinho se houver o comando `tizen` e `SAIMO_TIZEN_PERFIL`.
- **Instalador automático** (botão no app do Mac/Windows) e a **loja oficial**.

### Como testar na TV
1. `./scripts/montar_tv.sh` gera `build/tv/SaimoTV-Samsung.wgt` e `build/tv/SaimoTV-LG.ipk`.
2. Samsung: assinar e instalar (passos na página `/app`, aba Samsung). LG: `ares-install`.
3. Abrir um canal https, um canal http e um filme. Se algo não tocar, ver no console da TV
   (`tizen` Web Inspector / `ares-inspect`) qual tentativa falhou.
