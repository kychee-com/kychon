## Why

Kychon's clean URL work currently uses Run402 v1.66 static route aliases, which makes `/events` work but still leaves `/events.html` publicly reachable as an implementation file. Run402 v1.69.0 adds `site.public_paths`, letting Kychon publish clean browser paths such as `/events` while keeping backing `.html` assets private to the release.

## What Changes

- Upgrade Kychon's exact-pinned `@run402/sdk` usage from `1.66.0` to `1.69.0`.
- Replace ordinary static clean aliases in `routes.replace` with `site.public_paths` in explicit mode.
- Publish Kychon-owned HTML pages, metadata files, runtime config, stylesheets, scripts, and assets through explicit public paths.
- **BREAKING**: Kychon-owned `.html` implementation paths such as `/events.html`, `/resources.html`, `/search.html`, `/admin.html`, and generated custom page files are no longer public URLs after a v1.69 deploy unless deliberately declared.
- Keep release asset file names such as `events.html` as internal deploy targets so Astro static output and client-side page code remain static-first.
- Reserve `routes.replace` for routed functions and unusual method-aware static route behavior, not ordinary clean static page publication.
- Update diagnostics and verification to inspect Run402 `static_public_paths` and negative `.html` reachability, not only route-table aliases.

## Capabilities

### New Capabilities
- `public-static-paths`: Explicit public browser-path contract for Kychon static releases on Run402 v1.69+.

### Modified Capabilities
- `deploy`: Deploy specs now publish clean static URLs via `site.public_paths` explicit mode and hide `.html` asset paths by default.
- `config-driven-ui`: Navigation requirements now expect clean Kychon-owned hrefs such as `/events`.
- `site-search`: Search block and search results page requirements now expect `/search` instead of `/search.html`.

## Impact

- Code: `package.json`, `package-lock.json`, `src/lib/clean-routes.ts`, `scripts/_lib.ts`, deploy diagnostics, release verification helpers, and route/public-path tests.
- Deploy/runtime: Run402 release specs gain `site.public_paths: { mode: "explicit", replace: ... }`; ordinary static route aliases move out of `routes.replace`.
- Public URLs: clean Kychon-owned URLs become the only public HTML surface for deployed portals; legacy `.html` bookmarks return not found unless a project intentionally publishes compatibility paths.
- Operations: fleet smoke checks should verify `/events` succeeds and `/events.html` does not, plus inspect active release inventory for `static_public_paths`.
