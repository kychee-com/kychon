## ADDED Requirements

### Requirement: Sections animate in on scroll

Homepage sections SHALL fade in when they enter the viewport. A shared `IntersectionObserver` (threshold 0.15) SHALL watch all `.section` elements. When a section intersects, the class `section-visible` SHALL be added, triggering a CSS transition from `opacity: 0` to `opacity: 1` over 600ms with `ease-out` timing. Sections SHALL use `visibility: hidden` (not `display: none` or layout-collapsing transforms) so they reserve their full layout space while invisible. The `translateY(20px)` slide-up effect SHALL be removed to prevent cumulative layout shift.

#### Scenario: Section enters viewport
- **WHEN** a homepage section scrolls into view (15% visible)
- **THEN** it transitions from invisible to fully visible over 600ms via opacity fade
- **THEN** the `section-visible` class is added and the observer stops watching that element
- **THEN** no layout shift occurs (the section occupied its full space while invisible)

#### Scenario: Section already in viewport on load
- **WHEN** the page loads and a section is already within the viewport (e.g., the hero)
- **THEN** the observer fires immediately and the section fades in without delay

#### Scenario: Staggered animation for adjacent sections
- **WHEN** multiple sections enter the viewport simultaneously (e.g., on a short page)
- **THEN** each section SHALL have an incremental `transition-delay` based on its DOM order (e.g., 0ms, 100ms, 200ms) to create a staggered cascade effect

#### Scenario: Section layout space is stable
- **WHEN** a section has not yet animated in (still invisible)
- **THEN** it occupies its full height and width in the document flow (visibility: hidden)
- **THEN** content below the section does not shift when the section becomes visible

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
