# Copied Theme Fidelity Audit

Origin: Mississauga Children's Choir port, via `kychee-com/kychon-concierge#5` and Kychon engine issues #94-#98.

## Pattern Map

| Source Pattern | Current Workaround | First-Class Kychon Surface |
| --- | --- | --- |
| Dropdown parents under About/Choirs, desktop hover menus, source-sized logo/header footprint, mobile closed/open behavior | Native nav children plus port-specific header/nav CSS | `nav` block `config.items` plus `config.presentation` and `config.behavior`; header/nav theme tokens |
| Distinct CTA, donate, nav, social icon, card, and hover-reveal transitions | Port-specific CSS selectors in `custom_css` | `site_config.theme.interactions` tokens plus per-block `interactions` overrides |
| OUR CHOIRS expanding image panels with hover reveal | Custom homepage HTML/CSS flex behavior | `image_accordion` block |
| Elementor SVG wave/shape dividers between colored bands | Inline SVG and manual CSS orientation fixes | `shape_divider` block with path/layers/flips/top-bottom color binding |
| Source carousel slide inventory, arrows, autoplay, fade/crop behavior | Custom HTML/CSS/inline JS or partially-native slideshow | Extended `slideshow` rich carousel config |

## Acceptance Notes

- Supported copied-theme patterns should not be represented solely as `custom` blocks.
- Hover behavior must have keyboard focus parity and mobile/no-hover fallback behavior.
- Shape divider verification must catch "right path, inverted colors" regressions.
- Existing generic Kychon nav, theme, and slideshow configs must remain valid without copied-theme fields.

## Structured Config Guide

Use these copied-theme fields when a source site pattern is recurring and admin-editable. Reserve `custom` blocks or `custom_css` for one-off markup that does not map to a reusable block.

### `site_config.theme`

- `interactions.button.hover`, `interactions.card.hover`, `interactions.social.hover`, and `interactions.default.hover` map source hover/focus colors, shadows, transforms, duration, and easing into CSS variables.
- `header` and `nav` provide source header/nav defaults such as padding, link colors, dropdown background, shadow, and mobile menu colors.
- `carousel.arrow` and `carousel.dot` provide rich carousel control colors when multiple slideshows should share source styling.

### `nav` Block

- Keep links in `config.items`; nested `children` still define dropdowns.
- Put source visual details in `config.presentation`: link padding/gap, typography, hover/active colors, dropdown width/offset/border/shadow, chevron color, transition, and mobile menu surface.
- Put source responsive behavior in `config.behavior`: `mobile_breakpoint`, `mobile_closed_layout`, `mobile_open_layout`, and optional `desktop_open`.
- Use the admin nav item editor for link structure and the source settings editor for presentation/behavior.

### `image_accordion` Block

- Use `config.panels[]` for ordered panels with `image_url`, `image_alt`, `title`, `description`, `cta_label`, `href`, `fit`, and `object_position`.
- Use block-level `active_ratio`, `idle_ratio`, `overlay_color`, `overlay_opacity`, `reveal_duration`, and `mobile_fallback` instead of CSS-only flex hacks.
- Add per-panel or block-level `interactions` only when source hover/focus colors differ from the theme.

### `shape_divider` Block

- Use `preset` for common `wave`, `tilt`, and `curve` shapes, or `path` for imported SVG path data only.
- Use `layers[]` for fill, opacity, optional layer path override, and vertical offset.
- Always set `top_color` and `bottom_color` when porting between colored bands so orientation can be tested.
- Use `flip_x`, `flip_y`, `height`, `view_box`, and `placement` for source parity instead of embedding arbitrary SVG markup.

### `slideshow` Block as Rich Carousel

- Continue using `config.items[]` for slides. Per slide fields are `src`, `alt`, `caption`, `href`, `fit`, and `object_position`.
- Use `height`, `mobile_height`, `aspect_ratio`, `transition`, `transition_ms`, `transition_easing`, `auto_rotate_seconds`, `pause_on_hover`, `pause_on_focus`, and `manual_pause` for behavior.
- Use `arrow_style` and `dot_style` for source controls. Prefer theme carousel tokens when the style is shared across the site.
