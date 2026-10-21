#!/bin/bash
#
# Põe o código das TVs Samsung/LG em dist/tv/ (o carregador do pacote o baixa de lá ao abrir).
# Roda no fim do `npm run build`, tanto na Cloudflare (publicação pelo Git) quanto no
# publicar_site.sh. Precisa do dist/ do site já montado.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/tv_codigo.sh
mkdir -p dist/tv
cp dist-tv/saimo.js dist-tv/saimo.css dist-tv/manifesto.json dist/tv/
# O carregador lê o manifesto por XHR de outra origem (file://): precisa de CORS.
printf '/tv/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=60\n' > dist/_headers
# Arquivos que os apps leem (inclusive o das TVs, de outra origem): amostra da contagem de online,
# servidores desligados e a agenda extra. Estáticos: não contam pedido.
for arq in telemetria.json fontes-desativadas.json eventos-extra.json; do
  printf '/%s\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=600\n' "$arq" >> dist/_headers
done
