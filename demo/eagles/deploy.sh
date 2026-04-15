#!/bin/bash
# Deploy Eagles demo to Run402
# Usage: bash demo/eagles/deploy.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_ID="${EAGLES_PROJECT_ID:?Set EAGLES_PROJECT_ID env var}"

echo "=== Eagles Deploy ==="
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
SEED_FILE="demo/eagles/seed.sql" RUN402_PROJECT_ID="$PROJECT_ID" SUBDOMAIN=eagles \
  EXCLUDE_FUNCTIONS=check-expirations \
  node deploy-batched.js

# Deploy reset-demo separately (too large for bundle deploy)
echo "Deploying reset-demo function separately..."
run402 functions update "$PROJECT_ID" check-expirations --schedule-remove 2>/dev/null || true
run402 functions deploy "$PROJECT_ID" reset-demo --file "$SCRIPT_DIR/reset-demo.js" --schedule "0 * * * *"

# Clean up copied assets
if [ -d "$ASSETS_DST" ]; then
  echo "Cleaning up copied assets..."
  rm -rf "$ASSETS_DST"
fi

# Bootstrap demo accounts (idempotent — creates/links demo-admin + demo-member auth users)
echo ""
echo "Bootstrapping demo accounts..."
ANON_KEY=$(run402 projects keys "$PROJECT_ID" | jq -r '.anon_key')
bash "$ROOT/scripts/bootstrap-demo.sh" "$PROJECT_ID" "$ANON_KEY"

echo ""
echo "=== Deploy complete ==="
echo "Live at: https://eagles.kychon.com"
