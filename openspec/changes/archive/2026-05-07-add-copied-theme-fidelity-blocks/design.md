## Context

Kychon already has the right substrate for copied-site fidelity: every visible block is a `sections` row, `src/lib/blocks.ts` is the shared renderer, dynamic blocks hydrate through small browser controllers, and chrome is represented as header/footer blocks. The current friction is that several common source-site patterns still have no structured representation, so ports fall back to `custom` blocks and site-specific CSS/JS.

The Mississauga Children's Choir port is the representative case. It needed native nav children plus source-specific header footprint and mobile behavior, source hover/focus states, a Jet/Elementor image accordion, Elementor-style SVG shape dividers, and a rich carousel. The engine already covers part of this: nested nav exists, theme base tokens exist, and `slideshow` already has autoplay, arrows, dots, transitions, fit, aspect ratio, ARIA, and keyboard behavior. The change should extend those existing systems rather than introduce a second rendering stack.

## Goals / Non-Goals

**Goals:**

- Keep copied-site visual parity inside structured `sections.config` and `site_config.theme` data.
- Add first-class `image_accordion` and `shape_divider` block types.
- Extend the existing `slideshow` block into a rich carousel surface without breaking current slideshow configs.
- Extend the `nav` block with source-imported presentation and behavior config while preserving existing flat/nested nav behavior.
- Add reusable theme interaction tokens for hover/focus/transition states and allow per-block overrides where copied themes require them.
- Make all new surfaces admin-editable and testable without requiring custom HTML/CSS/JS for common copied-site patterns.

**Non-Goals:**

- No full page-builder rewrite or arbitrary CSS editor replacement.
- No attempt to model every Elementor/WordPress widget in this change.
- No support for executing source-site JavaScript.
- No destructive migration of existing section configs.
- No requirement that generic Kychon demo sites use the copied-theme features by default.

## Decisions

### 1. Add a copied-theme capability layer, but keep rendering in `BLOCK_TYPES`

The new capability is a product contract for source fidelity, not a separate runtime. Implementation remains normal Kychon block rendering:

```
source inventory
      |
      v
sections.config + site_config.theme
      |
      v
BLOCK_TYPES renderers + small hydrators
      |
      v
admin-editable copied site
```

Alternative considered: keep using `custom` blocks and make custom CSS easier to manage. That would preserve immediate flexibility, but it keeps high-value ported pages opaque to admins and prevents meaningful unit/visual testing of recurring patterns.

### 2. Extend `slideshow` instead of adding a parallel carousel block

The existing `slideshow` block already owns carousel semantics: region/slide ARIA, active state, arrows, dots, autoplay, pause behavior, reduced motion, lazy loading, fade/slide transitions, and a runtime controller. This change should add rich config fields to that block:

- per-slide `object_position`, optional crop/focal point, and href/CTA metadata
- explicit height and responsive aspect controls
- arrow/dot style tokens
- transition duration/easing
- autoplay pause/manual state behavior
- optional `rich_carousel` alias in the picker only if useful for copied-site authors

Alternative considered: create a new `rich_carousel` block. That would be simpler to reason about in the short term, but it would duplicate controller logic and create two carousel concepts for admins.

### 3. Model image accordions as a real block with pointer and keyboard parity

`image_accordion` should be a static renderer with a tiny runtime controller only where needed. Its config should be ordered panels:

- `image_url`, `image_alt`, `href`, `title`, `description`, `cta_label`
- active/idle width ratio
- overlay color/opacity
- text reveal mode
- object fit/position
- mobile fallback mode

Pointer hover should widen/reveal panels on desktop. Keyboard focus should produce the same reveal state for focusable panel links. Mobile should stack panels with readable text instead of relying on hover.

Alternative considered: adapting `promo_cards`. Promo cards are click-card grids; the accordion has distinct layout physics and reveal timing, so overloading promo cards would make both harder to maintain.

### 4. Model shape dividers as a section-adjacent visual block

`shape_divider` should render full-width SVG between sections and opt out of narrow `.container` constraints. Its config should include:

- preset path id or imported SVG path data
- one or more fill layers with opacity
- top/bottom placement and flip controls
- responsive height
- top/bottom color binding

The color binding is important. Ports have already failed with the right SVG path but inverted section colors, so tests must assert that the top color touches the previous/top section and the bottom color touches the next/bottom section.

Alternative considered: embed the divider inside neighboring sections. That makes orientation harder to test and forces unrelated content blocks to understand decorative transitions.

### 5. Keep source nav behavior as nav config, not global CSS

The `nav` block already supports recursive children. This change adds optional `config.presentation` and `config.behavior` fields for source-imported concerns:

- header position and mobile breakpoint
- logo/header sizing and flow controls
- parent/child typography, spacing, colors, and chevrons
- dropdown width, offset, shadow, border, and transition
- mobile closed/open layout behavior

These fields should emit CSS custom properties and data attributes scoped to the nav block. The default config remains today's behavior.

Alternative considered: keep all header differences in `site_config.custom_css`. That works for one port but makes breakpoints and mobile closed/open layout fragile and hard to verify.

### 6. Introduce interaction-state theme tokens with per-block overrides

`site_config.theme` should grow optional structured interaction tokens for hover/focus/default states. The theme injector maps these to CSS custom properties such as block/nav/button/card hover colors, border/shadow, transform, duration, and easing. Blocks should accept local override objects only when copied source behavior differs from the theme default.

Alternative considered: add one-off config keys to every block. That would move quickly, but the same hover/focus vocabulary would be repeated across nav, cards, CTAs, social icons, slideshow arrows, and accordions.

### 7. Add block-specific admin editors selectively

The generic section popover should still handle width/scope/remove. Type-specific editors should be added for copied-theme blocks and rich slideshow config:

- rich carousel settings for `slideshow`
- panel editor for `image_accordion`
- layer/path/orientation editor for `shape_divider`
- presentation/behavior settings for `nav`

Inline editing remains useful for simple text and images. Structured arrays and interaction settings need explicit forms so admins do not edit raw JSON.

## Risks / Trade-offs

- Config surface can sprawl. Mitigation: keep defaults compact, group copied-theme settings under `presentation`, `behavior`, `interactions`, and `items`, and only expose advanced controls in type-specific editors.
- Source SVG paths can be unsafe or malformed. Mitigation: treat shape paths as SVG path data only, not arbitrary `<svg>`/script markup; validate path/layer inputs before rendering.
- Hover behavior can exclude keyboard and touch users. Mitigation: every hover reveal must have a focus equivalent and a mobile fallback scenario.
- Rich carousel changes could regress existing slideshow sites. Mitigation: keep current config keys and defaults, add unit tests for legacy configs, and gate new behavior behind optional fields.
- More CSS custom properties can make styling hard to trace. Mitigation: keep generated variable names namespaced by surface, and document the mapping in tests and design comments.

## Migration Plan

1. Add new config fields and block types as optional, additive behavior.
2. Preserve existing `slideshow`, `nav`, and theme configs as valid defaults.
3. Add examples in a copied-site fixture or seed without modifying generic demo appearance.
4. Use existing custom CSS workarounds as reference cases, then replace them with structured configs in a fixture.
5. Roll back by leaving existing configs untouched; new copied-theme configs are ignored by older code only if not deployed to older builds.

## Open Questions

- Should the block picker expose the extended slideshow as `Slideshow` only, or add a `Rich Carousel` alias that creates a slideshow with richer defaults?
- Should imported SVG path data be stored directly in `sections.config`, or should common shapes be normalized into a preset registry once multiple ports use the same paths?
- How much of `nav.presentation` should belong on the `nav` block versus global `site_config.theme.header` tokens?
