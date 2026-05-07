## Why

High-fidelity copied sites are currently forced to escape Kychon's editable block model whenever the source theme uses richer navigation behavior, source-specific interaction states, image accordions, shape dividers, or carousel controls. The Mississauga Children's Choir port exposed this clearly: visual parity shipped only after custom HTML/CSS/JS workarounds, then generated five engine friction issues (#94-#98).

This change makes those recurring copied-site patterns first-class so future ports remain source-faithful, admin-editable, accessible, and testable across viewports.

## What Changes

- Add first-class copied-theme fidelity support for:
  - source-imported header/nav behavior and styling controls
  - source-like hover/focus/transition states for nav items, CTAs, cards, buttons, social icons, and hover-reveal surfaces
  - an admin-editable image accordion / expanding hover-reveal block
  - an admin-editable SVG wave/shape divider block
  - richer carousel configuration by extending the existing `slideshow` block rather than duplicating carousel behavior
- Add admin editing surfaces for the new/extended block configs so copied-site content does not live in opaque custom HTML.
- Preserve existing flat nav, existing nested nav, existing slideshow configs, and generic Kychon themes as backwards-compatible defaults.
- Add tests and visual verification coverage for source-imported behavior, mobile nav layout, hover/focus parity, shape-divider color orientation, image accordion focus fallback, and rich carousel controls.

## Capabilities

### New Capabilities

- `copied-theme-fidelity`: First-class source theme fidelity controls and copied-site visual blocks: theme-imported nav behavior, source interaction states, image accordions, shape dividers, and rich carousel behavior.

### Modified Capabilities

- `composable-layout`: The block registry, nav block config, and admin block editing requirements expand to support copied-theme blocks and source-imported nav behavior.
- `config-driven-ui`: Theme injection expands from base color/font/radius tokens to source interaction-state and header/nav presentation tokens.

## Impact

- Affected GitHub issues: `kychee-com/kychon#94`, `#95`, `#96`, `#97`, `#98`.
- Affected code areas:
  - `src/lib/blocks.ts` block registry and renderers
  - `src/lib/blocks/slideshow.ts` runtime controller
  - `src/lib/nav-dropdown.ts` nav runtime behavior
  - `src/lib/config.ts` theme token injection
  - `src/components/AdminEditor.astro` block-specific config editors
  - `public/css/styles.css`, `public/css/nav-dropdown.css`, and related block CSS
  - typed seeds and seed SQL generation for copied-site examples
  - unit/integration tests for block rendering, hydration, admin config, and visual parity gates
- Data model impact is additive: new config JSON fields on existing `sections.config` and `site_config.theme`. No required schema migration is expected.
