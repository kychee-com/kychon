## Why

Run402 v1.54 shipped `asset-image-variants` extensions: every new image upload through `r.assets.put` now atomically populates `AssetRef.blurhash_data_url` (pre-decoded ~600-1200-byte PNG data URL) and `AssetRef.asset_schema` (semver-shape stamp). The `<Run402Image>` component spec is freeze-final but its implementation (`run402-image-component-impl`, 95 tasks) is queued behind v1.54 — usable once `@run402/astro@1.0` ships.

Kychon's engine has an existing `src/lib/kychon-image.ts` module that:

- Reads `AssetRef.blurhash` (the 30-byte LQIP string) at render time
- Calls `decodeBlurhashToDataUri` from `@run402/astro/blurhash` to produce a 32×32 PNG data URI on demand
- Caches the result keyed by blurhash string
- Exports `<KychonImage>` (JSX, used in React-bundled blocks) and `kychonImageHtml` (HTML-string, used in `blocks.ts` string emitters)
- Is called at 9 sites across `src/components/kychon/MarketingBlocksView.tsx`, `src/components/kychon/ImageAccordionBlockView.tsx`, `src/components/kychon/SlideshowBlockView.tsx`, `src/lib/kychon-image.ts`, and `src/lib/blocks.ts`

The render-time decode is exactly the CPU cost the v1.54 `blurhash_data_url` pre-decode is supposed to eliminate. Two adoptions are in scope here:

### 1. Intermediate (immediate, low-risk)

Switch `kychon-image.ts` to PREFER `AssetRef.blurhash_data_url` when present; fall back to client-side decode for AssetRefs that lack the field (legacy uploads from before v1.54 OR uploads that hit the pre-decode failure path documented in the sibling spec). Net: render path saves a blurhash decode per image on the hot path; legacy AssetRefs still render correctly via the existing fallback.

This is purely additive — the existing `decodeBlurhashToDataUri` import + cache stay, with a new branch checking `blurhash_data_url` first. Backward-compatible by construction.

### 2. Full adoption (deferred until @run402/astro@1.0 ships with `<Run402Image>`)

Replace `<KychonImage>` and `kychonImageHtml` with `<Run402Image>` (Astro entry from `@run402/astro/components`) and the React port (`@run402/astro/react`) at the 9 call sites. Mostly mechanical: the consumer-side contract is `asset: AssetRef` instead of `url + manifest`. The migration captures `imageDefaults.strict: { onSchema: ">=v1.49" }` per tenant (project-level via `astro.config.mjs`'s `run402({ imageDefaults: ... })`).

### Operator action

Run the v1.54 backfill against the three demo tenant projects (eagles, silver-pines, barrio) so existing AssetRefs gain `blurhash_data_url` and `asset_schema`. Without this, the intermediate switch falls back to render-time decode for every legacy row, defeating the perf win.

Per the rev-2 sibling spec's HEIC correctness floor, demo tenants that have HEIC uploads from before the `display_jpeg` variant landed need `--regenerate-heic-transcodes` to be backfill-eligible. Demo content is largely curated PNG/JPEG; HEIC counts are expected to be low or zero. The cost preview from each tenant's dry-run determines whether the HEIC re-encoding flag is worth running.

## What Changes

### Code (intermediate switch — actionable today)

- `src/lib/kychon-image.ts`: add a new branch that reads `ref?.blurhash_data_url` first; if present, use the value directly as the placeholder data URI without decoding. Fall back to the existing `decodeBlurhashToDataUri(hash)` path when the new field is absent (legacy AssetRefs).
- Preserve the existing LQIP cache. The cache becomes a no-op fast-path for v1.54-stamped AssetRefs (the field is already a data URI; nothing to compute) and remains useful for legacy AssetRefs.
- Add tests: one fixture with `blurhash_data_url` populated (assert no decode call), one fixture without (assert decode-and-cache path still works).
- No call-site changes for the intermediate switch — the API surface of `kychon-image.ts` is unchanged.

### Code (full `<Run402Image>` adoption — gated on @run402/astro@1.0)

- Bump `@run402/astro` to `^1.0` once shipped (currently `0.2.1`).
- Update `package.json` and `astro.config.mjs` to use `run402({ imageDefaults: { strict: { onSchema: ">=v1.49" } } })` at the project level (post-backfill; details in design notes).
- Replace `<KychonImage>` JSX usage at the 9 call sites with `<Run402Image>` from `@run402/astro/react`.
- Replace `kychonImageHtml` string emitters in `blocks.ts` with renders to the Astro-native `<Run402Image>` from `@run402/astro/components` (or the React port, depending on the call site's context).
- Migrate the manifest pipeline: `<Run402Image>` reads variants from `AssetRef.variants` directly; the existing manifest-based URL resolution stays for ASSET LOOKUP (mapping admin-uploaded references to current AssetRef snapshots) but the variant ladder no longer flows through the manifest.
- Remove `decodeBlurhashToDataUri` import once the intermediate fallback path is no longer needed (after backfill is verified complete AND `<Run402Image>` is universally adopted).

### Operations

- Run the v1.54 backfill against eagles, silver-pines, and barrio in a single operator session:
  ```
  GATEWAY_URL=https://api.run402.com \
  ADMIN_KEY=<key> \
  npx tsx /Users/talweiss/Developer/run402-private/scripts/asset-schema-backfill.ts \
    --project=prj_1776162941487_0008 --dry-run    # eagles
  ```
  Repeat per project. Project IDs from `.env`: eagles `prj_1776162941487_0008`, silver-pines `prj_1776162950442_0031`, barrio `prj_1776162954485_0075`.
- Capture each dry-run output (cost preview + HEIC count) as the change-management artifact before real runs.
- Run real backfills sequentially; watch the `Run402-AssetBackfill` CloudWatch dashboard.
- If any tenant's dry-run reports meaningful HEIC counts missing `display_jpeg`, re-run with `--regenerate-heic-transcodes` per the rev-2 sibling spec's operator-discretion criterion (cost preview governs the decision).
- Verify post-backfill: each project's `internal.blobs` rows carry `blurhash_data_url` IS NOT NULL where `blurhash IS NOT NULL`, AND `asset_schema = "v1.49"` (or the platform's current stamp value — confirm via dashboard whether v1.54 stamps land for backfilled rows or whether backfill caps at v1.49 per the spec's asymmetry rule).

## Capabilities

### Modified Capabilities

- `image-rendering` (or whatever the engine names this — verify against `openspec/specs/`): prefers gateway-pre-decoded blurhash placeholder when available. Strict-mode regression-gating becomes available once `<Run402Image>` ships and per-tenant strict opt-in is configured.

## Impact

- **Code (intermediate)**: 1 file edited (`src/lib/kychon-image.ts`), 1 test added. Trivial diff.
- **Code (full)**: 5 files edited at 9 call sites, plus `astro.config.mjs` + `package.json` bump. Gated on `@run402/astro@1.0`.
- **Operations**: three tenant projects backfilled. Approx wall time: ≤15 min each in baseline mode (rev-2 throughput band 500-2000 rows/sec); meaningfully longer per tenant if `--regenerate-heic-transcodes` runs (0.5-1 row/sec).
- **Dependencies**: no version bump for intermediate switch. `@run402/astro` from `^0.2.1` to `^1.0` when full adoption ships.
- **External**: requires `ADMIN_KEY` for backfill CLI. Requires `<Run402Image>` to ship in `@run402/astro@1.0` before full-adoption tasks can be executed.
- **Cross-repo**: sibling change `adopt-run402-v1-54-marketing` in `/Users/talweiss/Developer/kychon-private` covers the marketing-side prep (env.d.ts + marketing-project backfill). Independent landability.

## Out of scope (explicit deferrals)

- **`MediaPicker` rewrite** — the existing React island (`src/components/kychon/MediaPickerHost.tsx`, `MediaPickerIsland.tsx`) stays. The MediaPicker continues writing AssetRefs via `r.assets.put`; the v1.54 fields land automatically on new uploads. `<Run402Image>` swap targets render-side, not picker.
- **Tenant-specific strict-mode rollout** — strict opt-in is per-tenant via `imageDefaults`. Default lenient until each tenant's backfill is verified clean (manifest empty OR known-legacy entries only). Full rollout decision deferred to the full-adoption tasks.
- **Customer-port tenants** (ODBC `prj_1777563179844_1095`, BMW Club Canberra `prj_1777926746773_1225`, AAGE `prj_1777894176600_1224`) — these have their own deploy scripts (`_*-port-deploy.ts`). Backfill against customer tenants is a separate operator-coordinated step once demo tenants are verified clean.
- **Server-component / RSC support** — the component spec defers React Server Components to `<Run402Image>` v1.1; not in scope for v1.0 adoption.
- **AVIF** — deferred platform-wide per the component spec's "AVIF NOT emitted in v1.0" requirement.
- **`run402-image-component-impl`** — the 95-task component implementation lives in `/Users/talweiss/Developer/run402-private/openspec/changes/`, not this repo. Kychon's role is consumer-side adoption only.
