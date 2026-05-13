## Context

Kychon is an Astro static-output portal. The build emits release assets such as `events.html`, `search.html`, `_astro/*.js`, `css/*.css`, and generated custom page shells such as `about.html`. The completed `add-clean-static-routes` change made clean paths work by adding Run402 v1.66 `routes.replace` entries:

```
/events  ── route_static_alias ──▶ events.html
```

That solved shareable clean URLs, but it left the backing release asset public through Run402's filename-derived static serving:

```
/events       200
/events.html  200
```

Run402 v1.69.0 adds `site.public_paths`, which separates release asset paths from browser-visible public paths. In explicit mode, a release can contain `events.html` as an internal asset while publishing only `/events`.

```
Release asset table          Public path table
──────────────────          ─────────────────────────
events.html          ◀────── /events
search.html          ◀────── /search
about.html           ◀────── /about
_astro/app.hash.js   ◀────── /_astro/app.hash.js
```

## Goals / Non-Goals

**Goals:**
- Upgrade Kychon's typed Run402 deploy dependency to exact `@run402/sdk@1.69.0`.
- Use `site.public_paths` explicit mode for ordinary static browser URLs.
- Hide Kychon-owned `.html` implementation paths such as `/events.html` and `/page.html?slug=about`.
- Preserve Kychon's static-first architecture and Astro file output.
- Publish all required non-HTML support files explicitly so pages still load scripts, styles, config, images, manifests, and discovery files.
- Clear or replace stale v1.66 static route aliases so public reachability comes from `explicit_public_path`, not `route_static_alias`.
- Add verification that `/events` works and `/events.html` does not.

**Non-Goals:**
- Adding redirect responses from legacy `.html` URLs to clean URLs.
- Removing `.html` files from the release asset set.
- Introducing SSR or a rewrite function for normal static pages.
- Guaranteeing clean routes for arbitrary database-created pages whose slugs were not known at build/deploy time.
- Moving Kychon's Capability API to same-origin function routes.

## Decisions

### Decision 1: Use `site.public_paths` explicit mode for static pages

The deploy spec should set:

```json
{
  "site": {
    "replace": { "events.html": "..." },
    "public_paths": {
      "mode": "explicit",
      "replace": {
        "/events": { "asset": "events.html", "cache_class": "html" }
      }
    }
  }
}
```

This makes `/events` public without making `/events.html` public. It also matches the Run402 v1.69 guidance that `site.public_paths` is preferred for ordinary clean static URLs.

Alternative considered: keep v1.66 `routes.replace` static aliases. Rejected because routes do not hide filename-derived static paths.

Alternative considered: delete or rename `.html` files before deploy. Rejected because Astro still emits file-based page shells and Run402 public paths can already separate asset identity from public URL identity.

Alternative considered: route all clean paths through a function. Rejected because static pages do not need dynamic ingress, function auth/CORS concerns, or runtime failure modes.

### Decision 2: Generate the explicit public-path table from the file set

The deploy helper should build public paths mechanically after `fileSetFromDir(distDir)`.

- HTML page assets map to clean paths:
  - `index.html` -> `/`
  - `events.html` -> `/events`
  - generated `about.html` -> `/about`
- Known public support files map to their same path:
  - `/_astro/*`
  - `/assets/*`
  - `/css/*`
  - `/custom/*`
  - `/js/env.js`
  - `/favicon.svg`, `/favicon.ico`
  - `/.well-known/kychon.json`
  - `/kychon-capabilities.json`
  - `/kychon-release.json`
  - `/llms.txt`

The generator should not publish Kychon-owned `.html` paths, `page.html`, or generated custom page files under their raw filenames. It should also fail or warn if an HTML page that must be public has no clean path.

Alternative considered: hand-maintain a static public path manifest. Rejected because generated custom page aliases and hashed Astro assets change with build output.

### Decision 3: Keep route tables for function ingress and method-aware exceptions

Run402 v1.69 treats `routes` as a separate resource. Omitting `routes` or passing `null` carries routes forward from the base release, so Kychon should not simply stop emitting the old static aliases. The v1.69 deploy should either:

- emit `routes: { replace: [] }` when there are no same-origin function routes, or
- emit `routes.replace` containing only real routed functions or deliberate method-aware exceptions.

Ordinary static paths such as `/events`, `/search`, `/admin`, and `/about` should not remain in `routes.replace`.

### Decision 4: Treat legacy `.html` URL removal as an intentional breaking cleanup

After this change, Kychon-owned legacy URLs such as `/events.html`, `/search.html`, `/admin.html`, and `/page.html?slug=about` should return not found on deployed Run402 public hosts. Internal browser code and generated content should already canonicalize Kychon-owned hrefs to clean paths, so the main blast radius is external bookmarks and old crawler state.

No redirects are included in this change. Redirects would require a function or future platform redirect primitive and would reintroduce dynamic public ingress for static pages.

### Decision 5: Verify through release inventory, resolve diagnostics, and HTTP smoke

Verification should inspect the deployed release's `static_public_paths` inventory and use Run402 diagnostics where available. It should also perform real HTTP checks because CDN behavior is what users see.

Minimum smoke:

- `GET /events` returns `200 text/html`
- `GET /events.html` returns `404` or equivalent not served
- `GET /search?q=hello&type=all` returns the search page and preserves query parameters for browser code
- `GET /_astro/...`, `/css/...`, `/js/env.js`, `/kychon-release.json`, and `/.well-known/kychon.json` still work

## Risks / Trade-offs

- [Risk] Explicit mode can accidentally hide required scripts, styles, images, or manifests. -> Mitigation: generate public paths from the full file set, add tests for representative asset classes, and smoke deployed portals after upgrade.
- [Risk] Old `.html` bookmarks break. -> Mitigation: this is an intentional breaking change; ensure Kychon-owned links are clean before deployment and document that legacy compatibility requires explicit opt-in.
- [Risk] Stale v1.66 route aliases remain active if `routes` is omitted. -> Mitigation: emit `routes.replace` deliberately, even when it is an empty array.
- [Risk] Cache classes are misapplied. -> Mitigation: use `html` for public HTML paths, conservative revalidating classes for mutable assets, and immutable classes only for obviously versioned or content-hashed assets.
- [Risk] Active `add-clean-static-routes` artifacts mention route aliases and legacy `.html` compatibility. -> Mitigation: treat this change as the successor decision and update/archive specs in the correct order during implementation.

## Migration Plan

1. Bump the exact `@run402/sdk` dependency and lockfile to `1.69.0`.
2. Replace route-spec helpers with public-path helpers, retaining URL canonicalization and custom page slug safety.
3. Wire `site.public_paths` explicit mode into the `r.deploy.apply()` release spec.
4. Emit `routes.replace` only for real routed functions or as an empty list to clear stale static aliases.
5. Update dry-run output and deploy logs to show public paths and diagnostic commands.
6. Update specs/tests that still expect `/events.html` or `/search.html` as public routes.
7. Deploy one demo portal and verify `/events`, `/search`, support assets, release manifest, and negative `/events.html` reachability.

Rollback: deploy the previous release shape with implicit filename-derived static serving or v1.66 static route aliases. Since the release still contains `.html` assets, rollback does not require rebuilding page content or migrating data.

## Open Questions

- Should Kychon offer a temporary operator flag that republishes selected legacy `.html` public paths for high-traffic migrated portals?
- Should a future platform redirect primitive replace the no-redirect stance for SEO-sensitive legacy URLs?
