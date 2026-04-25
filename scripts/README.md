# scripts/

Build and deploy tooling. TypeScript, run via `tsx` (no compile step). All Run402 interactions go through `@run402/sdk/node` — typed methods, no `execSync('run402 …')`.

## Files

| File | Purpose |
|---|---|
| `deploy.ts` | Single-project deploy — assemble bundle and call `apps.bundleDeploy`. |
| `deploy-batched.ts` | Batched deploy for demo sites with large image payloads (~52 images / ~68MB). Splits into ~25MB slices, first slice via `apps.bundleDeploy` with metadata, rest via `sites.deploy`. |
| `_lib.ts` | Shared helpers: file collection, function loading, RLS config, error formatting, project resolution, etc. |

## Usage

```bash
# Single deploy (production / kychon main)
npx tsx scripts/deploy.ts

# Demo deploy (eagles, silver-pines, barrio) — invoked via demo/<name>/deploy.sh
RUN402_PROJECT_ID=prj_xxx SUBDOMAIN=eagles \
  EXCLUDE_FUNCTIONS=check-expirations,reset-demo \
  SEED_FILE=demo/eagles/seed.sql \
  npx tsx scripts/deploy-batched.ts

# Dry-run — assembles options, logs what would be sent, no API call
npx tsx scripts/deploy.ts --dry-run
npx tsx scripts/deploy-batched.ts --dry-run
```

## Environment variables

| Var | Purpose |
|---|---|
| `RUN402_PROJECT_ID` | Target project. Falls back to `r.projects.active()` if unset. |
| `SUBDOMAIN` | Target subdomain (defaults to `kychon`). |
| `ANON_KEY` | Override anon key. Falls back to local keystore via `r.projects.keys()`. |
| `SEED_FILE` | Path to seed SQL (default: `seed.sql`). Used by demo deploys. |
| `EXCLUDE_FUNCTIONS` | Comma-separated function names to skip during deploy. |
| `EXTRA_FUNCTION` | Path to a single extra `.js` function to append. |

## Type-checking

```bash
npx tsc --project tsconfig.scripts.json
```

The dedicated `tsconfig.scripts.json` extends `astro/tsconfigs/strictest` and adds `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Whole point of porting from `.js` was author-time safety on manifest shapes — keep the strictness up.

## SDK pin

`@run402/sdk` is exact-pinned (not `^` / `~`) because the SDK is <1 month old and has already shipped breaking minor changes. Bump the pin in a deliberate PR with a diff review of the SDK changelog. CI catches signature drift via the smoke-test workflow (`.github/workflows/ci.yml :: deploy-smoke-test` — once secrets are configured).

## Migration record

Tracked at `openspec/changes/deploy-sdk-migration/`. The legacy `deploy.js` and `deploy-batched.js` at the repo root remain in place until bash wrappers (`demo/*/deploy.sh`, `deploy-marketing.sh` in the sibling private repo) cut over to the TS entry points.
