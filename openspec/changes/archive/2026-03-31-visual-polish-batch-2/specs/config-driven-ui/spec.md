## ADDED Requirements

### Requirement: Glassmorphic navigation bar

The sticky navigation bar SHALL use `backdrop-filter: blur(12px)` with a semi-transparent background (`rgba(255,255,255,0.8)` in light mode) to create a frosted-glass effect. The solid background color SHALL remain as a fallback for browsers that do not support `backdrop-filter`.

#### Scenario: Nav over scrolled content
- **WHEN** the user scrolls and content passes behind the sticky nav
- **THEN** the content is visible as a blurred backdrop through the semi-transparent nav

#### Scenario: Browser does not support backdrop-filter
- **WHEN** the browser does not support `backdrop-filter`
- **THEN** the nav renders with a solid background color (existing fallback)

### Requirement: Gradient text on hero heading

The hero section `h1` SHALL display a text gradient using `background-clip: text` with colors derived from `--color-primary` and `--color-primary-hover`. The gradient SHALL use a 135-degree angle matching the hero section's background gradient direction.

#### Scenario: Hero heading renders with gradient
- **WHEN** a hero section is displayed
- **THEN** the h1 text shows a gradient from `--color-primary` to `--color-primary-hover`
- **THEN** the gradient adapts to any portal's theme colors
