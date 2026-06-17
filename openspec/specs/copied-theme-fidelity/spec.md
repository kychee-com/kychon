# copied-theme-fidelity Specification

## Purpose
TBD - created by archiving change add-copied-theme-fidelity-blocks. Update Purpose after archive.
## Requirements
### Requirement: Copied-site fidelity uses structured blocks and configs

When a copied site requires a recurring source-site pattern covered by this capability, Kychon SHALL represent that pattern using structured `sections.config` and `site_config.theme` fields rather than opaque custom HTML/CSS/JS. The covered patterns SHALL include source-imported nav behavior, source hover/focus states, image accordions, SVG wave/shape dividers, rich carousel behavior, association homepage panel grids, restaurant/bar menus, Wild Apricot-style utility header clusters, member login surfaces, and wordmark/favicon branding.

Custom HTML/CSS/JS MAY still be used for source patterns outside the supported surface. When custom CSS is used it SHALL have a predictable override point that does not require `!important`. Supported patterns SHALL remain admin-editable, themable, translatable, and testable through first-class Kychon blocks or config, and any pattern handled by a workaround SHALL be enumerable through the supported-pattern registry.

#### Scenario: Copied source has a supported visual pattern
- **WHEN** a copied-site seed includes an image accordion, shape divider, rich carousel, source nav behavior, source interaction state, panel grid, menu, utility header cluster, or member login
- **THEN** the seed uses a registered Kychon block or structured theme/nav config for that pattern
- **THEN** the supported pattern is not represented solely as a `custom` block with embedded CSS or JavaScript

#### Scenario: Unsupported source widget still needs a workaround
- **WHEN** a copied source contains a widget outside the supported copied-theme fidelity surface
- **THEN** the port may use a `custom` block or custom CSS for that widget
- **THEN** supported copied-theme patterns on the same page still use first-class blocks/configs
- **THEN** the workaround is recorded in the port's coverage report

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

The renderer SHALL output SVG markup from validated path/layer data only. The renderer SHALL NOT execute arbitrary imported source SVG markup or scripts. The block SHALL be able to render full-width outside the normal `data-layout-container` constraint when needed by the source design.

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

### Requirement: Feature panels block

Kychon SHALL provide a `feature_panels` block for association-homepage panel grids (the recurring "coordinated panels" source pattern) so the pattern ships as structured config instead of degrading to stacked prose. The block config SHALL contain ordered panels, each with image URL, alt text, heading, body, optional CTA label and href, and object fit/position. The block SHALL be admin-editable through the block list editor, themable via `--ky-*` tokens, and expose each panel's heading, body, and CTA label as translatable fields. The HTML sanitizer SHALL remain unchanged; this block SHALL NOT introduce a looser custom-HTML mode.

#### Scenario: Source panels render as a structured grid
- **WHEN** a copied-site seed describes a multi-panel homepage section as a `feature_panels` block
- **THEN** the panels render as a responsive grid that preserves the source's panel layout
- **THEN** the section is not represented as a `custom` block

#### Scenario: Admin edits panels
- **WHEN** an admin opens the `feature_panels` block editor
- **THEN** the editor allows adding, removing, reordering, and editing panels
- **THEN** saving updates the block's structured `sections.config`

#### Scenario: Panel text is translatable
- **WHEN** a translation exists for a panel's heading, body, or CTA label
- **THEN** the translated value renders for that language

### Requirement: Menu block

Kychon SHALL provide a `menu` block for restaurant/bar menus carried by copied club/association sites. The block config SHALL contain ordered sections, each with a name and ordered items; each item SHALL carry a name and MAY carry a description, price, and dietary tags. The block SHALL be admin-editable through the block list editor, themable via `--ky-*` tokens, and expose section names, item names, and item descriptions as translatable fields.

#### Scenario: Menu renders structured sections and items
- **WHEN** a `menu` block has sections with items
- **THEN** each section renders its name and its items with name, description, price, and dietary tags as present

#### Scenario: Admin edits a menu price without raw HTML
- **WHEN** an admin changes an item's price in the `menu` block editor
- **THEN** saving updates the structured `sections.config`
- **THEN** no raw HTML editing is required

#### Scenario: Menu fields are translatable
- **WHEN** a translation exists for a section name, item name, or item description
- **THEN** the translated value renders for that language

### Requirement: Utility header cluster

Kychon SHALL support a Wild Apricot-style utility header cluster for copied sites through composable header-zone blocks rather than per-port custom CSS. Kychon SHALL provide `utility_bar`, `social_row`, and `safety_cta` header blocks, and SHALL provide a porter-emittable preset that places a coordinated cluster (brand, dropdown nav, compact search, social icons, sign-in, safety CTA, and tagline) into the header zone in a single operation. Each block SHALL be independently admin-editable through the existing header-zone layout and SHALL define its own mobile behavior.

#### Scenario: Porter emits a coordinated header cluster
- **WHEN** a port applies the utility-header preset
- **THEN** the header zone contains the cluster's blocks positioned to match the source layout
- **THEN** the cluster is not represented as a `custom` block or per-port custom CSS

#### Scenario: Admin edits one cluster block
- **WHEN** an admin edits the `utility_bar`, `social_row`, or `safety_cta` block
- **THEN** the change applies to that block alone without affecting the rest of the cluster

#### Scenario: Cluster collapses on mobile
- **WHEN** the viewport matches the mobile breakpoint
- **THEN** each cluster block renders its defined mobile behavior without overflow

### Requirement: Member login block

Kychon SHALL provide a `member_login` block for copied Wild Apricot member zones, with source-style labels and icons configurable without custom CSS. The block SHALL expose an `enable_bot_protection` flag. When bot protection is enabled but the Run402 platform hook is unavailable, Kychon SHALL surface the gap in the port's coverage report rather than present a faked or non-functional protection widget. Gated content SHALL remain private to anonymous visitors regardless of the block's presence.

#### Scenario: Login block renders source-style without custom CSS
- **WHEN** a copied member zone uses a `member_login` block with configured labels and icons
- **THEN** the login surface renders those labels and icons through structured config
- **THEN** no per-port custom CSS is required for the labels and icons

#### Scenario: Bot protection requested without platform support
- **WHEN** `enable_bot_protection` is set but the Run402 bot-protection hook is unavailable
- **THEN** the port's coverage report marks bot protection as unsupported or pending
- **THEN** Kychon does not present a non-functional or faked protection widget

#### Scenario: Gated content stays private
- **WHEN** an anonymous visitor loads a members-only page that carries a `member_login` block
- **THEN** the gated content is not exposed

### Requirement: Wordmark and favicon brand header mode

The `brand_header` block SHALL support an explicit brand-presentation mode so a copied site can display a wordmark while still setting a separate favicon/icon. The mode SHALL be one of `wordmark`, `icon`, or `auto`. In `wordmark` mode the header SHALL render `brand_wordmark_url` even when an icon or favicon URL is also set.

#### Scenario: Wordmark mode shows the wordmark with a separate favicon
- **WHEN** `brand_header_mode` is `wordmark` and both a wordmark URL and an icon/favicon URL are set
- **THEN** the header renders the wordmark
- **THEN** the icon/favicon is still used as the site favicon

#### Scenario: Icon mode shows the icon lockup
- **WHEN** `brand_header_mode` is `icon`
- **THEN** the header renders the icon-and-text lockup

### Requirement: Predictable custom CSS override layer

`site_config.custom_css` SHALL be applied through a CSS cascade layer ordered after Kychon's framework styles, so that port-specific CSS overrides framework styles by layer order without requiring `!important`. Kychon's header `social_links` SHALL be visible by default, with no `opacity: 0` reveal state that requires a port override.

#### Scenario: Port CSS overrides framework styles without !important
- **WHEN** a port sets `custom_css` that targets a selector also styled by Kychon's framework CSS
- **THEN** the port's declaration wins by cascade-layer order
- **THEN** the override does not require `!important`

#### Scenario: Header social links are visible by default
- **WHEN** a header includes `social_links` and no custom CSS overrides their opacity
- **THEN** the social links render visible

### Requirement: Supported copied-site pattern registry

Kychon SHALL expose a discoverable registry of the copied-site patterns it covers (the registered blocks and configs for source patterns) so the copy-website porter can determine, for any source pattern, whether a first-class block exists and otherwise record the fallback used. The registry SHALL be derivable from the block registry and available to agents through the portal's agent-facing capability surface.

#### Scenario: Porter resolves a supported pattern
- **WHEN** the porter checks a source pattern that has a registered block such as a menu, panels, or utility header
- **THEN** the registry reports the pattern as supported and names the block

#### Scenario: Porter records an unsupported pattern
- **WHEN** the porter checks a source pattern with no registered block
- **THEN** the registry reports the pattern as unsupported
- **THEN** the porter records the fallback used in its coverage report

