## ADDED Requirements

### Requirement: Hero block supports foreground rendering mode

The `hero` block-type in `BLOCK_TYPES.hero` SHALL accept an optional `config.mode` property with values `'background'` (default) or `'foreground'`. When `mode === 'background'` (or unset), the renderer SHALL emit the existing background-image hero. When `mode === 'foreground'`, the renderer SHALL emit a `<picture>` element wrapping a single `<img>` rendered at the configured aspect ratio (no `background-image: cover` cropping), positioned in the section's normal flow, with optional logo overlay, optional corner caption, and configurable heading placement.

#### Scenario: Hero with no mode renders as background (default preserved)
- **WHEN** a hero block has `config.mode` unset
- **THEN** the renderer emits the existing background-image-cover layout with text overlaid
- **THEN** existing demos with no `mode` field render identically to before this change

#### Scenario: Foreground mode renders `<picture>` at native aspect
- **WHEN** a hero block has `config.mode === 'foreground'` and `config.image_url` set
- **THEN** the rendered HTML contains a `<picture class="hero-picture">` wrapping `<img src={image_url} alt={image_alt} loading="eager" decoding="async" />`
- **THEN** the image renders at its native aspect when `config.image_aspect === 'auto'` (or unset)
- **THEN** no `background-image: cover` is applied to the section

### Requirement: Hero foreground supports configurable aspect ratio

When `mode === 'foreground'`, the renderer SHALL accept `config.image_aspect` with values `'auto'` (default), `'16/9'`, `'4/3'`, or `'21/9'`. The CSS SHALL apply `aspect-ratio: <ratio>` and `object-fit: cover` for non-`'auto'` values; for `'auto'` the image's natural dimensions are preserved (`width: 100%; height: auto`).

#### Scenario: Auto aspect uses image's natural dimensions
- **WHEN** `image_aspect === 'auto'` (or unset)
- **THEN** the `<img>` has CSS `aspect-ratio: auto` and renders at its intrinsic dimensions
- **THEN** the image is not cropped

#### Scenario: 16/9 aspect crops to ratio
- **WHEN** `image_aspect === '16/9'`
- **THEN** the `<img>` has CSS `aspect-ratio: 16 / 9; object-fit: cover`
- **THEN** the image is cropped to 16:9 if its natural aspect differs

#### Scenario: Aspect-ratio fallback for older browsers
- **WHEN** the browser does not support CSS `aspect-ratio`
- **THEN** a fallback class using padding-bottom ratios produces equivalent layout

### Requirement: Hero foreground supports optional logo overlay

When `mode === 'foreground'` and `config.logo_overlay_url` is set, the renderer SHALL emit an absolutely-positioned `<img>` over the banner using `config.logo_position` (`'left' | 'center' | 'right'`, default `'left'`) and `config.logo_max_height` (default `'120px'`). The overlay's `<img>` SHALL have `alt=""` (decorative).

#### Scenario: Logo positioned left
- **WHEN** a foreground hero has `logo_overlay_url = 'https://…/logo.svg'` and `logo_position = 'left'`
- **THEN** the rendered HTML contains `<div class="hero-logo-overlay" data-position="left">` containing `<img src="https://…/logo.svg" alt="" style="max-height: 120px" />`
- **THEN** CSS positions the overlay at the left edge, vertically centered

#### Scenario: Logo overlay omitted when URL not set
- **WHEN** a foreground hero has no `logo_overlay_url`
- **THEN** no `.hero-logo-overlay` element is rendered

### Requirement: Hero foreground supports corner caption

When `mode === 'foreground'` and `config.caption_html` is set, the renderer SHALL emit an absolutely-positioned caption div with `caption_html` as its content (passed through an allowlist sanitizer permitting only `<br>`, `<strong>`, `<em>`, `<a href>`), positioned per `config.caption_position` (one of `'top-left'`, `'top-center'`, `'top-right'`, `'right-middle'`, `'bottom-right'` (default), `'bottom-center'`, `'bottom-left'`, `'left-middle'`).

#### Scenario: Caption renders bottom-right by default
- **WHEN** a foreground hero has `caption_html = "Alexandria, Virginia"` and no `caption_position`
- **THEN** the rendered HTML contains `<div class="hero-caption" data-position="bottom-right">Alexandria, Virginia</div>`
- **THEN** CSS positions the caption at the bottom-right corner of the section

#### Scenario: Caption sanitizer strips disallowed tags
- **WHEN** an admin saves `caption_html = "<script>alert(1)</script>Hello <em>world</em>"`
- **THEN** the rendered output contains `Hello <em>world</em>` only (script tag stripped)

#### Scenario: Caption sanitizer restricts href schemes
- **WHEN** caption HTML contains `<a href="javascript:alert(1)">x</a>`
- **THEN** the rendered output has the link with `href=""` (or stripped attribute)
- **WHEN** caption HTML contains `<a href="/about">x</a>` or `<a href="mailto:x@y.com">x</a>` or `<a href="https://example.com">x</a>`
- **THEN** the rendered link's href is preserved

### Requirement: Hero foreground supports heading position

When `mode === 'foreground'`, the renderer SHALL accept `config.text_position` with values `'over_image'` (default) or `'below_image'`. With `'over_image'`, the heading group (heading, subheading, CTA) is absolutely-positioned over the picture with `text-shadow` for readability. With `'below_image'`, the heading group renders in normal flow below the `<picture>`.

#### Scenario: Default text position is over the image
- **WHEN** a foreground hero has no `text_position` field
- **THEN** the heading group is absolutely-positioned over the picture
- **THEN** the section element has `data-text-position="over_image"`

#### Scenario: Below-image text position renders heading in normal flow
- **WHEN** a foreground hero has `text_position = 'below_image'`
- **THEN** the heading group renders below the `<picture>` element in document order
- **THEN** the section element has `data-text-position="below_image"`
- **THEN** no text-shadow is applied (text is on a normal background, not over an image)

### Requirement: Hero foreground emits eager loading hints

When `mode === 'foreground'`, the rendered `<img>` SHALL include `loading="eager"` and `decoding="async"`. The `cacheHeroImage` helper in `src/lib/config.ts` SHALL preload `image_url` (foreground) or `bg_image` (background) via a `<link rel="preload" as="image">` tag based on the active hero block's mode.

#### Scenario: Foreground hero image is preloaded
- **WHEN** a page with a foreground hero loads
- **THEN** the document head contains `<link rel="preload" as="image" href={image_url}>`
- **THEN** the hero image is fetched eagerly (not deferred)

#### Scenario: Background hero image preload still works
- **WHEN** a page with a background hero loads (existing behavior)
- **THEN** the document head contains `<link rel="preload" as="image" href={bg_image}>`

### Requirement: Hero block edit popover supports mode toggle

The hero block's edit popover SHALL include a mode toggle (`Background image` / `Foreground image`). When `Foreground` is selected, the popover SHALL reveal additional fields: image URL, image alt, aspect ratio, logo URL, logo position, logo max height, caption HTML, caption position, text position. Switching modes SHALL prompt the admin to confirm clearing the previous mode's specific fields when any are non-default.

#### Scenario: Admin selects foreground mode and configures it
- **WHEN** an admin opens the hero edit popover and clicks `Foreground image`
- **THEN** the foreground fieldset reveals additional input fields
- **WHEN** the admin saves
- **THEN** the system PATCHes `config.mode = 'foreground'` along with the foreground field values

#### Scenario: Mode switch prompts confirmation when fields are dirty
- **WHEN** an admin has configured a foreground hero with logo, caption, and image_url
- **WHEN** they toggle back to `Background image`
- **THEN** the popover prompts: `"Switching modes will clear the foreground-specific fields. Continue?"`
- **WHEN** they confirm
- **THEN** the system clears `image_url`, `logo_overlay_url`, `caption_html`, etc. and PATCHes the new mode

## MODIFIED Requirements

### Requirement: Block-type registry includes chrome and footer types

The `BLOCK_TYPES` registry in `src/lib/blocks.ts` SHALL include, at minimum, the following block types:

**Main-zone (carried over from existing renderers):** `hero` (with optional foreground mode per the foreground-mode requirement above), `features`, `cta`, `stats`, `testimonials`, `faq`, `polls` (dynamic), `event_countdown`, `activity_feed` (dynamic), `announcements_feed` (dynamic).

**Header-zone:** `nav`, `brand_header`, `sign_in_bar`.

**Footer-zone:** `footer_address`, `footer_links`, `footer_copyright`, `footer_social`, `footer_attribution`.

Each entry SHALL define `defaultConfig` providing a working starting point when an admin adds a new block of that type via the picker.

#### Scenario: Hero defaultConfig represents background mode
- **WHEN** an admin adds a new hero block via the picker
- **THEN** the new section's `config` is populated from `BLOCK_TYPES.hero.defaultConfig` with no `mode` field set (which renders as background, the safe default)
- **THEN** the admin can flip the mode toggle to opt into foreground

#### Scenario: Admin adds a footer address block
- **WHEN** an admin opens the block picker in the footer zone
- **THEN** `footer_address` appears as an option
- **WHEN** the admin selects it
- **THEN** a new sections row is created with `BLOCK_TYPES.footer_address.defaultConfig` as its starting config
- **THEN** the footer renders the new block immediately

#### Scenario: Footer attribution block defaults to Powered-by-Kychon
- **WHEN** the kychon template seed is generated
- **THEN** the seed includes a `footer_attribution` block with `config.text = "Powered by [Kychon](https://kychon.com) on [Run402](https://run402.com)"`

#### Scenario: Footer copyright supports auto year
- **WHEN** a `footer_copyright` block has `config.year = 'auto'`
- **THEN** the rendered HTML contains a `<span data-year="auto">` element
- **THEN** an inline script sets the span's text to the current year on page load
