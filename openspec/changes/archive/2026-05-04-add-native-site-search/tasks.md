## 1. Schema, Access, And Sync Primitives

- [x] 1.1 Add `search_documents` to `schema.sql` with idempotent creation, `source_type`, text `source_key`, source tuple uniqueness, title/body/url fields, visibility fields, timestamps, and v1 source constraints for `page`, `resource`, and `event`
- [x] 1.2 Add `title_vector` and `search_vector` support using the `simple` text-search config, with title terms weighted above body terms
- [x] 1.3 Add GIN indexes for both vectors plus supporting indexes for visibility filters, source type, source tuple lookup, and deterministic updated ordering
- [x] 1.4 Add direct-table access protection through RLS, privileges, or equivalent deploy configuration so browser clients cannot leak members-only `search_documents` rows
- [x] 1.5 Add idempotent sync/reindex primitives for page, resource, and event documents, including `kychon_reindex_search()` or an equivalent full repair function
- [x] 1.6 Add triggers or an equivalent transactional central write path for `pages`, `sections`, `resources`, and `events` so search rows stay synchronized across existing direct write paths
- [x] 1.7 Add schema tests for fresh deploy, idempotent re-deploy, core table inventory, source constraints, unique source tuples, vector indexes, direct-table access protection, and repeatable reindexing

## 2. Search Document Extraction

- [x] 2.1 Add plain-text extraction helpers for searchable block configs, including hero copy, rich/custom content, FAQ items, promo cards, link lists, page banners, and other visible page-scoped text blocks
- [x] 2.2 Build one page search document per slug from `pages.title`, `pages.content`, and visible page-scoped `sections`, excluding global header/footer/nav/sign-in/attribution chrome
- [x] 2.3 Ensure section create/update/delete and `visible` changes refresh the corresponding page search document
- [x] 2.4 Build resource search documents from metadata only: title, description, category, file type, and safe file label derived from the final URL path segment with query strings/tokens stripped
- [x] 2.5 Build event search documents from event title, description, location, date text, member visibility, and stable event URL
- [x] 2.6 Add extraction/sync tests for section-derived page hits, hidden sections, global chrome exclusion, updated section text, changed resource visibility, deleted events, safe filename labels, and stale-index repair

## 3. Search Endpoint

- [x] 3.1 Add a Run402 server-side search endpoint that accepts `q`, singular `type`, `page`, `page_size`, and title-only suggestion mode
- [x] 3.2 Validate endpoint input so empty/whitespace queries return zero results, unsupported types fall back or error predictably, and `page_size` is capped
- [x] 3.3 Implement PostgreSQL querying with `websearch_to_tsquery`, short-query prefix/substr fallback, title-first ranking, deterministic secondary ordering, snippets, visible-only counts, visible-only facets, and pagination metadata
- [x] 3.4 Generate snippets from plain text with escaped content and only Kychon-controlled highlight markup
- [x] 3.5 Enforce visibility on the server for anonymous users, active members/admins/moderators, pending users, expired users, suspended users, and missing member rows
- [x] 3.6 Return `Vary: Authorization` and `Cache-Control: no-store` or `private, max-age=0` on result and suggestion responses
- [x] 3.7 Add endpoint tests for public results, active member results, pending/suspended exclusions, direct gated-title leak prevention, type filtering, title-over-body ranking, deterministic ties, XSS-safe snippets, short-query behavior, page-size caps, facets, and pagination

## 4. Search Results Page

- [x] 4.1 Add `/search.html` with a search form that preserves `q`, `type`, and `page` state from URL parameters
- [x] 4.2 Render result counts, visible-only facets, source filters for `all`, `pages`, `resources`, and `events`, result rows with title/type/URL/snippet, pagination controls, loading state, no-query state, and no-results state
- [x] 4.3 Add `noindex,follow` robots metadata and i18n strings for default labels, placeholders, result type labels, count text, no-query state, and no-results state
- [x] 4.4 Style the results page, filters, pagination, and snippet highlights so they fit existing Kychon chrome on desktop and mobile without overlap
- [x] 4.5 Add page-level tests for populated results, no-query state, empty results, filter changes, pagination, visible-only facet counts, escaped snippets, robots metadata, and mobile layout sanity

## 5. Site Search Block And Autosuggest

- [x] 5.1 Add the `site_search` block type, config defaults, renderer, and required hydrator registration
- [x] 5.2 Support configurable placeholder text, submit label, destination path, compact mode, and singular `default_type`
- [x] 5.3 Ensure the block submits to `/search.html` with `q` and `type` even when JavaScript is unavailable
- [x] 5.4 Add autosuggest hydration using title-only search with minimum query length, 150-250ms debounce, AbortController cancellation, max 5 suggestions, no localStorage suggestion cache, keyboard/pointer selection, Escape close, and ARIA combobox/listbox semantics
- [x] 5.5 Add block tests for default rendering, copied labels, submit URL generation, configured default type, no-JS fallback, visible suggestions, prefix-like suggestions, stale request handling, gated suggestion exclusions, and keyboard behavior

## 6. Copy And Import Mapping

- [x] 6.1 Update the copied-site seed/import path used for Wild Apricot ports to detect site search gadgets and absolute or relative `/Sys/Search` and `/Sys/Search/DoSearch` forms
- [x] 6.2 Emit native `site_search` sections that preserve discovered placeholder text, submit labels, compact/layout intent, and layout position
- [x] 6.3 Translate Wild Apricot content-type bitmasks to Kychon's singular `type` defaults: supported single bits map to `pages`, `resources`, or `events`; all/missing/multiple/unknown bits map to `all` with a warning when appropriate
- [x] 6.4 Remove Wild Apricot hidden search parameters from emitted native URLs and ensure copied HTML/sections contain no remaining `/Sys/Search` action or link
- [x] 6.5 Run or schedule the native reindex path after copied-site seed/import generation instead of writing arbitrary imported content directly to `search_documents`
- [x] 6.6 Add import fixture tests for Wild Apricot search gadget detection, absolute source search URLs, relative search URLs, custom labels, hidden `types`, unknown bits warnings, and no remaining `/Sys/Search` output

## 7. Verification

- [x] 7.1 Run focused unit and integration tests for schema, indexing, endpoint behavior, search page rendering, block hydration, resource metadata safety, direct-table protection, and import mapping
- [x] 7.2 Run the project build and existing smoke tests that cover generated pages, global chrome, resources, events, and seed generation
- [x] 7.3 Run OpenSpec validation for `add-native-site-search` and fix any artifact issues before implementation begins
