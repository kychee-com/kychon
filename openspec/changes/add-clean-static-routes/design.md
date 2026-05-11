## Context

Kychon currently builds flat Astro files such as `events.html`, `resources.html`, `search.html`, and a generic `page.html` that reads `?slug=<page>` at runtime. The public demos therefore expose URLs like `/events.html` and `/page.html?slug=about`. Run402 v1.66 adds exact static route targets, which lets a release route `/events` directly to `events.html` without turning Kychon into an SSR app or adding rewrite functions.

Static route targets are exact deployed files, not rewrites. `target.file` cannot include a leading slash, query string, fragment, traversal, directory shorthand, or wildcard. That means module pages such as `/events` can point at existing `events.html`, while custom pages such as `/about` need a real `about.html` file in the deploy artifact.

## Goals / Non-Goals

**Goals:**

- Serve clean public aliases for every Kychon-owned HTML route that can be represented as an exact static target.
- Generate per-slug static files for published seed-backed custom pages, so `/about` and `/volunteer` do not depend on `page.html?slug=...`.
- Keep legacy `.html` and `page.html?slug=` URLs working for old bookmarks and in-flight deployments.
- Preserve query parameters for stateful pages such as search, event detail, resource filters, and forum category/topic views.
- Make clean URLs the canonical Kychon-owned hrefs in seed output, block configs, search results, and route-active helpers.
- Use Run402 v1.66 deploy diagnostics and static asset observability when verifying deployed clean routes.

**Non-Goals:**

- Removing `.html` files or issuing HTTP redirects from legacy URLs to clean URLs.
- Supporting arbitrary database-created pages as clean static aliases when their slug was not known at build/deploy time.
- Mapping clean URLs to files through wildcard, directory, or query-string route targets.
- Replacing the existing client-side data fetching model for events, resources, search, forum, polls, committees, or admin pages.
- Converting Kychon into a server-rendered or function-routed app.

## Decisions

### Decision 1: Use Run402 exact static route aliases

The deploy spec should include `routes: { replace: [...] }` entries with `target: { type: "static", file: "<file>.html" }` and `methods: ["GET", "HEAD"]`. This preserves Kychon's static-first architecture and keeps route activation atomic with the site, functions, database, and subdomain release.

Alternative considered: add a routed function that rewrites clean paths to `.html` files. Rejected because it adds public dynamic ingress, auth/CSRF/CORS responsibilities, and runtime failure modes for routes that are already static files.

### Decision 2: Materialize custom page slug files from `page.html`

After Astro builds `dist/page.html`, the deploy build step should copy it to `<slug>.html` for each published, build-known page whose slug is safe for a clean path. The client page code should resolve the page slug from either `?slug=` or the current clean path. This lets `/about` target `about.html` while preserving `page.html?slug=about`.

Alternative considered: use a Run402 static route target of `page.html?slug=about`. Rejected because v1.66 static targets are exact file names and explicitly forbid query strings.

### Decision 3: Centralize Kychon-owned URL canonicalization

Implement one shared helper that maps Kychon-owned hrefs:

- `/page.html?slug=about` -> `/about`
- `/events.html` -> `/events`
- `/search.html?q=hello&type=all` -> `/search?q=hello&type=all`

Use it from seed SQL generation, runtime renderers, search URL helpers, and route-active matching so the app does not accumulate multiple partial URL rules.

Alternative considered: manually edit each seed and page. Rejected because ported sites and future blocks can still emit legacy paths, and the deploy should normalize the Kychon-owned surface consistently.

### Decision 4: Only alias safe, non-conflicting slugs

Generated custom page aliases should require lowercase path slugs made of letters, digits, and hyphens, optionally with single slash-separated segments if the repo intentionally supports nested clean paths later. Slugs must not collide with reserved Kychon routes such as `events`, `search`, `admin`, or deployed static file aliases. Unsafe or colliding slugs keep their legacy `page.html?slug=` URL.

Alternative considered: percent-encode every possible page slug into a route. Rejected because static route patterns are public URLs, and route tables should stay human-readable, safe, and diagnosable.

### Decision 5: Treat generated routes as deploy output, not hand-maintained manifest

The deploy script should derive static route entries from known route files and generated page aliases during the build/deploy flow. Tests should assert the generated route table rather than requiring each demo seed to maintain separate manifest data.

Alternative considered: store a static `routes` config per seed. Rejected because the alias set is mostly mechanical and can drift from the actual files in `dist/`.

## Risks / Trade-offs

- [Risk] `routes.replace` can accidentally remove existing route entries if future Kychon releases add dynamic routes. -> Mitigation: route generation should own the full Kychon public route table and tests should cover any added dynamic routes before they ship.
- [Risk] Static route table size may grow for large ports with many custom pages. -> Mitigation: generate aliases only for build-known published pages and heed Run402 `STATIC_ALIAS_TABLE_NEAR_LIMIT`/`ROUTE_TABLE_NEAR_LIMIT` warnings.
- [Risk] Relative links inside copied `page.html` aliases could resolve differently from `/page.html?slug=...`. -> Mitigation: Kychon should canonicalize internal absolute-root hrefs and avoid document-relative asset links in page chrome.
- [Risk] Search engines may see both `.html` and clean URLs. -> Mitigation: keep this release additive; a later SEO change can add canonical link metadata or redirects once live behavior is verified.
- [Risk] SDK types before v1.66 do not model static route targets. -> Mitigation: bump the exact `@run402/sdk` pin to `1.66.0` as part of this change.

## Migration Plan

1. Add route/canonicalization helpers and tests.
2. Generate custom page slug files after `astro build` and before `fileSetFromDir()`.
3. Build a Run402 static route table from standard Kychon HTML files plus generated page aliases.
4. Add the route table to the `r.deploy.apply()` release spec.
5. Update search, nav, page slug detection, and seed SQL generation to prefer clean URLs while accepting legacy URLs.
6. Bump `@run402/sdk` to `1.66.0`, refresh lockfile, and run type checks.
7. Deploy one demo and validate representative URLs with `run402 deploy diagnose --project <project_id> https://eagles.kychon.com/<path> --method GET`.

Rollback: revert the release spec route generation and deploy again. The underlying `.html` files remain in the site bundle, so legacy URLs keep serving during and after rollback.

## Open Questions

- Should a later SEO-focused change add canonical link tags or explicit redirects from `.html` paths to clean paths?
- Should operator-created database pages eventually get a dynamic fallback for clean slugs, or should clean static aliases remain build-known only?
