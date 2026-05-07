## ADDED Requirements

### Requirement: Block registry includes copied-theme fidelity block types

The `BLOCK_TYPES` registry SHALL include copied-theme fidelity block support. At minimum, it SHALL include `image_accordion` and `shape_divider` block types, and the existing `slideshow` block SHALL support the rich carousel configuration required by `copied-theme-fidelity`.

Each copied-theme block type SHALL define `render(section, ctx)`, `defaultConfig`, `label`, `icon`, `dynamic`, `zoneHints`, and `supportedSpans` where appropriate. The defaults SHALL render a safe editable starting point when an admin adds the block through the picker.

#### Scenario: Admin can add image accordion
- **WHEN** an admin opens the main-zone block picker
- **THEN** `image_accordion` appears as an available block type
- **WHEN** the admin adds it
- **THEN** the new section uses the block's structured `defaultConfig`

#### Scenario: Admin can add shape divider
- **WHEN** an admin opens the main-zone block picker
- **THEN** `shape_divider` appears as an available block type
- **WHEN** the admin adds it
- **THEN** the new section uses the block's structured `defaultConfig`

#### Scenario: Shape divider can render full width
- **WHEN** a `shape_divider` block is rendered in a zone where the source design requires full-width section transition
- **THEN** the block can opt out of the normal constrained `.container` wrapper
- **THEN** the divider spans the intended viewport or zone width

#### Scenario: Existing block rendering remains registry-based
- **WHEN** `image_accordion`, `shape_divider`, or rich `slideshow` sections render at build time or runtime
- **THEN** they render through `renderBlock(section, ctx)` and the `BLOCK_TYPES` registry

### Requirement: Nav block supports source-imported presentation and behavior

The `nav` block's config SHALL support optional source-imported presentation and behavior fields while preserving the existing `config.items` navigation model. These fields SHALL cover header footprint, logo/header sizing hooks, source typography, nav spacing, parent/child colors, chevron styling, dropdown width/offset/shadow/border, transition timing, desktop hover/focus behavior, mobile breakpoint, and mobile open/closed layout behavior.

The nav renderer SHALL scope source-imported presentation to the nav block using data attributes and CSS custom properties. Missing presentation/behavior fields SHALL fall back to current Kychon nav behavior.

#### Scenario: Existing nav config still renders
- **WHEN** a `nav` block only has `config.items`
- **THEN** the nav renders with existing flat/nested Kychon behavior
- **THEN** no source-imported presentation fields are required

#### Scenario: Source-imported dropdown styling applies
- **WHEN** a `nav` block has dropdown presentation config for colors, border, shadow, width, offset, chevron, and transition timing
- **THEN** the rendered nav exposes scoped variables or data attributes for those values
- **THEN** dropdown children render with the configured source-like presentation

#### Scenario: Source mobile closed layout does not overlay content
- **WHEN** a `nav` block configures a mobile breakpoint and closed layout behavior that keeps nav links hidden
- **WHEN** the page is rendered at or below that breakpoint
- **THEN** closed nav links are not visible
- **THEN** the closed nav does not cover the hero or first content block unless overlay behavior is explicitly configured

#### Scenario: Source mobile open layout expands predictably
- **WHEN** a user opens the mobile hamburger menu for a source-configured `nav` block
- **THEN** nav links and dropdown children use the configured mobile open layout
- **THEN** inactive links remain readable against the configured menu background

### Requirement: Copied-theme block editors expose structured config

Admin editing SHALL provide type-specific config editors for copied-theme blocks and rich carousel settings. The generic section edit popover SHALL continue to handle width, scope, and remove. Type-specific editors SHALL handle structured arrays, SVG layers, source presentation fields, and interaction settings without requiring raw JSON editing.

At minimum, editors SHALL support:

- rich carousel settings on `slideshow`
- panel editing on `image_accordion`
- path/layer/orientation editing on `shape_divider`
- presentation/behavior editing on `nav`

#### Scenario: Generic popover routes to copied-theme editor
- **WHEN** an admin opens the section edit popover for `image_accordion`, `shape_divider`, `slideshow`, or `nav`
- **THEN** the popover exposes a settings action for that block's structured config
- **WHEN** the admin opens settings
- **THEN** a type-specific editor appears

#### Scenario: Type-specific editor saves structured config
- **WHEN** an admin changes panel, layer, carousel, or nav presentation fields in a type-specific editor
- **THEN** the system PATCHes the section's `config` JSON with structured values
- **THEN** `wl_cache_sections_*` entries are invalidated
- **THEN** `wl-content-rendered` is dispatched so the rendered block updates

#### Scenario: Inline editing still works for simple fields
- **WHEN** an `image_accordion` panel title or rich carousel heading is exposed as inline editable text
- **THEN** inline editing updates the corresponding nested structured config path
- **THEN** the type-specific editor remains able to edit the same config after reload

### Requirement: Copied-theme blocks participate in column spans and zones

Copied-theme block types SHALL participate in the existing column-span and zone system. Blocks SHALL declare supported spans matching their layout needs, and rendering SHALL attach `data-column-span` through the existing `renderBlock` post-process.

#### Scenario: Full-width-only copied-theme block constrains span picker
- **WHEN** a copied-theme block type declares `supportedSpans: ['1']`
- **THEN** its section edit popover renders only the full-width option

#### Scenario: Accordion can use normal grid spans
- **WHEN** an `image_accordion` block declares multiple supported spans
- **THEN** the span picker shows only those supported spans
- **THEN** the rendered block flows through the existing zone grid rules

#### Scenario: Shape divider preserves span and full-bleed behavior
- **WHEN** a `shape_divider` section is moved or re-rendered
- **THEN** the section preserves its configured span
- **THEN** full-bleed rendering remains controlled by the block type rather than ad hoc wrapper markup
