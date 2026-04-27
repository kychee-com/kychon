#!/bin/bash
# Deploy Silver Pines demo to Run402.
#
# Copies the demo's source images into public/assets/ at full resolution,
# then delegates the actual Run402 deploy to scripts/deploy.ts.
#
# Usage: bash demo/silver-pines/deploy.sh
set -e

PROJECT_ID="${SILVER_PINES_PROJECT_ID:?Set SILVER_PINES_PROJECT_ID env var}"
SUBDOMAIN="silver-pines"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ASSETS_SRC="$SCRIPT_DIR/assets"
ASSETS_DST="$ROOT/public/assets"

echo "=== Silver Pines Demo Deploy ==="

# Clean up copied assets on any exit (success or failure) so a mid-flow failure
# doesn't leave the working tree dirty.
trap '[ -d "$ASSETS_DST" ] && rm -rf "$ASSETS_DST"' EXIT

# 1. Copy demo assets into public/assets/ at full resolution.
if [ -d "$ASSETS_SRC" ]; then
  echo "Copying demo assets into public/assets..."
  mkdir -p "$ASSETS_DST"
  cp "$ASSETS_SRC"/* "$ASSETS_DST/"
fi

# 2. Run the deploy via scripts/deploy.ts.
#    - SEED_FILE points at the silver-pines seed (concatenated with schema.sql)
#    - EXCLUDE_FUNCTIONS removes the production-only check-expirations cron
#    - EXTRA_FUNCTION adds the silver-pines-specific reset-demo cron
cd "$ROOT"
SEED_FILE="demo/silver-pines/seed.sql" \
  RUN402_PROJECT_ID="$PROJECT_ID" \
  SUBDOMAIN="$SUBDOMAIN" \
  EXCLUDE_FUNCTIONS=check-expirations \
  EXTRA_FUNCTION="demo/silver-pines/reset-demo.js" \
  npx tsx scripts/deploy.ts

# 3. Bootstrap demo accounts (idempotent — creates/links demo-admin + demo-member auth users).
echo ""
echo "Bootstrapping demo accounts..."
ANON_KEY=$(run402 projects keys "$PROJECT_ID" | jq -r '.anon_key')
bash "$ROOT/scripts/bootstrap-demo.sh" "$PROJECT_ID" "$ANON_KEY"

echo ""
echo "=== Done! ==="
echo "Live at: https://${SUBDOMAIN}.kychon.com"
