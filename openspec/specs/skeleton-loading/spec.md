## ADDED Requirements

### Requirement: Skeleton placeholder classes

The CSS SHALL provide skeleton utility classes: `.skeleton` (base pulsing animation), `.skeleton-text` (single-line text placeholder), `.skeleton-card` (card-shaped block), `.skeleton-avatar` (circular avatar placeholder). The pulse animation SHALL use a moving gradient with `@keyframes`.

#### Scenario: Skeleton text renders
- **WHEN** an element has class `skeleton skeleton-text`
- **THEN** it renders as a rounded gray bar with a pulsing gradient animation

#### Scenario: Skeleton card renders
- **WHEN** an element has class `skeleton skeleton-card`
- **THEN** it renders as a card-sized rectangle with pulsing animation matching the card dimensions

#### Scenario: Skeleton avatar renders
- **WHEN** an element has class `skeleton skeleton-avatar`
- **THEN** it renders as a circular placeholder matching the member avatar size

### Requirement: Pages show skeletons while loading

Pages that fetch data SHALL display skeleton placeholders in their content containers while waiting for API responses. Skeletons SHALL be replaced with actual content once data arrives.

#### Scenario: Homepage sections loading
- **WHEN** the homepage is loading sections from the API
- **THEN** skeleton card placeholders are visible in the sections container
- **THEN** skeletons are replaced with rendered sections once data arrives

#### Scenario: Announcements loading
- **WHEN** the announcements feed is loading
- **THEN** skeleton text placeholders matching announcement card shape are visible
- **THEN** skeletons are replaced with announcement cards once data arrives

### Requirement: Skeletons respect reduced motion

When `prefers-reduced-motion: reduce` is active, skeleton placeholders SHALL display as static gray blocks without the pulsing animation.

#### Scenario: Reduced motion active
- **WHEN** `prefers-reduced-motion: reduce` is enabled
- **THEN** skeleton elements render as solid gray blocks without animation
