## 1. Field-editability registry + self-explaining guard (make the invariant explicit)

- [x] 1.1 Add `src/lib/config-fields.ts` exporting a typed registry: each chrome/theme `site_config` key with `{ key, applyMode: 'runtime' | 'redeploy', reason }`. Final state declared: `custom_css` + fonts `runtime`, `color_scheme`/`motion` `redeploy`.
- [x] 1.2 Expose helpers: `getFieldMode(key)`, `runtimeFields()`, `redeployFields()`, `registeredKeys()`, `isRegisteredField()`, `configFieldsManifest()`/`configFieldsJson()`.
- [x] 1.3 Guard test (`tests/unit/config-fields-guard.test.ts`) source-scans the chrome bake for `site_config` reads (comment-stripped) and asserts each is declared. **Self-explaining failure**: names the offending field, the consuming file, and the exact next action. Green.

## 2. Runtime reconciliation of custom_css (the core fix)

- [x] 2.1 `<style id="wl-custom-css">` is now baked unconditionally in [Portal.astro](../../../src/layouts/Portal.astro) (always present so the runtime updater owns a stable element).
- [x] 2.2 `applyCustomCss(css)` in [src/lib/config.ts](../../../src/lib/config.ts) — **find-only** via `findDirectElementChild` (no DOM creation, per the `legacy-static-primitives` purity guard), sets/empties the baked element's `textContent`.
- [x] 2.3 `applyCustomCss(siteConfig.custom_css)` called on all three config-apply paths in `init()` (cached, fresh, `wl-config-changed` revalidate), adjacent to `applyTheme`/`applyBranding`.
- [x] 2.4 Registry declares `custom_css` `runtime`; guard green.

## 3. Shrink the redeploy set — fonts move to runtime

- [x] 3.1 `applyTheme` calls `ensureFontStylesheet(theme)`, which **finds** the stable `<link id="wl-font-stylesheet">` (baked by Portal from `chrome.fontStylesheetUrl`) and repoints/clears its `href` via the shared `buildGoogleFontsUrl`. The stylesheet `<link>` moved out of `renderFontHead` into the stable baked element so runtime can repoint it without creating DOM. (Refined from "adopt existing link" → "baked placeholder" to honor the DOM-purity guard.)
- [x] 3.2 Registry declares both font families `runtime`; `redeploy` set is exactly `theme.color_scheme` + `theme.motion` (asserted by the guard).

## 4. First-paint fidelity (build reads live config)

- [x] 4.1 New [src/lib/build-config.ts](../../../src/lib/build-config.ts): `fetchLiveSiteConfig(creds)` reads the live project's `site_config` via the same `config.get` capability the runtime uses (dynamic `@kychon/sdk` import so the pure helpers stay SDK-free), and `applyLiveConfigOverrides(seed, rows)` overrides the registry's top-level `runtime` chrome keys (`custom_css`, `theme`, branding) on the seed. Wired into [scripts/_lib.ts](../../../scripts/_lib.ts) `runDeploy` **before** `buildAstro` — the deploy seam, NOT `bakeChrome`. Fixes both first-paint staleness AND the `SEED_OWNED` `theme` upsert clobbering a live theme edit on redeploy.
- [x] 4.2 Fallback: missing creds / fetch error / no overridable rows → static seed unchanged (the override step is wrapped in try/catch and the merge returns the same seed reference). No-op overrides (live == seed, e.g. a demo after its reset cron) are skipped so the build keeps its typed-seed source kind. A deploy is never blocked by a config-API failure.

## 5. Agent affordance — co-located, generated from the one source

- [x] 5.1 `injectConfigFieldsJson(distDir)` in [scripts/_lib.ts](../../../scripts/_lib.ts) emits `dist/config-fields.json` from `configFieldsJson()`; wired into `writeAdapterAwareArtifacts` (the single seam both deploy paths route through, alongside `injectEnvJs`).
- [x] 5.2 Reflected into [CUSTOMIZING.md](../../../CUSTOMIZING.md) (new "Which `site_config` edits publish on reload vs. need a redeploy" table) and [STRUCTURE.md](../../../STRUCTURE.md) (Runtime Config from DB + lib listing).
- [x] 5.3 Drift guarded: the guard test asserts `configFieldsJson()` matches the typed registry exactly.

## 6. Tests

- [x] 6.1 Integration: `applyCustomCss` applies/updates/empties the baked `#wl-custom-css`, and no-ops safely when absent (never creates DOM).
- [x] 6.2 Integration: `applyTheme` repoints a single `#wl-font-stylesheet` for a non-system family, no duplication across repeated applies, clears href for system fonts.
- [x] 6.3 Integration: changed `custom_css` / font family across applies updates the DOM to the live value (simulates edit→reload publishing).
- [x] 6.4 Unit ([tests/unit/build-config.test.ts](../../../tests/unit/build-config.test.ts)): live `custom_css`/`theme` override the seed (wrapper shape preserved); non-chrome keys ignored; empty rows → unchanged seed reference (fetch-failure fallback); no-op when live == seed; input not mutated.
- [x] 6.5 Guard regression: a synthetic undeclared baked field is flagged by `undeclaredIn(...)`; `/config-fields.json` drift fails the manifest-match test.

## 7. Verify

- [x] 7.1 Full suite green: 1119 passed / 159 files; `tsc --noEmit` (main + scripts) clean; `biome check` clean. No resource-load noise.
- [ ] 7.2 On a deployed demo, edit `site_config.custom_css` (and a `theme.font_body`) via SQL, reload, confirm no-rebuild publish + no cold-visit flash. (Requires deploy — manual follow-up.)
- [ ] 7.3 Confirm `GET /config-fields.json` on the deployed demo returns the registry. (Requires deploy — manual follow-up. Content verified locally: 10 `runtime`, 2 `redeploy`.)
