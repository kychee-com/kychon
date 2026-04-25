#!/bin/bash
# Deploy Silver Pines demo to Run402.
#
# Resizes the demo's source images via `sips` (web-optimized JPEGs/PNG),
# copies them into public/assets/ for the Astro build to pick up, then
# delegates the actual Run402 deploy to scripts/deploy.ts.
#
# Usage: bash demo/silver-pines/deploy.sh
set -e

PROJECT_ID="${SILVER_PINES_PROJECT_ID:?Set SILVER_PINES_PROJECT_ID env var}"
SUBDOMAIN="silver-pines"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ASSETS_DST="$ROOT/public/assets"

echo "=== Silver Pines Demo Deploy ==="

# Clean up copied assets on any exit (success or failure) so a mid-flow failure
# doesn't leave the working tree dirty.
trap '[ -d "$ASSETS_DST" ] && rm -rf "$ASSETS_DST"' EXIT

# 1. Resize images to web-friendly sizes directly into public/assets/.
echo "Resizing images into public/assets/..."
mkdir -p "$ASSETS_DST"
for f in "$SCRIPT_DIR/assets"/avatar-*.jpg; do
  [ -f "$f" ] && sips -Z 256 -s formatOptions 70 -s format jpeg "$f" --out "$ASSETS_DST/$(basename "$f")" >/dev/null 2>&1
done
for f in "$SCRIPT_DIR/assets"/event-*.jpg; do
  [ -f "$f" ] && sips -Z 800 -s formatOptions 70 -s format jpeg "$f" --out "$ASSETS_DST/$(basename "$f")" >/dev/null 2>&1
done
for f in "$SCRIPT_DIR/assets"/committee-*.jpg; do
  [ -f "$f" ] && sips -Z 800 -s formatOptions 70 -s format jpeg "$f" --out "$ASSETS_DST/$(basename "$f")" >/dev/null 2>&1
done
for f in "$SCRIPT_DIR/assets"/hero.jpg; do
  [ -f "$f" ] && sips -Z 1200 -s formatOptions 70 -s format jpeg "$f" --out "$ASSETS_DST/$(basename "$f")" >/dev/null 2>&1
done
for f in "$SCRIPT_DIR/assets"/logo.png; do
  [ -f "$f" ] && sips -Z 256 "$f" --out "$ASSETS_DST/$(basename "$f")" >/dev/null 2>&1
done
echo "  $(ls "$ASSETS_DST" | wc -l | tr -d ' ') images ($(du -sh "$ASSETS_DST" | cut -f1) web-optimized)"

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
