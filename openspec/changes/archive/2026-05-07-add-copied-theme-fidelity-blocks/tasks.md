## 1. Model and Compatibility

- [x] 1.1 Audit the current Mississauga custom workaround patterns and map each to `nav`, `slideshow`, `image_accordion`, `shape_divider`, or theme interaction config.
- [x] 1.2 Define TypeScript config shapes for copied-theme nav presentation/behavior, interaction tokens, `image_accordion`, `shape_divider`, and rich `slideshow` fields.
- [x] 1.3 Add backwards-compatibility tests proving existing flat nav, nested nav, base theme, and legacy slideshow configs still render unchanged.

## 2. Theme Interaction Tokens

- [x] 2.1 Extend theme token application in `src/lib/config.ts` to map optional interaction-state tokens onto CSS custom properties.
- [x] 2.2 Add CSS defaults/usages for button, CTA, card, nav link, social icon, carousel control, and hover-reveal interaction variables.
- [x] 2.3 Add theme cache-first tests showing copied-theme interaction and header/nav tokens apply from cached `site_config`.
- [x] 2.4 Add fallback tests showing missing copied-theme tokens preserve existing Kychon styling.

## 3. Source-Imported Nav Behavior

- [x] 3.1 Extend the `nav` block config to accept optional `presentation` and `behavior` objects without changing existing `items` behavior.
- [x] 3.2 Update the nav renderer to emit scoped variables/data attributes for source header footprint, dropdown presentation, chevron styling, transitions, and mobile layout behavior.
- [x] 3.3 Update nav CSS and `src/lib/nav-dropdown.ts` only as needed to honor source presentation while preserving keyboard, pointer, and mobile dropdown behavior.
- [x] 3.4 Add unit/integration tests for source dropdown styling, mobile closed state, mobile open state, and legacy nav fallback.

## 4. Image Accordion Block

- [x] 4.1 Add `image_accordion` to `BLOCK_TYPES` with safe default config, renderer, zone hints, supported spans, and admin wrappers.
- [x] 4.2 Add image accordion CSS for desktop expand/reveal behavior, focus-visible parity, overlays, object fit/position, and mobile readable fallback.
- [x] 4.3 Add a small hydrator/controller if CSS alone cannot preserve active/focus state across pointer, keyboard, and touch behavior.
- [x] 4.4 Add tests for render output, escaping, panel order, hover/focus state hooks, mobile fallback classes, and structured config paths.

## 5. Shape Divider Block

- [x] 5.1 Add `shape_divider` to `BLOCK_TYPES` with preset/imported path config, fill layers, flip controls, responsive height, color binding, and full-bleed support.
- [x] 5.2 Add validation/sanitization for SVG path and layer data so arbitrary imported SVG markup or scripts cannot execute.
- [x] 5.3 Add CSS/rendering support for top/bottom placement, horizontal/vertical flips, multi-layer fills, and responsive heights.
- [x] 5.4 Add tests for imported path rendering, invalid path fallback, full-width rendering, flips, and top/bottom color orientation.

## 6. Rich Carousel Extensions

- [x] 6.1 Extend the existing `slideshow` config with per-slide object position/focal controls, responsive height/aspect controls, arrow/dot style tokens, transition timing/easing, and pause/manual state fields.
- [x] 6.2 Update the slideshow renderer to emit rich carousel attributes/styles while preserving legacy config defaults.
- [x] 6.3 Update `src/lib/blocks/slideshow.ts` to honor rich timing, controls, keyboard behavior, reduced motion, pause/manual state, and accessible announcements.
- [x] 6.4 Add tests for source slide order, per-slide crop controls, arrow/dot styling hooks, autoplay/pause behavior, keyboard controls, and legacy slideshow compatibility.

## 7. Admin Editing Surfaces

- [x] 7.1 Add type-specific editor entry points from the generic section edit popover for `image_accordion`, `shape_divider`, `slideshow`, and `nav`.
- [x] 7.2 Implement an `image_accordion` panel editor for adding, removing, reordering, and editing panel fields.
- [x] 7.3 Implement a `shape_divider` editor for preset/path, fill layers, opacity, flips, height, and color binding.
- [x] 7.4 Implement rich slideshow settings for slide crop/focal fields, height/aspect, controls, transition, autoplay, and pause/manual state.
- [x] 7.5 Extend nav editing with source presentation/behavior fields while keeping the existing nav item editor intact.
- [x] 7.6 Add admin editor tests for structured config PATCHes, cache invalidation, and `wl-content-rendered` dispatch.

## 8. Fixtures, Verification, and Documentation

- [x] 8.1 Add or update a copied-theme fixture/seed that exercises source nav behavior, interaction tokens, image accordion, shape divider, and rich carousel.
- [x] 8.2 Add visual/browser verification for desktop hover/focus states, mobile nav closed/open layout, carousel arrow click/autoplay, image accordion hover/focus, and shape-divider color orientation.
- [x] 8.3 Update developer docs or `STRUCTURE.md` to document copied-theme block config fields and when to use them instead of custom HTML.
- [x] 8.4 Run targeted unit/integration tests for blocks, theme config, nav behavior, admin editing, and copied-theme fixtures.
- [x] 8.5 Run full validation required by the repo before marking the change complete.
