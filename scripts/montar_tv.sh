#!/bin/bash
#
# Monta os pacotes do Saimo TV para TV Samsung (Tizen) e LG (webOS).
#
#   ./scripts/montar_tv.sh            gera build/tv/SaimoTV-Samsung.wgt, build/tv/SaimoTV-LG.ipk
#                                     e dist-tv/ (o código que o site publica em /tv/)
#
# O pacote é uma casca pequena (tv/comum/carregador.js) com uma cópia do app dentro; o
# carregador baixa a versão atual do site ao abrir. Ver docs/PLANO-TIZEN-WEBOS.md.
#
# Samsung: o .wgt só instala depois de assinado com o certificado da TV (Tizen Studio ou
#   o instalador). Se o comando `tizen` existir e SAIMO_TIZEN_PERFIL estiver definido
#   (perfil de certificado), o script já assina; sem isso sai um .wgt sem assinatura.
# LG: usa o ares-package (npx @webosose/ares-cli).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSAO="$(python3 -c "import json;print(json.load(open('package.json'))['version'])")"
SAIDA="build/tv"
rm -rf "$SAIDA"; mkdir -p "$SAIDA"

bash scripts/tv_codigo.sh

preparar() { # preparar marca pasta
  local marca="$1" pasta="$2"
  mkdir -p "$pasta/app"
  sed "s/%MARCA%/$marca/" tv/comum/index.html > "$pasta/index.html"
  cp tv/comum/carregador.js "$pasta/"
  cp dist-tv/saimo.js dist-tv/saimo.css "$pasta/app/"
  cp -R public/abertura public/icons public/favicon.png "$pasta/"
}

echo "==> Samsung (Tizen)"
T="$SAIDA/tizen"; preparar tizen "$T"
sed "s/%VERSAO%/$VERSAO/" tv/tizen/config.xml > "$T/config.xml"
cp tv/tizen/icon.png "$T/"
if command -v tizen >/dev/null && [ -n "${SAIMO_TIZEN_PERFIL:-}" ]; then
  tizen package -t wgt -s "$SAIMO_TIZEN_PERFIL" -o "$SAIDA" -- "$T" >/dev/null
  mv "$SAIDA"/SaimoTV.wgt "$SAIDA/SaimoTV-Samsung.wgt"
  echo "    assinado com o perfil $SAIMO_TIZEN_PERFIL"
else
  ( cd "$T" && zip -qr "../SaimoTV-Samsung.wgt" . -x '.*' )
  echo "    SEM ASSINATURA (falta o comando tizen e SAIMO_TIZEN_PERFIL): a TV só aceita depois de assinar"
fi

echo "==> LG (webOS)"
W="$SAIDA/webos"; preparar webos "$W"
sed "s/%VERSAO%/$VERSAO/" tv/webos/appinfo.json > "$W/appinfo.json"
cp tv/webos/icon.png tv/webos/largeIcon.png "$W/"
npx --yes -p @webosose/ares-cli ares-package "$W" -o "$SAIDA" --no-minify >/dev/null
mv "$SAIDA"/br.com.saimo.tv_*_all.ipk "$SAIDA/SaimoTV-LG.ipk"

echo "pronto:"
ls -la "$SAIDA"/*.wgt "$SAIDA"/*.ipk | awk '{print "  " $5 " " $9}'
