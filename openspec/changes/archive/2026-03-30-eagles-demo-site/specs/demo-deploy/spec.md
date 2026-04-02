## ADDED Requirements

### Requirement: Dedicated Run402 project

The demo SHALL be deployed to a separate Run402 project with its own project ID, database, and subdomain (`eagles.kychon.com`). The project SHALL be provisioned via `run402 projects provision` if it doesn't already exist.

#### Scenario: Demo project is provisioned
- **WHEN** the deploy script runs and no Eagles project exists
- **THEN** a new Run402 project SHALL be provisioned and its project ID recorded

#### Scenario: Demo project already exists
- **WHEN** the deploy script runs and the Eagles project already exists
- **THEN** the existing project SHALL be reused without re-provisioning

### Requirement: Deploy script generates and uploads images

The deploy script SHALL generate all required AI images (logo, hero, avatars, event photos), upload them to Run402 storage, and record the resulting URLs for use in the seed SQL.

#### Scenario: Images generated and uploaded
- **WHEN** the deploy script runs
- **THEN** all AI images SHALL be generated, uploaded to Run402 storage, and their URLs available for seed insertion

#### Scenario: Image generation is cached
- **WHEN** the deploy script runs and images already exist in storage
- **THEN** existing images SHALL be reused without regeneration

### Requirement: Deploy script runs schema + seed

The deploy script SHALL execute `schema.sql` (shared template schema) followed by `seed-eagles.sql` (Eagles-specific content) against the demo project's database.

#### Scenario: Fresh deploy creates all tables and content
- **WHEN** schema.sql and seed-eagles.sql are executed against an empty database
- **THEN** all tables SHALL be created and all Eagles content SHALL be populated

#### Scenario: Redeploy is idempotent
- **WHEN** the deploy script is run again on an already-populated database
- **THEN** no errors SHALL occur and no duplicate content SHALL be created

### Requirement: Deploy script reports friction

The deploy script SHALL log every Run402 CLI error, unexpected behavior, or workaround encountered during execution. These logs SHALL be appended to `docs/run402-feedback.md`.

#### Scenario: Friction is documented
- **WHEN** a Run402 error or unexpected behavior occurs during deployment
- **THEN** the issue SHALL be logged with context (command run, error message, workaround used)

### Requirement: All features enabled and testable

The deployed demo SHALL have all feature flags enabled (events, forum, directory, resources, committees, AI moderation, AI newsletter, AI translation, AI insights, AI onboarding, event recaps) so every feature is visible and testable.

#### Scenario: All features visible
- **WHEN** a user visits the demo site
- **THEN** navigation SHALL show all feature pages (directory, events, resources, forum, committees)

#### Scenario: AI features enabled
- **WHEN** an admin views the admin dashboard
- **THEN** AI sections (insights, moderation, newsletter) SHALL be visible
