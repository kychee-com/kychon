## Purpose

Kychon provides native site search over its own PostgreSQL-backed content without requiring OpenSearch or Wild Apricot search. The initial search surface covers pages, resources, and events with server-enforced visibility and safe resource metadata indexing.

## Requirements

### Requirement: Search block renders native search controls

The system SHALL provide a reusable `site_search` block that can render in global header chrome, page sections, and copied-site layouts. The block SHALL support configurable placeholder text, button label, destination path, compact mode, and `default_type`. The default destination path SHALL be `/search.html`, and the default type SHALL be `all`.

#### Scenario: Header search renders with defaults
- **WHEN** a global header section has `section_type = 'site_search'` and empty config
- **THEN** the rendered page includes a search form that submits to `/search.html`
- **THEN** the form includes a query input, a submit control, and no Wild Apricot `/Sys/Search` dependency

#### Scenario: Search block preserves copied labels
- **WHEN** a copied-site import configures a search placeholder or submit label discovered from the source site
- **THEN** the `site_search` block renders those configured strings

#### Scenario: Search block submits selected query without JavaScript
- **WHEN** JavaScript is unavailable and a visitor submits `membership renewal` from the search block
- **THEN** the visitor is navigated to `/search.html?q=membership%20renewal&type=all`

#### Scenario: Search block submits configured type
- **WHEN** a `site_search` block is configured with `default_type = 'resources'`
- **WHEN** a visitor submits a query
- **THEN** the visitor is navigated to `/search.html` with `type=resources`

### Requirement: Page search includes schema-driven section content

The system SHALL index one page search document per page slug. Each page document SHALL aggregate `pages.title`, `pages.content`, and plain text extracted from visible page-scoped `sections` for that slug. The system SHALL exclude global chrome sections, including global header, footer, navigation, sign-in, and attribution content.

#### Scenario: Section text is searchable
- **WHEN** the homepage has a visible page-scoped hero, FAQ, or custom section containing `volunteer induction`
- **WHEN** a visitor searches for `induction`
- **THEN** the homepage appears as a page result

#### Scenario: Global chrome text is excluded
- **WHEN** a global footer attribution section contains `Powered by Run402`
- **WHEN** a visitor searches for `Run402`
- **THEN** that global footer text does not cause every page to appear as a match

#### Scenario: Section update refreshes page document
- **WHEN** an admin updates visible page-scoped section text for page slug `about`
- **THEN** the page search document for `about` is refreshed
- **THEN** subsequent searches use the updated section text

#### Scenario: Hidden section is excluded
- **WHEN** a page-scoped section has `visible = false`
- **THEN** text from that section is not included in the page search document

### Requirement: Search endpoint returns ranked visible results

The system SHALL provide a Run402 server-side search endpoint that accepts `q`, `type`, `page`, `page_size`, and title-only suggestion mode. The endpoint SHALL search indexed pages, resources, and events, rank title matches above body matches, and return result objects containing `id`, `type`, `title`, `url`, and safe `snippet`. The endpoint SHALL return visible-only total count, current page, capped page size, `has_next`, and visible-only facet counts.

#### Scenario: Public query returns matching content
- **WHEN** an anonymous visitor searches for a term that appears in a published public page title
- **THEN** the endpoint returns that page in the results
- **THEN** the page title match ranks above a body-only match for the same term

#### Scenario: Empty query returns no results
- **WHEN** a visitor searches with an empty or whitespace-only `q`
- **THEN** the endpoint returns zero results without an error

#### Scenario: Page size is capped
- **WHEN** a visitor requests a `page_size` above the server cap
- **THEN** the endpoint uses the capped page size
- **THEN** the response reports the capped page size

#### Scenario: Pagination returns stable metadata
- **WHEN** a query has more results than `page_size`
- **THEN** the endpoint returns the requested page of results
- **THEN** the response includes total count, current page, page size, and whether another page exists

#### Scenario: Type filter limits source types
- **WHEN** a visitor searches with `type=resources`
- **THEN** the endpoint returns resource results only
- **THEN** matching pages and events are excluded from that response

#### Scenario: Facet counts respect visibility
- **WHEN** an anonymous visitor searches for a term that matches public and members-only content
- **THEN** facet counts include only public visible matches

#### Scenario: Snippet markup is safe
- **WHEN** a matching title or body contains HTML or script-like text
- **THEN** the endpoint escapes user/content HTML in snippets
- **THEN** only Kychon-controlled highlight markup such as `<mark>` may appear

#### Scenario: Ordering is deterministic
- **WHEN** multiple visible results have the same rank
- **THEN** the endpoint orders them deterministically by updated time, source type, and source key

### Requirement: Search visibility is enforced server-side

The system SHALL enforce search visibility in the server endpoint before returning full results or suggestions. Anonymous visitors and authenticated users without an active member row SHALL receive public results only. Active members, active admins, and active moderators SHALL receive published public results plus published members-only results. Direct browser access to `search_documents` SHALL be denied or protected by an equivalent database visibility policy.

#### Scenario: Anonymous query excludes gated content
- **WHEN** an anonymous visitor searches for a term that appears only in members-only resources
- **THEN** the endpoint does not return those resources
- **THEN** the endpoint does not expose their titles or snippets

#### Scenario: Active member query includes member content
- **WHEN** an authenticated user has a member row with `status = 'active'`
- **WHEN** they search for a term that appears in members-only content
- **THEN** the endpoint includes matching members-only results

#### Scenario: Pending user does not receive member content
- **WHEN** an authenticated user has a member row with `status = 'pending'`
- **WHEN** they search for a term that appears in members-only content
- **THEN** the endpoint treats the user as anonymous
- **THEN** members-only results are excluded

#### Scenario: Suspended user does not receive member content
- **WHEN** an authenticated user has a member row with `status = 'suspended'`
- **WHEN** they search for a term that appears in members-only content
- **THEN** the endpoint treats the user as anonymous
- **THEN** members-only results are excluded

#### Scenario: Direct search table access is protected
- **WHEN** a browser client attempts to select `search_documents` directly through PostgREST
- **THEN** the request is denied or returns only rows allowed by the same visibility policy

#### Scenario: Search responses are private
- **WHEN** the endpoint returns search results or suggestions
- **THEN** the response includes `Vary: Authorization`
- **THEN** the response includes `Cache-Control: no-store` or `Cache-Control: private, max-age=0`

### Requirement: Search results page displays results and filters

The system SHALL provide `/search.html` as the native search results page. The page SHALL read `q`, `type`, and `page` parameters from the URL, render a search form, show visible-only result counts and facets, show filters for all supported source types, and display each result with title, type label, URL, and safe snippet. The page SHALL include `noindex,follow` robots metadata.

#### Scenario: Results page renders matching rows
- **WHEN** a visitor opens `/search.html?q=board`
- **THEN** the page displays the submitted query in the search input
- **THEN** matching results are shown with title, type label, URL, and snippet

#### Scenario: Results page renders no-query state
- **WHEN** a visitor opens `/search.html` without a query
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
- **THEN** the search block navigates to `/search.html` with the typed query

#### Scenario: Escape closes suggestions
- **WHEN** suggestions are open and the visitor presses Escape
- **THEN** the suggestions close
- **THEN** focus remains in or returns to the search input

### Requirement: Resource search indexes safe metadata first

The system SHALL index resource metadata in the initial site search release. Resource search SHALL include title, description, category, file type, and a safe file label derived from the final URL path segment. The system SHALL strip query strings or tokens from indexed file labels and SHALL NOT claim to search inside uploaded PDF, DOCX, or image file bodies in this release.

#### Scenario: Resource title match is searchable
- **WHEN** a public resource has title `Annual audit PDF`
- **WHEN** a visitor searches for `audit`
- **THEN** the resource appears as a resource result

#### Scenario: Resource filename label is searchable
- **WHEN** a public resource has a file URL ending in `bylaws-2025.pdf`
- **WHEN** a visitor searches for `bylaws`
- **THEN** the resource appears as a resource result

#### Scenario: Resource query string is not indexed
- **WHEN** a resource file URL is `/files/bylaws.pdf?token=secret-renewal`
- **WHEN** a visitor searches for `secret-renewal`
- **THEN** the query-string token does not cause the resource to match

#### Scenario: Members-only resource URL is not raw storage URL
- **WHEN** a members-only resource appears in an active member search result
- **THEN** the result URL points to a Kychon-owned page, anchor, or secure download endpoint
- **THEN** the result URL does not expose a raw public storage URL

#### Scenario: PDF body text is not required
- **WHEN** an uploaded PDF contains text that is not present in resource metadata
- **THEN** the initial search implementation is not required to return that resource for the PDF-only text

### Requirement: Wild Apricot search gadgets map to native search

The copy/import workflow SHALL map Wild Apricot-style site search gadgets and `/Sys/Search` forms to Kychon's `site_search` block. The mapper SHALL preserve discovered placeholder text, submit label, and search position where possible. The mapper SHALL translate Wild Apricot content-type defaults into Kychon's singular `type` defaults without exposing Wild Apricot bitmask parameters as Kychon's public API.

#### Scenario: Wild Apricot search form becomes native block
- **WHEN** the copy/import workflow detects a Wild Apricot site search gadget
- **THEN** it emits a Kychon section with `section_type = 'site_search'`
- **THEN** the emitted form targets `/search.html` instead of the source site's `/Sys/Search`

#### Scenario: Absolute Wild Apricot search URL is replaced
- **WHEN** copied source HTML contains an absolute URL ending in `/Sys/Search` or `/Sys/Search/DoSearch`
- **THEN** the emitted Kychon output does not retain that source-domain search URL

#### Scenario: Relative Wild Apricot search URL is replaced
- **WHEN** copied source HTML contains a relative `/Sys/Search` or `/Sys/Search/DoSearch` form action
- **THEN** the emitted Kychon output does not retain that Wild Apricot search URL

#### Scenario: Wild Apricot labels are preserved
- **WHEN** the source search gadget has custom placeholder or button text
- **THEN** the emitted `site_search` block config includes the discovered text

#### Scenario: Wild Apricot type defaults are translated
- **WHEN** the source search gadget specifies Wild Apricot content-type defaults
- **THEN** the importer maps those defaults to the nearest supported Kychon `type` value
- **THEN** Wild Apricot hidden `types` parameters are not emitted into native Kychon URLs

#### Scenario: Unknown Wild Apricot type defaults warn and fall back
- **WHEN** the source search gadget specifies unsupported or unknown type bits
- **THEN** the importer falls back to `type=all`
- **THEN** the importer records a warning for the copied-site report

### Requirement: Search index stays synchronized

The system SHALL keep indexed search rows synchronized with page, section, resource, and event create, update, visibility, and delete operations. Synchronization SHALL be implemented through database sync functions/triggers or an equivalent transactional central write path. The system SHALL also provide a reindex path that rebuilds search rows from existing pages, sections, resources, and events for deployments, imports, and repair.

#### Scenario: Page update refreshes search result
- **WHEN** a page title, content, `requires_auth`, or `published` value is updated
- **THEN** the corresponding page search document is updated before subsequent search responses depend on it

#### Scenario: Section update refreshes page result
- **WHEN** visible page-scoped section text changes for page slug `about`
- **THEN** the page search document for `about` is refreshed

#### Scenario: Resource visibility update affects search
- **WHEN** a resource is changed from public to members-only
- **THEN** anonymous search responses stop returning that resource

#### Scenario: Event deletion removes result
- **WHEN** an event is deleted
- **THEN** the corresponding search document is removed or marked unpublished

#### Scenario: Reindex rebuilds existing content
- **WHEN** the reindex path runs on a deployment with existing pages, sections, resources, and events
- **THEN** it creates or updates search documents for all searchable content
- **THEN** stale search documents for missing source rows are removed or marked unpublished
