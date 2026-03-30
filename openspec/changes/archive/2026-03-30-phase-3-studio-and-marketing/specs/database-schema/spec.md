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
