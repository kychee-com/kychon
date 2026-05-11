## ADDED Requirements

### Requirement: Navigation supports clean Kychon URLs

Kychon navigation and block-rendered internal links SHALL prefer clean Kychon-owned URLs when a clean static alias exists. The system SHALL continue to recognize legacy `.html` and `page.html?slug=` hrefs as equivalent for active navigation and compatibility.

#### Scenario: Seeded nav renders clean custom page link
- **WHEN** a navigation block contains an item with href `/page.html?slug=about`
- **THEN** the rendered link href is `/about`

#### Scenario: Seeded nav renders clean module link
- **WHEN** a navigation block contains an item with href `/events.html`
- **THEN** the rendered link href is `/events`

#### Scenario: Legacy page href remains active on clean path
- **WHEN** a nav item href is `/page.html?slug=about`
- **AND** the current browser URL is `https://eagles.kychon.com/about`
- **THEN** the nav item is considered active

#### Scenario: Clean nav href remains active on legacy path
- **WHEN** a nav item href is `/about`
- **AND** the current browser URL is `https://eagles.kychon.com/page.html?slug=about`
- **THEN** the nav item is considered active

### Requirement: Schema-driven custom pages resolve clean slugs

The generic custom page route SHALL resolve the target page slug from either the legacy `slug` query parameter or the current clean pathname. Clean pathname resolution SHALL apply only when the path is not a reserved Kychon module route and represents a safe custom page slug.

#### Scenario: Custom page renders from clean path
- **WHEN** a visitor opens `/volunteer`
- **THEN** the custom page runtime resolves slug `volunteer`
- **AND** it fetches and renders the matching published `pages` row

#### Scenario: Custom page renders from legacy query
- **WHEN** a visitor opens `/page.html?slug=volunteer`
- **THEN** the custom page runtime resolves slug `volunteer`
- **AND** it fetches and renders the matching published `pages` row

#### Scenario: Module route does not become custom page slug
- **WHEN** a visitor opens `/events`
- **THEN** Kychon treats the path as the events module route
- **AND** the generic custom page runtime does not claim slug `events`
