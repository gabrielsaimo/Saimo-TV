#!/bin/bash
#
# Publica o site no Cloudflare Pages sem passar pelo GitHub (upload direto).
#
# ATENÇÃO: o site de verdade (saimo-tv.pages.dev) é um projeto ligado ao Git e publica sozinho
# a cada push na `main` de gabrielsaimo/Saimo-TV. Este script serve para publicar noutro
# projeto por upload (SAIMO_PROJETO_SITE) quando o Git não puder ser usado.
#
#   ./scripts/publicar_site.sh
#
# Faz o build (bun, por causa do bun.lock) e envia dist/ com a pasta functions/
# (Pages Functions: /api/* e os atalhos /tvbox, /celular, /mac, /windows).
# Autenticação: CLOUDFLARE_API_TOKEN (permissão "Cloudflare Pages: Edit") ou o
# `wrangler login` desta máquina. Passos da troca de GitHub: docs/TROCA-DO-SITE.md
set -euo pipefail
cd "$(dirname "$0")/.."

export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-e0f6d97a9f8f4bb1b7a8ce6a7a470b3f}"
PROJETO="${SAIMO_PROJETO_SITE:-saimo-tv2}"

achar_wrangler() {
  if command -v wrangler >/dev/null 2>&1; then command -v wrangler; return; fi
  # Fora do terminal o PATH não tem o nvm: procura onde ele costuma deixar.
  local c
  for c in "$HOME"/.nvm/versions/node/*/bin/wrangler /opt/homebrew/bin/wrangler /usr/local/bin/wrangler; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  return 1
}

WRANGLER="$(achar_wrangler)" || { echo "wrangler não encontrado (npm i -g wrangler)" >&2; exit 1; }
# O wrangler vive no nvm: precisa do node dele no PATH.
export PATH="$(dirname "$WRANGLER"):$PATH"

if command -v bun >/dev/null 2>&1; then
  # copyfile: no disco externo o bun não consegue clonar/ligar os arquivos do cache.
  bun install --frozen-lockfile --backend=copyfile
  bun run build
else
  npm ci
  npm run build
fi

"$WRANGLER" pages deploy dist --project-name "$PROJETO" --branch main --commit-dirty=true
