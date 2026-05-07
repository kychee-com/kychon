# copied-theme-fidelity Specification

## Purpose
TBD - created by archiving change add-copied-theme-fidelity-blocks. Update Purpose after archive.
## Requirements
### Requirement: Copied-site fidelity uses structured blocks and configs

When a copied site requires a recurring source-site pattern covered by this capability, Kychon SHALL represent that pattern using structured `sections.config` and `site_config.theme` fields rather than opaque custom HTML/CSS/JS. The covered patterns SHALL include source-imported nav behavior, source hover/focus states, image accordions, SVG wave/shape dividers, and rich carousel behavior.

Custom HTML/CSS/JS MAY still be used for source patterns outside the supported surface, but supported patterns SHALL remain admin-editable and testable through first-class Kychon blocks or config.

#### Scenario: Copied source has a supported visual pattern
- **WHEN** a copied-site seed includes an image accordion, shape divider, rich carousel, source nav behavior, or source interaction state
- **THEN** the seed uses a registered Kychon block or structured theme/nav config for that pattern
- **THEN** the supported pattern is not represented solely as a `custom` block with embedded CSS or JavaScript

#### Scenario: Unsupported source widget still needs a workaround
- **WHEN** a copied source contains a widget outside the supported copied-theme fidelity surface
- **THEN** the port may use a `custom` block or custom CSS for that widget
- **THEN** supported copied-theme patterns on the same page still use first-class blocks/configs

### Requirement: Image accordion block

Kychon SHALL provide an `image_accordion` block for copied-site image accordions and expanding hover-reveal panels. The block config SHALL contain ordered panels with image URL, alt text, href, title, description, CTA label, object fit/position, and optional per-panel interaction overrides. The block config SHALL also support active/idle width ratios, overlay color/opacity, reveal timing, and mobile fallback behavior.

On pointer devices, hovering a panel SHALL reveal its text/CTA and expand it according to the configured ratio. Keyboard focus on a panel or its link SHALL produce equivalent reveal and expansion behavior. On mobile/no-hover viewports, panels SHALL stack or otherwise render in a readable non-hover fallback.

#### Scenario: Pointer hover reveals an accordion panel
- **WHEN** a pointer user hovers an `image_accordion` panel
- **THEN** that panel expands according to the configured active/idle ratio
- **THEN** the panel overlay, title, description, and CTA become visible according to the configured reveal behavior

#### Scenario: Keyboard focus reveals an accordion panel
- **WHEN** a keyboard user focuses a panel link inside an `image_accordion`
- **THEN** the focused panel receives the same visible reveal state as pointer hover
- **THEN** the focus indicator remains visible

#### Scenario: Mobile renders readable panels
- **WHEN** the viewport matches the configured mobile fallback breakpoint or has no hover support
- **THEN** `image_accordion` panels render in a readable stacked or non-expanding layout
- **THEN** title, description, and CTA text remain visible without requiring hover

#### Scenario: Admin edits accordion panels
- **WHEN** an admin opens the `image_accordion` block editor
- **THEN** the editor allows adding, removing, reordering, and editing panels
- **THEN** saving updates the block's structured `sections.config`

### Requirement: Shape divider block

Kychon SHALL provide a `shape_divider` block for copied-site SVG wave and shape dividers between sections. The block config SHALL support either a preset shape id or imported SVG path data, multiple fill layers with opacity, top/bottom placement, horizontal and vertical flip controls, responsive height, and top/bottom color binding.

The renderer SHALL output SVG markup from validated path/layer data only. The renderer SHALL NOT execute arbitrary imported source SVG markup or scripts. The block SHALL be able to render full-width outside the normal `.container` constraint when needed by the source design.

#### Scenario: Divider renders imported source path
- **WHEN** a `shape_divider` block has imported SVG path data and fill layers
- **THEN** the rendered divider contains an SVG using the configured path and layers
- **THEN** the divider spans the intended section width without being constrained by the content container

#### Scenario: Divider color orientation is correct
- **WHEN** a `shape_divider` is configured between a white top section and a blue bottom section
- **THEN** the divider's top-bound color visually touches the top section
- **THEN** the divider's bottom-bound color visually touches the bottom section

#### Scenario: Divider flips preserve color binding
- **WHEN** an admin applies horizontal or vertical flip controls to a `shape_divider`
- **THEN** the SVG geometry changes according to the flip
- **THEN** top/bottom color binding remains correct for adjacent sections

#### Scenario: Invalid divider path is rejected safely
- **WHEN** a `shape_divider` config contains invalid or unsafe SVG data
- **THEN** the renderer emits a safe admin-visible placeholder or omits the divider for visitors
- **THEN** no arbitrary script or unsupported SVG element is executed

### Requirement: Rich carousel behavior extends slideshow

Kychon SHALL extend the existing `slideshow` block to cover rich carousel behavior required by copied sites. The extended config SHALL support exact source slide order, slide image URL/blob references, per-slide object fit and object position, responsive aspect/height controls, autoplay interval, pause/manual state, previous/next arrow controls, dot controls, fade/slide transition options, transition timing/easing, accessibility labels, and keyboard controls.

Existing slideshow configs SHALL continue to render with their current default behavior.

#### Scenario: Rich carousel preserves source slide inventory
- **WHEN** a copied-site seed configures `slideshow.items` from a source carousel inventory
- **THEN** the rendered carousel preserves the exact configured slide order
- **THEN** each slide uses its configured image URL or blob reference

#### Scenario: Per-slide crop controls affect rendering
- **WHEN** a slide has `object_position` or equivalent focal/crop config
- **THEN** the rendered image uses that crop/focal setting
- **THEN** other slides without an override use the carousel-level default

#### Scenario: Carousel controls are keyboard accessible
- **WHEN** focus is inside a rich carousel
- **THEN** previous/next controls and keyboard arrow navigation move between slides
- **THEN** slide changes update the carousel's accessible announcement region

#### Scenario: Legacy slideshow config remains valid
- **WHEN** an existing `slideshow` block has only legacy config keys such as `items`, `auto_rotate_seconds`, `show_arrows`, `show_dots`, `aspect_ratio`, `fit`, and `transition`
- **THEN** the slideshow renders without requiring any new rich carousel fields
- **THEN** its existing autoplay, arrow, dot, and transition behavior is preserved

### Requirement: Copied-theme visual parity is verifiable

Kychon SHALL provide tests or verification hooks for copied-theme fidelity features so source parity can be validated without relying on manual CSS inspection. Verification SHALL cover desktop hover/focus states, mobile nav closed/open layout, image accordion hover/focus/mobile states, shape-divider color orientation, and rich carousel arrow/autoplay behavior.

#### Scenario: Visual parity tests cover source interaction states
- **WHEN** copied-theme fixture pages are tested
- **THEN** the test suite exercises at least one hover or focus state for nav, CTA/button/card/social/icon, image accordion, and carousel controls when those blocks are present

#### Scenario: Shape divider orientation regression is caught
- **WHEN** a fixture contains a `shape_divider` between differently colored sections
- **THEN** verification asserts that the top-bound color touches the top section and the bottom-bound color touches the bottom section

#### Scenario: Mobile nav closed state is verified
- **WHEN** a copied-theme fixture is rendered at a mobile viewport
- **THEN** verification asserts that the closed nav does not cover the hero or first content block unless explicitly configured to overlay
