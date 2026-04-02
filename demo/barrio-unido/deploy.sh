#!/bin/bash
# Deploy Barrio Unido demo to Run402
# Usage: bash demo/barrio-unido/deploy.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_ID="${BARRIO_PROJECT_ID:?Set BARRIO_PROJECT_ID env var}"

echo "=== Barrio Unido Deploy ==="
echo "Project: $PROJECT_ID"

# Copy demo assets into public/assets so Astro build includes them in dist/
ASSETS_SRC="$SCRIPT_DIR/assets"
ASSETS_DST="$ROOT/public/assets"

if [ -d "$ASSETS_SRC" ]; then
  echo "Copying demo assets into public/assets..."
  mkdir -p "$ASSETS_DST"
  cp "$ASSETS_SRC"/* "$ASSETS_DST/"
fi

# Deploy site + images + seed (deploy.js runs astro build + collects from dist/)
cd "$ROOT"
SEED_FILE="demo/barrio-unido/seed.sql" RUN402_PROJECT_ID="$PROJECT_ID" SUBDOMAIN=barrio-unido node deploy.js

# Clean up copied assets
if [ -d "$ASSETS_DST" ]; then
  echo "Cleaning up copied assets..."
  rm -rf "$ASSETS_DST"
fi

echo ""
echo "=== Deploy complete ==="
echo "Live at: https://barrio-unido.run402.com"
