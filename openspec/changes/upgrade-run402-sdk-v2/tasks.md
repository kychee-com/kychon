## 0. Sanity smoke (collapsed by 2.0.1 / 2.1.0 / 2.2.0)

The 2.0.1 / 2.1.0 / 2.2.0 release notes together settle Decision 4 (see [design.md](./design.md)). The legacy `/storage/v1/uploads*` routes are confirmed gone from production; the apply hero is fixed in 2.0.1; the SDK asset namespace is fixed in 2.1.0; the in-function `assets.put` helper landed in 2.2.0. The only smoke that remains is: confirm 2.2.0's `apply` hero and `assets.put` (in both surfaces) work end-to-end before deploying.

- [ ] 0.1 Pick or create a scratch 2.x Run402 project. Existing smoke-test project `kychon-smoke-test` (`prj_1777127682656_0592`) is fine if its allowance is still funded.
- [ ] 0.2 Install `@run402/sdk@2.2.0` locally without saving: `npm install --before=null @run402/sdk@2.2.0 --no-save`.
- [ ] 0.3 Smoke A — release apply: run a one-line script that does `await (await r.project(SCRATCH_ID)).apply({ site: { replace: { 'index.html': '<h1>2.2.0 smoke</h1>' } } })`. Confirm it returns a release id and no errors.
- [ ] 0.4 Smoke B — assets.put (deploy-time): `const ref = await (await r.project(SCRATCH_ID)).assets.put('probe.txt', 'hello-2.2', { contentType: 'text/plain', visibility: 'public', immutable: true })` and verify `ref.cdnUrl` serves the bytes.
- [ ] 0.5 Smoke C — in-function assets.put: deploy a one-shot function that calls `assets.put` from `@run402/functions`, invoke it, verify the returned `AssetRef` is well-formed. (This used to be the unverified runtime-bundling question; 2.2.0 collapses it to a one-line probe.)
- [ ] 0.6 If any smoke fails, file a Run402 issue and **stop**. Do not deploy to production until the working release is confirmed.

## 1. Dependency setup

- [x] 1.1 Bump `@run402/sdk` pin in `package.json` from `1.69.0` to `2.2.0` (exact pin, no caret/tilde). Skip 2.0.x and 2.1.0 — see Decision 1.
- [x] 1.2 Regenerate `package-lock.json` with `npm install --before=null @run402/sdk@2.2.0` so the lock entry resolves to the published 2.2.0 tarball. *Verified: `node_modules/@run402/sdk/package.json` reports 2.2.0; lockfile `packages` section resolves to 2.2.0.*
- [x] 1.3 Verify `npx tsc --noEmit` (or `npm run lint` / `npm run build`) passes against the new SDK types — the scoped-client shape changes mean any stale `r.deploy` reference becomes a type error, which is the intended signal for tasks in group 2. *Pre-edit: 2 type errors at `_lib.ts:499` (`r.deploy.apply`) and `_lib.ts:508` (`result.urls`). Post-edits: clean against 2.0.1, 2.1.0, and 2.2.0. Astro check also clean. Full vitest suite: 1017/1017 pass after `npm run build:sdk`.*
- [ ] 1.4 Commit deps bump + regenerated lockfile as a discrete commit before any code edits. **USER ACTION** — left for the human to commit when they're ready.

## 2. Deploy hot path migration (Slice A — `scripts/_lib.ts`)

- [x] 2.1 In `scripts/_lib.ts:369` `runDeploy()`, hoist `const project = await r.project(opts.projectId);` near the top of the function body (after `buildAstro(...)`, before the spec is assembled — anywhere it can be reused). Per design Decision 2.
- [x] 2.2 At the call site (current line ~499), replace `await r.deploy.apply(spec, applyOptions)` with `await project.apply(spec, applyOptions)`.
- [x] 2.3 In `buildKychonReleaseSpec()` (line ~342), remove the `project: opts.projectId` field from the returned `ReleaseSpec` — the scoped apply binds it. Per design Decision 3. Update the function's `BuildKychonReleaseSpecOptions` type to drop `projectId` if it is no longer referenced; otherwise leave the parameter for callers that still pass it. *Dropped `projectId` from `BuildKychonReleaseSpecOptions`; new return type `KychonReleaseSpec = Omit<ReleaseSpec, "project">`. Test `tests/unit/deploy-public-paths.test.ts` updated to match.*
- [x] 2.4 Verify `await import("@run402/sdk")` in `prettyPrintError` still resolves all the error subclasses we branch on (`Run402DeployError`, `PaymentRequired`, `Unauthorized`, `ApiError`, `NetworkError`, `LocalError`, `Run402Error`). 2.x re-exports them per `dist/index.d.ts`; this is a sanity check, not a change. *All seven subclasses confirmed exported from `@run402/sdk@2.1.0` index.d.ts line 128.*
- [ ] 2.5 Run `tsx scripts/deploy.ts --dry-run` against the scratch project — confirms no type drift and that the assembled spec still serializes correctly. Capture the dry-run output for the PR description. **PARTIAL**: typecheck passed (`npx tsc --project tsconfig.scripts.json --noEmit` clean, `npx astro check` clean, port-deploy scripts also clean). Full dry-run still TBD because it requires keystore/env setup the agent cannot do — run locally.
- [ ] 2.6 Run a real deploy against `eagles` (lowest-traffic demo): `SUBDOMAIN=eagles tsx scripts/deploy-demo.ts eagles`. Verify: deploy completes, `eagles.kychon.com/events` returns 200, `eagles.kychon.com/search?q=hello&type=all` returns 200, hidden `/events.html` returns 404 (release-public-path machinery intact). **USER ACTION**.
- [ ] 2.7 **Do not deploy `silver-pines` / `barrio` yet.** Group 3 must land in the same deploy pair — otherwise the redeploy with Slice A but without Slice B would re-bake the (still-broken) edge functions on top of an apply that already passed, masking the urgency. *Directive — not an action.*

## 3. Upload pipeline migration (Slice B — `assets.put` from `@run402/functions`)

Target shape per design Decision 5 option (A'): edge functions add `assets` to the existing `@run402/functions` import and call `await assets.put(key, bytes, opts)`. Returns an `AssetRef` carrying the CDN URL directly. **Do not** use `initUploadSession` / `getUploadSession` / `completeUploadSession` — they throw `LocalError` in 2.1.0+.

- [x] 3.1 ~~Confirm `@run402/sdk@2.1.0` runs inside the Run402 function runtime.~~ *Obsolete: 2.2.0's in-function `assets.put` ships in `@run402/functions`, which the runtime already auto-resolves. Bundling the SDK is no longer the plan; this verification question doesn't apply.*
- [x] 3.2 Rewrite `functions/upload-asset.js`:
  - [x] 3.2.1 Add `assets` to the existing `@run402/functions` import. Replace `uploadBytesContentAddressed` with `await assets.put(storagePath, bytes, { contentType, visibility: 'public', immutable: true })`. Dropped: `sha256Hex` helper, init session POST, per-part PUT loop, complete POST. ~45 lines removed, ~8 lines added.
  - [x] 3.2.2 Service-key auth: handled by the runtime — no credentials provider work needed (this was the gating concern in Decision 5 option A; resolved by 2.2.0's runtime helper).
  - [x] 3.2.3 Extract URL from returned `AssetRef` via existing fallback chain `cdn_immutable_url || immutable_url || cdn_url || url || /storage/${key}`. `AssetRef` exposes all those fields per `@run402/functions@2.2.0` types.
  - [x] 3.2.4 ~~Update DELETE flow.~~ *No change needed: `DELETE /storage/v1/blob/{key}` is still alive in 2.2.0 (SDK source confirms; the v1.48 cutover only retired `/storage/v1/uploads*`).*
- [x] 3.3 Rewrite `functions/upload-resource.js` the same way. Same delta as 3.2.1.
- [x] 3.4 `src/lib/storage-upload.ts` — per design Decision 6 option (D1), the lib's body now POSTs the file payload as JSON to `/functions/v1/upload-asset` instead of hitting Run402 directly.
  - [x] 3.4.1 Single caller (`src/components/AdminEditor.astro:499`, all using `keyPrefix: 'assets'`); kept the lib as a thin proxy so AdminEditor doesn't change.
  - [x] 3.4.2 The lib now rejects non-`assets` prefixes at runtime (was: passed through to Run402). Anyone trying `keyPrefix: 'avatars/42'` etc. gets a clear error pointing at the migration.
  - [x] 3.4.3 *grep results: only `AdminEditor.astro` consumes `uploadFileContentAddressed`; `resources-page-source` / `profile-page-source` tests only string-check that bundles reference the name. No avatar-upload caller exists today via this lib.*
- [x] 3.5 Add a sentinel comment to `scripts/_lib.ts` near the apply call (and to each rewritten `functions/upload-*.js` when 3.2 / 3.3 land). 2.1.0+ makes the legacy session methods THROW `LocalError`, so the sentinel mainly directs readers to `assets.put` for single keys vs `assets.uploadDir` for Node batches. *Comment in `scripts/_lib.ts` updated; the rewritten upload functions document the substrate inline in their `assets.put` call comments.*

- [ ] 3.6 Test the upload path manually after group 3 changes:
  - [ ] 3.6.1 On `eagles`, sign in as the demo admin, upload a PDF resource through the admin form. Confirm it succeeds and the resource appears in the listing with a working CDN URL.
  - [ ] 3.6.2 On `eagles`, upload a member profile photo as a non-admin member. Confirm it succeeds and the new URL renders on the directory page.
  - [ ] 3.6.3 As admin, delete the test resource and the test photo. Confirm both are removed from storage (deletion path of 3.2.4 / 3.3).

## 4. Test updates

- [x] 4.1 `tests/unit/security-bug-28-storage-upload.test.ts` rewritten to assert against the new browser → `/functions/v1/upload-asset` flow. New scenarios: (a) one POST to the edge function, no legacy `/storage/v1/` calls; (b) base64 payload + path + auth headers; (c) error body surfaces on edge-function failure; (d) non-`assets` prefix rejected at runtime; (e) optional `target` field forwarded for `brand_icon_url` hints. 5 tests, all pass.
- [x] 4.2 `tests/unit/security-bug-25-uploads.test.ts` updated: added `assets.put` to the `@run402/functions` mock so the rewritten upload functions resolve their import. DELETE URL assertion at line 190 unchanged — `DELETE /storage/v1/blob/assets/logo.png` is still the right path in 2.2.0. 9 tests, all pass.
- [x] 4.3 Run `npx vitest run` and confirm zero failures, zero warnings. *Full suite: 1017/1017 pass after `npm run build:sdk` (the workspace SDK build is a prerequisite of the suite, unrelated to this change).*

## 5. Spec delta

- [ ] 5.1 Apply the delta in `specs/deploy/spec.md` to `openspec/specs/deploy/spec.md`. (The OpenSpec archive flow will do this automatically when the change is marked complete; verify visually before archiving.) *Deferred — archive flow handles this.*
- [x] 5.2 Verify `openspec validate upgrade-run402-sdk-v2` reports no errors before flipping the change to "complete". *Validates clean.*

## 6. Documentation sweep

- [x] 6.1 Edit `STRUCTURE.md`: lines 6, 14, 72 swept.
- [x] 6.2 Edit `CUSTOMIZING.md`: lines 114, 182, 198, 199 swept.
- [x] 6.3 Edit `docs/spec.md:144`: swept.
- [x] 6.4 Edit `openspec/specs/scheduled-functions/spec.md`: all 6 `deploy.js` references replaced via global `s/deploy.js/scripts/deploy.ts/g`.
- [x] 6.5 Edit `openspec/specs/deploy/spec.md:71`: scenario block swept.
- [x] 6.6 Edit `scripts/README.md`: SDK-pin paragraph + 1.50.1 history paragraph + "deploy goes through" line updated for 2.0 / 2.0.1. *Will need a 2.1.0 follow-on once that's the active pin.*
- [x] 6.7 Edit `CLAUDE.md`'s "Run402 Platform Gaps" section: 10MB-cap bullet rewritten for unified-apply CAS substrate.

## 7. Memory update

- [x] 7.1 Update `/Users/talweiss/.claude/projects/-Users-talweiss-Developer-kychon/memory/project_demo_deploy.md`:
  - Replace `node deploy.js` with `npx tsx scripts/deploy.ts` in the "Why" block. *Done.*
  - Keep the `bash deploy-all.sh` reference (still accurate). *Preserved.*

## 8. Verification

- [ ] 8.1 After all groups land, deploy production `kychon.run402.com` via the standard `scripts/deploy.ts` flow. Verify the live site URL, that admin and member sign-in still work, that the directory page loads, and that an existing member's avatar still renders (CDN URL preserved through the migration per release-notes promise on `internal.asset_versions`).
- [ ] 8.2 Run `bash deploy-all.sh` to re-deploy all three demos. Confirm uploads still work post-redeploy (group 3.6 was on `eagles` only; this is the regression-net sweep).
- [ ] 8.3 Wait one cron cycle (top of the hour) and check that the `reset-demo` function ran successfully on at least one demo. Demo reset includes seeded photo uploads, so its success is the cheapest end-to-end upload signal we have.
- [ ] 8.4 Sanity-check edge-function bundle sizes after group 3. If any function bundle grew by more than 2× pre-migration size, capture the number in the PR description and consider the design Decision 5 (C) fallback for the next iteration.

## 9. Follow-up captures (not in this change)

- [x] 9.1 ~~When Run402 publishes the patch that rewrites `Assets.put` etc. against `/apply/v1/plans`, file an OpenSpec change to simplify edge functions.~~ *Resolved by 2.1.0 (2026-05-18, ~3h after 2.0.1). `r.assets.put` now routes through the unified substrate. This change folds the simplification directly into Slice B (task group 3) instead of deferring it.*
- [ ] 9.2 If `@run402/functions` adds an `assets` helper in a future release, refactor edge functions to use it instead of bundling the full `@run402/sdk`. Saves ~1MB per function. File a feature request on `kychee-com/run402` if no movement after a week.
- [ ] 9.3 Cross-repo: `kychon-private/marketing/deploy-marketing.js` is still on the pre-`deploy-sdk-migration` CLI surface. The 2.x migration there needs to land before the next marketing-site deploy. **USER ACTION** (cross-team coordination).
- [ ] 9.4 Track adoption of the new 2.x surfaces we deliberately did not adopt here: `assets` release-spec slice on the *deploy* spec (atomic asset-flip + release-flip on each deploy), `prepareDir` for URL injection at build time, `allowWarningCodes` (more targeted than `allowWarnings: true`), `getQuotaScope(e)` in `prettyPrintError`, `assets.uploadDir` for bulk asset directory deploys. Capture as a follow-up OpenSpec change `adopt-unified-apply-features-2.x` (or similar).
