// Seed type definitions. Each forkable Kychon project exports a `ProjectSeed`
// from src/seeds/{project}.ts; the generator turns the typed value into
// idempotent SQL written to ./seed.sql.

export type Zone = 'header' | 'main' | 'footer';
export type Scope = 'page' | 'global';
/** column-span-rows: fraction of a 6-col zone grid the block occupies on desktop. */
export type ColumnSpan = '1' | '1/2' | '1/3' | '2/3';

export interface SeedSection {
  /** `'*'` is a seed-time convention for "every page" (use with `scope: 'global'`). */
  page_slug: string;
  zone: Zone;
  scope: Scope;
  section_type: string;
  config: Record<string, unknown>;
  position: number;
  visible?: boolean;
  /** Width inside the 6-col zone grid. Defaults to `'1'` (full width) when unset. */
  column_span?: ColumnSpan;
}

export interface TierSeed {
  name: string;
  description?: string;
  benefits?: string[];
  price_label?: string;
  position: number;
  is_default?: boolean;
}

export interface MemberCustomFieldSeed {
  field_name: string;
  field_label: string;
  field_type: string;
  options?: unknown;
  required?: boolean;
  visible_in_directory?: boolean;
  position: number;
}

export interface PageSeed {
  slug: string;
  title: string;
  content?: string;
  requires_auth?: boolean;
  show_in_nav?: boolean;
  nav_position?: number;
  published?: boolean;
}

export interface SiteConfigEntry {
  /** JSONB value (object, array, string, number, boolean). */
  value: unknown;
  category?: string;
}

export interface ProjectSeed {
  /** Map of site_config rows, keyed by config key (no `nav` here — nav is a block). */
  site_config: Record<string, SiteConfigEntry | unknown>;
  sections: SeedSection[];
  membership_tiers?: TierSeed[];
  member_custom_fields?: MemberCustomFieldSeed[];
  pages?: PageSeed[];
  /**
   * Path to a hand-written SQL file (relative to repo root) appended verbatim
   * to the generated `seed.sql`. Used for demo content (members, sample
   * announcements, events) that doesn't belong in TS.
   */
  extraSqlFile?: string;
}
