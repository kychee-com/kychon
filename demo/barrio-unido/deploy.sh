#!/bin/bash
# Deploy Barrio Unido demo to Run402
# Usage: bash demo/barrio-unido/deploy.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_ID="${BARRIO_PROJECT_ID:-prj_1774962829424_0008}"

echo "=== Barrio Unido Deploy ==="
echo "Project: $PROJECT_ID"

# Symlink demo assets into site/assets so deploy.js picks them up
ASSETS_SRC="$SCRIPT_DIR/assets"
ASSETS_DST="$ROOT/site/assets"

if [ -d "$ASSETS_SRC" ]; then
  echo "Copying demo assets into site/assets..."
  mkdir -p "$ASSETS_DST"
  cp "$ASSETS_SRC"/* "$ASSETS_DST/"
fi

# Deploy site + images + seed
cd "$ROOT"
RUN402_PROJECT_ID="$PROJECT_ID" SUBDOMAIN=barrio-unido node deploy.js

# Run the barrio-unido seed
echo ""
echo "Running barrio-unido seed..."
run402 projects sql "$PROJECT_ID" --file "$SCRIPT_DIR/seed.sql"

# Clean up symlinks
if [ -d "$ASSETS_DST" ]; then
  echo "Cleaning up copied assets..."
  rm -rf "$ASSETS_DST"
fi

echo ""
echo "=== Deploy complete ==="
echo "Live at: https://barrio-unido.run402.com"
