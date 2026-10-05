## Why

Ported sites (copy-website) reference uploaded images as `/assets/<basename>`, but that path is not served — only the manifest's `_blob/astro/...` CDN URLs are. Outside typed page-image fields the literal path was emitted, so the logo, favicon, wordmark, hero image, and `<img>` inside custom HTML returned 403/404 on every port (kychon#159). Ports stage their manifest at `public/_assets-manifest.json`, which the build-time bake never read.

Separately, a background-mode hero always painted a primary-colour scrim over `bg_image`, so image-only heroes were brand-tinted with no way to opt out (kychon#160).

## What Changes

- The build-time bake reads the asset manifest from the `@run402/astro` integration or, for ports, from `public/_assets-manifest.json`; Portal inlines the same manifest.
- `/assets/<basename>` resolves through the manifest in chrome (brand icon, wordmark, favicon), hero background image and foreground logo overlay, feature-panel and member-login images, and `src`/`href` attributes inside custom-block, custom-page, event-description, and announcement HTML. Misses keep the configured URL.
- The hero warm-cache stores the URL the hero paints, not the configured `/assets/...` path.
- Background heroes accept `config.overlay`: `"auto"` (default; scrim only when heading/subheading/CTA text is present), `"brand"`, or `"none"`.

## Capabilities

### Modified Capabilities

- `config-driven-ui`: asset-path resolution across block emitters; hero background overlay setting.
