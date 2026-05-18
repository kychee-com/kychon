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
| `SUBDOMAIN` | Required target subdomain. Deploys fail fast when unset. |
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

Set `RUN402_ALLOW_WARNINGS=true` only after reviewing confirmation-required deploy warnings (for example, expected full-site static file replacement on demo deploys).

## Type-checking

```bash
npx tsc --project tsconfig.scripts.json
```

The dedicated `tsconfig.scripts.json` extends `astro/tsconfigs/strictest` and adds `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Whole point of porting from `.js` was author-time safety on manifest shapes — keep the strictness up.

## SDK pin

`@run402/sdk` is exact-pinned (not `^` / `~`) because the SDK is <2 months old and has shipped breaking minor changes — and one major (2.0 "Unified Apply" on 2026-05-18, which removed `r.deploy.apply` in favor of the project-scoped `r.project(id).apply` hero; 2.0.1 patched a release-time bug where the new hero still hit the retired `/storage/v1/uploads/:id/complete` route; 2.1.0 completed the SDK side by routing `r.assets.put` / `uploadDir` / `syncDir` / `prepareDir` / `putMany` through the same unified-apply substrate and making the legacy `initUploadSession` / `getUploadSession` / `completeUploadSession` methods throw `LocalError`; 2.2.0 added `assets.put()` to `@run402/functions` so edge functions get the helper from the in-runtime library without bundling the full SDK; earlier breakage: 1.50.x removed the legacy `apps.bundleDeploy` path's compat semantics; 1.44.0 removed `sites.deploy()` before that). Bump the pin in a deliberate PR with a diff review of the SDK changelog. CI catches signature drift via the smoke-test workflow (`.github/workflows/deploy-smoke.yml`).

When npm refuses to install a recently-published SDK release because of a `before=` cutoff in your local config, override with `npm install --before=null`.

## Single-shot deploy

The deploy goes through `r.project(id).apply(spec)` — the v2.0 "Unified Apply" hero. The SDK builds a `ReleaseSpec` (migrations, expose manifest, functions, site, subdomains, optional assets), uploads bytes through CAS (only the SHAs the gateway hasn't seen), commits, and polls until `ready`. Re-deploying an unchanged tree issues no S3 PUTs. (Pre-2.0 used `r.deploy.apply(spec)` — removed in 2.0; see `openspec/changes/upgrade-run402-sdk-v2`.)

Static files use Run402 v1.69 `site.public_paths` in explicit mode. Release assets such as `events.html` and `search.html` are still present in the site bundle, but browser-visible paths are clean entries such as `/events` and `/search`; implementation paths like `/events.html` are intentionally not public unless a future compatibility path declares them.

Deploy logs and dry-runs print representative public path mappings. For deployed checks, inspect `static_public_paths` in the active release inventory and confirm `reachability_authority: "explicit_public_path"` for page routes:

```bash
run402 deploy release active --project <project_id>
run402 deploy diagnose --project <project_id> https://example.kychon.com/events --method GET
npx tsx scripts/verify-first-byte-chrome.ts --base https://example.kychon.com --brand "Example Club"
```

We migrated off `apps.bundleDeploy()` in 1.50.1 (kychee-com/run402#154) because its compat shim was emitting an `expose.tables` shape the v2 deploy validator briefly rejected. The gateway validator was relaxed in 2026-04-30 to delegate to the same `validateManifest()` the imperative `/expose` route uses, so both bare strings and the rich `{name, expose, policy}` shape now work. We send the rich shape (matches the published schema, type-checks cleanly, and pins the policy explicitly). In 2.0 "Unified Apply" (2026-05-18), `r.deploy.apply` itself was removed in favor of the project-scoped `r.project(id).apply` — see `openspec/changes/upgrade-run402-sdk-v2`. 2.0.1 fixed the broken completion call introduced in 2.0.0; 2.1.0 rewrote `r.assets.put` etc. onto the same unified substrate so single-key uploads are ergonomic again; 2.2.0 added `assets.put()` to `@run402/functions` so edge-function uploads can use the helper without bundling the SDK.

## Engine release metadata

Every deploy writes `dist/kychon-release.json` before collecting the Run402 file set. The manifest is the durable engine release stamp for hosted Kychon portals: SemVer engine version, git SHA, build time, release channel, promotion status, schema migration ID/checksum, seed identity, and exact `@run402/sdk` version.

Release channels and promotion status are explicit:

| Env var | Default | Allowed values |
|---|---|---|
| `KYCHON_RELEASE_CHANNEL` | `dev` | `dev`, `canary`, `stable`, `security` |
| `KYCHON_RELEASE_PROMOTION_STATUS` | `candidate` | `candidate`, `promoted`, `withdrawn`, `deprecated` |
| `KYCHON_RELEASE_NOTES_URL` | unset | URL or text reference to release notes |
| `KYCHON_GIT_SHA` | git / `GITHUB_SHA` | exact source SHA override |

SemVer policy:

- `PATCH` releases are bug fixes, visual fixes, function fixes, and safe additive migrations.
- `MINOR` releases are backwards-compatible features, optional schema, or new portal surfaces.
- `MAJOR` releases are breaking block/config/schema behavior or manual upgrade work.
- prereleases such as `1.5.0-rc.1` are candidates/canaries and do not become latest stable.

`main` is not latest stable. A commit becomes a hosted-fleet target only after its release manifest is promoted on a channel by the Kychon release process.

## Service-key writes

Service-key writes go through `/admin/v1/rest/*`, not the PostgREST-shaped `/rest/v1/*` (which rejects service_role with `"service_role is not permitted on /rest/v1/*"`). The pre-port `bootstrap-demo.sh` was hitting `/rest/v1/*` with service_key and `> /dev/null`'ing the response — silently 403'ing on every demo deploy without anyone noticing. The TS port hits `/admin/v1/rest/*` and asserts response.ok.

## Migration record

Tracked at `openspec/changes/deploy-sdk-migration/`.
