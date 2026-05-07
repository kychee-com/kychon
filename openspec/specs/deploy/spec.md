## Purpose

Kychon deployments are packaged as Run402 manifests that include static site files, database migrations, seed data, edge functions, RLS policy configuration, scheduled jobs, and project targeting so a developer can deploy or redeploy a portal predictably.
## Requirements
### Requirement: Single-command deploy to Run402

The system SHALL provide a deploy entry point that builds the Astro project, assembles a Run402 deploy payload from project files, and deploys it to Run402.

The deploy flow SHALL:
1. Run `npx astro build` to generate static output in `dist/`
2. Resolve project ID from `RUN402_PROJECT_ID` or the active Run402 project
3. Resolve `anon_key` from `ANON_KEY` or Run402 project keys
4. Generate `dist/js/env.js` with `__KYCHON_API` and `__KYCHON_ANON_KEY`
5. Read `schema.sql` and seed SQL as deploy migrations
6. Collect all files from `dist/` recursively
7. Collect edge functions from `functions/` with schedule parsing
8. Include RLS configuration and subdomain targeting
9. Execute the Run402 deploy

#### Scenario: Deploy from clean checkout
- **WHEN** a developer runs the deploy entry point with a valid Run402 project
- **THEN** Astro build completes first, producing `dist/` with static HTML, JavaScript, and CSS
- **THEN** the script reads all files under `dist/`, all functions under `functions/`, `schema.sql`, and seed SQL
- **THEN** it assembles and executes a valid Run402 deploy
- **THEN** the site is accessible at `{subdomain}.run402.com`

#### Scenario: Build failure stops deploy
- **WHEN** Astro build fails
- **THEN** the deploy exits with a non-zero exit code
- **AND** no Run402 deploy is executed
- **AND** the Astro error is printed for debugging

#### Scenario: Re-deploy preserves existing data
- **WHEN** the deploy entry point is run against a project that already has data
- **THEN** migrations are idempotent (no data loss), site files are updated, functions are redeployed
- **THEN** the subdomain automatically points to the new deployment

### Requirement: Deploy script reads project config

The deploy script SHALL read `project_id` from environment variable `RUN402_PROJECT_ID` or from `~/.config/run402/projects.json` (active project). The deploy script SHALL require `SUBDOMAIN` to be set explicitly and SHALL fail before deploying when `SUBDOMAIN` is unset or blank.

#### Scenario: Project ID from environment
- **WHEN** `RUN402_PROJECT_ID` is set and the deploy entry point is run
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

<!-- Phase 2 additions -->

### Requirement: Deploy includes scheduled functions with cron

The deploy manifest SHALL include all edge functions with their cron schedules parsed from `// schedule:` comments. For demo site deploys, the manifest SHALL include `reset-demo.js` with schedule `"0 * * * *"` and SHALL exclude `check-expirations.js` (irrelevant for demo sites: no real members, no real emails, data resets hourly). This swap keeps each demo project within the prototype tier's 1-scheduled-function limit.

#### Scenario: Demo deploy includes reset function
- **WHEN** a demo deploy script runs (e.g., `demo/silver-pines/deploy.sh`)
- **THEN** the manifest includes `reset-demo.js` with schedule `"0 * * * *"`
- **AND** the manifest does NOT include `check-expirations.js`

#### Scenario: Production deploy unchanged
- **WHEN** the main `deploy.js` runs for a production portal
- **THEN** the manifest includes `check-expirations.js` and any other scheduled functions as before
- **AND** `reset-demo.js` is NOT included (it lives in `demo/` directory, not `functions/`)

### Requirement: Deploy includes RLS for new tables

The deploy manifest RLS configuration SHALL include the new tables: `events`, `event_rsvps`, `resources`, `forum_categories`, `forum_topics`, `forum_replies`, `committees`, `committee_members`.

#### Scenario: New tables have RLS
- **WHEN** the deploy completes
- **THEN** new content tables have `public_read` RLS applied
