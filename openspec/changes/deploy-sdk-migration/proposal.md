## Why

The deploy scripts (`deploy.js`, `deploy-batched.js`, `demo/*/deploy.sh`, and the sibling `kychon-private/marketing/deploy-marketing.js`) shell out to the `run402` CLI via `execSync` + `JSON.parse` — a brittle contract that surfaces as silent-success exit codes, stderr regex parsing, and whole-manifest HTTP 400s mid-upload (e.g. yesterday's 90-minute eagles outage when a server-side RLS template rename flipped `public_read` to `public_read_authenticated_write`). The official typed `@run402/sdk@1.43.0` now covers every call site we use, including a Node-only `sites.deployDir()` helper and typed `PaymentRequired` / `ApiError` / `LocalError` errors.

## What Changes

- **Port `deploy.js` + `deploy-batched.js` from JS + CLI shell-outs to TypeScript on `@run402/sdk/node`.** Use `r.apps.bundleDeploy()` for the full-stack path, `r.sites.deploy()` with `inherit: true` to preserve the outer batching loop until a single-shot 68MB upload is verified.
- **Pin `@run402/sdk` at `=1.43.0`** as a `devDependency`. Version pin is exact (not `^`) because the SDK is <1 week old and has already shipped breaking minor bumps.
- **Execute TS scripts via `tsx`** (no separate build step — dev loop stays `node deploy.js` → `tsx deploy.ts`).
- **Add CI smoke-test job** that runs `tsx deploy.ts --dry-run` against a scratch project on every push, guarding against SDK point-release surprises.
- **Update demo bash wrappers** (`demo/{eagles,silver-pines,barrio-unido}/deploy.sh`) to call the ported TS entry point instead of `node deploy-batched.js`.
- **Kill the stale `app-silver-pines.json` build artifact** now that the SDK takes structured options instead of JSON-file manifests.
- **Policy**: new tooling that talks to Run402 uses `@run402/sdk` directly — no new `execSync('run402 ...')` call sites.
- **Not breaking** for end-users: the deploy contract, produced artifacts, and site URLs are unchanged.

## Capabilities

### New Capabilities

<!-- No new capabilities. This is a rework of existing deploy specs, plus an additive smoke-test requirement on the CI spec. -->

### Modified Capabilities

- `deploy`: replace CLI-prescriptive requirements with tool-agnostic ones phrased against the Run402 bundle deploy API, reflecting the move to `@run402/sdk/node`. Retain all externally observable behaviors (idempotent migrations, RLS config, subdomain, scheduled functions).
- `ci-pipeline`: add a deploy smoke-test requirement — on every push to `main`, CI runs the ported deploy script in dry-run mode against a dedicated scratch project to catch SDK-contract breakage before it hits a real deploy.

*Note*: `marketing-deploy` spec exists in this repo but the actual script lives in the sibling `kychon-private` repo since repo-split. That spec should be archived or rewritten as a cross-repo dependency note — tracked as separate follow-up, not touched here.

## Impact

- **Code**: `deploy.js`, `deploy-batched.js` deleted → replaced with `scripts/deploy.ts` and `scripts/deploy-batched.ts`. Demo bash wrappers updated to point at the TS entry. Sibling private repo `kychon-private/marketing/deploy-marketing.js` needs the same treatment in a follow-up (out of scope for this change — different repo).
- **Dependencies**: `@run402/sdk@=1.43.0` + `tsx` added to `devDependencies`. No runtime deps change for the deployed site.
- **CI**: new job `deploy-smoke-test` added to `.github/workflows/ci.yml`; requires a dedicated scratch Run402 project ID held as a GitHub secret.
- **Specs**: `openspec/specs/deploy/spec.md`, `openspec/specs/marketing-deploy/spec.md`, and `openspec/specs/ci-pipeline/spec.md` get delta updates.
- **Docs**: `CLAUDE.md` already documents the OpenSpec workflow; no doc changes required beyond referencing the SDK policy in the deploy section.
- **External**: one open feature-request issue ([kychee-com/run402#113](https://github.com/kychee-com/run402/issues/113)) landed in SDK 1.43.0 and makes `r.projects.list()` argument-free on the Node entry — the ported code uses the new signature.
