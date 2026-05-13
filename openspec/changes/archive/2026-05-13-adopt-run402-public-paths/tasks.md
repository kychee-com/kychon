## 1. Dependency And Route Model

- [x] 1.1 Bump `@run402/sdk` to exact `1.69.0` in `package.json` and refresh `package-lock.json`.
- [x] 1.2 Confirm TypeScript accepts `ReleaseSpec.site.public_paths` in the deployed SDK types.
- [x] 1.3 Rename or replace clean-route static route helpers so the shared module can generate explicit public path entries while preserving href canonicalization and safe custom page slug validation.
- [x] 1.4 Add unit tests for public path generation covering standard pages, `index.html`, generated custom pages, query-preserving clean paths, and hidden `.html` implementation paths.

## 2. Explicit Public Path Generation

- [x] 2.1 Generate `site.public_paths.replace` from the complete Run402 file set after custom page files and `kychon-release.json` are materialized.
- [x] 2.2 Map Kychon-owned HTML assets to clean public paths only, including `/`, `/events`, `/resources`, `/forum`, `/polls`, `/committees`, `/search`, `/directory`, `/join`, `/profile`, `/event`, `/admin`, `/admin-members`, `/admin-settings`, and safe generated custom page slugs.
- [x] 2.3 Publish required support files explicitly, including `/_astro/*`, `/assets/*`, `/css/*`, `/custom/*`, `/js/env.js`, `/favicon.svg`, `/favicon.ico`, `/.well-known/kychon.json`, `/kychon-capabilities.json`, `/kychon-release.json`, and `/llms.txt`.
- [x] 2.4 Assign conservative `cache_class` values for HTML, mutable support assets, and clearly versioned or content-hashed assets.
- [x] 2.5 Ensure generated public paths never include query strings, fragments, traversal segments, wildcards, or raw Kychon-owned `.html` implementation URLs.

## 3. Deploy Spec Integration

- [x] 3.1 Update `scripts/_lib.ts` so `site` includes both `replace: fileSet` and `public_paths: { mode: "explicit", replace: publicPaths }`.
- [x] 3.2 Stop emitting ordinary static page aliases through `routes.replace`.
- [x] 3.3 Emit `routes: { replace: [] }` when there are no same-origin function routes so previously deployed v1.66 static route aliases are cleared.
- [x] 3.4 Preserve the ability to add true function routes or deliberate method-aware route exceptions in the future without mixing ordinary static pages back into `routes.replace`.
- [x] 3.5 Update dry-run output and deploy logging to show public path counts, representative mappings, hidden `.html` behavior, and v1.69 diagnostic commands.

## 4. Public URL Canonicalization

- [x] 4.1 Update any remaining source, seed, and generated config expectations that still treat `/events.html` as Kychon's public events URL.
- [x] 4.2 Update site search defaults and tests so search forms, result pages, and autosuggest fallback submit to `/search`.
- [x] 4.3 Keep legacy href canonicalization as an input cleanup path so imported or stored `/events.html` and `/page.html?slug=about` values still render as clean hrefs.
- [x] 4.4 Confirm custom page runtime resolution works from clean paths without requiring `/page.html?slug=...` to be public.

## 5. Verification And Operations

- [x] 5.1 Add or update tests that inspect the assembled dry-run deploy spec for `site.public_paths` explicit mode and absence of ordinary static routes.
- [x] 5.2 Add verification coverage that `/events` is public and `/events.html` is not public for deployed portals.
- [x] 5.3 Update fleet/manual verification docs or helpers to inspect Run402 `static_public_paths` and `explicit_public_path` reachability authority.
- [x] 5.4 Run the relevant unit tests for clean routes/public paths, deploy spec assembly, site search route expectations, and release manifest visibility.
- [x] 5.5 Run a full build to ensure explicit public paths include all generated support assets.

## 6. Live Demo Validation

- [x] 6.1 Deploy one demo portal with Run402 v1.69 public paths.
- [x] 6.2 Verify live `GET /events`, `/search?q=hello&type=all`, `/kychon-release.json`, `/.well-known/kychon.json`, `/js/env.js`, `/css/theme.css`, and at least one `/_astro/*` asset.
- [x] 6.3 Verify live `GET /events.html`, `/search.html`, `/admin.html`, and `/page.html?slug=about` are not successful public HTML responses.
- [x] 6.4 Inspect active release inventory or resolve diagnostics to confirm `/events` maps to `events.html` through `explicit_public_path`.
- [x] 6.5 Record live validation notes in the task list or release documentation before marking the change complete.

Live validation notes (2026-05-13): deployed Eagles demo project `prj_1776162941487_0008` with release `rel_1778701577960_1f311e54` using `@run402/sdk` `1.69.0`. Verified `https://eagles.kychon.com/events` and `/search?q=hello&type=all` return public HTML, and verified `/kychon-release.json`, `/.well-known/kychon.json`, `/js/env.js`, `/css/theme.css`, and `/_astro/events.astro_astro_type_script_index_0_lang.COWyeukc.js` return HTTP 200. Verified `/events.html`, `/search.html`, `/admin.html`, and `/page.html?slug=about` do not return successful public HTML. `run402 deploy diagnose --project prj_1776162941487_0008 https://eagles.kychon.com/events --method GET` resolves `/events` to `events.html` with `reachability_authority: "explicit_public_path"`; `/events.html` diagnoses as `would_serve: false`, `diagnostic_status: 404`, and `authorized: false`.
