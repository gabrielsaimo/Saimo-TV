# Trocar o site de GitHub (ou largar o GitHub)

O site não depende mais de nenhum endereço do GitHub em tempo de execução:

- catálogo, rádios e `versao.json` vêm de `https://saimo-canais.pages.dev/`
- filmes, séries, legendas e novidades vêm de `https://saimo-filmes.pages.dev/`
- os dois endereços ficam num lugar só: `src/services/enderecos.ts`
- os botões de download e os atalhos `/tvbox`, `/celular`, `/mac`, `/windows`
  leem os links do `versao.json` (só aceitam `https://github.com/<dono>/<repo>/releases/download/…`)

Falta só o deploy. Hoje o projeto `saimo-tv` do Cloudflare Pages é conectado ao
Git (publica a cada push). Esse tipo de projeto não pode trocar de repositório
nem virar upload direto, então a troca é apagar e recriar com o mesmo nome.

## Passo a passo

Com `CLOUDFLARE_ACCOUNT_ID=e0f6d97a9f8f4bb1b7a8ce6a7a470b3f` e wrangler logado
(ou `CLOUDFLARE_API_TOKEN` com "Cloudflare Pages: Edit"):

```bash
export CLOUDFLARE_ACCOUNT_ID=e0f6d97a9f8f4bb1b7a8ce6a7a470b3f
wrangler pages project delete saimo-tv --yes
wrangler pages project create saimo-tv --production-branch main
scripts/publicar_site.sh
```

O site fica fora do ar só entre o `delete` e o fim do upload (build mais envio,
cerca de 1 minuto). Apagar e recriar o mesmo nome funciona na hora (testado num
projeto de teste). O endereço `saimo-tv.pages.dev` não muda. Domínio próprio
ligado ao projeto, se houver, precisa ser ligado de novo.

Depois disso, publicar é sempre `scripts/publicar_site.sh`; push no GitHub não
publica mais nada. Para outro nome de projeto: `SAIMO_PROJETO_SITE=outro`.

## O que sobe junto

- **`functions/`**: o `wrangler pages deploy dist` procura a pasta `functions`
  na raiz de onde o comando roda (o projeto), compila e envia como Pages
  Functions, mesmo com o diretório de saída sendo `dist`. Ali estão `api/proxy`,
  `api/events`, `api/resolve-vod` e os atalhos `tvbox`, `celular`, `mac`,
  `windows` (a lógica comum está em `functions/_lib/baixar.ts`, que não exporta
  rota). Não verifiquei contra uma publicação real: se `/api/*` ou `/tvbox`
  responderem com o `index.html`, é sinal de que as Functions não subiram;
  confira o log do deploy ("Compiled Worker successfully" / "Uploading Functions bundle").
- **`public/_redirects`** vai para dentro de `dist` pelo Vite e é lido pelo
  Pages. Só sobrou `/baixar -> /app` e o fallback `/* /index.html 200`. Os
  atalhos de download saíram dele, porque um redirect estático precisaria do
  dono do repositório escrito; agora são Functions. O `_redirects` é processado
  antes das Functions, então não recoloque ali rotas que as Functions atendem.
- **`_headers`**: o projeto não tem; CORS de `/api/*` é feito dentro das Functions.
  Sem `Content-Security-Policy` no site, nada a liberar para os dois hosts novos.

## Quando mudar de conta no GitHub

1. Mover os repositórios.
2. Rodar `scripts/publicar_catalogos.sh` no SaimoPlayer e publicar o novo
   `versao.json` apontando para os releases da conta nova.
3. O site não precisa de mudança nem de novo deploy.
