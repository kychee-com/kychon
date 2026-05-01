/**
 * Generate seed.sql from the active project's typed seed module.
 *
 * Reads `KYCHON_PROJECT` (default `kychon`), loads `src/seeds/{project}.ts`,
 * and writes idempotent SQL to `./seed.sql` at repo root.
 *
 * Usage:
 *   tsx scripts/generate-seed-sql.ts                       # writes seed.sql
 *   tsx scripts/generate-seed-sql.ts --dry-run             # validate without writing
 *   KYCHON_PROJECT=eagles tsx scripts/generate-seed-sql.ts # per-project
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getActiveProjectSeed } from '../src/seeds/index.ts';
import type {
  MemberCustomFieldSeed,
  PageSeed,
  ProjectSeed,
  SeedSection,
  SiteConfigEntry,
  TierSeed,
} from '../src/seeds/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function escSql(s: string): string {
  return String(s).replace(/'/g, "''");
}

function jsonbLiteral(value: unknown): string {
  // PostgreSQL JSONB literal: 'json-text'::jsonb (we emit it without ::jsonb
  // since the column type already coerces, matching the existing seed style).
  return `'${escSql(JSON.stringify(value))}'`;
}

function isEntry(v: unknown): v is SiteConfigEntry {
  return (
    typeof v === 'object' &&
    v !== null &&
    'value' in (v as Record<string, unknown>)
  );
}

function emitSiteConfig(siteConfig: Record<string, unknown>): string {
  const rows: string[] = [];
  for (const [key, raw] of Object.entries(siteConfig)) {
    if (key === 'nav') {
      throw new Error(
        `site_config.nav is no longer seeded — express the nav as a 'nav' block in zone='header'.`,
      );
    }
    let value: unknown;
    let category = 'general';
    if (isEntry(raw)) {
      value = raw.value;
      if (raw.category) category = raw.category;
    } else {
      value = raw;
    }
    rows.push(
      `  ('${escSql(key)}', ${jsonbLiteral(value)}, '${escSql(category)}')`,
    );
  }
  if (rows.length === 0) return '';
  return [
    '-- site_config',
    `INSERT INTO site_config (key, value, category) VALUES`,
    rows.join(',\n'),
    `ON CONFLICT (key) DO NOTHING;`,
    '',
  ].join('\n');
}

function emitTiers(tiers: TierSeed[]): string {
  if (!tiers.length) return '';
  const out = ['-- membership_tiers'];
  for (const t of tiers) {
    const benefitsArr = (t.benefits || [])
      .map((b) => `'${escSql(b)}'`)
      .join(', ');
    const description = t.description ? `'${escSql(t.description)}'` : 'NULL';
    const priceLabel = t.price_label ? `'${escSql(t.price_label)}'` : 'NULL';
    const isDefault = t.is_default ? 'true' : 'false';
    out.push(
      `INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)`,
    );
    out.push(
      `SELECT '${escSql(t.name)}', ${description}, ARRAY[${benefitsArr}]::text[], ${priceLabel}, ${t.position}, ${isDefault}`,
    );
    out.push(
      `WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = '${escSql(t.name)}');`,
    );
  }
  out.push('');
  return out.join('\n');
}

function emitCustomFields(fields: MemberCustomFieldSeed[]): string {
  if (!fields.length) return '';
  const out = ['-- member_custom_fields'];
  for (const f of fields) {
    const opts = f.options !== undefined ? jsonbLiteral(f.options) : 'NULL';
    const required = f.required ? 'true' : 'false';
    const visible = f.visible_in_directory !== false ? 'true' : 'false';
    out.push(
      `INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)`,
    );
    out.push(
      `SELECT '${escSql(f.field_name)}', '${escSql(f.field_label)}', '${escSql(f.field_type)}', ${opts}, ${required}, ${visible}, ${f.position}`,
    );
    out.push(
      `WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = '${escSql(f.field_name)}');`,
    );
  }
  out.push('');
  return out.join('\n');
}

function emitPages(pages: PageSeed[]): string {
  if (!pages.length) return '';
  const out = ['-- pages'];
  for (const p of pages) {
    const content = p.content !== undefined ? `'${escSql(p.content)}'` : 'NULL';
    const requiresAuth = p.requires_auth ? 'true' : 'false';
    const showInNav = p.show_in_nav ? 'true' : 'false';
    const navPosition = p.nav_position != null ? String(p.nav_position) : 'NULL';
    const published = p.published !== false ? 'true' : 'false';
    out.push(
      `INSERT INTO pages (slug, title, content, requires_auth, show_in_nav, nav_position, published)`,
    );
    out.push(
      `SELECT '${escSql(p.slug)}', '${escSql(p.title)}', ${content}, ${requiresAuth}, ${showInNav}, ${navPosition}, ${published}`,
    );
    out.push(
      `WHERE NOT EXISTS (SELECT 1 FROM pages WHERE slug = '${escSql(p.slug)}');`,
    );
  }
  out.push('');
  return out.join('\n');
}

function emitSections(sections: SeedSection[]): string {
  if (!sections.length) return '';
  const out = [
    '-- sections (chrome + main blocks).',
    "-- Idempotent on (page_slug, zone, scope, section_type, position).",
  ];
  const spanUpdates: string[] = [];
  for (const s of sections) {
    const visible = s.visible !== false ? 'true' : 'false';
    const span = s.column_span ?? '1';
    out.push(
      `INSERT INTO sections (page_slug, zone, scope, section_type, config, position, visible, column_span)`,
    );
    out.push(
      `SELECT '${escSql(s.page_slug)}', '${escSql(s.zone)}', '${escSql(s.scope)}', '${escSql(s.section_type)}', ${jsonbLiteral(s.config)}, ${s.position}, ${visible}, '${escSql(span)}'`,
    );
    out.push(
      `WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = '${escSql(s.page_slug)}' AND zone = '${escSql(s.zone)}' AND scope = '${escSql(s.scope)}' AND section_type = '${escSql(s.section_type)}' AND position = ${s.position});`,
    );
    // column-span-rows: re-assert the seed's span on existing rows (the
    // INSERT…WHERE NOT EXISTS skips rows that already exist, so without an
    // UPDATE pass a span change in the seed wouldn't propagate to deployed DBs).
    // Skip the default — fresh inserts already carry '1'.
    if (span !== '1') {
      spanUpdates.push(
        `UPDATE sections SET column_span = '${escSql(span)}' WHERE page_slug = '${escSql(s.page_slug)}' AND zone = '${escSql(s.zone)}' AND scope = '${escSql(s.scope)}' AND section_type = '${escSql(s.section_type)}' AND position = ${s.position};`,
      );
    }
  }
  if (spanUpdates.length) {
    out.push('-- column-span-rows: re-assert spans on rows that pre-existed the seed change.');
    out.push(...spanUpdates);
  }
  out.push('');
  return out.join('\n');
}

const NAV_CLEANUP_SQL = [
  '-- composable-layout: clear legacy site_config.nav row.',
  '-- nav is now a block (see sections above); this guards against stale DBs',
  '-- and against any extraSqlFile that still inserts the legacy row.',
  "DELETE FROM site_config WHERE key = 'nav';",
  '',
].join('\n');

export function generateSeedSql(seed: ProjectSeed, root: string = ROOT): string {
  const header = [
    '-- ============================================',
    `-- Kychon — Generated Seed Data (idempotent)`,
    `-- DO NOT EDIT BY HAND. Edit src/seeds/{project}.ts and re-run`,
    `--   tsx scripts/generate-seed-sql.ts`,
    '-- ============================================',
    '',
  ].join('\n');

  const parts = [
    header,
    emitSiteConfig(seed.site_config as Record<string, unknown>),
    emitTiers(seed.membership_tiers || []),
    emitCustomFields(seed.member_custom_fields || []),
    emitPages(seed.pages || []),
    emitSections(seed.sections || []),
  ];

  if (seed.extraSqlFile) {
    const path = join(root, seed.extraSqlFile);
    if (!existsSync(path)) {
      throw new Error(`extraSqlFile not found: ${path}`);
    }
    const extra = readFileSync(path, 'utf-8');
    parts.push(
      `-- Appended from ${seed.extraSqlFile}`,
      extra,
      '',
    );
  }

  // Trailing nav cleanup runs LAST so it scrubs any nav row a stale demo
  // seed.sql might have re-inserted above.
  parts.push(NAV_CLEANUP_SQL);

  return parts.filter(Boolean).join('\n');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const project = process.env.KYCHON_PROJECT || 'kychon';
  process.stdout.write(`Generating seed.sql for project: ${project}\n`);

  const seed = await getActiveProjectSeed();
  const sql = generateSeedSql(seed);

  if (dryRun) {
    process.stdout.write(`[dry-run] Would write ${sql.length} bytes to ./seed.sql\n`);
    return;
  }

  const target = join(ROOT, 'seed.sql');
  writeFileSync(target, sql, 'utf-8');
  process.stdout.write(`Wrote ${sql.length} bytes to ${target}\n`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error('generate-seed-sql failed:', err);
    process.exit(1);
  });
}
