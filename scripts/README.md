# scripts/

Build and deploy tooling. TypeScript, run via `tsx` (no compile step). All Run402 interactions go through `@run402/sdk/node` — typed methods, no `execSync('run402 …')`. The full pipeline is TS — there are no per-demo bash wrappers and no `bootstrap-demo.sh` anymore.

## Files

| File | Purpose |
|---|---|
| `deploy.ts` | Production deploy entry — reads target from env vars and calls `runDeploy()`. |
| `deploy-demo.ts` | Per-demo orchestrator — copies demo assets, calls `runDeploy()` with the demo's seed/exclude/extra config, then bootstraps demo accounts. Has the `DEMOS` config map (eagles / silver-pines / barrio). |
| `deploy-all.ts` | Multi-demo dispatcher — runs `deploy-demo.ts` for one or all targets. Invoked via `bash deploy-all.sh` (which is just a 3-line wrapper that loads `.env` and calls this file). |
| `bootstrap-demo.ts` | Creates `demo-admin` + `demo-member` accounts, triggers on-signup, sets roles via `/admin/v1/rest/*`, stores demo_accounts in site_config. Idempotent. |
| `_lib.ts` | Shared helpers: `runDeploy()`, file collection, function loading, expose-tables config, error formatting, project resolution, byte formatting. |

## Usage

```bash
# Production deploy (kychon.run402.com)
npx tsx scripts/deploy.ts

# All 3 demos
bash deploy-all.sh

# One demo
bash deploy-all.sh eagles
bash deploy-all.sh silver-pines
bash deploy-all.sh barrio

# Direct (no bash wrapper) — needs env vars set in shell or via --env-file
npx tsx --env-file=.env scripts/deploy-all.ts
npx tsx scripts/deploy-demo.ts eagles

# Dry-run — assembles spec, logs what would be sent, no API call
npx tsx scripts/deploy.ts --dry-run
```

## Environment variables

`scripts/deploy.ts` (production deploy entry) reads:

| Var | Purpose |
|---|---|
| `RUN402_PROJECT_ID` | Target project. Falls back to `r.projects.active()` if unset. |
| `SUBDOMAIN` | Target subdomain (defaults to `kychon`). |
| `ANON_KEY` | Override anon key. Falls back to local keystore via `r.projects.keys()`. |
| `SEED_FILE` | Path to seed SQL (default: `seed.sql`). |
| `EXCLUDE_FUNCTIONS` | Comma-separated function names to skip. |
| `EXTRA_FUNCTION` | Path to a single extra `.js` function to append. |

`scripts/deploy-demo.ts` and `scripts/deploy-all.ts` ignore those env vars and instead read per-demo project ids:

| Var | Demo |
|---|---|
| `EAGLES_PROJECT_ID` | eagles → `eagles.kychon.com` |
| `SILVER_PINES_PROJECT_ID` | silver-pines → `silver-pines.kychon.com` |
| `BARRIO_PROJECT_ID` | barrio → `barrio.kychon.com` |

`deploy-all.sh` loads `.env` for you via `tsx --env-file=.env`. The TS scripts will surface a fast-fail error message if a required env var is missing.

## Type-checking

```bash
npx tsc --project tsconfig.scripts.json
```

The dedicated `tsconfig.scripts.json` extends `astro/tsconfigs/strictest` and adds `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Whole point of porting from `.js` was author-time safety on manifest shapes — keep the strictness up.

## SDK pin

`@run402/sdk` is exact-pinned (not `^` / `~`) because the SDK is <2 months old and has shipped breaking minor changes (1.50.x removed the legacy `apps.bundleDeploy` path's compat semantics; 1.44.0 removed `sites.deploy()` before that). Bump the pin in a deliberate PR with a diff review of the SDK changelog. CI catches signature drift via the smoke-test workflow (`.github/workflows/deploy-smoke.yml`).

When npm refuses to install a recently-published SDK release because of a `before=` cutoff in your local config, override with `npm install --before=null`.

## Single-shot deploy

The deploy goes through `r.deploy.apply(spec)` — the v2 unified deploy primitive. The SDK builds a `ReleaseSpec` (migrations, expose manifest, functions, site, subdomains), uploads bytes through CAS (only the SHAs the gateway hasn't seen), commits, and polls until `ready`. Re-deploying an unchanged tree issues no S3 PUTs.

We migrated off `apps.bundleDeploy()` in 1.50.1 (kychee-com/run402#154) because its compat shim was emitting an `expose.tables` shape the v2 deploy validator briefly rejected. The gateway validator was relaxed in 2026-04-30 to delegate to the same `validateManifest()` the imperative `/expose` route uses, so both bare strings and the rich `{name, expose, policy}` shape now work. We send the rich shape (matches the published schema, type-checks cleanly, and pins the policy explicitly).

## Service-key writes

Service-key writes go through `/admin/v1/rest/*`, not the PostgREST-shaped `/rest/v1/*` (which rejects service_role with `"service_role is not permitted on /rest/v1/*"`). The pre-port `bootstrap-demo.sh` was hitting `/rest/v1/*` with service_key and `> /dev/null`'ing the response — silently 403'ing on every demo deploy without anyone noticing. The TS port hits `/admin/v1/rest/*` and asserts response.ok.

## Migration record

Tracked at `openspec/changes/deploy-sdk-migration/`.
