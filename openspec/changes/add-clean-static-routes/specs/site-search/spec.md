## ADDED Requirements

### Requirement: Search uses clean public URLs

Kychon's search forms, result links, pagination, and filter controls SHALL use clean Kychon-owned public URLs when a clean static alias exists. Query parameters for search state SHALL be preserved exactly according to the existing search page contract.

#### Scenario: Search block submits to clean path
- **WHEN** a rendered `site_search` block uses the default destination
- **THEN** the form action is `/search`
- **AND** submitting a query still sends `q` and `type` query parameters

#### Scenario: Search page accepts clean query URL
- **WHEN** a visitor opens `/search?q=hello&type=all`
- **THEN** the search page reads query `hello` and type `all`
- **AND** matching results render as they would for `/search.html?q=hello&type=all`

#### Scenario: Page search result uses clean page URL
- **WHEN** a search result points to a page with slug `about`
- **THEN** the result URL is `/about`

#### Scenario: Resource and event result URLs keep stateful query or fragment behavior
- **WHEN** a search result points to a resource or event detail
- **THEN** the result URL uses the clean route path where available
- **AND** any required query parameters or fragments are preserved

#### Scenario: Wild Apricot search mapping targets clean route
- **WHEN** the copy/import workflow maps a Wild Apricot search form to Kychon's native search page
- **THEN** the emitted Kychon form targets `/search`
- **AND** it does not emit `/search.html` as the canonical destination
