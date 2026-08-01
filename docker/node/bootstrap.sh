#!/bin/sh
set -e

MODEL_PATH="${KATAGO_MODEL:-/home/node/app/katago/models/default.bin.gz}"
MODEL_URL="${KATAGO_MODEL_URL:-}"

if [ -n "$MODEL_URL" ] && [ ! -f "$MODEL_PATH" ]; then
  echo "Downloading KataGo model to $MODEL_PATH"
  mkdir -p "$(dirname "$MODEL_PATH")"
  curl -fsSL "$MODEL_URL" -o "$MODEL_PATH"
fi

exec "$@"
