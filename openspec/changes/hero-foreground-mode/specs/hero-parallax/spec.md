## MODIFIED Requirements

### Requirement: Hero background parallax on scroll

Hero sections with `config.mode === 'background'` (or `mode` unset) and a `bg_image` SHALL have a subtle parallax effect: the background image scrolls at a slower rate (0.3x) than the page content. The effect SHALL use CSS `transform: translateY()` updated via `requestAnimationFrame` on the scroll event. Parallax SHALL NOT be applied when `config.mode === 'foreground'` — foreground heroes render the image inside `<picture>` in normal flow, where a parallax offset would visually decouple the image from its overlaid logo and caption.

#### Scenario: Hero with background image
- **WHEN** a hero section has `mode === 'background'` (or unset), a `bg_image` configured, and the user scrolls
- **THEN** the background image moves at 30% of the scroll speed, creating a depth effect

#### Scenario: Hero without background image
- **WHEN** a hero section has no `bg_image` (gradient-only fallback)
- **THEN** no parallax behavior is applied

#### Scenario: Foreground hero is exempt from parallax
- **WHEN** a hero section has `config.mode === 'foreground'`
- **THEN** no parallax effect is applied to the section
- **THEN** the `<picture>` element renders in normal document flow with no scroll-driven transform
- **THEN** the optional logo overlay and caption move with the image as a single composed unit
