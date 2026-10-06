/**
 * Content history (content-history, Phase 2): every write to a
 * tracked content table becomes a revision, grouped into one changeset per
 * transaction, with layered attribution. Runs against the real schema.sql.
 */
import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { wrapInitialImport } from '../../scripts/initial-import';
import { freshKychonDb, rows } from '../helpers/pglite-db';

const TRACKED: Array<[string, string, string]> = [
  // table, insert statement, primary-key column
  ['site_config', `INSERT INTO site_config (key, value, category) VALUES ('tagline', '"Hi"', 'branding')`, 'key'],
  ['pages', `INSERT INTO pages (slug, title) VALUES ('about', 'About')`, 'id'],
  [
    'sections',
    `INSERT INTO sections (page_slug, section_type, config, position) VALUES ('index', 'hero', '{}', 1)`,
    'id',
  ],
  ['events', `INSERT INTO events (title, starts_at) VALUES ('Picnic', now())`, 'id'],
  ['announcements', `INSERT INTO announcements (title, body) VALUES ('News', 'Body')`, 'id'],
  ['resources', `INSERT INTO resources (title) VALUES ('Handbook')`, 'id'],
  ['committees', `INSERT INTO committees (name) VALUES ('Board')`, 'id'],
  ['membership_tiers', `INSERT INTO membership_tiers (name, position) VALUES ('Gold', 1)`, 'id'],
  [
    'member_custom_fields',
    `INSERT INTO member_custom_fields (field_name, field_label, field_type, position) VALUES ('car', 'Car', 'text', 1)`,
    'id',
  ],
  ['polls', `INSERT INTO polls (question) VALUES ('Where?')`, 'id'],
  ['forum_categories', `INSERT INTO forum_categories (name, position) VALUES ('General', 1)`, 'id'],
];

let db: PGlite;
beforeEach(async () => {
  db = await freshKychonDb();
});

async function revisions(table?: string) {
  return rows<{
    table_name: string;
    op: string;
    row_key: Record<string, unknown>;
    before: unknown;
    after: unknown;
    changeset_id: number;
  }>(
    db,
    `SELECT table_name, op, row_key, before, after, changeset_id FROM revisions ${table ? 'WHERE table_name = $1' : ''} ORDER BY id`,
    table ? [table] : [],
  );
}

describe('revision log', () => {
  it.each(
    TRACKED,
  )('records insert, update and delete on %s with full before/after rows', async (table, insert, key) => {
    const [inserted] = await rows<Record<string, unknown>>(db, `${insert} RETURNING *`);
    const id = inserted[key];
    const where = `${key} = ${typeof id === 'string' ? `'${id}'` : id}`;
    // A column every tracked table has a value we can flip without constraints.
    await db.exec(`UPDATE ${table} SET ${key} = ${key} WHERE ${where}`); // no-op: must not record
    const touch =
      table === 'site_config'
        ? `UPDATE site_config SET value = '"Hello"' WHERE ${where}`
        : `UPDATE ${table} SET ${['pages', 'events', 'announcements', 'resources'].includes(table) ? "title = title || '!'" : table === 'sections' ? 'position = position + 1' : table === 'polls' ? "question = question || '?'" : table === 'member_custom_fields' ? "field_label = field_label || '!'" : "name = name || '!'"} WHERE ${where}`;
    await db.exec(touch);
    await db.exec(`DELETE FROM ${table} WHERE ${where}`);

    const revs = await revisions(table);
    expect(revs.map((r) => r.op)).toEqual(['insert', 'update', 'delete']);
    expect(revs[0].before).toBeNull();
    expect(revs[0].after).toMatchObject({ [key]: id });
    expect(revs[1].before).not.toEqual(revs[1].after);
    expect(revs[2].after).toBeNull();
    expect(revs.every((r) => r.row_key[key] === id)).toBe(true);
  });

  it('does not record untracked tables (member data, member activity)', async () => {
    await db.exec(`INSERT INTO members (email, display_name) VALUES ('a@b.c', 'A')`);
    await db.exec(`INSERT INTO activity_log (action) VALUES ('signup')`);
    expect(await revisions()).toEqual([]);
  });

  it('groups one transaction into one changeset and separate transactions into separate ones', async () => {
    await db.exec(`BEGIN; ${TRACKED[1][1]}; ${TRACKED[2][1]}; COMMIT;`);
    await db.exec(TRACKED[3][1]);
    const sets = await rows<{ changeset_id: number; n: number }>(
      db,
      'SELECT changeset_id, count(*)::int AS n FROM revisions GROUP BY changeset_id ORDER BY changeset_id',
    );
    expect(sets.map((s) => s.n)).toEqual([2, 1]);
  });
});

describe('attribution', () => {
  it('records anonymous SQL as unattributed', async () => {
    await db.exec(TRACKED[1][1]);
    expect(await rows(db, 'SELECT actor_type, label FROM changesets')).toEqual([
      { actor_type: 'unattributed', label: null },
    ]);
  });

  it('attributes a PostgREST JWT caller from its claims', async () => {
    await db.exec(
      `BEGIN; SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"user-1"}', true); ${TRACKED[1][1]}; COMMIT;`,
    );
    expect(await rows(db, 'SELECT actor_type, actor_id FROM changesets')).toEqual([
      { actor_type: 'jwt', actor_id: 'user-1' },
    ]);
  });

  it('lets agent SQL label its own transaction', async () => {
    await db.exec(
      `BEGIN; ${TRACKED[2][1]}; SELECT kychon_label_changeset('agent', 'kychon-pro', 'Restyle hero'); COMMIT;`,
    );
    expect(await rows(db, 'SELECT actor_type, actor_id, label FROM changesets')).toEqual([
      { actor_type: 'agent', actor_id: 'kychon-pro', label: 'Restyle hero' },
    ]);
  });

  it('lets kychon-api claim a write by the txid it returned', async () => {
    const [{ txid }] = await rows<{ txid: string }>(
      db,
      `INSERT INTO pages (slug, title) VALUES ('join', 'Join') RETURNING txid_current()::text AS txid`,
    );
    const [{ id }] = await rows<{ id: number }>(
      db,
      `SELECT kychon_claim_changeset($1::bigint, 'admin', 'user-9', 'pages.update', 42) AS id`,
      [txid],
    );
    expect(id).not.toBeNull();
    expect(await rows(db, 'SELECT actor_type, actor_id, label, capability_execution_id FROM changesets')).toEqual([
      { actor_type: 'admin', actor_id: 'user-9', label: 'pages.update', capability_execution_id: 42 },
    ]);
  });

  it('claiming a transaction that changed nothing tracked returns null', async () => {
    const [{ id }] = await rows<{ id: number | null }>(
      db,
      `SELECT kychon_claim_changeset(1, 'admin', 'u', 'x', NULL) AS id`,
    );
    expect(id).toBeNull();
  });
});

describe('initial import and migrations', () => {
  it('records the whole initial import as one system changeset labelled "Initial import"', async () => {
    const seed = `${TRACKED[1][1]};\n${TRACKED[2][1]};\nINSERT INTO site_config (key, value, category) VALUES ('site_name', '"X"', 'branding');`;
    await db.exec(`BEGIN; ${wrapInitialImport(seed, { source: 'seed.sql' })} COMMIT;`);
    expect(await rows(db, 'SELECT actor_type, label FROM changesets')).toEqual([
      { actor_type: 'system', label: 'Initial import' },
    ]);
    expect((await revisions()).length).toBe(3);
  });

  it('labels schema backfills on a later migration as the engine, and only when something changed', async () => {
    const before = (await rows(db, 'SELECT count(*)::int AS n FROM changesets'))[0];
    await db.exec(`SELECT kychon_label_changeset('system', NULL, 'Engine migration', true);`);
    expect((await rows(db, 'SELECT count(*)::int AS n FROM changesets'))[0]).toEqual(before);
    await db.exec(
      `BEGIN; DELETE FROM site_config WHERE key = 'languages_enabled'; SELECT kychon_label_changeset('system', NULL, 'Engine migration', true); COMMIT;`,
    );
    expect(await rows(db, `SELECT actor_type, label FROM changesets ORDER BY id DESC LIMIT 1`)).toEqual([
      { actor_type: 'system', label: 'Engine migration' },
    ]);
  });
});

describe('retention (kychon_prune_history)', () => {
  async function backdate(days: number) {
    await db.exec(`UPDATE revisions SET created_at = now() - interval '${days} days'`);
    await db.exec(`UPDATE changesets SET created_at = now() - interval '${days} days'`);
  }

  it('defaults history_retention_days to 365 under a non-public category', async () => {
    expect(await rows(db, `SELECT value, category FROM site_config WHERE key = 'history_retention_days'`)).toEqual([
      { value: 365, category: 'history' },
    ]);
  });

  it('deletes old revisions but always keeps the newest revision of each row, then empty changesets', async () => {
    await db.exec(`INSERT INTO pages (slug, title) VALUES ('about', 'v1')`);
    await db.exec(`UPDATE pages SET title = 'v2' WHERE slug = 'about'`);
    await db.exec(`INSERT INTO pages (slug, title) VALUES ('join', 'only')`);
    await backdate(400);
    await db.exec(`UPDATE pages SET title = 'v3' WHERE slug = 'about'`); // recent

    const [{ summary }] = await rows<{ summary: Record<string, number> }>(
      db,
      'SELECT kychon_prune_history() AS summary',
    );
    expect(summary).toMatchObject({ retention_days: 365 });

    const left = await rows<{ title: string | null }>(
      db,
      `SELECT r.after ->> 'title' AS title FROM revisions r WHERE r.table_name = 'pages' ORDER BY r.id`,
    );
    // about: v1/v2 pruned (old, superseded), v3 kept; join: its only revision kept although old.
    expect(left.map((r) => r.title)).toEqual(['only', 'v3']);
    const orphans = await rows(
      db,
      'SELECT c.id FROM changesets c WHERE NOT EXISTS (SELECT 1 FROM revisions r WHERE r.changeset_id = c.id)',
    );
    expect(orphans).toEqual([]);
  });

  it('honours a custom retention period', async () => {
    await db.exec(`UPDATE site_config SET value = '30' WHERE key = 'history_retention_days'`);
    await db.exec(`INSERT INTO pages (slug, title) VALUES ('about', 'v1')`);
    await db.exec(`UPDATE pages SET title = 'v2' WHERE slug = 'about'`);
    await backdate(45);
    await db.exec(`UPDATE pages SET title = 'v3' WHERE slug = 'about'`);
    const [{ summary }] = await rows<{ summary: Record<string, number> }>(
      db,
      'SELECT kychon_prune_history() AS summary',
    );
    expect(summary.retention_days).toBe(30);
    expect(summary.revisions).toBeGreaterThanOrEqual(2);
  });
});

describe('install record', () => {
  it('pins the SHA-256 of each imported /assets reference', async () => {
    const seed = `INSERT INTO sections (page_slug, section_type, config, position) VALUES ('index', 'hero', '{"bg_image":"/assets/Home.jpg"}', 1);`;
    await db.exec(
      `BEGIN; ${wrapInitialImport(seed, { source: 'seed.sql', assets: { 'Home.jpg': 'd'.repeat(64) } })} COMMIT;`,
    );
    expect(await rows(db, 'SELECT import_source, import_assets FROM kychon_install')).toEqual([
      { import_source: 'seed.sql', import_assets: { 'Home.jpg': 'd'.repeat(64) } },
    ]);
  });
});
