## ADDED Requirements

### Requirement: section_translations table stores per-locale block config overrides

`schema.sql` SHALL define the `section_translations` table with the following columns: `id SERIAL PRIMARY KEY`, `section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE`, `language TEXT NOT NULL`, `config JSONB NOT NULL`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`. The table SHALL have a `UNIQUE(section_id, language)` constraint and an index on `(section_id, language)`. The definition SHALL use idempotent guards.

#### Scenario: section_translations table exists after schema apply

- **WHEN** `schema.sql` is applied to a fresh database
- **THEN** the `section_translations` table exists with all declared columns and constraints

#### Scenario: Only one translation row per (section, language) pair is allowed

- **WHEN** a second row is inserted with the same `section_id` and `language`
- **THEN** the INSERT raises a unique constraint violation (callers must use UPSERT)

#### Scenario: Deleting a sections row cascades to section_translations

- **WHEN** a `sections` row is deleted
- **THEN** all `section_translations` rows with that `section_id` are automatically deleted

### Requirement: Media metadata is platform-managed, not stored in Kychon's schema

Kychon SHALL NOT define a `media_assets` table (or any equivalent shadow table) for tracking uploaded media. Media metadata lives in Run402's `internal.blobs` via the v1.50 `metadata` JSONB column, with server-extracted intrinsics (`width_px`, `height_px`, `blurhash`, `image_format`, `image_info`, `image_exif`, `image_exif_policy`) populated by the platform at upload time.

This is a deliberate non-requirement on `schema.sql` to lock in the choice from design Decision 3 — if a future change attempts to add a `media_assets` table to Kychon, that change MUST first justify why the platform's `r.assets.list` + `metadata` JSONB is insufficient.

#### Scenario: schema.sql does NOT define media_assets

- **WHEN** `schema.sql` is applied to a fresh database
- **THEN** the `media_assets` table does NOT exist
- **AND** queries that join through `media_assets` would fail (they don't exist anywhere in the Kychon codebase by design)

#### Scenario: Pre-existing kychon portals stay consistent after deploy

- **WHEN** a Kychon portal upgrades from the pre-v1.50-storage era to this change
- **THEN** there is NO `media_assets` migration to run
- **AND** existing uploaded assets are visible via `r.assets.list` without any data movement
