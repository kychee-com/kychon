## MODIFIED Requirements

### Requirement: Search block renders native search controls

The system SHALL provide a reusable `site_search` block that can render in global header chrome, page sections, and copied-site layouts. The block SHALL support configurable placeholder text, button label, destination path, compact mode, and `default_type`. The default destination path SHALL be `/search`, and the default type SHALL be `all`.

#### Scenario: Header search renders with defaults
- **WHEN** a global header section has `section_type = 'site_search'` and empty config
- **THEN** the rendered page includes a search form that submits to `/search`
- **THEN** the form includes a query input, a submit control, and no Wild Apricot `/Sys/Search` dependency

#### Scenario: Search block preserves copied labels
- **WHEN** a copied-site import configures a search placeholder or submit label discovered from the source site
- **THEN** the `site_search` block renders those configured strings

#### Scenario: Search block submits selected query without JavaScript
- **WHEN** JavaScript is unavailable and a visitor submits `membership renewal` from the search block
- **THEN** the visitor is navigated to `/search?q=membership%20renewal&type=all`

#### Scenario: Search block submits configured type
- **WHEN** a `site_search` block is configured with `default_type = 'resources'`
- **WHEN** a visitor submits a query
- **THEN** the visitor is navigated to `/search` with `type=resources`

### Requirement: Search results page displays results and filters

The system SHALL provide `/search` as the native search results page. The page SHALL read `q`, `type`, and `page` parameters from the URL, render a search form, show visible-only result counts and facets, show filters for all supported source types, and display each result with title, type label, URL, and safe snippet. The page SHALL include `noindex,follow` robots metadata.

#### Scenario: Results page renders matching rows
- **WHEN** a visitor opens `/search?q=board`
- **THEN** the page displays the submitted query in the search input
- **THEN** matching results are shown with title, type label, URL, and snippet

#### Scenario: Results page renders no-query state
- **WHEN** a visitor opens `/search` without a query
- **THEN** the page displays a search-ready state
- **THEN** no empty-query error is shown

#### Scenario: Results page renders empty state
- **WHEN** a visitor searches for a term with no visible matches
- **THEN** the page displays a no-results state
- **THEN** the page keeps the search input available for another query

#### Scenario: Results page changes filter
- **WHEN** a visitor selects the resources filter from the results page
- **THEN** the page reloads or updates with `type=resources`
- **THEN** only resource results are shown

#### Scenario: Results page is mobile scannable
- **WHEN** the results page is rendered on a mobile viewport
- **THEN** filters, counts, snippets, and pagination controls remain readable and do not overlap

### Requirement: Autosuggest uses title-only progressive enhancement

The `site_search` block SHALL support lightweight autosuggest by requesting title-only matches from the native search endpoint after a visitor types a query. Suggestions SHALL require a minimum query length, SHALL be debounced, SHALL cancel stale requests, SHALL be limited to a small result count, SHALL avoid persistent localStorage caching, SHALL respect the same visibility rules as full results, and SHALL expose accessible combobox/listbox keyboard behavior.

#### Scenario: Suggestions show visible title matches
- **WHEN** a visitor types a query that matches public result titles after the minimum character count
- **THEN** the search block shows a limited list of title suggestions
- **THEN** each suggestion includes a title and type label

#### Scenario: Suggestions support prefix-like behavior
- **WHEN** a visitor types `mem`
- **WHEN** a visible title contains `Membership`
- **THEN** the title can appear as an autosuggest result

#### Scenario: Suggestions exclude gated titles
- **WHEN** an anonymous visitor types a query that matches only members-only titles
- **THEN** the suggestion list does not show those titles

#### Scenario: Stale suggestion requests are ignored
- **WHEN** a visitor quickly changes the query before a prior suggestion request completes
- **THEN** the stale response does not replace suggestions for the current query

#### Scenario: Keyboard fallback submits full search
- **WHEN** a visitor submits the search input without choosing a suggestion
- **THEN** the search block navigates to `/search` with the typed query

#### Scenario: Escape closes suggestions
- **WHEN** suggestions are open and the visitor presses Escape
- **THEN** the suggestions close
- **THEN** focus remains in or returns to the search input
