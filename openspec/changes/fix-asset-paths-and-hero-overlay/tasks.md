## 1. Asset path resolution (kychon#159)

- [x] 1.1 Add `resolveAssetUrl` / `rewriteAssetUrlsInHtml` to `src/lib/kychon-image.ts`.
- [x] 1.2 Add `src/lib/bake-asset-manifest.ts` (integration manifest, else staged `public/_assets-manifest.json`) and use it in `chrome-bake.ts` and `Portal.astro`.
- [x] 1.3 Resolve brand icon, wordmark, favicon, hero logo overlay, feature-panel and member-login images, and custom-block HTML in `src/lib/blocks.ts` / `chrome-bake.ts`.
- [x] 1.4 Rewrite `/assets/` URLs in custom-page, event-description, and announcement HTML.
- [x] 1.5 Warm-cache the painted hero URL (`heroImageRenderUrl`) in `page-render.ts`.
- [x] 1.6 Regression tests: `tests/unit/asset-path-resolution.test.ts`.

## 2. Hero overlay (kychon#160)

- [x] 2.1 Add `overlay: 'auto' | 'brand' | 'none'` to `HeroConfig`; emit `data-hero-overlay` on background heroes with an image.
- [x] 2.2 Hide the scrim for `data-hero-overlay="none"` in `src/styles/public.css`.
- [x] 2.3 Regression tests in `tests/unit/blocks-hero.test.ts`; document in `STRUCTURE.md`.
