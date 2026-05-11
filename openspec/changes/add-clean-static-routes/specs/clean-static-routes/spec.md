## ADDED Requirements

### Requirement: Kychon exposes clean static aliases for HTML routes

Kychon SHALL expose clean extensionless public aliases for Kychon-owned static HTML routes when the deployed Run402 release supports exact static route targets. Each clean alias SHALL map to an exact deployed `.html` file target using a relative `target.file` with no leading slash, query string, fragment, traversal, directory shorthand, or wildcard.

#### Scenario: Module page clean aliases resolve to static files
- **WHEN** a Kychon deploy includes `events.html`, `resources.html`, `forum.html`, `polls.html`, `committees.html`, and `search.html`
- **THEN** the deploy route table maps `/events`, `/resources`, `/forum`, `/polls`, `/committees`, and `/search` to those exact static files
- **AND** each route uses `GET` and `HEAD` only

#### Scenario: Query parameters are preserved by clean aliases
- **WHEN** a visitor opens `/search?q=hello&type=all`
- **THEN** Run402 matches the `/search` static alias
- **AND** the browser page receives the original query string so the search page can render the requested query and filter

#### Scenario: Legacy static file URLs remain available
- **WHEN** a visitor opens `/events.html`
- **THEN** the deployed static file still serves the events page
- **AND** the clean alias does not require removing or redirecting the legacy URL

### Requirement: Published seed pages receive clean static files

Kychon SHALL materialize a static HTML file for each build-known published custom page whose slug is safe for a clean route and does not collide with a reserved Kychon route. The generated file SHALL reuse the generic custom page shell and SHALL allow runtime code to resolve the page slug from the clean pathname.

#### Scenario: Eagles custom pages have clean aliases
- **WHEN** the Eagles seed defines published pages with slugs `about` and `volunteer`
- **THEN** the build output includes `about.html` and `volunteer.html`
- **AND** the deploy route table maps `/about` to `about.html` and `/volunteer` to `volunteer.html`

#### Scenario: Legacy query slug still works
- **WHEN** a visitor opens `/page.html?slug=about`
- **THEN** the custom page still renders the `about` page content
- **AND** no clean route is required for that legacy request to succeed

#### Scenario: Unsafe custom page slug is not aliased
- **WHEN** a published page slug contains a query string, fragment, traversal segment, wildcard, uppercase-only ambiguity, or otherwise fails the safe clean-route slug rules
- **THEN** Kychon does not create a clean static alias for that slug
- **AND** the page remains reachable through the legacy `page.html?slug=` URL

#### Scenario: Reserved custom page slug is rejected for aliasing
- **WHEN** a published page slug collides with a Kychon route such as `events`, `resources`, `search`, `admin`, or `event`
- **THEN** Kychon does not generate a duplicate static alias for that page slug
- **AND** the deploy route table remains deterministic

### Requirement: Kychon-owned hrefs prefer clean routes

Kychon SHALL canonicalize Kychon-owned internal hrefs to clean routes when a clean static alias exists. Canonicalization SHALL preserve query strings and fragments and SHALL NOT rewrite external URLs, `mailto:`, `tel:`, hash-only links, or unknown app-owned paths.

#### Scenario: Page slug href is canonicalized
- **WHEN** a seeded block or search result emits `/page.html?slug=volunteer`
- **THEN** rendered output uses `/volunteer`

#### Scenario: Static file href is canonicalized
- **WHEN** a seeded block or search form emits `/search.html?q=hello&type=all`
- **THEN** rendered output uses `/search?q=hello&type=all`

#### Scenario: External URL is not canonicalized
- **WHEN** a block contains `https://example.org/events.html`
- **THEN** Kychon preserves the external URL exactly
