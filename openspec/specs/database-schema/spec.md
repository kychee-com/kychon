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

The system SHALL maintain typed seed modules under `src/seeds/{project}.ts` as the canonical source of default content for each forkable project. Each module SHALL export a `ProjectSeed` object describing `site_config`, `sections` (with `zone`, `scope`, `section_type`, `config`, `position`), `membership_tiers`, and default `pages`. The build pipeline SHALL generate `seed.sql` by running `scripts/generate-seed-sql.ts` against the active project's seed module (selected via `KYCHON_PROJECT` env var, defaulting to `'kychon'`) before `astro build`. The generated `seed.sql` SHALL be idempotent (`INSERT … ON CONFLICT DO NOTHING` for keyed rows; `INSERT … WHERE NOT EXISTS` for `sections` keyed on `(page_slug, zone, scope, section_type, position)`). The generated `seed.sql` SHALL be gitignored.

#### Scenario: Fresh deploy with seed data renders a functional site
- **WHEN** `schema.sql` and the generated `seed.sql` are executed in order against an empty database
- **THEN** `site_config` contains keys for `site_name`, `site_tagline`, `theme`, all `feature_*` flags
- **THEN** `sections` contains chrome blocks for header (`brand_header`, `nav`, `sign_in_bar`) at `zone='header', scope='global'`
- **THEN** `sections` contains a `footer_attribution` block at `zone='footer', scope='global'`
- **THEN** at least one `membership_tier` exists with `is_default = true`

#### Scenario: Seed data is idempotent
- **WHEN** `seed.sql` is executed twice against the same database
- **THEN** no duplicate `sections` rows are created
- **THEN** no duplicate `site_config` rows are created

#### Scenario: Seeds are TS, seed.sql is generated
- **WHEN** a developer wants to change a demo's default chrome
- **THEN** they edit `src/seeds/{demo}.ts`
- **WHEN** they run `npm run build`
- **THEN** `seed.sql` is regenerated from the updated module

#### Scenario: Type error blocks the build
- **WHEN** a seed module references a non-existent block type or violates `SeedSection` types
- **THEN** `tsx scripts/generate-seed-sql.ts` exits non-zero with the TS error before `astro build` runs

#### Scenario: `site_config.nav` is no longer seeded
- **WHEN** the generator emits `seed.sql` for any project
- **THEN** the resulting SQL does not insert a `site_config` row with `key = 'nav'`
- **THEN** navigation is instead expressed as a `nav` block in `sections`

### Requirement: Schema evolution uses safe ALTER patterns

The system SHALL use `DO $$ BEGIN ALTER TABLE ... ADD COLUMN ...; EXCEPTION WHEN duplicate_column THEN NULL; END $$;` for adding columns to existing tables, ensuring safe re-deploy.

#### Scenario: Adding a column to an existing table
- **WHEN** a new column is added to `schema.sql` and re-deployed
- **THEN** the column is added without error if it doesn't exist, and ignored if it already exists

### Requirement: `sections` carries `zone` and `scope` columns

The `sections` table SHALL include a `zone` column (`TEXT NOT NULL DEFAULT 'main' CHECK (zone IN ('header','main','footer'))`) and a `scope` column (`TEXT NOT NULL DEFAULT 'page' CHECK (scope IN ('page','global'))`). The schema SHALL define an index on `(zone, scope, page_slug, position)` to back the per-page query that fetches both page-scoped and global blocks in one round trip. Both columns SHALL be added via the project's idempotent ALTER pattern (`DO $$ BEGIN ALTER … EXCEPTION WHEN duplicate_column THEN NULL; END $$;`).

#### Scenario: Fresh deploy creates the columns
- **WHEN** `schema.sql` runs against an empty database
- **THEN** `sections` has `zone TEXT NOT NULL DEFAULT 'main'` with a CHECK constraint allowing only `'header'`, `'main'`, `'footer'`
- **THEN** `sections` has `scope TEXT NOT NULL DEFAULT 'page'` with a CHECK constraint allowing only `'page'`, `'global'`
- **THEN** an index `idx_sections_zone_scope_slug` exists on `(zone, scope, page_slug, position)`

#### Scenario: Re-deploy is idempotent
- **WHEN** `schema.sql` is run twice against the same database
- **THEN** no errors occur; existing rows preserve their `zone` and `scope` values

#### Scenario: A row violating the CHECK constraint is rejected
- **WHEN** an INSERT specifies `zone = 'sidebar'`
- **THEN** the database rejects the row with a CHECK violation

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
## Requirements
### Requirement: `sections.column_span` carries per-block column-span fraction

The `sections` table SHALL include a `column_span` column (`TEXT NOT NULL DEFAULT '1' CHECK (column_span IN ('1','1/2','1/3','2/3'))`). The column SHALL be added via the project's idempotent ALTER pattern (`DO $$ BEGIN ALTER … EXCEPTION WHEN duplicate_column THEN NULL; END $$;`). The four legal values represent fractional widths inside a 6-column zone grid: `'1'` = full width (6 cols), `'1/2'` = half width (3 cols), `'1/3'` = third width (2 cols), `'2/3'` = two-thirds width (4 cols).

#### Scenario: Fresh deploy creates the column

- **WHEN** `schema.sql` runs against an empty database
- **THEN** `sections` has `column_span TEXT NOT NULL DEFAULT '1'` with a CHECK constraint allowing only `'1'`, `'1/2'`, `'1/3'`, `'2/3'`

#### Scenario: Existing rows acquire the default on migration

- **WHEN** `schema.sql` runs against a database with existing `sections` rows
- **THEN** the ALTER adds the column with default `'1'`
- **THEN** every pre-existing row has `column_span = '1'`
- **THEN** zones render those rows full-width (the substrate's pre-change behavior)

#### Scenario: Re-deploy is idempotent

- **WHEN** `schema.sql` is run twice against the same database
- **THEN** no errors occur; existing rows preserve their `column_span` values

#### Scenario: A row violating the CHECK constraint is rejected

- **WHEN** an INSERT specifies `column_span = '1/4'`
- **THEN** the database rejects the row with a CHECK violation

### Requirement: `column_span` is not part of the seed-row identity tuple

The seed-SQL generator SHALL key idempotent `sections` inserts on `(page_slug, zone, scope, section_type, position)` only — NOT on `column_span`. Spans applied via seed updates SHALL emit a trailing `UPDATE sections SET column_span = '<value>' WHERE …` per row whose seed value differs from the column default. This keeps row identity stable while letting seed authors evolve spans across deploys.

#### Scenario: Seed sets a span on a previously default row

- **WHEN** an existing row has `(page_slug='index', zone='main', scope='page', section_type='announcements_feed', position=4)` and `column_span='1'`
- **WHEN** the seed module sets `column_span: '2/3'` on the matching `SeedSection`
- **WHEN** `tsx scripts/generate-seed-sql.ts` runs
- **THEN** the generated SQL emits an `UPDATE sections SET column_span='2/3' WHERE page_slug='index' AND zone='main' AND scope='page' AND section_type='announcements_feed' AND position=4`

#### Scenario: UPDATE is idempotent

- **WHEN** the same generated `seed.sql` is executed twice against the same database
- **THEN** the UPDATE runs both times but produces no observable change after the first

#### Scenario: Default `'1'` does not emit an UPDATE

- **WHEN** a `SeedSection` omits `column_span` (or explicitly sets it to `'1'`)
- **THEN** the generator does NOT emit an UPDATE for that row's span (the default value is correct on insert)

