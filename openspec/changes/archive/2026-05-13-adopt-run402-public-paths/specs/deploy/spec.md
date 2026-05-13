## ADDED Requirements

### Requirement: Deploy uses Run402 v1.69 public paths

The deploy entry point SHALL use an exact-pinned `@run402/sdk` version that supports Run402 `site.public_paths` explicit mode. For this change, the exact pin SHALL be `1.69.0`.

#### Scenario: SDK pin exposes public path types
- **WHEN** a contributor installs dependencies from `package-lock.json`
- **THEN** `@run402/sdk` resolves to version `1.69.0`
- **AND** TypeScript accepts `site.public_paths` in the `ReleaseSpec` used by `r.deploy.apply()`

#### Scenario: SDK remains exact-pinned
- **WHEN** a dependency update changes `@run402/sdk`
- **THEN** the package manifest keeps an exact version string without `^` or `~`
- **AND** the change is reviewed as an intentional Run402 contract update

### Requirement: Deploy publishes explicit public static paths

The deploy entry point SHALL include `site.public_paths: { mode: "explicit", replace: ... }` in the Run402 release spec. The public path map SHALL publish clean Kychon-owned HTML URLs and required support assets, while keeping `.html` release asset paths hidden unless deliberately declared.

#### Scenario: Deploy spec contains clean public page paths
- **WHEN** the deploy entry point assembles a Run402 release spec after a successful Astro build
- **THEN** the spec maps standard Kychon pages such as `/events`, `/resources`, `/forum`, `/polls`, `/committees`, `/search`, `/directory`, `/join`, `/profile`, `/event`, `/admin`, `/admin-members`, and `/admin-settings` through `site.public_paths.replace`
- **AND** each entry references the corresponding release asset such as `events.html` or `admin.html`

#### Scenario: Deploy spec contains generated custom page paths
- **WHEN** the active seed has build-known published pages with safe non-conflicting slugs
- **THEN** the deploy spec maps each clean slug path through `site.public_paths.replace`
- **AND** the mapped asset is the generated slug `.html` file

#### Scenario: Deploy spec hides implementation paths
- **WHEN** the deploy entry point assembles `site.public_paths.replace`
- **THEN** it does not include public entries for Kychon-owned `.html` implementation paths such as `/events.html`, `/search.html`, `/admin.html`, `/page.html`, or generated custom page filenames
- **AND** those assets remain available only as release asset targets

#### Scenario: Deploy spec publishes required support files
- **WHEN** the deploy entry point assembles `site.public_paths.replace`
- **THEN** it includes required static support paths for Astro assets, CSS, runtime config, custom strings, images, favicons, discovery metadata, and release metadata
- **AND** public pages can load without implicit static filename reachability

### Requirement: Deploy clears ordinary static route aliases

The deploy entry point SHALL NOT use `routes.replace` for ordinary clean static page URLs when `site.public_paths` explicit mode is used. Because Run402 carries routes forward when `routes` is omitted or null, Kychon SHALL deliberately replace the route table with only supported routed functions or an empty array.

#### Scenario: Static aliases are not emitted as routes
- **WHEN** the deploy entry point assembles a release spec for ordinary static pages
- **THEN** `/events`, `/search`, `/resources`, `/admin`, and generated custom page paths are absent from `routes.replace`
- **AND** their reachability comes from `site.public_paths.replace`

#### Scenario: Old static route aliases are cleared
- **WHEN** the current base release contains v1.66 static route aliases
- **THEN** the next v1.69 deploy replaces the route table rather than carrying those aliases forward
- **AND** the release has no stale route-static aliases for ordinary static pages

#### Scenario: Function routes remain possible
- **WHEN** a future Kychon release adds a same-origin function route
- **THEN** `routes.replace` may include that function route
- **AND** ordinary static page URLs still remain in `site.public_paths`

### Requirement: Deploy verification checks hidden implementation URLs

Kychon deploy verification SHALL validate both positive clean public paths and negative implementation paths. Verification SHALL use Run402 release inventory or resolve diagnostics when available, and SHALL include HTTP smoke checks for user-visible behavior.

#### Scenario: Clean route succeeds
- **WHEN** a deployed portal is verified
- **THEN** verification checks that `/events` returns a successful HTML response
- **AND** verification checks that `/search?q=hello&type=all` returns the search page

#### Scenario: Implementation route is hidden
- **WHEN** a deployed portal is verified
- **THEN** verification checks that `/events.html` is not served as a successful HTML response
- **AND** the result is treated as expected hidden implementation behavior

#### Scenario: Release inventory confirms public paths
- **WHEN** Run402 release inventory is available
- **THEN** verification inspects `static_public_paths`
- **AND** it confirms `/events` maps to `events.html` with explicit public-path authority
