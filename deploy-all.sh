#!/bin/bash
# Deploy all Kychon DEMO sites — thin wrapper around scripts/deploy-all.ts.
#
# Usage: bash deploy-all.sh                # all 3 demos
#        bash deploy-all.sh eagles         # only Eagles
#        bash deploy-all.sh silver-pines   # only Silver Pines
#        bash deploy-all.sh barrio         # only Barrio Unido
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
exec npx --prefix "$ROOT" tsx --env-file="$ROOT/.env" "$ROOT/scripts/deploy-all.ts" "$@"
