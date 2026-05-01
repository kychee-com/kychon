## ADDED Requirements

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
