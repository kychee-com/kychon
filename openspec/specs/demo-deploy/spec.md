## Purpose

Each Kychon demo portal deploys to its own Run402 project from a single parameterized script, so a demo can be rebuilt from an empty database without hand steps.

## Requirements

### Requirement: Dedicated Run402 project per demo

Every demo SHALL be deployed to its own Run402 project with its own project ID, database, and subdomain. `scripts/deploy-demo.ts` SHALL hold one `DemoConfig` per demo declaring its display name, project-id and anon-key env vars, subdomain, live URL, assets directory, `KYCHON_PROJECT` seed key, reset-function file, and reset cron schedule. The registered demos SHALL be `eagles` (`eagles.kychon.com`), `silver-pines` (`silver-pines.kychon.com`), and `barrio` (`barrio.kychon.com`).

#### Scenario: Demo deploys to its own project
- **WHEN** `scripts/deploy-demo.ts` runs for a named demo
- **THEN** it SHALL target the Run402 project identified by that demo's `projectIdEnvVar` and claim that demo's subdomain

#### Scenario: Unknown demo name is rejected
- **WHEN** the deploy script is invoked with a name not present in `DEMOS`
- **THEN** it SHALL exit with an error naming the valid demo keys

### Requirement: Demo reset schedules are staggered

Each demo's hourly reset SHALL run on a distinct cron minute so that three full wipe-and-reseed cycles never execute concurrently against the shared database writer. The schedule SHALL be declared in the demo's `DemoConfig`, passed to `scripts/generate-reset-function.js`, and read back out of the emitted `// schedule: "..."` directive at deploy time.

#### Scenario: Resets do not collide
- **WHEN** the three registered demos are deployed
- **THEN** their `resetSchedule` values SHALL be on different minutes of the hour

### Requirement: Deploy script assembles assets and seed

The deploy script SHALL copy the demo's `assetsDir` into `public/assets/` before the build, set `KYCHON_PROJECT` to the demo's `kychonProject` so the bake and the seed-SQL generator both read the same typed seed module under `src/seeds/{project}.ts`, and apply `schema.sql` followed by the generated seed.

#### Scenario: Fresh deploy creates all tables and content
- **WHEN** `schema.sql` and the generated seed are executed against an empty database
- **THEN** all tables SHALL be created and the demo's content SHALL be populated

#### Scenario: Redeploy is idempotent
- **WHEN** the deploy script runs again on an already-populated database
- **THEN** no errors SHALL occur and no duplicate content SHALL be created

### Requirement: Dry run validates without mutating

`deployOneDemo` SHALL accept a `dryRun` option that assembles and validates the deploy without mutating the Run402 project, and an `allowWarnings` option that continues past confirmation-required deploy warnings.

#### Scenario: Dry run leaves the project untouched
- **WHEN** the deploy script runs with `dryRun`
- **THEN** the bundle SHALL be assembled and validated and no Run402 mutation SHALL be issued

### Requirement: Demo features are enabled and testable

Each deployed demo SHALL enable the portal feature flags its seed declares (directory, events, announcements, resources, forum, committees) so every shipped feature is visible and testable from the public site.

#### Scenario: All seeded features visible
- **WHEN** a visitor loads a demo site
- **THEN** navigation SHALL show every feature page the demo's seed enables
