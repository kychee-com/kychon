#!/bin/bash
# deploy-all.sh — Deploy all Kychon DEMO sites to their run402 projects.
#
# Demos (live at *.kychon.com via run402 custom-domain binding):
#   1. Eagles        → eagles.kychon.com
#   2. Silver Pines  → silver-pines.kychon.com
#   3. Barrio Unido  → barrio.kychon.com
#
# The marketing site (kychon.com) lives in the private operator repo
# kychee-com/kychon-private per saas-factory F12. Deploy marketing from
# there via `bash deploy-marketing.sh`.
#
# Usage: bash deploy-all.sh
#        bash deploy-all.sh eagles          # deploy only Eagles
#        bash deploy-all.sh silver-pines    # deploy only Silver Pines
#        bash deploy-all.sh barrio          # deploy only Barrio Unido
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Load project IDs from .env (can be overridden by env vars)
if [ -f "$ROOT/.env" ]; then
  set -a
  source "$ROOT/.env"
  set +a
fi

# --- Project IDs ---
export EAGLES_PROJECT_ID="${EAGLES_PROJECT_ID:?Set EAGLES_PROJECT_ID in .env or env}"
export SILVER_PINES_PROJECT_ID="${SILVER_PINES_PROJECT_ID:?Set SILVER_PINES_PROJECT_ID in .env or env}"
export BARRIO_PROJECT_ID="${BARRIO_PROJECT_ID:?Set BARRIO_PROJECT_ID in .env or env}"

TARGET="${1:-all}"

echo "============================================"
echo "  Kychon — Deploy Demo Sites"
echo "============================================"
echo ""
echo "  Eagles:       $EAGLES_PROJECT_ID → eagles.kychon.com"
echo "  Silver Pines: $SILVER_PINES_PROJECT_ID → silver-pines.kychon.com"
echo "  Barrio Unido: $BARRIO_PROJECT_ID → barrio.kychon.com"
echo ""
echo "  Target: $TARGET"
echo ""
echo "  Marketing site (kychon.com) lives in kychee-com/kychon-private;"
echo "  deploy it separately via: cd ../kychon-private && bash deploy-marketing.sh"
echo "============================================"
echo ""

FAILED=()

# --- 1. Eagles ---
if [ "$TARGET" = "all" ] || [ "$TARGET" = "eagles" ]; then
  echo ""
  echo ">>> [1/3] Deploying Eagles demo..."
  echo "--------------------------------------------"
  if bash demo/eagles/deploy.sh; then
    echo ">>> Eagles: OK"
  else
    echo ">>> Eagles: FAILED"
    FAILED+=("Eagles")
  fi
fi

# --- 2. Silver Pines ---
if [ "$TARGET" = "all" ] || [ "$TARGET" = "silver-pines" ]; then
  echo ""
  echo ">>> [2/3] Deploying Silver Pines demo..."
  echo "--------------------------------------------"
  if bash demo/silver-pines/deploy.sh; then
    echo ">>> Silver Pines: OK"
  else
    echo ">>> Silver Pines: FAILED"
    FAILED+=("Silver Pines")
  fi
fi

# --- 3. Barrio Unido ---
if [ "$TARGET" = "all" ] || [ "$TARGET" = "barrio" ]; then
  echo ""
  echo ">>> [3/3] Deploying Barrio Unido demo..."
  echo "--------------------------------------------"
  if bash demo/barrio-unido/deploy.sh; then
    echo ">>> Barrio Unido: OK"
  else
    echo ">>> Barrio Unido: FAILED"
    FAILED+=("Barrio Unido")
  fi
fi

# --- Summary ---
echo ""
echo "============================================"
echo "  Deploy Summary"
echo "============================================"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "  All demo sites deployed successfully!"
else
  echo "  FAILURES: ${FAILED[*]}"
  echo ""
  exit 1
fi
echo ""
echo "  Eagles:       https://eagles.kychon.com"
echo "  Silver Pines: https://silver-pines.kychon.com"
echo "  Barrio Unido: https://barrio.kychon.com"
echo ""
echo "  Marketing (separate): cd ../kychon-private && bash deploy-marketing.sh"
echo "============================================"
