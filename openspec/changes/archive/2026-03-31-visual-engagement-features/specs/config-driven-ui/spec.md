## MODIFIED Requirements

### Requirement: Schema-driven homepage sections

`config.js` SHALL read `sections` rows where `page_slug = 'index'`, ordered by `position`. Each section SHALL be rendered based on its `section_type` (hero, features, cta, stats, testimonials, faq, event-countdown, custom) using the `config` JSONB for content. All sections SHALL start invisible and animate in on scroll via IntersectionObserver (see `scroll-animations` spec). The `stats` section SHALL animate its numbers from 0 on scroll entry. The `hero` section SHALL apply a parallax effect when a `bg_image` is configured (see `hero-parallax` spec).

#### Scenario: Hero section renders with parallax
- **WHEN** a section with `section_type = 'hero'` exists and has a `bg_image` in its config
- **THEN** the homepage shows a hero with heading, subheading, CTA button, and background image
- **THEN** the background image has a parallax scroll effect (moves at 0.3x scroll speed)

#### Scenario: Hero section renders without parallax
- **WHEN** a section with `section_type = 'hero'` exists without a `bg_image`
- **THEN** the hero renders with the gradient fallback and no parallax behavior

#### Scenario: Stats section animates counters
- **WHEN** a section with `section_type = 'stats'` scrolls into view
- **THEN** each stat number counts up from 0 to its target value with easing

#### Scenario: Event countdown section renders
- **WHEN** a section with `section_type = 'event-countdown'` exists and `feature_events` is true
- **THEN** a countdown to the next upcoming event is rendered with days, hours, and minutes

#### Scenario: Features grid renders
- **WHEN** a section with `section_type = 'features'` exists with `columns: 3` and 3 items
- **THEN** a 3-column grid of feature cards is rendered with icons, titles, and descriptions

#### Scenario: Section visibility
- **WHEN** a section has `visible = false`
- **THEN** it is not rendered on the page

#### Scenario: Sections animate on scroll
- **WHEN** any section enters the viewport
- **THEN** it fades in with an upward slide animation (see `scroll-animations` spec)
