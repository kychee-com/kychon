## MODIFIED Requirements

### Requirement: Core tables exist with idempotent migrations

The system SHALL define all database tables in a single `schema.sql` file using `CREATE TABLE IF NOT EXISTS`. Tables SHALL be organized by feature section with comment markers. The schema SHALL include tables for: `site_config`, `pages`, `sections`, `membership_tiers`, `member_custom_fields`, `members`, `events`, `event_rsvps`, `resources`, `search_documents`, `forum_categories`, `forum_topics`, `forum_replies`, `committees`, `committee_members`, `announcements`, `polls`, `poll_options`, `poll_votes`, `reactions`, `activity_log`, `content_translations`, `moderation_log`, `member_insights`, `newsletter_drafts`.

#### Scenario: Fresh deploy creates all tables
- **WHEN** `schema.sql` is executed against an empty database
- **THEN** all tables are created with correct columns, types, constraints, and foreign keys

#### Scenario: Re-deploy is idempotent
- **WHEN** `schema.sql` is executed against a database that already has all tables
- **THEN** no errors occur and existing data is preserved

## ADDED Requirements

### Requirement: Search documents table supports native search

The schema SHALL include a `search_documents` table for normalized site search rows. Each row SHALL include an id, `source_type`, `source_key`, `title`, `body`, `url`, `is_members_only`, `published`, `title_vector`, `search_vector`, `created_at`, and `updated_at`. The schema SHALL constrain `source_type` to supported v1 search sources: `page`, `resource`, and `event`. The schema SHALL enforce uniqueness for a source row by `source_type` and `source_key`.

#### Scenario: Fresh deploy creates search documents table
- **WHEN** `schema.sql` is executed against an empty database
- **THEN** `search_documents` exists with the columns needed to index pages, resources, and events
- **THEN** `source_type` rejects unsupported values

#### Scenario: Page source key uses slug
- **WHEN** a search document represents page slug `about`
- **THEN** it stores `source_type = 'page'` and `source_key = 'about'`

#### Scenario: Resource source key uses text id
- **WHEN** a search document represents resource id `42`
- **THEN** it stores `source_type = 'resource'` and `source_key = '42'`

#### Scenario: Unique source rows prevent duplicates
- **WHEN** a search document already exists for `source_type = 'page'` and `source_key = 'about'`
- **THEN** inserting another search document with the same source tuple fails or is handled through an upsert path

#### Scenario: Search table migration is idempotent
- **WHEN** `schema.sql` is executed twice against the same database
- **THEN** the `search_documents` table, constraints, and existing rows are preserved

### Requirement: Search documents table has full-text indexes

The schema SHALL define PostgreSQL full-text vectors for `search_documents`: `title_vector` for title-only autosuggest and `search_vector` for full search with title terms weighted above body terms. The schema SHALL define GIN indexes for both vectors and supporting indexes for published status, member visibility, source type, updated ordering, and source tuple lookup.

#### Scenario: Full-text indexes exist
- **WHEN** `schema.sql` is executed
- **THEN** a GIN index exists for `search_documents.search_vector`
- **THEN** a GIN index exists for `search_documents.title_vector`

#### Scenario: Visibility indexes exist
- **WHEN** `schema.sql` is executed
- **THEN** indexes exist that support filtering by `published`, `is_members_only`, and `source_type`

#### Scenario: Source tuple index exists
- **WHEN** `schema.sql` is executed
- **THEN** a unique index or constraint exists for `source_type` and `source_key`

#### Scenario: Weighted vector ranks titles first
- **WHEN** a title contains a query term and another document contains the same term only in body text
- **THEN** the search vector supports ranking the title match higher

### Requirement: Search document access is protected

The schema and deployment configuration SHALL prevent browser clients from reading all `search_documents` rows directly unless equivalent row-level visibility policies are enforced at the database layer. Members-only titles, bodies, snippets, and URLs SHALL NOT be exposed through unauthenticated direct table access.

#### Scenario: Anonymous direct table access is denied or filtered
- **WHEN** an anonymous browser client attempts to select `search_documents` directly
- **THEN** the request is denied or returns only public visible rows allowed by the same search visibility policy

#### Scenario: Members-only search rows are not public
- **WHEN** a `search_documents` row has `is_members_only = true`
- **THEN** unauthenticated direct table access does not expose its title, body, snippet source text, or URL

### Requirement: Search sync functions are idempotent

The schema SHALL define idempotent database functions or equivalent migration-safe primitives to upsert page, resource, and event search documents and to rebuild the full search index. The sync primitives SHALL be safe to run repeatedly and SHALL remove or mark stale documents unpublished when source rows are deleted or no longer searchable.

#### Scenario: Page sync function exists
- **WHEN** schema migrations run
- **THEN** a sync primitive exists that can rebuild the page search document for a page slug from `pages` and visible page-scoped `sections`

#### Scenario: Resource sync function exists
- **WHEN** schema migrations run
- **THEN** a sync primitive exists that can rebuild a resource search document from resource metadata

#### Scenario: Event sync function exists
- **WHEN** schema migrations run
- **THEN** a sync primitive exists that can rebuild an event search document from an event row

#### Scenario: Reindex function is repeatable
- **WHEN** the full reindex primitive runs twice against the same content
- **THEN** it does not create duplicate search documents
- **THEN** it preserves the unique source tuple for each searchable source row
