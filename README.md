# Saimo TV — site

<p align="center">
  Saimo TV: <a href="https://github.com/gabrielsaimo/SaimoTV-Android">TV Box</a> · <a href="https://github.com/gabrielsaimo/Saimo-Cell-V2">Celular</a> · <a href="https://github.com/gabrielsaimo/SaimoWin">Windows</a> · <a href="https://github.com/gabrielsaimo/SaimoPlayer">Mac e catálogo</a> · <b>Site</b> · <a href="https://github.com/gabrielsaimo">todos os apps</a>
</p>

Canais ao vivo, guia de programação, filmes e séries no navegador:
**<https://saimo-tv.pages.dev>**. Versão atual: **2.1.1**.

Mesma lista de canais e mesmo acervo dos apps de TV Box, celular, Windows e Mac,
lidos direto do repositório
[SaimoPlayer](https://github.com/gabrielsaimo/SaimoPlayer) (`catalogo.txt` e
`vod/`). Nada de lista própria para manter aqui.

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

## Rodar

Com [Bun](https://bun.sh) (ou npm):

```bash
bun install
bun run dev        # http://localhost:5173
bun run build      # gera dist/
bun run lint
```

## Docker

Imagem de produção: o build roda em Bun e a imagem final serve o `dist/` mais
as mesmas Pages Functions de `/api/*` (proxy, `resolve-vod` e eventos) num
processo Bun (`docker/server.ts`). As regras de `public/_redirects` são
respeitadas, incluindo o endereço limpo das telas.

```bash
docker build -t saimo-tv .
docker run --rm -p 3000:3000 saimo-tv     # http://localhost:3000
```

Com Docker Compose:

```bash
docker compose up --build        # produção      -> http://localhost:3000
docker compose up dev            # desenvolvimento (Vite) -> http://localhost:5173
```

O `VITE_PROXY_BASE` é lido em tempo de **build** (vem de `import.meta.env`, não
do ambiente do contêiner). Para apontar o proxy para outro host — útil quando os
CDNs recusam os IPs da Cloudflare — passe-o como argumento de build:

```bash
VITE_PROXY_BASE=https://seu-proxy.vercel.app docker compose up --build
```

Arquivos: `Dockerfile`, `.dockerignore`, `docker-compose.yml` e
`docker/server.ts`. A porta é configurável por `PORT` (padrão `3000`).

## Publicar

Push em `main` publica. O site no ar é servido pelo Cloudflare Pages
(`saimo-tv.pages.dev`); `_redirects` em `public/` cuida das rotas, e `/baixar`
leva para a página de download dos apps.

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
