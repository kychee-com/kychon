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
