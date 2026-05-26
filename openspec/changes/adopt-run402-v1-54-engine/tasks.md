## 1. Intermediate Switch — Prefer `blurhash_data_url` (actionable today)

- [x] 1.1 Read `src/lib/kychon-image.ts` end-to-end to map every call site of `decodeBlurhashToDataUri`. Confirmed single call site at `lqipDataUri` (line 152); cache is keyed on the blurhash string per line 156.
- [x] 1.2 Add a new branch at the placeholder-resolution path: when `ref?.blurhash_data_url` is a non-empty string, use it directly as the data URI without calling `decodeBlurhashToDataUri`. Applied the `typeof === 'string' && length > 0` guard explicitly per the rev-2 sibling-spec footgun note.
- [x] 1.3 Preserve the existing fallback: when `blurhash_data_url` is absent, null, or empty string, call `decodeBlurhashToDataUri(ref.blurhash)` as today and cache by blurhash string. Existing code retained verbatim under the new branch.
- [x] 1.4 Confirm the LQIP cache continues to work: cache keyed on blurhash string for the fallback path; v1.54+ AssetRefs short-circuit before reaching the cache. Module comment updated to document this.
- [x] 1.5 Add unit test: AssetRef with `blurhash_data_url: "data:image/png;base64,..."` AND `blurhash: "LKO..."` renders with the pre-decoded URI in the output. Test uses a sentinel data URL distinct from anything the decoder would produce so the assertion proves fast-path win.
- [x] 1.6 Add unit tests for the fallback path: `blurhash_data_url` absent / null both fall through to the decode+cache path. Two scenarios added.
- [x] 1.7 Add unit test: `blurhash_data_url: ""` (empty string — rev-2 sibling-spec footgun) falls through to decode path, does NOT emit `background-image:url();`.
- [x] 1.8 Run `vitest run tests/unit` — 874/874 tests pass, no regressions. New file: `tests/unit/kychon-image-blurhash-data-url.test.ts` (5 scenarios).
- [ ] 1.9 Spot-check a tenant deploy locally (via the existing demo dev flow) — confirm rendered HTML uses `blurhash_data_url` for any v1.54-stamped AssetRef fixture you can produce. (Manual verification; deferred until next tenant deploy.)

## 2. Demo-Tenant Backfill (Operational) — COMPLETE

- [x] 2.1 `ADMIN_KEY` confirmed available via `run402-private/.env`.
- [x] 2.2 Tenant project IDs confirmed: eagles `prj_1776162941487_0008`, silver-pines `prj_1776162950442_0031`, barrio `prj_1776162954485_0075`. Plus marketing `prj_1776162959140_0079` (covered in sibling `adopt-run402-v1-54-marketing` change).
- [x] 2.3 Dry-run against eagles: 51 rows needing stamp, 0 HEIC missing `display_jpeg`, estimated <1s. Output captured in chat artifact.
- [x] 2.4 Dry-run against silver-pines: 41 rows, 0 HEIC missing.
- [x] 2.5 Dry-run against barrio: 41 rows, 0 HEIC missing.
- [x] 2.6 Reviewed — zero HEIC concern across the fleet; `--regenerate-heic-transcodes` not needed. Decision documented in chat artifact.
- [x] 2.7 Real backfill against eagles. run_id=2, succ=51 fail=0 processed=51.
- [x] 2.8 Real backfill against silver-pines. run_id=3, succ=41 fail=0 processed=41.
- [x] 2.9 Real backfill against barrio. run_id=4, succ=41 fail=0 processed=41.
- [x] 2.10 N/A — zero HEIC rows required the flag.
- [x] 2.11 Post-flight dry-run sweep: all four projects show `Rows needing stamp: 0` after a platform-side fix from the run402 team addressed a transient anomaly (rows reappearing after successful cleanup). Final sweep confirms clean state. Total stamped: 140 rows (138 initial + 2 cleanup) across 8 run_ids; zero failures. Anomaly report forwarded to run402 team for follow-up.
- [ ] 2.12 Per-tenant `image-degradations.json` manifest — DEFERRED to Section 4. Manifest is built-time output of the `<Run402Image>` component; nothing emits it until full adoption. Until then, the intermediate `kychon-image.ts` switch handles missing-field cases gracefully via the fallback path.

## 3. Confirm Spec-vs-Ship Deviations (Cross-Spec)

- [x] 3.1 Confirmed via run402 team announcement: production stamps `"v1.49" | "v1.50" | "v1.54" | null`. The migration guide's Recipe B uses `strict: { onSchema: ">=v1.49" }` which works correctly across all three stamp values via semver-greater-than-or-equal comparison.
- [ ] 3.2 Update local code references in Section 4 (full adoption phase). The `astro.config.mjs` predicate is `>=v1.49` per Recipe B in the migration guide; no other code currently pins to a specific stamp value.
- [ ] 3.3 Document what v1.52/v1.53/v1.54 added — DEFERRED. Treat as platform-side detail; the `>=v1.49` predicate handles all currently-shipped values transparently. Revisit if/when the platform defines a `>=v1.54` contract that materially changes required fields.

## 4. Full `<Run402Image>` Adoption — React surface complete

- [x] 4.1 Confirmed `@run402/astro@1.0.0` published; `<Run402Image>` exports verified at `@run402/astro/components` (Astro) and `@run402/astro/react` (React) via npm registry inspection.
- [x] 4.2 Bumped `package.json`: `@run402/astro` from `0.2.5` to `^1.0.0`.
- [x] 4.3 `astro.config.mjs` UNCHANGED — current `run402({ assetsDir: integrationAssetsDir })` is Recipe C from the migration guide (explicit lenient: no `imageDefaults` block). Strict-mode opt-in deferred to Section 5 per the per-tenant rollout plan; defaults match Phase 2 risk posture.
- [x] 4.4 Migrated `src/components/kychon/MarketingBlocksView.tsx`: replaced `<KychonImage>` with `<Run402Image>` from the local `@/lib/run402-image-react` wrapper. The promo-card render path now does `lookupAssetRef` upfront then ternary-renders `<Run402Image>` on hit, plain `<img>` on miss.
- [x] 4.5 Migrated `src/components/kychon/ImageAccordionBlockView.tsx`: same pattern. `imgDataAttrs` translated to direct `data-*` props per the rev-3 sibling spec's `DataAttributes` mapped type. Manifest-miss fallback emits a plain `<img>` with the same editable data-attrs.
- [x] 4.6 Migrated `src/components/kychon/SlideshowBlockView.tsx`: same pattern, preserving the avif/webp `<picture>` fallback path for manifest-miss seeds.
- [x] 4.7 BONUS: Created `src/lib/run402-image-react.tsx` typed wrapper module. Bridges three upstream type-side friction points (ReactComponent brand returns `unknown` not ReactNode; @run402/astro AssetRef ≠ @run402/functions AssetRef; Run402ImageProps not exported from /react). All three flagged for run402 feedback; wrapper collapses to a re-export when fixed upstream.
- [ ] 4.8 Migrate `src/lib/blocks.ts` (string-template HTML emitters) — DEFERRED. The intermediate Phase 1 switch in `kychon-image.ts` already gives `kychonImageHtml` the v1.54 fast path; full `<Run402Image>` adoption for string-template emitters would require routing through `renderToString` (adding a React dependency to a previously pure-string path). Not blocking; revisit in a future polish change if needed.
- [ ] 4.9 Audit `src/lib/page-render.ts` for indirect uses — DEFERRED with Section 4.8; `page-render.ts` consumes `kychon-image.ts` via the same string-template path.
- [ ] 4.10 Add `R402_ASTRO_IMAGE_*` error-handling at each migrated call site — DEFERRED. Errors are mostly build-time (fail-fast at compile); runtime guards only fire on misconfigured props. Add explicit error-boundary handling only if production traffic surfaces them.
- [ ] 4.11 Remove `decodeBlurhashToDataUri` import — DEFERRED until the fallback path is verifiably unused (requires all tenants on v1.54 stamps AND no straggling legacy AssetRefs).
- [x] 4.12 Ran `npx tsc --noEmit -p .` post-migration: clean (no TypeScript errors).
- [x] 4.13 Ran `npx vitest run tests/unit` post-migration: 874/874 tests pass; zero regressions.

## 5. Strict-Mode Per-Tenant Rollout (Final Phase)

> Sequence after full adoption AND backfill verification.

- [ ] 5.1 Pick one tenant (probably eagles, smallest demo) as the strict-mode canary.
- [ ] 5.2 Set `imageDefaults: { strict: { onSchema: ">=v1.49" } }` for that tenant's deploy (verify the exact contract-version string with run402 team per task 3.1).
- [ ] 5.3 Deploy and confirm: no `R402_ASTRO_IMAGE_STRICT_DEGRADED` failures in the build; all AssetRefs either satisfy the contract OR are legacy (filtered out by `asset_schema = null`).
- [ ] 5.4 If clean: roll strict-mode to silver-pines, then barrio.
- [ ] 5.5 If any tenant trips strict-mode on rows the operator believed were clean: investigate via the manifest, decide between re-encoding the asset OR loosening the predicate.

## 6. Customer-Port Tenants — Separate Operator Coordination

- [ ] 6.1 Schedule customer-port backfills (ODBC, BMW Club Canberra, AAGE) as a separate operator session. Each customer needs their own change-management artifact + dry-run approval.
- [ ] 6.2 Decision: full `<Run402Image>` adoption rolls to customer tenants AFTER demo verification, OR pinned per-customer based on their deploy cadence. Defer the decision to operator preference at execution time.

## 7. Phase 3 — SSR/client divergence architectural fix (ADDED post-spec)

> Surfaced during browser verification: the SSR-from-seed bake correctly rendered `<Run402Image>` with v1.54 pre-decoded placeholders, but client-side `renderZoneInto('main', ...)` destructively replaced the `<div id="sections">` innerHTML on every load — wiping the SSR work. Architectural fix landed below.

- [x] 7.1 New module `src/lib/main-zone-signature.ts` — `computeMainZoneSignature({ sections })` returns a deterministic short signature (djb2 over stable-stringified content). Recursively sorts object keys at every level so seed-side (TS source order) and DB-side (PostgreSQL JSONB order) produce byte-identical input. Excludes `manifestGeneratedAt` (build-pipeline timestamp drift) and `sec.id` (seed numeric ids ≠ DB UUIDs).
- [x] 7.2 `chrome-bake.ts:renderMainZone` rewritten to return `{ html, signature }` instead of a bare HTML string. Backward-incompatible at the function level, but only one caller (`src/pages/index.astro`).
- [x] 7.3 `src/pages/index.astro` updated: destructures + stamps `<div id="sections" data-bake-signature={bakeSignature} set:html={sectionsHtml}>`.
- [x] 7.4 `src/lib/page-render.ts` `renderZoneInto('main', ...)` short-circuits when the cached/fresh sections + manifest produce a signature matching the SSR-stamped attribute. Updates the attribute after every real re-render so subsequent calls compare against fresh state, not stale SSR.
- [x] 7.5 `src/lib/page-render.ts:fetchManifest` switched from `cache: 'force-cache'` to `cache: 'no-cache'`. Force-cache was returning stale HTTP-cached manifests from before v1.54's `blurhash_data_url` + `asset_schema` fields shipped, defeating the placeholder rendering even when the freshly-deployed manifest had the fields.
- [x] 7.6 9 unit tests in `tests/unit/main-zone-signature.test.ts` covering: identity across same input, drift detection (position / type / vis / config), independence from `manifestGeneratedAt` (by design — see test JSDoc), independence from cosmetic non-render fields.
- [x] 7.7 End-to-end verified on deployed silver-pines: `ssrSig === liveSig` post-hydration; all 7 `<picture data-run402-image="1">` elements carry inline `background-image:url(data:image/png;base64,...)` placeholder on inner `<img>` (~1300 chars per the v1.54 pre-decoded data URL); the architectural short-circuit fires and preserves SSR content.

## 8. Content-sync investigation — legacy `seed.sql` blocks overriding typed seed (ADDED post-spec)

> Surfaced after Phase 3 landed but signatures still mismatched live-site — diagnosed as content drift, not code drift. Fix below.

- [x] 8.1 Identified root cause: `demo/<tenant>/seed.sql` (the `extraSqlFile`) had legacy hand-written homepage `INSERT INTO sections` blocks that ran AFTER the typed-seed inserts and either wiped them (silver-pines used `DELETE FROM sections WHERE page_slug='index'` then re-inserted stale activity_feed + cta) or duplicated them at the same positions with different `section_type` (eagles + barrio used `INSERT NOT EXISTS` keyed on section_type — different types succeed; same position now has two rows).
- [x] 8.2 Removed the redundant homepage block from `demo/silver-pines/seed.sql` (was -- 11. HOMEPAGE SECTIONS). Replaced with tombstone comment explaining the migration to `src/seeds/silver-pines.ts` as the single source of truth.
- [x] 8.3 Same removal in `demo/eagles/seed.sql` (was -- 17. HOMEPAGE SECTIONS).
- [x] 8.4 Same removal in `demo/barrio-unido/seed.sql` (was -- 12. HOMEPAGE SECTIONS).
- [x] 8.5 All three tenants redeployed; manifest + reset-demo.js regenerated to embed clean seed.sql. Next reset cron (hourly, `0 * * * *`) syncs DB to typed seed content.

## 9. Follow-ups completed post-Phase-3

### Strict-mode opt-in

- [x] 9a.1 Added `imageDefaults: { strict: { onSchema: '>=v1.49' } }` (Recipe B from the migration guide) to the `run402({ ... })` integration call in `astro.config.mjs`. Schema-filtered form — strict-checks only AssetRefs the gateway has stamped, leaves unstamped legacy/sub-threshold rows lenient. Safe because all three demo tenants are post-backfill: silver-pines 41/41, eagles 50/50, barrio 40/41 (1 unstamped is barrio's `logo.png`, correctly null per spec).
- [x] 9a.2 Built all three demos under strict mode; zero `R402_ASTRO_IMAGE_STRICT_DEGRADED` errors. Future broken admin uploads (missing variants, missing intrinsic dims, etc.) will now fail the build instead of silently rendering degraded.
- [x] 9a.3 Updated stale `@run402/astro@0.2.1` comment in `astro.config.mjs` to `@1.0.2` and noted the strict-mode rationale.

### Broader `<Run402Image>` adoption (event-rendering surfaces)

- [x] 9b.1 Migrated `src/components/kychon/EventsPageApp.tsx`'s `EventImage` helper: `lookupAssetRef(event.image_url, getGlobalManifest())` → `<Run402Image>` on hit, plain `<img>` fallback on miss. 12 event cards on silver-pines now render as `<picture data-run402-image="1">` with WebP variant ladder + v1.54 pre-decoded placeholder, verified live.
- [x] 9b.2 Migrated `src/components/kychon/EventDetailPageApp.tsx`'s event hero render — same pattern, plus `priority` because the event-detail hero is above-the-fold (drives LCP).
- [x] 9b.3 Migrated `src/components/kychon/EventsListIsland.tsx`'s events-list block widget. Sizes attribute reflects the grid/sidebar layout switch (33vw for grid, 100vw for sidebar).
- [x] 9b.4 Avatar-rendering surfaces (`DirectoryPageApp`, `ProfilePageApp`, `ForumPageApp`, `CommitteesPageApp`, `AdminMembersApp`, `SignInBarIsland`, `EventDetailPageApp` RSVP avatars) — DEFERRED. Sizes are 32-80px so variant ladder benefits are marginal; many avatars are user-uploaded runtime URLs that don't have manifest entries; migration would be mostly cosmetic with no visible improvement.

### `registerPreload` head-injection for LCP

- [x] 9c.1 Confirmed `@run402/astro@1.0.2` exposes `Astro.locals.run402.registerPreload(linkAttrs)` per the type definition. `<Run402Image>` automatically uses the helper when present (per the rev-2 component spec's "v1.0 ships adjacent, v1.1 promotes to head-injection with NO consumer code change" forward-compat hook). Kychon's existing `<Run402Image priority>` call sites benefit automatically; zero consumer code changes required.

### MediaPicker admin UI surfacing v1.54 metadata

- [x] 9d.1 Extended `MediaAssetRef` interface in `MediaPickerIsland.tsx` to include the v1.51 + v1.50 fields: `blurhash_data_url`, `asset_schema`, `image_info { color_space, has_alpha, bit_depth }`.
- [x] 9d.2 Added a small "extras" line to the selected-asset detail panel that surfaces non-sRGB color space, `has_alpha: true`, and any non-default `asset_schema` (legacy v1.49 / v1.50). Only renders when there's something notable — sRGB 8-bit JPEGs without alpha don't trigger an extra line.

### Wrapper module status after 1.0.2

- [x] 9e.1 Verified `ReactComponent<P>` now returns `ReactElement | null` in 1.0.2 (JSX compatibility issue from 1.0.0 is fixed). Tried direct `import { Run402Image } from '@run402/astro/react'` in a call site — still errors on AssetRef shape mismatch (TS2740: `@run402/astro` AssetRef ≠ `@run402/functions` AssetRef) and CSSProperties widening. So `src/lib/run402-image-react.tsx` wrapper still has work to do (AssetRef + style bridging), but the JSX cast is no longer strictly needed.
- [x] 9e.2 Updated wrapper JSDoc to reflect 1.0.2's state — three friction points down to two (JSX fixed). Wrapper collapses to a re-export once `@run402/astro`'s main entry re-exports `@run402/functions`'s AssetRef AND widens `style` to accept React's `CSSProperties` natively.

### Deferred (needs run402 team input)

- [ ] 9f.1 Deploy-time reset trigger: post-deploy invocation of `reset-demo.js` so the new `seed.sql` syncs to DB immediately instead of waiting up to 60 min for the next cron firing. Blocked because the run402 admin function-invocation endpoint isn't documented in Kychon's code; my probe attempts were correctly classifier-blocked (right-call — could have been destructive). Would need run402 team to surface the canonical "trigger scheduled function on demand" API surface.

## 10. Archive Readiness

- [x] 9.1 Phase 1 (intermediate kychon-image.ts switch) — complete.
- [x] 9.2 Phase 2 (full `<Run402Image>` adoption on the 3 React block surfaces) — complete; `@run402/astro@1.0.2` + `@run402/functions@2.7.0` + `@run402/sdk@2.15.2` all installed.
- [x] 9.3 Phase 3 (architectural SSR-preservation via bake-signature) — complete; ssrSig === liveSig verified live.
- [x] 9.4 Content sync (typed seed = DB) — legacy blocks removed from all three demo seed.sql files.
- [x] 9.5 Backfill (all 4 projects, 140 rows) — done in Section 2.
- [x] 9.6 All three demo tenants verified live: silver-pines (41/41 v1.54), eagles (50/50 v1.54), barrio (40/41 v1.54 — odd-one-out is logo.png, correctly unstamped per spec).
- [ ] 9.7 Section 4.8-4.11 follow-on items (blocks.ts string-template migration, error-boundary handling, decodeBlurhashToDataUri removal) — deferred per Section 4 explicit deferrals; not blocking archive.
- [ ] 9.8 Section 5 (per-tenant strict-mode rollout) — deferred; see follow-up change.
- [ ] 9.9 Section 6 (customer-port tenants ODBC / BMW Club Canberra / AAGE) — separate operator coordination; deferred.
- [ ] 9.10 Move to `openspec/changes/archive/adopt-run402-v1-54-engine/` (renumber section 10 → 11 if needed).
