## ADDED Requirements

### Requirement: Sections animate in on scroll

Homepage sections SHALL fade in with an upward slide when they enter the viewport. A shared `IntersectionObserver` (threshold 0.15) SHALL watch all `.section` elements. When a section intersects, the class `section-visible` SHALL be added, triggering a CSS transition from `opacity: 0; transform: translateY(20px)` to `opacity: 1; transform: none` over 600ms with `ease-out` timing.

#### Scenario: Section enters viewport
- **WHEN** a homepage section scrolls into view (15% visible)
- **THEN** it transitions from invisible/offset to fully visible over 600ms
- **THEN** the `section-visible` class is added and the observer stops watching that element

#### Scenario: Section already in viewport on load
- **WHEN** the page loads and a section is already within the viewport (e.g., the hero)
- **THEN** the observer fires immediately and the section animates in without delay

#### Scenario: Staggered animation for adjacent sections
- **WHEN** multiple sections enter the viewport simultaneously (e.g., on a short page)
- **THEN** each section SHALL have an incremental `transition-delay` based on its DOM order (e.g., 0ms, 100ms, 200ms) to create a staggered cascade effect

### Requirement: Stat counters animate on scroll

When a `stats` section enters the viewport, each stat number SHALL animate from 0 to its target value over ~1.5 seconds using `requestAnimationFrame` with `easeOutExpo` easing. The animation SHALL handle number formatting (commas, `$` prefix, `+` suffix) by preserving non-numeric characters.

#### Scenario: Stats count up when visible
- **WHEN** the stats section scrolls into view
- **THEN** each stat number counts up from 0 to its target value over approximately 1.5 seconds
- **THEN** the numbers decelerate (ease-out) so they appear to "land" on the final value

#### Scenario: Stats with formatted numbers
- **WHEN** a stat value is "$12,500" or "400+"
- **THEN** the counter preserves the "$" prefix and "+" suffix during animation
- **THEN** comma formatting is maintained as the number counts up

#### Scenario: Stats with non-numeric values
- **WHEN** a stat value contains no parseable number (e.g., "N/A")
- **THEN** the value is displayed instantly without animation

### Requirement: Animations respect reduced motion preference

All scroll animations and counter animations SHALL be disabled when the user's system has `prefers-reduced-motion: reduce` enabled. Elements SHALL appear in their final visible state immediately.

#### Scenario: Reduced motion enabled
- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** all sections are visible immediately without fade-in
- **THEN** stat counters display their final values instantly without counting up
