## MODIFIED Requirements

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
