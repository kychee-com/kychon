# scripts/

Build and deploy tooling. TypeScript, run via `tsx` (no compile step). All Run402 interactions go through `@run402/sdk/node` — typed methods, no `execSync('run402 …')`.

## Files

| File | Purpose |
|---|---|
| `deploy.ts` | Single-shot deploy — assemble bundle and call `apps.bundleDeploy()`. Used by both production (`kychon.run402.com`) and every demo wrapper. |
| `_lib.ts` | Shared helpers: file collection, function loading, RLS config, error formatting, project resolution, byte formatting. |

## Usage

```bash
# Production deploy
npx tsx scripts/deploy.ts

# Demo deploy (eagles, silver-pines, barrio-unido) — invoked via demo/<name>/deploy.sh
RUN402_PROJECT_ID=prj_xxx SUBDOMAIN=eagles \
  EXCLUDE_FUNCTIONS=check-expirations,reset-demo \
  SEED_FILE=demo/eagles/seed.sql \
  npx tsx scripts/deploy.ts

# Dry-run — assembles options, logs what would be sent, no API call
npx tsx scripts/deploy.ts --dry-run
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

`@run402/sdk` is exact-pinned (not `^` / `~`) because the SDK is <2 months old and has shipped breaking minor changes (1.44.0 removed `sites.deploy()`, the legacy inline-bytes path). Bump the pin in a deliberate PR with a diff review of the SDK changelog. CI catches signature drift via the smoke-test workflow (`.github/workflows/deploy-smoke.yml`).

When npm refuses to install a recently-published SDK release because of a `before=` cutoff in your local config, override with `npm install --before=null`.

## Single-shot deploy

The deploy is one HTTP call: `apps.bundleDeploy(projectId, { migrations, rls, functions, files, subdomain, inherit: true })`. No batching, no `sites.deploy()` follow-up. The legacy multi-call path (one bundle plus N file batches) was retired with SDK 1.44.0 — the 410 Gone removal of `sites.deploy()` made it unworkable, and the ~50MB+ payload ceiling on `apps.bundleDeploy` makes it unnecessary.

## Migration record

Tracked at `openspec/changes/deploy-sdk-migration/`.
