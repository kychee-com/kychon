## ADDED Requirements

### Requirement: Kychon separates public browser paths from release asset paths

Kychon SHALL publish browser-visible static URLs through Run402 `site.public_paths` explicit mode. Kychon release asset paths such as `events.html`, `search.html`, `page.html`, and generated custom page files SHALL be treated as internal deploy assets unless they are explicitly listed as public paths.

#### Scenario: Events uses a clean public path
- **WHEN** a deployed release contains the asset `events.html`
- **THEN** the Run402 public path table maps `/events` to asset `events.html`
- **AND** `/events` is the public browser URL for the events page

#### Scenario: Events implementation file is hidden
- **WHEN** a visitor requests `/events.html` from a deployed Run402 public host
- **THEN** Run402 does not serve the `events.html` asset by implicit filename reachability
- **AND** the response is a not-found response unless the project deliberately declares `/events.html` as a public path

#### Scenario: Custom page implementation file is hidden
- **WHEN** a build-known custom page slug `about` is materialized as `about.html`
- **THEN** the public path table maps `/about` to asset `about.html`
- **AND** `/about.html` is not public by default

#### Scenario: Generic page shell is hidden
- **WHEN** a release contains `page.html` as a generic custom page shell
- **THEN** `/page.html` and `/page.html?slug=about` are not public browser URLs by default
- **AND** build-known custom pages remain reachable through their clean public paths

### Requirement: Kychon publishes all required support assets explicitly

Kychon SHALL include every static support asset required by public pages in the explicit public path table. Support asset public paths SHALL normally match their release asset path with a leading slash, except where a cleaner public path is intentionally generated for an HTML page.

#### Scenario: Astro assets remain reachable
- **WHEN** the build output contains hashed Astro assets under `_astro/`
- **THEN** each required asset is listed in `site.public_paths.replace` under `/_astro/<asset>`
- **AND** pages that reference those assets can load their scripts and styles after deploy

#### Scenario: Runtime config remains reachable
- **WHEN** the build output contains `js/env.js`
- **THEN** the explicit public path table publishes `/js/env.js`
- **AND** browser code can still read Kychon's Run402 API base URL and anon key

#### Scenario: Discovery metadata remains reachable
- **WHEN** the build output contains `.well-known/kychon.json`, `kychon-capabilities.json`, `kychon-release.json`, or `llms.txt`
- **THEN** each metadata file is published at its expected public path
- **AND** fleet verification and SDK discovery continue to work

#### Scenario: Demo media remains reachable
- **WHEN** the build output contains images or other public files under `assets/`, `custom/`, or `css/`
- **THEN** those files are published under their matching public paths
- **AND** portal pages do not lose images, styles, or localized strings in explicit public-path mode

### Requirement: Query strings are preserved on clean public paths

Kychon SHALL rely on Run402 public-path matching for the pathname while preserving the original query string for browser code. Public path entries SHALL NOT encode query strings in their asset target.

#### Scenario: Search query reaches the browser page
- **WHEN** a visitor opens `/search?q=hello&type=all`
- **THEN** Run402 resolves pathname `/search` to asset `search.html`
- **AND** browser code receives `q=hello&type=all` through `window.location.search`

#### Scenario: Event detail query reaches the browser page
- **WHEN** a visitor opens `/event?id=evt_123`
- **THEN** Run402 resolves pathname `/event` to asset `event.html`
- **AND** browser code receives `id=evt_123` through `window.location.search`

### Requirement: Public path inventory is the authority for static reachability

Kychon verification SHALL treat Run402 release inventory `static_public_paths` as the authority for which static assets are publicly reachable. The inventory SHALL include clean public paths for Kychon pages and SHALL NOT include Kychon-owned `.html` implementation paths unless compatibility was deliberately enabled.

#### Scenario: Release inventory shows explicit public path authority
- **WHEN** an operator inspects the active release after deploy
- **THEN** `/events` appears in `static_public_paths` with asset path `events.html`
- **AND** its reachability authority is `explicit_public_path`

#### Scenario: Release inventory omits hidden implementation path
- **WHEN** an operator inspects the active release after deploy
- **THEN** `/events.html` does not appear as a direct public path
- **AND** no implicit filename-derived reachability is used for Kychon-owned HTML pages
