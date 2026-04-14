## ADDED Requirements

### Requirement: Forum tables support moderation columns

The schema SHALL add `hidden` and `locked` boolean columns to `forum_topics` and a `hidden` column to `forum_replies` using safe ALTER migrations (DO block with EXCEPTION WHEN duplicate_column).

#### Scenario: Hidden column added to forum_topics
- **WHEN** schema migrations run
- **THEN** `forum_topics` has a `hidden BOOLEAN DEFAULT false` column
- **THEN** `forum_topics` has a `locked BOOLEAN DEFAULT false` column

#### Scenario: Hidden column added to forum_replies
- **WHEN** schema migrations run
- **THEN** `forum_replies` has a `hidden BOOLEAN DEFAULT false` column

#### Scenario: Migration is idempotent
- **WHEN** migrations run on a database that already has these columns
- **THEN** no errors occur

### Requirement: Full-text search index on forum

The schema SHALL add a `search_vector` tsvector column to `forum_topics` and a GIN index for full-text search.

#### Scenario: Search vector column exists
- **WHEN** schema migrations run
- **THEN** `forum_topics` has a `search_vector TSVECTOR` column with a GIN index
