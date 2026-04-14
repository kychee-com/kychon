## ADDED Requirements

### Requirement: Core tables exist with idempotent migrations

The system SHALL define all database tables in a single `schema.sql` file using `CREATE TABLE IF NOT EXISTS`. Tables SHALL be organized by feature section with comment markers. The schema SHALL include tables for: `site_config`, `pages`, `sections`, `membership_tiers`, `member_custom_fields`, `members`, `events`, `event_rsvps`, `resources`, `forum_categories`, `forum_topics`, `forum_replies`, `committees`, `committee_members`, `announcements`, `activity_log`, `content_translations`, `moderation_log`, `member_insights`, `newsletter_drafts`.

#### Scenario: Fresh deploy creates all tables
- **WHEN** `schema.sql` is executed against an empty database
- **THEN** all tables are created with correct columns, types, constraints, and foreign keys

#### Scenario: Re-deploy is idempotent
- **WHEN** `schema.sql` is executed against a database that already has all tables
- **THEN** no errors occur and existing data is preserved

### Requirement: Seed data provides working defaults

The system SHALL define seed data in a `seed.sql` file that populates `site_config` with default branding, theme, feature flags, and nav config. It SHALL insert default membership tiers and sample data sufficient for the site to render correctly on first deploy.

#### Scenario: Fresh deploy with seed data renders a functional site
- **WHEN** `schema.sql` and `seed.sql` are executed in order
- **THEN** `site_config` contains keys for `site_name`, `site_tagline`, `theme`, all `feature_*` flags, and `nav`
- **THEN** at least one `membership_tier` exists with `is_default = true`

#### Scenario: Seed data is idempotent
- **WHEN** `seed.sql` is executed twice
- **THEN** no duplicate rows are created (uses `ON CONFLICT` or `INSERT ... WHERE NOT EXISTS`)

### Requirement: Schema evolution uses safe ALTER patterns

The system SHALL use `DO $$ BEGIN ALTER TABLE ... ADD COLUMN ...; EXCEPTION WHEN duplicate_column THEN NULL; END $$;` for adding columns to existing tables, ensuring safe re-deploy.

#### Scenario: Adding a column to an existing table
- **WHEN** a new column is added to `schema.sql` and re-deployed
- **THEN** the column is added without error if it doesn't exist, and ignored if it already exists

<!-- Phase 2 additions -->
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

<!-- Phase 3 additions -->
## ADDED Requirements

### Requirement: Newsletter drafts table columns and constraints

The `newsletter_drafts` table SHALL include columns: `id` (SERIAL PRIMARY KEY), `subject` (TEXT NOT NULL), `body` (TEXT NOT NULL for AI-generated HTML), `status` (TEXT DEFAULT 'draft' — valid values: 'draft', 'approved', 'sent'), `period_start` (TIMESTAMPTZ), `period_end` (TIMESTAMPTZ), `sent_at` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ DEFAULT now()). The table creation SHALL use `CREATE TABLE IF NOT EXISTS` for idempotent deployment.

#### Scenario: Newsletter drafts table created on fresh deploy
- **WHEN** `schema.sql` is executed against an empty database
- **THEN** the `newsletter_drafts` table SHALL exist with all specified columns and constraints

#### Scenario: Newsletter drafts table creation is idempotent
- **WHEN** `schema.sql` is executed against a database that already has the `newsletter_drafts` table
- **THEN** no errors SHALL occur and existing data SHALL be preserved

### Requirement: Feature flags for newsletter and event recaps

The `site_config` seed data SHALL include `feature_newsletter` (default `true`) and `feature_event_recaps` (default `true`) boolean flags.

#### Scenario: Feature flags present after seed
- **WHEN** `seed.sql` is executed
- **THEN** `site_config` SHALL contain rows for `feature_newsletter` and `feature_event_recaps` with default value `true`

#### Scenario: Feature flag seed is idempotent
- **WHEN** `seed.sql` is executed twice
- **THEN** no duplicate `feature_newsletter` or `feature_event_recaps` rows SHALL be created

## ADDED Requirements

### Requirement: Reactions table

The schema SHALL include a `reactions` table with columns: `id` (SERIAL PRIMARY KEY), `content_type` (TEXT NOT NULL), `content_id` (INT NOT NULL), `member_id` (INT REFERENCES members(id)), `emoji` (TEXT NOT NULL), `created_at` (TIMESTAMPTZ DEFAULT now()). A UNIQUE constraint SHALL exist on `(content_type, content_id, member_id, emoji)`. The table creation SHALL use `CREATE TABLE IF NOT EXISTS`.

#### Scenario: Reactions table created on fresh deploy
- **WHEN** `schema.sql` is executed against an empty database
- **THEN** the `reactions` table SHALL exist with all specified columns and constraints

#### Scenario: Reactions table creation is idempotent
- **WHEN** `schema.sql` is executed against a database that already has the `reactions` table
- **THEN** no errors SHALL occur and existing data SHALL be preserved

#### Scenario: Unique constraint prevents duplicate reactions
- **WHEN** a row with `content_type = 'announcement'`, `content_id = 1`, `member_id = 5`, `emoji = 'like'` already exists
- **THEN** inserting another row with the same values SHALL fail with a unique constraint violation

### Requirement: Feature flags for activity feed and reactions

The `site_config` seed data SHALL include `feature_activity_feed` (default `true`) and `feature_reactions` (default `true`) boolean flags.

#### Scenario: Feature flags present after seed
- **WHEN** `seed.sql` is executed
- **THEN** `site_config` SHALL contain rows for `feature_activity_feed` and `feature_reactions` with default value `true`

#### Scenario: Feature flag seed is idempotent
- **WHEN** `seed.sql` is executed twice
- **THEN** no duplicate `feature_activity_feed` or `feature_reactions` rows SHALL be created

### Requirement: Activity feed homepage section in seed data

The seed data SHALL include a `sections` row with `section_type = 'activity_feed'` for the homepage, positioned after the announcements section. The `config` JSONB SHALL include `{ "limit": 15 }`.

#### Scenario: Activity feed section seeded
- **WHEN** `seed.sql` is executed
- **THEN** a `sections` row exists with `page_slug = 'index'`, `section_type = 'activity_feed'`, and appropriate `position`

#### Scenario: Activity feed section seed is idempotent
- **WHEN** `seed.sql` is executed twice
- **THEN** no duplicate `activity_feed` section rows are created
