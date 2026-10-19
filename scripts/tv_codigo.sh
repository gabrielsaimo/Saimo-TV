#!/bin/bash
#
# Compila o app para TV em dist-tv/ (saimo.js + saimo.css + manifesto.json).
# Usado por montar_tv.sh (pacotes .wgt/.ipk) e por publicar_site.sh (que publica o
# mesmo código em /tv/, de onde o carregador do pacote o baixa ao abrir).
set -euo pipefail
cd "$(dirname "$0")/.."
VERSAO="$(python3 -c "import json;print(json.load(open('package.json'))['version'])")"
echo "==> compilando o app para TV ($VERSAO)"
./node_modules/.bin/tsc -b
./node_modules/.bin/vite build --mode tv >/dev/null
python3 - "$VERSAO" <<'PY'
import json, sys, hashlib, pathlib
v = sys.argv[1]
h = hashlib.sha256(pathlib.Path("dist-tv/saimo.js").read_bytes()).hexdigest()[:10]
json.dump({"versao": f"{v}-{h}", "js": "saimo.js", "css": "saimo.css", "minimoCasca": 1},
          open("dist-tv/manifesto.json", "w"))
PY
rm -rf dist-tv/assets   # o worker do guia vai embutido no saimo.js
