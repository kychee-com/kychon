## ADDED Requirements

### Requirement: Asset paths resolve through the manifest in every emitter

The system SHALL resolve a configured `/assets/<basename>` image URL to the asset manifest's CDN URL wherever it renders the URL: chrome (`brand_icon_url`, `brand_wordmark_url`, `favicon_url`), the hero background image and logo overlay, feature-panel and member-login images, and `src`/`href` attributes in custom-block, custom-page, event-description, and announcement HTML. The build-time bake SHALL use the `@run402/astro` integration's manifest when present, otherwise the port-staged `public/_assets-manifest.json`. A URL with no manifest entry SHALL be emitted unchanged.

#### Scenario: Port chrome resolves at build time
- **WHEN** a port stages `public/_assets-manifest.json` containing `Logo.jpg` and sets `brand_icon_url` and `favicon_url` to `/assets/Logo.jpg`
- **THEN** the built HTML's brand icon `src` and favicon `href` are the manifest CDN URL
- **AND** the built HTML does not contain `/assets/Logo.jpg`

#### Scenario: Custom HTML image resolves
- **WHEN** a custom block's HTML contains `<img src="/assets/Ad.jpg">` and the manifest has `Ad.jpg`
- **THEN** the rendered `<img>` uses the manifest CDN URL

#### Scenario: Manifest miss keeps the configured URL
- **WHEN** a configured `/assets/<basename>` URL has no manifest entry
- **THEN** the URL is emitted unchanged

#### Scenario: Hero warm-cache stores the painted URL
- **WHEN** the runtime caches the active hero image for the next visit
- **THEN** it caches the manifest-resolved URL the hero paints, not the configured `/assets/...` path

### Requirement: Background hero overlay is configurable

A `hero` block in background mode with a `bg_image` SHALL accept `config.overlay` of `"auto"`, `"brand"`, or `"none"`, emitted as `data-hero-overlay="brand"` or `data-hero-overlay="none"`. `"auto"` (the default, and any unknown value) SHALL resolve to `brand` when `heading`, `subheading`, or `cta_text` is non-blank and to `none` otherwise. The primary-colour scrim SHALL NOT paint when the overlay is `none`.

#### Scenario: Image-only hero is untinted by default
- **WHEN** a background hero has a `bg_image` and blank heading, subheading, and CTA text, with no `overlay`
- **THEN** it renders with `data-hero-overlay="none"` and no scrim

#### Scenario: Hero with text keeps the scrim
- **WHEN** a background hero has a `bg_image` and a heading, with no `overlay`
- **THEN** it renders with `data-hero-overlay="brand"` and the primary-colour scrim

#### Scenario: Explicit opt-out
- **WHEN** a background hero sets `overlay: "none"`
- **THEN** no scrim paints regardless of text
