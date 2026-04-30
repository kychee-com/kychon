## ADDED Requirements

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

## MODIFIED Requirements

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
