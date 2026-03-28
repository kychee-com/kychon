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
