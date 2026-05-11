## Why

Kychon’s public portal URLs still expose implementation-shaped `.html` paths and query-string page slugs such as `/page.html?slug=about`, even though Run402 v1.66 supports exact static route targets. Clean URLs like `/about`, `/events`, and `/search?q=hello&type=all` make hosted portals easier to share, inspect, and port from existing association sites while preserving Kychon’s static-first deployment model.

## What Changes

- Generate deployable static HTML aliases for published seed-backed custom pages, so slugs such as `about` and `volunteer` materialize as `about.html` and `volunteer.html`.
- Add Run402 `routes.replace` static aliases for clean public paths:
  - `/events` -> `events.html`
  - `/resources` -> `resources.html`
  - `/forum` -> `forum.html`
  - `/polls` -> `polls.html`
  - `/committees` -> `committees.html`
  - `/search` -> `search.html`
  - generated page slugs such as `/about` -> `about.html`
- Canonicalize Kychon-owned links in seeded navigation, block configs, search results, and runtime route helpers from `.html` or `page.html?slug=` forms to clean paths where a static alias exists.
- Preserve query-string state on clean route requests. For example, `/search?q=hello&type=all` resolves through the `/search` static route and the existing browser page reads the query parameters unchanged.
- Keep the legacy `.html` URLs working as deployed static files for compatibility; this change adds clean aliases instead of removing old URLs.
- Update the Run402 SDK/CLI usage expectations to v1.66.0 where route static targets are available and use deploy diagnostics when validating clean URL behavior.

## Capabilities

### New Capabilities

- `clean-static-routes`: Clean public URL aliases for Kychon static pages and seed-backed custom page slugs.

### Modified Capabilities

- `deploy`: Kychon deploys SHALL include Run402 static route entries for clean public paths.
- `config-driven-ui`: Kychon navigation and schema-driven custom pages SHALL support clean page URLs in addition to legacy `page.html?slug=` URLs.
- `site-search`: Search forms and result URLs SHALL use `/search` and clean page result URLs where available.

## Impact

- Code: `scripts/_lib.ts`, deploy helpers, seed/link canonicalization helpers, `src/pages/page.astro`, `src/lib/page-render.ts`, `src/lib/config.ts`, `src/lib/search.ts`, and tests.
- Deploy/runtime: Run402 release specs gain `routes.replace` entries with exact static targets. Ordinary static files remain deployed under their existing `.html` names.
- Dependencies: `@run402/sdk` should be bumped from the current exact pin to `1.66.0` so TypeScript understands static route targets.
- Operations: verification should prefer `run402 deploy diagnose --project <project_id> <url> --method GET` or `r.deploy.resolve({ project, url, method })` instead of guessing which static file serves a clean URL.
