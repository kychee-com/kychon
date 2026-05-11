## ADDED Requirements

### Requirement: Deploy includes clean static route aliases

The deploy entry point SHALL include Run402 static route aliases for Kychon's clean public URLs in the release spec. Static aliases SHALL use `routes.replace` entries with exact path patterns, `methods` limited to `GET` and `HEAD`, and `target: { type: "static", file: "<relative-file>.html" }`. Omitted route targets, leading slashes in `target.file`, query strings, fragments, traversal, directory shorthand, and wildcard static targets MUST NOT be generated.

#### Scenario: Deploy spec contains standard clean routes
- **WHEN** the deploy entry point assembles a Run402 release spec after a successful Astro build
- **THEN** the spec includes static alias routes for standard Kychon HTML pages such as `/events`, `/resources`, `/forum`, `/polls`, `/committees`, `/search`, `/directory`, `/join`, `/profile`, `/event`, `/admin`, `/admin-members`, and `/admin-settings`
- **AND** each static alias target references the corresponding deployed `.html` file without a leading slash

#### Scenario: Deploy spec contains generated page routes
- **WHEN** the active seed has build-known published pages with safe non-conflicting slugs
- **THEN** the deploy spec includes static alias routes mapping each clean slug path to its generated slug `.html` file

#### Scenario: Static routes are exact and method-safe
- **WHEN** the deploy spec contains static route aliases
- **THEN** each alias has an exact pattern rather than a wildcard
- **AND** each alias allows `GET` and `HEAD` only

#### Scenario: No query-string static targets
- **WHEN** a custom page was historically reached at `/page.html?slug=about`
- **THEN** the deploy spec maps `/about` to `about.html`
- **AND** it does not generate a static target file of `page.html?slug=about`

### Requirement: Deploy diagnostics verify clean static aliases

Kychon deploy verification SHALL prefer Run402's public URL diagnostic surfaces when investigating whether a clean route resolves to the intended static asset. Verification SHALL use the CLI `run402 deploy diagnose --project <project_id> <url> --method GET` or SDK `r.deploy.resolve({ project, url, method })` when available.

#### Scenario: Operator diagnoses clean search route
- **WHEN** an operator needs to inspect `https://eagles.kychon.com/search?q=hello&type=all`
- **THEN** the recommended Run402 check is `run402 deploy diagnose --project <project_id> https://eagles.kychon.com/search?q=hello&type=all --method GET`
- **AND** the operator uses the diagnostic match and static asset identity fields instead of guessing which deployed file is live
