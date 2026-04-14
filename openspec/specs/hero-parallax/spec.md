## ADDED Requirements

### Requirement: Hero background parallax on scroll

Hero sections with a `bg_image` SHALL have a subtle parallax effect: the background image scrolls at a slower rate (0.3x) than the page content. The effect SHALL use CSS `transform: translateY()` updated via `requestAnimationFrame` on the scroll event.

#### Scenario: Hero with background image
- **WHEN** a hero section has a `bg_image` configured and the user scrolls
- **THEN** the background image moves at 30% of the scroll speed, creating a depth effect

#### Scenario: Hero without background image
- **WHEN** a hero section has no `bg_image` (gradient-only fallback)
- **THEN** no parallax behavior is applied

### Requirement: Parallax disabled on touch devices and reduced motion

Parallax SHALL be disabled on touch-capable devices (where scrolling is gesture-driven and parallax feels unnatural) and when `prefers-reduced-motion: reduce` is active.

#### Scenario: Touch device
- **WHEN** the device supports touch input (`'ontouchstart' in window`)
- **THEN** the hero background renders normally without parallax

#### Scenario: Reduced motion preference
- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** the hero background renders normally without parallax
