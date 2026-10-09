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
- Guia de programação (meuguia.tv, guiadetv, Pluto TV e XMLTV)
- Filmes e séries com ficha, episódios e favoritos
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

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/components` | telas: player ao vivo, player de filmes, acervo, guia, barra lateral |
| `src/services` | catálogo, acervo, guia, TMDB, TheIntroDB (`pulos.ts`), legendas (`legendas.ts`), continuar, Chromecast, telemetria |
| `src/hooks` | Media Session e outros |
| `functions/`, `api/` | proxy para fontes sem CORS |
| `public/` | ícones, manifest, service worker, redirecionamentos |
| `desktop/` | configuração do Tauri |
