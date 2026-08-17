#!/bin/bash
# Doble clic para arrancar la app en una Mac.
cd "$(dirname "$0")"
mkdir -p logs

if ! command -v node >/dev/null 2>&1; then
  echo "Falta instalar Node.js: https://nodejs.org (version LTS)"
  read -p "Enter para cerrar..."
  exit 1
fi

[ -d node_modules ] || npm install
[ -d client/dist ] || (cd client && npm install && npm run build)

echo "Arrancando..."
node server/index.js
