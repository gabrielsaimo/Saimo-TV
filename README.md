# Saimo TV — site

<p align="center">
  Saimo TV: <a href="https://github.com/gabrielsaimo/SaimoTV-Android">TV Box</a> · <a href="https://github.com/gabrielsaimo/Saimo-Cell-V2">Celular</a> · <a href="https://github.com/gabrielsaimo/SaimoWin">Windows</a> · <a href="https://github.com/gabrielsaimo/SaimoPlayer">Mac e catálogo</a> · <b>Site</b> · <a href="https://github.com/gabrielsaimo">todos os apps</a>
</p>

Canais ao vivo, guia de programação, filmes e séries no navegador:
**<https://saimo-tv.pages.dev>**. Versão atual: **2.1.1**.

O site não embute lista nenhuma (nem de canais, nem de filmes, nem tabelas do guia).
Só há dois endereços padrão, as constantes `PADRAO` de `src/services/listas.ts`
(`canais-saimo.pages.dev` e `filmes-saimo.pages.dev`), ativos sem a pessoa digitar
nada. Em Ajustes > Listas ela pode trocá-los, restaurar o padrão ou deixar um em
branco e salvar, o que desliga aquela lista (estado vazio, nenhum pedido de rede);
os valores ficam no `localStorage`. A lista de canais serve `catalogo.txt`,
`canais.txt`, `restritos.txt`, `radios.txt` e `guia.txt` (tabelas do guia); a de
filmes serve a pasta `vod/`. A normalização do endereço está em
`src/utils/enderecoLista.ts` (testes em `tests/`). O único endereço fixo é o do
`versao.json` da última release do GitHub, de onde saem os links de download e os
atalhos `/tvbox`, `/celular`, `/mac` e `/windows`.

Publicar o site: `scripts/publicar_site.sh` (upload direto, sem GitHub). A troca
do projeto Git-conectado para esse modo está em [docs/TROCA-DO-SITE.md](docs/TROCA-DO-SITE.md).

## O que tem

- TV ao vivo com HLS (hls.js), MPEG-TS (mpegts.js) e DASH; troca de fonte quando
  uma cai
- Ao vivo não pausa: sem botão de pausa, e pausa vinda dos fones, da tela de
  bloqueio ou da janela flutuante volta a tocar sozinha
- Guia de programação (meuguia.tv, guiadetv, Pluto TV e XMLTV): grade de uma
  hora atrás até um dia adiante, com busca de canal, linha do "agora" e ficha
  do programa (sinopse e botão para assistir); tecla **G** abre e fecha
- Filmes e séries com ficha, episódios e favoritos
- Em série, o episódio seguinte (automático, Próximo ou outro da série) prefere a fonte
  que estava tocando, sem trocar entre dublado e legendado: mesmo servidor, senão a mesma
  posição na versão, senão a ordem de sempre
  (`src/utils/fontePreferida.ts`); a ordem HTTPS primeiro não muda
- Busca na aba Início procura em todo o acervo (filmes, séries, animes e
  doramas), com o nome exato primeiro
- Pular abertura e créditos com os tempos do [TheIntroDB](https://theintrodb.org)
- Legendas do OpenSubtitles em filmes e séries (Português do Brasil e de Portugal, inglês, espanhol),
  com ajuste de sincronia, em `src/services/legendas.ts`; sem chave nem cadastro
- Continuar assistindo, com a fileira na tela do acervo
- Filme que não toca no site (fonte http ou servidor que recusa) mostra o aviso
  para abrir numa página separada, com a lista de fontes. O topo do player,
  com o voltar, fica sempre livre; com muitas fontes o aviso rola desde o
  título, e a barra de baixo some enquanto o erro está na tela
- Controles do sistema e da tela de bloqueio (Media Session)
- Chromecast (SDK carregado só quando alguém usa)
- Instalável como app (PWA, com `manifest.webmanifest` e service worker)
- No celular: barra de seções embaixo (Início, Ao vivo, Filmes e séries,
  Baixar app), vídeo em cima e canais embaixo (sem canal escolhido, só a
  lista, ocupando a tela), e o voltar do aparelho fecha a
  ficha, o ator, o player e o guia em vez de sair da página
- Celular deitado: com um canal ou filme tocando, o vídeo toma a tela
  inteira (em pé a lista volta, sem recarregar o vídeo). O botão de tela
  cheia trava em paisagem no Android e usa o player nativo do vídeo no iPhone
  (`src/utils/telaCheia.ts`)
- Novidades (`/novidades`, sem link em lugar nenhum): o que entrou e o que mudou
  em cada rodada da atualização do acervo (11h e 18h), com data, hora e capa,
  lido de `vod/novidades.json` (gerado por `SaimoPlayer/gerar_novidades.py`).
- Abertura animada (`src/components/Abertura.tsx`): toda vez que a página inicial
  abre, a logo se monta peça por peça em SVG (camadas em `public/abertura/`,
  geradas por `SaimoPlayer/abertura`), no dobro da velocidade dos apps; clique
  ou tecla pula.
- Eventos (`src/services/eventos.ts`), como no TV Box: a agenda da embedtv
  (pela função `functions/api/events.ts`) e a do monitor (`/v1/eventos`, canais
  de streaming como CazéTV, Disney+, Prime e Paramount+, sem repetir) com os placares da ESPN, só jogos
  que passam em algum canal da lista, em grupos (ao vivo agora, começa em
  breve, hoje, amanhã, próximos dias), placar e tempo de jogo atualizados a
  cada minuto com o painel aberto, escudos em alta resolução e o canal com
  logo; tocar abre o canal. No celular fica na barra de baixo
- Atalhos de teclado: aperte **?** para ver todos
- Prévia de link com imagem ao compartilhar (Open Graph)

## Telemetria por amostra

O Saimo Monitor cobra por pedido, então só uma fração fixa dos navegadores fala
com ele (`src/services/telemetria.ts`): FNV-1a de 32 bits sobre o id, dentro
quando `hash % 10000 < pct * 100` — a mesma conta do servidor. O percentual vem
de `telemetria.json`, arquivo estático do monitor (não conta pedido), relido uma
vez por dia. Fora da amostra nada sai do navegador. Na amostra, batida fora do
relógio (pausa, troca) no máximo a cada 30 s. A lista de servidores desligados
fica guardada por uma hora, e a agenda de jogos atualiza a cada 3 min com a tela
aberta.

## Rodar

Com [Bun](https://bun.sh) (ou npm):

```bash
bun install
bun run dev        # http://localhost:5173
bun run build      # gera dist/
bun run lint
```

## Publicar

`scripts/publicar_site.sh` faz o build e o upload direto para o Cloudflare Pages
(`saimo-tv.pages.dev`), sem depender do GitHub. `_redirects` em `public/` cuida
das rotas, `/baixar` leva para a página de download dos apps e `functions/`
traz o proxy (`/api/*`) e os atalhos de download (`/tvbox`, `/celular`, `/mac`,
`/windows`, que leem o `versao.json`).

As rotas usam endereços normais (`/filmes`, `/canal/...`) no navegador e `#` no
app de desktop, que abre o mesmo `index.html`. Endereços antigos com `#` são
convertidos na abertura.

## App de desktop (Tauri)

O mesmo site empacotado como programa, em `desktop/`:

```bash
bun run desktop          # desenvolvimento
bun run desktop:build    # instalador
```

O workflow `Build Windows Desktop` gera MSI e NSIS ao receber uma tag
`desktop-v*`. O app de Windows principal, nativo e mais leve, é o
[SaimoWin](https://github.com/gabrielsaimo/SaimoWin).

## Guia de programação

- A montagem roda num Web Worker (`src/workers/epgWorker.ts`): páginas do
  meuguia e do guiadetv primeiro (chegam em segundos), depois os feeds XMLTV,
  lidos em streaming, pedaço a pedaço, sem segurar o arquivo inteiro na memória.
- Só fica a janela útil: de três horas atrás a trinta horas adiante. O worker
  ordena cada canal, tira repetidos e corta o programa que invade o seguinte.
- A cada etapa o worker manda só os canais que mudaram, e o serviço
  (`src/services/epgService.ts`) avisa as telas uma vez por lote.
- Cache em `localStorage` (`saimo-epg-v5`, cerca de 2 MB) por seis horas,
  gravado quando a página está ociosa.
- A grade (`src/components/ProgramGuide.tsx`) é um único rolador com canal e
  régua presos por `sticky` e desenha só as linhas e horários visíveis.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/components` | telas: player ao vivo, player de filmes, acervo, guia, barra lateral |
| `src/services` | catálogo, acervo, guia, TMDB, TheIntroDB (`pulos.ts`), legendas (`legendas.ts`), continuar, Chromecast, telemetria |
| `src/hooks` | Media Session e outros |
| `functions/`, `api/` | proxy para fontes sem CORS |
| `public/` | ícones, manifest, service worker, redirecionamentos |
| `desktop/` | configuração do Tauri |


## TV Samsung (Tizen) e LG (webOS)

O mesmo código do site roda como app nas TVs de 2020 em diante: `./scripts/montar_tv.sh` gera
`build/tv/SaimoTV-Samsung.wgt` e `build/tv/SaimoTV-LG.ipk`. O pacote guarda só uma casca e uma cópia
do app; ao abrir, o carregador (`tv/comum/carregador.js`) baixa a versão atual de
`saimo-tv.pages.dev/tv/`, que o `publicar_site.sh` atualiza junto com o site. Na TV os vídeos abrem
direto (http inclusive, HLS pelo decodificador da TV), sem o proxy. Plano, estado e o que falta testar
em TV de verdade: `docs/PLANO-TIZEN-WEBOS.md`. Build: `vite build --mode tv`, depois `scripts/tv_es5.mjs`
(ES5 conferido com acorn, para TVs antigas/fracas a partir do Chromium 38) e polyfills em
`src/entrada-tv.ts` / `src/plataforma/polyfills-tv.ts`. Se a TV não abrir em 1 minuto, o carregador mostra o
motivo na tela e manda um evento `crash` ao monitor (plataformas `tizen` e `webos`).
