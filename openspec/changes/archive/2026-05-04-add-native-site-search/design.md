## Context

Kychon stores the content that association visitors expect to search in PostgreSQL, but that content is not only in top-level source tables. Public pages are schema-driven: titles may live in `pages`, while most visible copy lives in `sections.config` rendered through the block registry. A copied Wild Apricot page may have body text, hero copy, FAQ items, promo cards, link lists, and custom HTML in page-scoped sections.

Wild Apricot-style ports can currently render a visible search form, but the honest fallback sends users back to the source `/Sys/Search`, which breaks the migrated-site illusion and keeps the old domain in the critical path. Wild Apricot's public search behavior is modest: it posts a query, a content-type bitmask, and a page number to `/Sys/Search/DoSearch`; it returns counts, snippets, and result rows. AAGE's visible search covers page contents, blogs, and forums; searches for document names return the page linking to the document, not the document file body as an independent result.

Kychon can match the useful behavior with PostgreSQL full-text search and improve resource metadata search without introducing a dedicated search cluster, as long as the design protects members-only data and keeps page documents synchronized with section edits.

## Goals / Non-Goals

**Goals:**

- Provide a reusable `site_search` block for header/global chrome and copied-site layouts.
- Provide `/search.html` and a Run402 search endpoint with visible-only counts, snippets, pagination, type filtering, facets, and title-only suggestions.
- Search pages, resources, and events from one normalized index while respecting `pages.requires_auth` and `is_members_only` visibility.
- Build page search documents from `pages` plus visible page-scoped `sections` text, excluding global header/footer/nav chrome.
- Keep the implementation portable for Run402 deployments and easy for generated site seeds/imports to reindex.
- Preserve source labels/placeholders from Wild Apricot search gadgets during copy/import and remove source-domain `/Sys/Search` dependencies.

**Non-Goals:**

- No OpenSearch/Elasticsearch/Meilisearch/Algolia dependency.
- No browser OpenSearch descriptor in the initial implementation.
- No OCR and no promise to search inside uploaded PDF/DOCX/image file bodies in the initial slice.
- No universal crawl of arbitrary rendered HTML; indexed content comes from Kychon's content tables, block config extraction, and import pipeline.
- No native announcements/news/blog search in v1. Announcements currently lack stable per-item result URLs; add them later with permalinks or reliable anchors.
- No forum search, member directory search, translation-aware search, admin search analytics, synonyms, or fuzzy/trigram tuning in this change.

## Decisions

### Use a protected normalized `search_documents` table

Create a `search_documents` table with `source_type`, `source_key`, `title`, `body`, `url`, `is_members_only`, `published`, `title_vector`, `search_vector`, timestamps, and supporting indexes. `source_key` is text: page documents use the page slug, while resources and events use `id::text`. Public result identifiers use the stable tuple `${source_type}:${source_key}` rather than the table's serial id. V1 source types are `page`, `resource`, and `event`.

Rows are generated from native Kychon content:

- `page`: one document per page slug, aggregating `pages.title`, `pages.content`, and visible page-scoped `sections` text for that slug. Index main-zone sections and page-scoped banner text where relevant. Do not index global header, footer, nav, sign-in, or attribution chrome.
- `resource`: one document per resource row, indexing metadata only.
- `event`: one document per event row.

Copy/import jobs should create native pages, sections, resources, and events, then run reindexing. They should not use `search_documents` as a dumping ground for content that does not map to native Kychon rows in v1.

Rationale: A single table keeps query/ranking/snippet logic simple and avoids duplicating SQL across source tables. Text `source_key` avoids the integer-vs-slug mismatch, and a separate title vector makes autosuggest cheap and predictable.

Alternatives considered:

- Query each source table directly with a `UNION ALL`: fewer schema changes, but ranking, paging, snippets, section aggregation, and future source types become scattered.
- External search service: better tuning at large scale, but operationally too heavy for association ports and unnecessary for current content sizes.
- One row per section: more granular, but it creates noisy result pages and poor copied-site UX. Visitors expect to land on the page.

### Enforce visibility through a server endpoint and table protection

The public search API SHALL be a Run402 server function. Browser clients must not select `search_documents` directly through PostgREST unless equivalent RLS/privilege policies enforce the same visibility rules.

Visibility rules:

- Anonymous visitors can see only `published = true AND is_members_only = false`.
- Authenticated users with a member row whose `status = 'active'` can see published public results plus published members-only results.
- Admins and moderators with active member rows use the same active-member visibility rule.
- Pending, expired, suspended, or missing member rows use anonymous visibility.

Endpoint responses should include `Cache-Control: no-store` or `private, max-age=0` and `Vary: Authorization` so members-only search responses are not shared across users.

Rationale: Search snippets and autosuggest can leak titles. Server-side filtering and direct-table access protection make privacy a backend guarantee rather than a client convention.

Alternatives considered:

- Client-side filtering: unacceptable because it leaks gated titles and snippets to the browser.
- Public PostgREST table access with frontend filters: same leak risk.

### Maintain the index with database sync functions and triggers

Use idempotent PostgreSQL functions to upsert search documents:

- `kychon_upsert_search_page(slug TEXT)`
- `kychon_upsert_search_resource(id INT)`
- `kychon_upsert_search_event(id INT)`
- `kychon_reindex_search()`

Add triggers on `pages`, `sections`, `resources`, and `events` to keep rows synchronized. Section changes refresh the corresponding page document when the section is page-scoped and searchable. Delete operations remove the corresponding document or mark it unpublished. Generated seeds/imports can rely on triggers and should run `kychon_reindex_search()` as a repair/backfill pass after bulk import.

Rationale: Kychon has many direct write paths: inline editing, page rendering/admin tools, resources/events pages, upload functions, generated seeds, and future agent-authored changes. Requiring each path to remember search sync manually is fragile. Database sync functions/triggers are less overkill than hunting stale indexes later.

Alternatives considered:

- App-level write-boundary updates: workable only if all writes go through a central server API, which Kychon does not currently guarantee.
- Search-time materialization: simplest to build, but slower and less flexible for snippets/ranking.

### Search only safe resource metadata first

For resources, index `title`, `description`, `category`, file type, and a safe filename label derived from the final path segment of `file_url`. Strip query strings/tokens, decode URL-encoded names safely, and do not expose raw storage URLs for members-only resources. Resource results should link to a Kychon page/anchor or secure download endpoint rather than a raw gated file URL.

Do not extract PDF/DOCX text in this change.

Rationale: Wild Apricot's visible behavior appears to search pages that link to documents rather than attachment bodies. Resource metadata gives a good association-site result quickly and keeps upload costs predictable.

Alternatives considered:

- PDF text extraction during upload: valuable follow-up, but adds dependency/runtime questions and failure modes for large/scanned files.
- OCR: too expensive and brittle for a native-search MVP.

### Use deterministic PostgreSQL full-text search

Use PostgreSQL full-text search with a simple, deterministic query plan:

- Default search config: `simple`, which behaves better for association names, acronyms, mixed-language titles, and filenames.
- Query parsing: `websearch_to_tsquery` for normal searches.
- Short/simple fallback: prefix or safe substring matching for short terms where FTS would otherwise fail.
- Autosuggest: query `title_vector` and/or prefix-normalized title text after a minimum query length.
- Ranking: title matches sort ahead of body-only matches, then rank, `updated_at`, `source_type`, and `source_key`.
- Snippets: generate from plain text and escape content. If `ts_headline` is used, emit sentinel markers, escape text, then replace markers with Kychon-controlled `<mark>` tags.

Empty or whitespace-only queries return no results and no error. `page_size` is capped server-side.

Rationale: PostgreSQL search is already available with the content database, supports indexes, and is enough for small-to-medium membership sites. The deterministic behavior keeps tests stable and gives copied sites predictable results.

Alternatives considered:

- Client-side search over downloaded rows: works for demos, but leaks gated titles and does not scale.
- Fuzzy matching/trigrams in v1: useful later, but not required to replace Wild Apricot-style search.

### Model Wild Apricot type filters as Kychon source filters

Use a singular `type` filter in Kychon URLs/API:

- `all`
- `pages`
- `resources`
- `events`

Wild Apricot bitmasks are importer implementation details, not Kychon's public contract. Suggested import mapping:

| Wild Apricot source | Kychon default |
| --- | --- |
| pages/content bit | `pages` |
| documents/files bit | `resources` |
| events/calendar bit | `events` |
| all, missing, `7`, or multiple supported bits | `all` |
| blog/news/forum/unknown bits | `all` with importer warning, unless that content was imported as normal pages |

The importer should detect absolute and relative `/Sys/Search` and `/Sys/Search/DoSearch` forms, convert source POST forms to native GET `/search.html`, preserve placeholder/button text, remove Wild Apricot hidden parameters, and ensure copied output no longer contains `/Sys/Search`.

Rationale: Kychon's search sources are product concepts, not Wild Apricot internals. Singular type filters keep URLs simple and enough for v1.

Alternatives considered:

- Preserve `types` bitmask in Kychon: easier for copied forms, but confusing for native code and incomplete for resources/events.
- Support multi-type comma filters in v1: more flexible, but not needed for a Wild Apricot-style replacement.

### Keep autosuggest as progressive enhancement

Autosuggest is a modern nicety, not a dependency for search. Normal form submission must work without JavaScript. When JavaScript is available, the block should debounce requests, require a minimum query length, abort stale requests, cap suggestions, avoid localStorage caching, and expose ARIA combobox/listbox behavior with keyboard and pointer selection.

Rationale: This improves perceived quality without making the secure endpoint/results page contingent on extra client behavior.

## Risks / Trade-offs

- Stale page results -> Use database sync functions/triggers plus `kychon_reindex_search()`; add tests for section edits and repair.
- Gated content leakage -> Enforce visibility in the Run402 function and protect direct table access; test anonymous, active member, pending, suspended, and suggestions.
- Poor snippets from HTML content -> Extract plain text from block config and generate escaped snippets with Kychon-controlled `<mark>` tags.
- Resource search feels shallow without PDF bodies -> Make metadata-only indexing explicit and leave `body` capable of later file text ingestion.
- Search result URLs for resources -> Use Kychon-owned anchors/routes or secure endpoints, especially for members-only files.
- Postgres full-text ranking surprises -> Use simple field weights and deterministic secondary ordering.
- Import mapping may miss custom Wild Apricot search labels -> Preserve placeholder/button text when discovered, warn on unknown type mappings, and fall back to Kychon defaults otherwise.

## Migration Plan

1. Add idempotent schema for `search_documents`, vectors, indexes, access protection, and sync/reindex functions.
2. Add search text extraction for pages, visible page-scoped sections, resources, and events.
3. Add triggers plus `kychon_reindex_search()` to backfill and repair rows from existing content.
4. Add the Run402 search endpoint and `/search.html`, gated by server-side visibility rules and private cache headers.
5. Add the `site_search` block and progressive autosuggest hydration.
6. Update seeds/importers to emit native search blocks and run reindex after copied-site import.
7. Rollback by disabling/removing the block from chrome and leaving the unused table/functions in place until a later cleanup migration.

## Resolved Questions

- Announcements are deferred in v1 because current announcements do not have stable per-item result URLs. Copied news/blog content can still be searched when imported as normal pages/sections.
- Authenticated users only receive members-only results when their member row is active. Pending, expired, suspended, or missing member rows are treated as anonymous.
- Copy/import workflows should create native Kychon content and run a reindex pass; they should not write arbitrary unmapped content directly to `search_documents`.
