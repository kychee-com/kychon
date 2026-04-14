## ADDED Requirements

### Requirement: Single-command deploy to Run402

The system SHALL provide a `deploy.js` script that assembles a Run402 bundle deploy manifest (`app.json`) from project files and executes `run402 deploy --manifest app.json`. The manifest SHALL include `project_id` (from env or config), `migrations_file` pointing to `schema.sql`, RLS configuration, site files, edge functions, and subdomain.

#### Scenario: Deploy from clean checkout
- **WHEN** a developer runs `node deploy.js` with a valid Run402 project
- **THEN** the script reads all files under `site/`, all functions under `functions/`, `schema.sql`, and `seed.sql`
- **THEN** it assembles a valid `app.json` manifest and runs `run402 deploy --manifest app.json`
- **THEN** the site is accessible at `{subdomain}.run402.com`

#### Scenario: Re-deploy preserves existing data
- **WHEN** `node deploy.js` is run against a project that already has data
- **THEN** migrations are idempotent (no data loss), site files are updated, functions are redeployed
- **THEN** the subdomain automatically points to the new deployment

### Requirement: Deploy script reads project config

The deploy script SHALL read `project_id` from environment variable `RUN402_PROJECT_ID` or from `~/.config/run402/projects.json` (active project). The subdomain SHALL be configurable via environment variable `SUBDOMAIN` or default to the project name.

#### Scenario: Project ID from environment
- **WHEN** `RUN402_PROJECT_ID` is set and `node deploy.js` is run
- **THEN** the manifest uses that project ID

#### Scenario: Project ID from active project
- **WHEN** `RUN402_PROJECT_ID` is not set
- **THEN** the script uses the active project from `run402 projects list`

### Requirement: Deploy includes RLS configuration

The deploy manifest SHALL configure Row-Level Security: `user_owns_rows` for `members` (owner_column: `user_id`), `public_read` for config/content tables.

#### Scenario: RLS is applied on deploy
- **WHEN** the deploy completes
- **THEN** anonymous users can read `site_config`, `pages`, `sections`, `announcements`, `membership_tiers`
- **THEN** authenticated users can only update their own row in `members`
