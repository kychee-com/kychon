## 1. Dependency setup

- [x] 1.1 Confirm `@run402/sdk@=1.43.0` is pinned in `devDependencies` (already landed on branch; verify on PR base)
- [x] 1.2 Add `tsx` as a `devDependency` with an exact or caret pin consistent with other devDeps
- [x] 1.3 Add a `tsconfig.scripts.json` (or root `tsconfig.json` include entry) that covers `scripts/**/*.ts` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- [x] 1.4 Update `.gitignore` if any new build-artifact paths appear (shouldn't — `tsx` runs source directly)
- [x] 1.5 Commit deps + tsconfig as a separate PR-reviewable commit before any script ports

## 2. Port the single-project deploy

- [x] 2.1 Create `scripts/deploy.ts` — TypeScript port of `deploy.js` using `@run402/sdk/node`
- [x] 2.2 Resolve project id via `process.env.RUN402_PROJECT_ID ?? await r.projects.active()`; exit with clear error when neither is set
- [x] 2.3 Collect site files via `r.sites.deployDir` or equivalent helper — preserves current `dist/` walk semantics
- [x] 2.4 Collect functions from `functions/` with `// schedule:` comment parsing, typed as `BundleFunctionSpec[]`
- [x] 2.5 Assemble `BundleDeployOptions` with `migrations`, `rls`, `functions`, `files`, `subdomain`, `inherit: true`
- [x] 2.6 Wrap the `apps.bundleDeploy` call in `try/catch` handling `PaymentRequired`, `ApiError`, and `LocalError` distinctly; emit actionable error messages — *Note: LocalError fell through to abstract `Run402Error` base because SDK 1.43.0 doesn't re-export `LocalError` from public surface; follow-up tracked in section 8.*
- [x] 2.7 Add a `--dry-run` flag that assembles the options, logs what would be sent, and exits without an API call (used by CI smoke-test)
- [ ] 2.8 Verify `npx tsx scripts/deploy.ts` against a scratch project produces a working site **— PAUSED: real deploy, user-gated**

## 3. Port the batched demo deploy

- [x] 3.1 Create `scripts/deploy-batched.ts` — TypeScript port of `deploy-batched.js`
- [x] 3.2 Extract the image-batching helper (`sliceBySize(files, maxBytes)`) as a named function with a comment referencing the supersession contract from the spec
- [x] 3.3 First batch: `r.apps.bundleDeploy(projectId, { migrations, rls, secrets?, functions, subdomain, files: slices[0], inherit: true })`
- [x] 3.4 Subsequent batches: `for (const slice of slices.slice(1)) await r.sites.deploy(projectId, { files: slice, inherit: true })`
- [x] 3.5 Preserve the `EXCLUDE_FUNCTIONS` env var semantics used by demo deploys
- [x] 3.6 Preserve the `SEED_FILE` env var semantics used by demo deploys
- [ ] 3.7 Verify against a scratch project that N+1 HTTP calls land the same deployment state today's N+1 `run402 deploy` calls produce **— PAUSED: real deploy, user-gated**

## 4. Update bash wrappers

- [ ] 4.1 Update `demo/eagles/deploy.sh` to invoke `npx tsx scripts/deploy-batched.ts` instead of `node deploy-batched.js`
- [ ] 4.2 Do a real eagles deploy via the updated wrapper; verify site and cache behavior
- [ ] 4.3 Update `demo/silver-pines/deploy.sh` (note: uses its own inline manifest assembly — port that logic inline into the TS script or into a `demo/silver-pines/deploy.ts` thin wrapper)
- [ ] 4.4 Do a real silver-pines deploy via the updated wrapper; verify
- [ ] 4.5 Update `demo/barrio-unido/deploy.sh`
- [ ] 4.6 Do a real barrio deploy via the updated wrapper; verify
- [ ] 4.7 Update `deploy-all.sh` output messages if they reference old filenames

## 5. Remove old scripts

- [ ] 5.1 Delete `deploy.js` from repo root
- [ ] 5.2 Delete `deploy-batched.js` from repo root
- [ ] 5.3 Remove the generated-but-tracked `app-silver-pines.json` (if still tracked) and add it to `.gitignore` if the new script emits it anywhere
- [ ] 5.4 Grep for any stray references to `node deploy.js` / `node deploy-batched.js` in docs and update

## 6. CI smoke-test

- [ ] 6.1 Provision a dedicated scratch Run402 project for CI smoke-testing; store id as GitHub secret `RUN402_SMOKE_PROJECT_ID`
- [ ] 6.2 Export that project's allowance JSON; store as GitHub secret `RUN402_SMOKE_ALLOWANCE_JSON`
- [ ] 6.3 Fund the scratch project's wallet with enough USDC to cover ~10 tier renewals at current pricing
- [ ] 6.4 Add `deploy-smoke-test` job to `.github/workflows/ci.yml`: writes allowance secret to tmpfile, runs `npx tsx scripts/deploy.ts --dry-run` with `RUN402_PROJECT_ID` pointed at scratch project
- [ ] 6.5 Add a pre-step that runs `r.tier.status()` (via a short helper TS) and fails fast with a readable message if the scratch tier is expired
- [ ] 6.6 Gate merge of this PR on the smoke-test job passing against the new scripts

## 7. Documentation

- [ ] 7.1 Add a one-liner in `CLAUDE.md`'s "Key Conventions" section: new Node tooling targeting Run402 uses `@run402/sdk/node` — no new `execSync('run402 …')` call sites
- [ ] 7.2 Update `CLAUDE.md`'s "File Structure" section to reflect `scripts/deploy.ts` (`deploy.js` references removed)
- [ ] 7.3 Update any `docs/*.md` references to `deploy.js` → `scripts/deploy.ts`
- [ ] 7.4 Add a short `scripts/README.md` explaining the deploy scripts, the `--dry-run` flag, and the pinned SDK version

## 8. Follow-up captures (not in this change)

- [ ] 8.1 File an issue (or propose a separate OpenSpec change) to archive or rewrite `openspec/specs/marketing-deploy/spec.md` since the script now lives in `kychon-private`
- [ ] 8.2 File an issue to investigate yesterday's `run402 functions deploy reset-demo` HTTP 401 error — blocked on cron reset silently dying
- [ ] 8.3 File an issue to load-test a single-shot `apps.bundleDeploy` against ~68MB of real production data; goal is removing the batching loop (supersedes the "batching preserved" spec requirement)
- [ ] 8.4 Bring up cross-repo migration for `kychon-private/marketing/deploy-marketing.js` with private-repo maintainers
- [ ] 8.5 File an issue to update `openspec/specs/ci-pipeline/spec.md`'s "CI uses Node 20" requirement to "Node 22" to match actual workflow (discovered while writing this change, out of scope)
