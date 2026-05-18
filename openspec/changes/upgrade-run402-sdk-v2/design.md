## Context

`@run402/sdk@2.0.0` "Unified Apply" landed 2026-05-18, ~30 minutes before this proposal was drafted; `@run402/sdk@2.0.1` followed ~10 minutes later as a critical hotfix; `@run402/sdk@2.1.0` followed ~3 hours after that, completing the unified-apply migration by rewriting the asset namespace onto the same substrate. The three releases together are the v1.48 destructive cutover landing in the public packages: every release write and every blob write now flows through one engine, accessed two ways — `r.project(id).apply(spec)` for declarative writes, and `r.project(id).assets.put/uploadDir/syncDir/...` for ergonomic asset operations.

Three things were removed from the public surface across 2.0.x and 2.1.0:

1. **`r.deploy.apply(spec, opts)`** — the top-level deploy entry. Our `scripts/_lib.ts:499` calls this on every deploy.
2. **`r.blobs.*` and `r.assets.apply`** — the legacy blob namespace. We don't use these directly.
3. **The wire endpoints `POST /deploy/v2/plans` and `POST /storage/v1/uploads*`** — per the [v2.0.0 release notes](https://github.com/kychee-com/run402/releases/tag/v2.0.0), both return HTTP 404. Our edge functions raw-fetch the latter (`functions/upload-asset.js`, `functions/upload-resource.js`, `src/lib/storage-upload.ts`), bypassing the SDK.

The 2.0.0 release itself shipped with a bug: `r.project(id).apply` was issuing `POST /storage/v1/uploads/:id/complete` after every CAS PUT, hitting the same retired route. Caught by Run402's `cli-integration` running against **production**, which proves the gateway is already on v1.48 — the cutover is live, not pending. 2.0.1 removes the legacy completion call so the apply hero is fully functional. 2.0.1 left the asset namespace broken (the [v2.0.1 release notes](https://github.com/kychee-com/run402/releases/tag/v2.0.1) explicitly noted `Assets.put` / `Assets.initUploadSession` / `Assets.completeUploadSession` as still hitting retired routes, with a follow-up patch planned). [v2.1.0](https://github.com/kychee-com/run402/releases/tag/v2.1.0) lands that patch: `Assets.put` now routes through `/content/v1/plans → S3 PUT → /apply/v1/plans/:id/commit` (the apply substrate); the three legacy session methods throw `LocalError` with explicit migration hints. 2.1.0 also ships new Node-only helpers (`assets.uploadDir/syncDir/prepareDir/putMany`) and a `dir(path)` shorthand.

The new shape:

```ts
// 1.69 (gone):
await r.deploy.apply(spec, opts);

// 2.1.0 — release writes:
const p = await r.project(opts.projectId);  // async! returns ScopedRun402
await p.apply(spec, opts);                   // hero — fully functional

// 2.1.0 — asset writes (ergonomic single key, returns AssetRef with CDN URL):
const ref = await p.assets.put(key, bytes, { contentType, visibility: 'public', immutable: true });
// ref.cdnUrl / ref.immutable_url / ref.sri are populated

// 2.1.0 — asset writes (Node directory batch):
await p.assets.uploadDir('./public/assets', { prefix: 'static/' });

// 2.1.0 — composable with releases (atomic asset-flip + release-flip):
await p.apply({ site: dir('./dist'), assets: { put: [{ key, source: bytes }] } });

// 2.1.0 — these THROW LocalError with migration hints:
await p.assets.initUploadSession({...});       // throws
await p.assets.getUploadSession(id);           // throws
await p.assets.completeUploadSession(id, {});  // throws
```

The release-spec shape is unchanged (`database`, `functions`, `site`, `subdomains`, `routes`, optional new `assets` / `checks` / `secrets` slices), and Node-only helpers `fileSetFromDir`, `dir()`, `uploadDir`, `syncDir`, `prepareDir`, `putMany` still apply. Errors keep the same constructors (`PaymentRequired`, `Unauthorized`, `ApiError`, `NetworkError`, `LocalError`, `Run402DeployError`); 2.0 also exposes `Run402Error.quotaScope` from the v1.46 account-pooled tier work.

The previous `deploy-sdk-migration` change already moved us from `execSync('run402 ...')` to typed SDK calls and from `apps.bundleDeploy` to `r.deploy.apply` (v2 ReleaseSpec). That foundation makes this change small in the deploy path: one call site, identical spec, different scoping. The edge-function upload pipeline is the larger surface here because those files never went through `deploy-sdk-migration` — they always raw-fetched `/storage/v1/uploads` and predate the SDK adoption policy. As of the v1.48 cutover those raw-fetch calls are returning 404 against production; uploads are currently broken on the live demos. The user-visible symptom is masked by the hourly demo-reset cron repainting seeded photos from the deploy bundle.

## Goals / Non-Goals

**Goals:**

- Pin `@run402/sdk@=2.1.0` and migrate every call site in this repo that touches a removed surface.
- Replace `r.deploy.apply` with `r.project(id).apply` in `scripts/_lib.ts` while preserving the exact spec shape, error handling, dry-run behavior, and event-stream warning logging.
- Migrate the three edge-function upload call sites off `/storage/v1/uploads` to `r.project(id).assets.put` (the 2.1.0 ergonomic single-key API), which returns an `AssetRef` carrying the CDN URL directly.
- Update upload tests so URL-shape assertions reflect the new endpoint, not the retired one.
- Update the deploy spec's SDK-version + call-shape requirement to `2.1.0` + `r.project(id).apply` + `r.project(id).assets.put`.
- Sweep doc references to the pre-Astro `deploy.js` / `app.json` / `run402 deploy` flow.
- Preserve every externally observable behavior: site URLs, route table, public_paths map, cron schedules, idempotent migrations, member-photo CDN URLs.

**Non-Goals:**

- Adopting new 2.0 features beyond what the migration requires. The `assets` release-spec slice (atomic asset-flip + release-flip), `prepareDir` URL injection, `allowWarningCodes`, and `quotaScope` enrichment in `prettyPrintError` are out of scope. Capture as follow-ups.
- Migrating the sibling private repo `kychon-private/marketing/deploy-marketing.js`. Different repo, different maintainer; tracked as USER ACTION.
- Resolving the open `deploy-sdk-migration` tasks 6.2 / 6.6 (smoke-test GitHub secrets gating). Unrelated; tracked there.
- Replacing the legacy `RUN402_SERVICE_KEY`-based auth in edge functions with anything new. The 2.0 release does not change service-key semantics; auth stays as-is.
- Removing `src/lib/storage-upload.ts` even though the new SDK supports browser-side uploads via `r.project(id).assets.put`. The lib is called from non-SDK contexts (Astro client scripts) and rewriting all consumers is a separate refactor.

## Decisions

### Decision 1: Pin `@run402/sdk@=2.2.0` (exact), carry `@run402/functions@2.2.0` lockstep

Same rationale as the existing `deploy-sdk-migration` Decision 2: the SDK has shipped breaking minor and major bumps; exact-pin keeps every change deliberate. The 2.0.0 release explicitly states "Lockstep across SDK, CLI, MCP, and Functions — all at 2.0.0," and the same lockstep convention applies through 2.2.0. Carrying both pins together avoids the failure mode where a deployed edge function's bundled `@run402/functions@1.69` helpers expect a 1.69 gateway response shape that the 2.x gateway no longer emits.

We skip 2.0.0, 2.0.1, and 2.1.0:

- **2.0.0** ships with a known critical bug (the `r.project(id).apply` retired-completion-call regression caught by Run402's production `cli-integration` test).
- **2.0.1** fixed the apply hero but left the asset namespace calling retired routes — silent breakage in `Assets.put` etc., which is exactly the kind of failure we don't want to ship even if we're not calling that surface today.
- **2.1.0** fixes `r.assets.put` (deploy-time path) but leaves edge functions without an in-runtime helper. Routing edge-function uploads through 2.1.0 would require bundling the full `@run402/sdk` into each function plus a custom kernel-level credentials provider — design Decision 5 option (A) — and runtime-bundling has unverified compatibility risk.
- **2.2.0** adds `assets.put()` to `@run402/functions`, which is the missing piece: edge functions get the helper from the runtime alongside `adminDb` / `getUser`, with service-key auth injected automatically. This is the first 2.x release where both the deploy-tooling path (via `r.project(id).apply`) and the edge-function path (via in-runtime `assets.put`) are ergonomic and correct.

Rejected: caret-pin `^2.2.0` (auto-upgrades through a future 2.3 breaking minor), tilde-pin `~2.2.0` (patch-level surprise during an unstable post-major window), pinning 2.0.x or 2.1.0 (each has the specific gaps above).

### Decision 2: Hoist the scoped client in `runDeploy`, don't construct it inline

The current `runDeploy(r, opts)` signature takes the unscoped `r` and the target options. With 2.0, every call inside `runDeploy` that needs the project id (the apply call, and potentially future `assets` calls) goes through `r.project(opts.projectId)`. Two options:

- (A) **Inline**: `const result = await (await r.project(opts.projectId)).apply(spec, applyOptions);`
- (B) **Hoisted**: `const p = await r.project(opts.projectId);` once at the top of `runDeploy`, then `await p.apply(spec, applyOptions)`.

Picked **(B)** because (i) the scoped client is the natural home for any future call that needs the project (e.g. status reads, asset uploads); (ii) it reads better in the error-handling paths; (iii) `r.project(id)` does NOT mutate keystore state per the SDK doc ("project() does NOT mutate keystore state — use useProject for the persist-then-scope shorthand"), so hoisting has no side-effect risk. Keep `runDeploy`'s outer signature unchanged so callers (`scripts/deploy.ts`, `scripts/deploy-demo.ts`, the `_*-port-deploy.ts` scripts) don't need to change.

Rejected: (A) for the readability reasons above.

### Decision 3: Drop `spec.project` from the assembled ReleaseSpec

`buildKychonReleaseSpec()` currently sets `spec.project = opts.projectId`. In 2.0 the scoped apply accepts `Omit<ReleaseSpec, "project"> & { project?: string }` — the field is optional because the scope binds it; supplying it still works but is redundant. We drop it for cleanliness so the spec assembly reads "describe the release" without restating the target.

Trade-off: a future migration to a non-scoped call shape (unlikely; no such surface exists in 2.0) would have to re-add the field. Acceptable — this is a one-line change behind `buildKychonReleaseSpec`.

Rejected: keeping the field (works but reads as superstitious code).

### Decision 4: No probe — endpoint state is settled by the 2.0.1 and 2.1.0 release notes

An earlier draft of this design called for an empirical probe to resolve a release-notes vs. SDK-source discrepancy: 2.0.0 source still called `/storage/v1/uploads*` even though the release notes said those routes returned 404. The 2.0.1 release notes resolved the apply-hero half:

> `deploy.apply` (and everything that wraps it — `sites.deployDir`, `r.project(id).apply`) was issuing a per-session `POST /storage/v1/uploads/:id/complete` after every CAS upload PUT. That route was removed in the v1.48 cutover, so every non-CI site / asset upload hit 404 before reaching the plan-level commit.

The 2.1.0 release notes resolved the asset-namespace half:

> `r.assets.put` now routes through the unified-apply hero. In v2.0.x, single-key uploads used a dedicated `/storage/v1/uploads*` multipart session. That gateway endpoint was removed in gateway v1.48. In v2.1.0, every asset upload — single key or batch — flows through `/content/v1/plans → S3 PUT → /apply/v1/plans/:id/commit`, the same activation path as site deploys.

Three things are now definitive:

- **Production gateway is on v1.48.** The cutover happened. Any code hitting `/storage/v1/uploads*` is broken in production right now, not on the next deploy.
- **`r.project(id).apply(spec)` works in 2.0.1+.** Including the assets slice. This is the migration target for Slice A (release writes).
- **`r.project(id).assets.put(key, source, opts)` works in 2.1.0+** (was broken in 2.0.x). This is the migration target for Slice B (asset writes). Same wire substrate as `apply({ assets })` underneath, ergonomically simpler call site.

We skip the probe. Task 0 in the original draft becomes a much smaller "smoke test: confirm 2.1.0 apply + assets.put work end-to-end against scratch project before touching production code" — a sanity check, not a directional decision.

### Decision 5: Migrate edge-function uploads to `assets.put` from `@run402/functions@2.2.0`

Four layers were considered for the edge-function upload pipeline:

- **(A) `r.project(id).assets.put` via the SDK, bundled into the function** — the ergonomic single-key helper. **Rejected (in favor of A')**: would require bundling `@run402/sdk` into each edge function (~1MB per function, plus a custom kernel-level credentials provider for service-key auth, plus unverified runtime compatibility).
- **(A') `assets.put` from `@run402/functions@2.2.0`** — same wire substrate (`/apply/v1/service-asset-put`) and same `AssetRef` return shape as the SDK helper, but auto-resolved by the Run402 function runtime alongside the existing `adminDb` / `getUser` imports. Service-key auth is injected by the runtime; no credentials provider needed. **Picked.**
- **(B) `r.project(id).apply({ assets: { put: [...] } })`** — the unified-apply hero with an asset-only spec. **Reserve.** Useful when an upload must be atomic with a release flip; not needed for the per-user upload case where there's no release context.
- **(C) Raw-fetch the new wire endpoints directly** — skip the helper in edge functions. **Rejected**: more code to maintain, has to be re-derived every time the gateway changes, and the helper works fine.

(A') is the cleanest possible migration: one new named import (`assets`) added to the existing `@run402/functions` import line, one method call replaces the entire `uploadBytesContentAddressed` helper. The implementation in `functions/upload-asset.js` and `functions/upload-resource.js` drops ~45 lines per file (SHA-256 helper, init/PUT/complete dance, multipart bookkeeping) and gains 5 lines (the `assets.put` call plus the URL-pick helper). The returned `AssetRef` exposes both snake_case and camelCase aliases of the same fields the legacy `/storage/v1/uploads/:id/complete` response carried, so the existing fallback chain `cdn_immutable_url || immutable_url || cdn_url || url || /storage/${key}` keeps working unchanged.

For `src/lib/storage-upload.ts` (browser-side), see Decision 6.

### Decision 6: Use the apply-assets-slice via a thin proxy in `src/lib/storage-upload.ts`

`src/lib/storage-upload.ts` is the browser-side equivalent of the edge function's upload helper, called from Astro client scripts. Browser code cannot bundle `@run402/sdk` (too heavy: ~150KB+ minified, plus the `@x402/fetch` dependency tree). Two options:

- **(D1) Route browser uploads through one of our edge functions** — the client POSTs the file to `functions/upload-asset.js` which already runs in Run402's serverless and can use option (B1). The browser never touches the asset API directly. This is closest to the existing pattern (the file is already routed through edge functions for resources; member-avatar uploads go directly today).
- **(D2) Raw-fetch the new wire endpoints from the browser** — implement the `/apply/v1/plans` + CAS upload + commit flow in vanilla JS. ~50 lines, mirrors what the SDK does internally.

Picked **(D1)**. Avoids duplicating the wire-shape logic in two places; keeps service-key auth server-side; makes future Run402 endpoint changes a one-file fix instead of two. Member-avatar uploads (which currently call `src/lib/storage-upload.ts` directly from the browser) get routed through `functions/upload-asset.js` instead.

Trade-off: one extra hop for member-avatar uploads (browser → edge function → gateway, instead of browser → gateway). Acceptable for image uploads; the existing pattern for resources is the same shape and has not been a bottleneck.

Rejected: (D2) for the duplication concern.

### Decision 7: Spec delta replaces the v1.69 requirement, doesn't add a parallel v2.0 one

The existing `openspec/specs/deploy/spec.md` "Requirement: Deploy uses Run402 v1.69 public paths" prescribes the exact SDK pin and the call shape. We rewrite that requirement against 2.0 + scoped apply rather than adding a new requirement next to it. Adding two coexistent SDK-version requirements would let the implementation satisfy the old one and ignore the new, which defeats the point of a spec.

The downstream requirement "Deploy publishes explicit public static paths" and friends keep their existing scenarios — they describe the spec shape, not the SDK call, and the spec shape is unchanged in 2.0.

## Risks / Trade-offs

- **Uploads are currently broken in production.** The v1.48 cutover happened before we caught the SDK update. Member-avatar, resource, and admin-asset uploads are returning 404 right now. Each hour without Slice B landing is another hour user uploads silently fail. Mitigation: prioritize this change as urgent; deploy Slice A and Slice B together. Do not let Slice A land first and "fix later" — the symptom is upload-side, not deploy-side, so a partial fix doesn't help users.
- **`r.project(id)` is async** — every call site touching the new surface gains an `await`. Easy to miss in code review. Mitigation: TypeScript catches missing-await in strict mode because `r.project()` returns `Promise<ScopedRun402>`, and calling `.apply` on a `Promise<...>` is a type error.
- ~~**Bundling `@run402/sdk` into edge functions adds bundle weight.**~~ Resolved by Decision 5 picking option (A') — edge functions use `assets.put` from `@run402/functions@2.2.0` (auto-injected by the runtime), no SDK bundling, zero added bundle weight. The earlier concern about ~1MB-per-function cold-start cost no longer applies.
- **Lockstep `@run402/functions` upgrade lands inside deployed function bundles, not in `package.json`.** The current edge functions `import { adminDb, getUser } from '@run402/functions';` — that import resolves at function-deploy time against whatever the Run402 runtime ships. The 2.0 release statement implies the runtime version is bumped lockstep, so no explicit pin change is needed in our code. Verify post-deploy by checking that an edge function still calls `adminDb()` without runtime errors.
- **Edge-function uploads run hourly via the demo reset path.** If we migrate the upload pipeline incorrectly, the next demo reset (top of the hour) breaks user-visible photo URLs across all three demos. The reset cron currently masks the broken-upload symptom by re-baking seeded photos from the deploy bundle; once we fix uploads and rely on them, that crutch is gone. Mitigation: run a real upload test against `eagles` (lowest-traffic demo) before deploying to `silver-pines` / `barrio`.
- **Legacy `initUploadSession` / `getUploadSession` / `completeUploadSession` THROW in 2.1.0.** The failure mode is loud (a `LocalError` with a migration hint) rather than silent. No mitigation needed in our code — if anyone introduces these calls thinking they still work, the error message points at the right replacement. This is a substantial improvement over 2.0.x where the same methods silently hit retired routes.
- **The previous `deploy-sdk-migration` change is still in-progress with 3 unticked tasks.** Two are USER ACTION items (smoke-test GitHub secret, cross-repo migration); one is gating on those. This change does not depend on them landing first — the 1.69-era smoke-test workflow already calls `runDeploy` indirectly via `tsx scripts/deploy.ts --dry-run`, and the same code path stays valid in 2.0 after Slice A. Document that this change can ship while `deploy-sdk-migration` stays in-progress.
- **Cross-repo marketing deploy (`kychon-private/marketing/deploy-marketing.js`) is still on the pre-`deploy-sdk-migration` CLI surface.** It will start failing the moment the next marketing-site deploy runs. Out of scope here (different repo), but the user should know that repo also needs immediate attention — captured as a USER ACTION follow-up.
