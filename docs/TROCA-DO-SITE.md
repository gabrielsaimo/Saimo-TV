> **Atualização (19/10/2026):** o endereço do site é `saimo-tv.pages.dev`, o projeto antigo da
> Cloudflare (conta antiga), ligado ao GitHub antigo: publicar é dar push na `main` de
> `gabrielsaimo/Saimo-TV`. O `saimo-tv2` foi abandonado; o texto abaixo é histórico.

# Trocar o site de GitHub (ou largar o GitHub)

O site não embute lista nenhuma. Os endereços de canais
(`https://canais-saimo.pages.dev/`) e de filmes e séries
(`https://filmes-saimo.pages.dev/`) são as constantes `PADRAO` de
`src/services/listas.ts`; em Ajustes > Listas a pessoa troca, desliga (campo vazio)
ou restaura o padrão, e isso fica no `localStorage`. Fora isso, o único nome fixo é o do
repositório de downloads, `SaimoTV/saimo-downloads` (`src/services/versao.ts` e
`functions/_lib/baixar.ts`): os botões e os atalhos `/tvbox`, `/celular`, `/mac`,
`/windows`, `/samsung` e `/lg` leem os anexos da última release pela API do GitHub e
casam pelo nome do arquivo (`SaimoTV.apk`, `SaimoCell.apk`, `SaimoTV.dmg`,
`SaimoTV-Windows.zip`, `SaimoTV-Samsung.wgt`, `SaimoTV-LG.ipk`), então subir outra
versão ou trocar o repositório é só mudar a constante. O `versao.json` de
`canais-saimo.pages.dev` continua sendo lido para a versão e como reserva, e só
aceitam `https://github.com/<dono>/<repo>/releases/download/…`.

O projeto final do Cloudflare Pages é `saimo-tv2` (`saimo-tv.pages.dev`), o padrão de
`scripts/publicar_site.sh`.

Falta só o deploy. O projeto antigo `saimo-tv` do Cloudflare Pages é conectado ao
Git (publica a cada push). Esse tipo de projeto não pode virar upload direto, então o site novo é um projeto
novo, `saimo-tv2`, criado por upload direto.

## Passo a passo

Com `CLOUDFLARE_ACCOUNT_ID=e0f6d97a9f8f4bb1b7a8ce6a7a470b3f` e wrangler logado
(ou `CLOUDFLARE_API_TOKEN` com "Cloudflare Pages: Edit"):

```bash
export CLOUDFLARE_ACCOUNT_ID=e0f6d97a9f8f4bb1b7a8ce6a7a470b3f
wrangler pages project create saimo-tv2 --production-branch main
scripts/publicar_site.sh
```

O endereço novo é `saimo-tv.pages.dev`; domínio próprio, se houver, precisa ser
ligado ao projeto novo.

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
2. Publicar o `versao.json` da última release apontando para os arquivos da conta nova.
3. O site não precisa de mudança nem de novo deploy.
