## Why

Copied association sites often include a visible Wild Apricot site search gadget, but Kychon currently has no native equivalent. Ports such as AAGE can only preserve the UI by sending users back to the source `/Sys/Search`, leaving the migrated site dependent on the old domain for a basic navigation workflow.

Kychon can cover the useful part of Wild Apricot-style search without OpenSearch or another search product because the searchable content already lives in PostgreSQL. The important caveat is that Kychon's page content is schema-driven: real visitor-facing text lives in both `pages` and `sections`, so native search must index rendered page documents rather than only page table rows.

## What Changes

- Add a native site search experience with a reusable `site_search` block for header/global chrome and copied-site layouts.
- Add `/search.html` and a Run402 server-side search endpoint that use PostgreSQL full-text search rather than Wild Apricot or an external search service.
- Add normalized `search_documents` storage with protected direct access, full-text indexes, title-only autosuggest support, and source-key based result identifiers.
- Search public page documents, resources, and events, while excluding gated or members-only content for anonymous visitors and inactive authenticated accounts.
- Build page search documents from `pages` plus visible page-scoped `sections` text, excluding global header/footer/nav chrome.
- Return visible-only counts, facets, snippets, type labels, cache-safe headers, and paginated results suitable for a Wild Apricot-style search page.
- Support lightweight progressive-enhancement autosuggest from the same server endpoint using title-only/prefix-friendly matches.
- Teach copy/import workflows to map Wild Apricot `Sys/Search` gadgets to Kychon's native search block while preserving labels/placeholders where possible and ensuring copied output no longer points at `/Sys/Search`.
- Treat resource file body indexing as an incremental enhancement: the initial search indexes safe resource metadata and leaves PDF/DOCX/OCR text extraction for a later, explicit ingestion step.

## Capabilities

### New Capabilities

- `site-search`: Native site-wide search UI, endpoint behavior, section-aware page indexing, visibility rules, suggestions, and import mapping for copied association sites.

### Modified Capabilities

- `database-schema`: Add protected search index storage, vectors, idempotent migrations, and sync/reindex primitives needed to query pages, resources, and events efficiently.

## Impact

- Affected schema: `schema.sql`, generated seed SQL, search index functions/triggers, and any deploy manifest/RLS/privilege configuration for new search storage.
- Affected UI: `src/pages/search.astro`, `src/lib/blocks.ts`, `src/lib/block-hydrators.ts`, styles, i18n strings, and header/global section rendering.
- Affected backend: a Run402 search function for search queries and autosuggest. Browser clients must not query `search_documents` directly unless the same visibility policy is enforced at the database layer.
- Affected data flows: page/section/resource/event create, update, visibility, and delete paths must keep searchable rows in sync, including generated seed/import reindexing.
- Tests should cover section-derived page matches, anonymous/active-member/inactive-member visibility, direct-table leak prevention, ranking basics, safe snippets, page-size caps, pagination, suggestions, resource URL safety, and Wild Apricot gadget mapping.

## Explicit V1 Non-Goals

- No OpenSearch/Elasticsearch/Meilisearch/Algolia dependency.
- No search inside uploaded PDF/DOCX/image bodies, and no OCR.
- No announcements/news/blog rows in v1 unless they were imported as normal pages/sections; native announcements need stable result URLs first.
- No forum search, member directory search, cross-language/translation-aware search, search analytics, synonyms, or fuzzy/trigram tuning in the initial slice.
