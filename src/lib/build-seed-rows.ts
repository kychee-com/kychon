/**
 * Seed rows as a build-time data source (kychon#224).
 *
 * The build-time loaders (`build-sections`, `build-pages`, `build-events`,
 * `build-announcements`, `build-members`) normally read the deployed
 * project's database through the capability gateway. On a fresh project that
 * database is still empty when a free `deployMode: "check"` runs, so seeded
 * pages and sections never render and a render error in them (e.g. an
 * AssetRef with no `cdn_url`) surfaces only in the paid deploy's post-import
 * rebuild, after the initial release is already live.
 *
 * `runDeploy`'s check mode therefore loads `schema.sql` + the seed's initial
 * import into an in-process database, dumps the rows to a JSON file, and
 * builds once with `KYCHON_BUILD_SEED_ROWS` pointing at it. While it is set,
 * each loader answers from these rows instead of the gateway, applying the
 * same anonymous-caller visibility the gateway does (`functions/kychon-api.js`:
 * `visiblePage`, `visibleSection`, `visibleMembersOnly` and the row mappers).
 * That build is never published.
 */
import { readFileSync } from 'node:fs';

export const BUILD_SEED_ROWS_ENV = 'KYCHON_BUILD_SEED_ROWS';

export type SeedRow = Record<string, unknown>;

export interface BuildSeedRows {
  version: 1;
  tables: Partial<Record<SeedRowsTable, SeedRow[]>>;
}

export const SEED_ROWS_TABLES = ['pages', 'sections', 'events', 'announcements', 'members', 'membership_tiers'] as const;
export type SeedRowsTable = (typeof SEED_ROWS_TABLES)[number];

let cached: { path: string; rows: BuildSeedRows } | null = null;

/** The seed rows named by `KYCHON_BUILD_SEED_ROWS`, or null when unset. Throws on an unreadable file. */
export function readBuildSeedRows(): BuildSeedRows | null {
  const path = process.env[BUILD_SEED_ROWS_ENV]?.trim();
  if (!path) return null;
  if (cached?.path === path) return cached.rows;
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as BuildSeedRows;
  if (parsed?.version !== 1 || !parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error(`${BUILD_SEED_ROWS_ENV} (${path}) is not a version 1 seed-rows file`);
  }
  cached = { path, rows: parsed };
  return parsed;
}

function tableRows(rows: BuildSeedRows, table: SeedRowsTable): SeedRow[] {
  const list = rows.tables[table];
  return Array.isArray(list) ? list.map((row) => ({ ...row })) : [];
}

function omit(row: SeedRow, field: string): SeedRow {
  const { [field]: _omitted, ...rest } = row;
  return rest;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return String(a) < String(b) ? -1 : 1;
}

/** Published, ungated pages — what `pages.list` returns to the anon key. */
export function seedPages(rows: BuildSeedRows): SeedRow[] {
  return tableRows(rows, 'pages').filter((row) => row.published !== false && row.requires_auth !== true);
}

/** Visible, non-admin sections matching the equality filters — `sections.list` for the anon key. */
export function seedSections(rows: BuildSeedRows, filters: Record<string, unknown> = {}): SeedRow[] {
  return tableRows(rows, 'sections').filter(
    (row) =>
      row.visible !== false &&
      row.scope !== 'admin' &&
      Object.entries(filters).every(([field, value]) => row[field] === value),
  );
}

/** Public events by `starts_at`, without `created_by` — `events.list` for the anon key. */
export function seedEvents(rows: BuildSeedRows, limit: number): SeedRow[] {
  return tableRows(rows, 'events')
    .filter((row) => row.is_members_only !== true)
    .map((row) => omit(row, 'created_by'))
    .sort((a, b) => compare(a.starts_at, b.starts_at))
    .slice(0, limit);
}

/** Pinned first, then newest, without `author_id` — `announcements.list` for the anon key. */
export function seedAnnouncements(rows: BuildSeedRows, limit: number): SeedRow[] {
  return tableRows(rows, 'announcements')
    .map((row) => omit(row, 'author_id'))
    .sort((a, b) => Number(b.is_pinned === true) - Number(a.is_pinned === true) || compare(b.created_at, a.created_at))
    .slice(0, limit);
}

/**
 * Active members by name, in the anon projection — `members.list` for the anon
 * key. The gateway only answers that when the directory is public; the
 * caller (`ensureBuildMembersLoaded`) already gates on it.
 */
export function seedMembers(rows: BuildSeedRows, limit: number): SeedRow[] {
  return tableRows(rows, 'members')
    .filter((row) => row.status === 'active')
    .map(({ id, display_name, avatar_url, bio, tier_id, role }) => ({ id, display_name, avatar_url, bio, tier_id, role }))
    .sort((a, b) => compare(a.display_name, b.display_name))
    .slice(0, limit);
}

/** Membership tiers — `tiers.list`. */
export function seedTiers(rows: BuildSeedRows): SeedRow[] {
  return tableRows(rows, 'membership_tiers');
}
