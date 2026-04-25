## Context

Today's deploy surface is four Node scripts (`deploy.js`, `deploy-batched.js`, and per-demo bash wrappers that call them) plus one private-repo cousin (`kychon-private/marketing/deploy-marketing.js`). Every call to Run402 goes through `execSync('run402 …')`, with stdout `JSON.parse`d and stderr regex-matched for error handling. This produced real outages yesterday:

- A server-side RLS template rename (`public_read` → `public_read_authenticated_write`) was silently rejected with HTTP 400 after batches 1-3 of images had already uploaded → 90 minutes of 404s on `eagles.kychon.com` until manual fix + redeploy. The pre-flight validation was the server's, not the client's, and the error arrived only after ~68MB of wasted upload.
- A CLI packaging bug (`run402@1.40.1`) bricked every `execSync('run402 …')` call with `ERR_MODULE_NOT_FOUND`. The fix came in `1.40.2` the same day, but any script-level logic that tried to parse `run402 tier status` during that window exited 0 with the wrong state.
- `run402 tier set prototype` returned a 402 payment challenge to stdout and exited 0, making it look like success. Scripts that used exit codes as ground truth skipped past the failure.

`@run402/sdk@1.43.0` fixes all three classes of pain: typed method signatures (`PaymentRequired`, `ApiError`, `LocalError`) instead of stderr parsing; one process instead of a subprocess per call; and structured `apps.bundleDeploy()` / `sites.deploy()` methods whose signatures match the current manifest shape 1:1. The optional-wallet `projects.list()` shipped in 1.43.0 (from our feature request [kychee-com/run402#113](https://github.com/kychee-com/run402/issues/113)) and `sites.deployDir()` handles most of the current `collectFiles` boilerplate.

CI runs Node 22 (`engines.node: >=22` matches the SDK floor). No runtime changes for the deployed site — this is deploy-tooling only.

## Goals / Non-Goals

**Goals:**

- Replace `execSync('run402 …')` with typed SDK calls in all `.js` deploy scripts in this repo.
- Port those scripts from `.js` to `.ts`, executed via `tsx` (no build step).
- Keep the current batching pattern (multi-call with `inherit: true`) until a single-shot 68MB `apps.bundleDeploy()` is load-tested.
- Add a CI smoke-test job that runs the ported deploy script in `--dry-run` mode against a dedicated scratch Run402 project on every push to `main`.
- Establish a policy that new Node-side tooling targeting Run402 uses `@run402/sdk` directly (no new `execSync` call sites).
- Preserve every externally observable behavior of the current deploy (same artifacts, same site URLs, same idempotency, same cron schedules).

**Non-Goals:**

- Migrating the sibling private repo `kychon-private/marketing/deploy-marketing.js`. Different repo, different maintainers, out of scope.
- Rewriting the per-demo bash wrappers (`demo/*/deploy.sh`). They stay bash — only their body changes to call the TS entry point instead of `node deploy-batched.js`.
- Replacing the standalone `run402 functions deploy reset-demo` call (used because the bundle is too large to include it). Still a CLI call for now; revisit once we know whether `apps.bundleDeploy` can accept it inline.
- Removing the existing trap-based `public/assets/` cleanup ([commit 7180d0c](https://github.com/kychee-com/kychon/commit/7180d0c)) — that's orthogonal.
- Replacing the Astro build step. `astro build` still runs up front; `tsx deploy.ts` only handles what happens after.

## Decisions

### Decision 1: `tsx` for TS execution, no compile step

Options considered: `ts-node`, `tsc --noEmit` + keep `.js` in the run path, `bun run`, `tsx`.

Picked **`tsx`** because (a) single npm install, zero config; (b) faster cold start than `ts-node`; (c) matches what CI and local dev already do for vitest; (d) no separate `dist/` to manage and accidentally commit; (e) Bun would work but adds a second runtime for the repo. `tsc --noEmit` would let us keep `.js` but loses the co-located types benefit that was half the point of migrating.

Rejected: `ts-node` (slower, more config), `bun run` (second runtime), compile-to-`.js` (build step drag).

### Decision 2: Exact-pin `@run402/sdk@=1.43.0`

The SDK is 2 days old (first release 2026-04-23), has already shipped breaking minor bumps (`sites.deploy()` signature changed 1.41 → 1.42), and the run402 team are actively co-developing with us. Caret-pin (`^1.43.0`) would auto-upgrade us into future breaking minors. Tilde (`~1.43.0`) still accepts patches that could break us. Exact (`=1.43.0`) means we bump deliberately, with a diff review, until the API stabilizes. Review exact-pin policy once three consecutive minor releases are non-breaking.

### Decision 3: Keep the outer batching loop

`deploy-batched.js` currently splits ~52 images into 3 batches + 1 final (code + migrations + RLS + functions) because past single-shot deploys timed out with `UND_ERR_HEADERS_TIMEOUT` (kychee-com/run402 #29, #31 — closed, fix unclear). The SDK's `apps.bundleDeploy()` does not expose an internal batch size. Until a single-shot 68MB upload is verified against production, ported code will keep the batching pattern:

```ts
// first call: bundle non-file metadata + first file slice
await r.apps.bundleDeploy(projectId, {
  migrations, rls, secrets, functions, subdomain,
  files: slices[0],
  inherit: true,
});

// subsequent calls: file-only incremental
for (const slice of slices.slice(1)) {
  await r.sites.deploy(projectId, { files: slice, inherit: true });
}
```

Loss: each deploy is N+1 HTTP calls instead of 1, and the operation is non-atomic the same way today's is ([#108](https://github.com/kychee-com/run402/issues/108)). Acceptable temporarily; revisit once we load-test single-shot. Document the loop-exit condition so removing it later is a small PR.

### Decision 4: CI smoke-test runs in `--dry-run` mode, not a real deploy

Every push to `main` runs `tsx scripts/deploy.ts --dry-run` against a **dedicated scratch Run402 project** (held in a GitHub secret, separate from eagles/silver-pines/barrio/marketing). Dry-run means: build the manifest, assemble options, call `r.apps.bundleDeploy(scratchId, opts)` against a throwaway project and roll back / delete the resulting deployment. Catches:

- SDK signature drift (a minor bump breaks our call sites)
- Auth/credential setup (the scratch project's allowance expired)
- Missing required fields in the options object
- Migration SQL parse errors (server rejects the migration block)

Does not catch: Astro build regressions, batch-size issues (only hits one scratch project), runtime deploy failures specific to eagles' data size. Trade-off accepted — the goal is SDK-contract guarding, not end-to-end coverage. A real deploy stays behind a manual gate.

### Decision 5: TypeScript strict mode for the ported scripts

`tsconfig.scripts.json` (or inline `tsconfig.json` section) sets `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. The whole point is type safety catching manifest-shape mistakes at author-time — loose TS would be ceremony without payoff. Aligns with the project's existing `typescript: ^5.7.3` devDep.

### Decision 6: Script layout — `scripts/deploy.ts` and `scripts/deploy-batched.ts`

Move from repo root to `scripts/`. Rationale: (a) `.js` files at the root are easy to mistake for the Astro app; (b) gives a clear home for future TS tooling; (c) matches how most Node projects organize build/deploy helpers. Update demo bash wrappers + any docs that reference the old paths.

## Risks / Trade-offs

- **SDK instability** → Exact-pin `=1.43.0`. Any SDK bump is a deliberate PR. CI smoke-test catches drift in vendored builds before a real deploy.
- **Single-shot deploy might fail at production size** → Keep the batching loop; document where to remove it; plan a separate load-test PR to validate single-shot before simplifying.
- **`tsx` adds a devDep but no runtime change** → Lockfile grows by ~a few MB. Acceptable; vitest already pulls similar tooling in.
- **Scratch project for smoke-test needs funding** → Project-level allowance needs to stay funded to cover the ~$0.10 tier renewals on test deploys. Cheaper than an outage. Document the funding model in the CI spec. A funded-tier check as part of the smoke test fails fast when the scratch project lapses.
- **Port happens while kychon-private still uses the CLI** → Two styles of deploy scripts coexist until the sibling repo catches up. No code coupling, so no breakage — just doc drift. Note the follow-up in the proposal.
- **`run402 functions deploy reset-demo` stays as `execSync`** → The bash wrappers still shell out for this one call. Same brittleness, but scoped to one known case. Remove when the bundle-size reason goes away (likely an SDK fix on their side).
- **CI auth secret management** → Scratch-project allowance private key lives in GitHub Secrets. Documented in the CI spec; treated like any other credential. No keystore-on-disk in CI runners — the SDK accepts an inline allowance via `NodeRun402Options.allowancePath` pointing at a tmpfile written from the secret.

## Migration Plan

1. Add `@run402/sdk@=1.43.0` + `tsx` to `devDependencies`. Commit separately so the install diff is reviewable on its own.
2. Write `scripts/deploy.ts` + `scripts/deploy-batched.ts` as the TS ports of the existing `.js` files. Keep the old `.js` files intact during this step so deploys keep working from bash wrappers.
3. Update `demo/{eagles,silver-pines,barrio-unido}/deploy.sh` to call `npx tsx scripts/deploy-batched.ts …` instead of `node deploy-batched.js`. One wrapper at a time, verify each with a real deploy.
4. Delete the original `deploy.js` + `deploy-batched.js` once every wrapper points at the TS entry. Clean up any artifacts (`app-silver-pines.json` etc.) no longer written.
5. Add the CI smoke-test job; gate its enablement on a green run against the scratch project.
6. Update `CLAUDE.md` with a one-liner referencing the SDK policy in the Tooling section (new code uses `@run402/sdk`, not `execSync('run402 …')`).

Rollback: `git revert` of the script replacement restores `deploy-batched.js` verbatim. Nothing about the DB/site state of a deployed project depends on whether the deploy came from the JS or TS script.

## Open Questions

- **Single-shot `apps.bundleDeploy()` payload ceiling**: What's the real cutoff before timeouts? Testable but requires a dedicated run against a scratch project with representative data. Plan to answer after this change lands but before removing the batching loop.
- **`reset-demo` function deploy auth**: Yesterday's eagles deploy ended with `HTTP 401 "Invalid token"` on the standalone `run402 functions deploy reset-demo` step. Unclear if this is per-project token expiry or a CLI refresh issue. Not blocking this change, but the cron reset for demo data may be silently dead; worth investigating as a separate task.
- **How to handle the sibling `kychon-private/marketing/deploy-marketing.js`**: Coordinate with the private-repo maintainers on a parallel migration? Or let it stay CLI until a full deploy outage forces the issue? Propose as a follow-up after this lands.
