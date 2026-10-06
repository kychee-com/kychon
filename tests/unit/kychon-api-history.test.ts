/**
 * Content-history attribution end to end: the real kychon-api function writing
 * to the real schema.sql (PGlite), so the row triggers, the txid RETURNING and
 * kychon_claim_changeset all run for real.
 */
import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';
import { pgliteAdminDb } from '../helpers/pglite-admin-db';
import { freshKychonDb, rows } from '../helpers/pglite-db';

const state = vi.hoisted(() => ({
  db: null as null | ReturnType<typeof import('../helpers/pglite-admin-db').pgliteAdminDb>,
  user: null as null | { id: string; email?: string },
}));

vi.mock(
  '@run402/functions',
  () => ({
    adminDb: () => state.db,
    auth: { user: async () => state.user },
    events: { emit: async () => ({ deduplicated: false }) },
  }),
  { virtual: true },
);

const { default: kychonApi } = await import('../../functions/kychon-api.js');

let db: PGlite;
beforeEach(async () => {
  db = await freshKychonDb();
  state.db = pgliteAdminDb(db);
  await db.exec(`
    INSERT INTO members (user_id, email, display_name, role, status) VALUES
      ('11111111-1111-4111-8111-111111111111', 'admin@example.org', 'Admin', 'admin', 'active'),
      ('22222222-2222-4222-8222-222222222222', 'member@example.org', 'Member', 'member', 'active');
  `);
  // Ignore history from fixture setup.
  await db.exec('TRUNCATE revisions, changesets');
});

async function execute(operation: string, input: Record<string, unknown>, key: string) {
  const res = await kychonApi(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KYCHON_API_VERSION,
        operation,
        phase: 'execute',
        confirmed: true,
        idempotencyKey: key,
        input,
      }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

describe('kychon-api content history attribution', () => {
  it('claims an admin write: actor, operation label and capability execution', async () => {
    state.user = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };
    const res = await execute('announcements.publish', { title: 'Picnic', body: '<p>Saturday</p>' }, 'k1');
    expect(res.status).toBe(200);

    const sets = await rows<Record<string, unknown>>(
      db,
      `SELECT c.actor_type, c.actor_id, c.label, c.capability_execution_id IS NOT NULL AS linked
         FROM changesets c JOIN revisions r ON r.changeset_id = c.id
        WHERE r.table_name = 'announcements'`,
    );
    expect(sets).toEqual([
      {
        actor_type: 'admin',
        actor_id: '11111111-1111-4111-8111-111111111111',
        label: 'announcements.publish',
        linked: true,
      },
    ]);
  });

  it('records site_config edits through config.set with before/after values', async () => {
    state.user = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };
    await db.exec(`INSERT INTO site_config (key, value, category) VALUES ('site_name', '"Old"', 'branding')`);
    await db.exec('TRUNCATE revisions, changesets');
    const res = await execute('config.set', { key: 'site_name', value: 'New' }, 'k2');
    expect(res.status).toBe(200);
    const [rev] = await rows<{ op: string; before: { value: unknown }; after: { value: unknown }; actor_type: string }>(
      db,
      `SELECT r.op, r.before, r.after, c.actor_type FROM revisions r JOIN changesets c ON c.id = r.changeset_id WHERE r.table_name = 'site_config'`,
    );
    expect(rev).toMatchObject({ op: 'update', before: { value: 'Old' }, after: { value: 'New' }, actor_type: 'admin' });
  });
});

async function query(operation: string, input: Record<string, unknown>) {
  const res = await kychonApi(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiVersion: KYCHON_API_VERSION, operation, phase: 'query', input }),
    }),
  );
  // biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary capability payloads
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

describe('history queries', () => {
  const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };
  const MEMBER = { id: '22222222-2222-4222-8222-222222222222', email: 'member@example.org' };

  it('lists changesets, a block history, and a revision with before/after (admin)', async () => {
    state.user = ADMIN;
    const [{ id: sectionId }] = await rows<{ id: number }>(
      db,
      `INSERT INTO sections (page_slug, section_type, config, position) VALUES ('index', 'hero', '{"heading":"Old"}', 1) RETURNING id`,
    );
    const updated = await execute('sections.updateConfig', { id: sectionId, config: { heading: 'New' } }, 'k3');
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);

    const list = await query('history.list', {});
    expect(list.status).toBe(200);
    const [latest] = list.body.data.changesets;
    expect(latest).toMatchObject({ actor_type: 'admin', label: 'sections.updateConfig', revision_count: 1 });
    expect(latest.targets).toEqual([{ table: 'sections', key: { id: sectionId } }]);

    const block = await query('history.revisions', { table: 'sections', key: sectionId });
    expect(block.body.data.revisions.map((r: { op: string }) => r.op)).toEqual(['update', 'insert']);

    const one = await query('history.revision', { id: block.body.data.revisions[0].id });
    expect(one.body.data.revision.before.config).toEqual({ heading: 'Old' });
    expect(one.body.data.revision.after.config).toEqual({ heading: 'New' });
  });

  it.each([
    'history.list',
    'history.revisions',
    'history.revision',
  ])('refuses %s for a non-admin member', async (operation) => {
    state.user = MEMBER;
    const res = await query(operation, { table: 'sections', key: 1, id: 1 });
    expect(res.status).toBe(403);
  });

  it('rejects untracked tables', async () => {
    state.user = ADMIN;
    const res = await query('history.revisions', { table: 'members', key: 1 });
    expect(res.status).toBe(400);
  });
});

describe('history.revert', () => {
  const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };
  let n = 0;
  const revert = (changesetId: number, extra: Record<string, unknown> = {}) =>
    execute('history.revert', { changeset_id: changesetId, ...extra }, `revert-${++n}`);
  const latestChangeset = async () =>
    (await rows<{ id: number }>(db, 'SELECT id FROM changesets ORDER BY id DESC LIMIT 1'))[0].id;

  beforeEach(() => {
    state.user = ADMIN;
  });

  it('reverts an insert (the row is removed)', async () => {
    await execute('announcements.publish', { title: 'Oops', body: '<p>x</p>' }, `pub-${++n}`);
    const res = await revert(await latestChangeset());
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await rows(db, 'SELECT id FROM announcements')).toEqual([]);
  });

  it('reverts an update (the old value comes back) and records a labelled revert changeset', async () => {
    await db.exec(`INSERT INTO site_config (key, value, category) VALUES ('site_name', '"Old"', 'branding')`);
    await execute('config.set', { key: 'site_name', value: 'New' }, `cfg-${++n}`);
    const changeset = await latestChangeset();
    expect((await revert(changeset)).status).toBe(200);
    expect(await rows(db, `SELECT value FROM site_config WHERE key = 'site_name'`)).toEqual([{ value: 'Old' }]);
    expect(
      await rows(db, 'SELECT actor_type, label, reverts_changeset_id FROM changesets ORDER BY id DESC LIMIT 1'),
    ).toEqual([{ actor_type: 'admin', label: `Revert #${changeset}`, reverts_changeset_id: changeset }]);
  });

  it('reverts a delete (the row returns with its id and content)', async () => {
    const [{ id }] = await rows<{ id: number }>(
      db,
      `INSERT INTO sections (page_slug, section_type, config, position) VALUES ('index', 'cta', '{"heading":"Join"}', 3) RETURNING id`,
    );
    const del = await execute('sections.delete', { id }, `del-${++n}`);
    expect(del.status, JSON.stringify(del.body)).toBe(200);
    expect((await revert(await latestChangeset())).status).toBe(200);
    expect(await rows(db, 'SELECT id, config FROM sections WHERE id = $1', [id])).toEqual([
      { id, config: { heading: 'Join' } },
    ]);
  });

  it('refuses a conflicting revert and changes nothing; force overwrites and is itself revertible', async () => {
    const [{ id }] = await rows<{ id: number }>(
      db,
      `INSERT INTO sections (page_slug, section_type, config, position) VALUES ('index', 'hero', '{"heading":"A"}', 1) RETURNING id`,
    );
    await execute('sections.updateConfig', { id, config: { heading: 'B' } }, `u-${++n}`);
    const first = await latestChangeset();
    await execute('sections.updateConfig', { id, config: { heading: 'C' } }, `u-${++n}`);

    const refused = await revert(first);
    expect(refused.status).toBe(409);
    expect(refused.body.error.detail.conflicts).toEqual([{ table: 'sections', key: { id } }]);
    expect(await rows(db, 'SELECT config FROM sections WHERE id = $1', [id])).toEqual([{ config: { heading: 'C' } }]);

    expect((await revert(first, { force: true })).status).toBe(200);
    expect(await rows(db, 'SELECT config FROM sections WHERE id = $1', [id])).toEqual([{ config: { heading: 'A' } }]);

    expect((await revert(await latestChangeset())).status).toBe(200);
    expect(await rows(db, 'SELECT config FROM sections WHERE id = $1', [id])).toEqual([{ config: { heading: 'C' } }]);
  });

  it('never writes untracked tables, even if a revision names one', async () => {
    const [{ id: cs }] = await rows<{ id: number }>(
      db,
      `INSERT INTO changesets (actor_type) VALUES ('unattributed') RETURNING id`,
    );
    await db.query(
      `INSERT INTO revisions (changeset_id, table_name, row_key, op, before, after) VALUES ($1, 'members', '{"id": 1}', 'update', '{"id":1,"role":"admin"}', '{"id":1,"role":"member"}')`,
      [cs],
    );
    const before = await rows(db, 'SELECT id, role FROM members ORDER BY id');
    const res = await revert(cs);
    expect(res.status).toBe(200);
    expect(await rows(db, 'SELECT id, role FROM members ORDER BY id')).toEqual(before);
  });

  it('is admin-only', async () => {
    const [{ id: cs }] = await rows<{ id: number }>(
      db,
      `INSERT INTO changesets (actor_type) VALUES ('unattributed') RETURNING id`,
    );
    state.user = { id: '22222222-2222-4222-8222-222222222222', email: 'member@example.org' };
    expect((await revert(cs)).status).toBe(403);
  });
});

describe('action results report their changesets (for Undo)', () => {
  it('returns history.changesetIds on a save, and reverting it undoes the save', async () => {
    state.user = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };
    await db.exec(`INSERT INTO site_config (key, value, category) VALUES ('site_name', '"Old"', 'branding')`);
    const saved = await execute('config.set', { key: 'site_name', value: 'New' }, 'undo-1');
    const ids = saved.body.data.history.changesetIds as string[];
    expect(ids).toHaveLength(1);
    const [{ id }] = await rows<{ id: number }>(db, 'SELECT id FROM changesets ORDER BY id DESC LIMIT 1');
    expect(ids).toEqual([String(id)]);

    const undone = await execute('history.revert', { changeset_id: Number(ids[0]) }, 'undo-2');
    expect(undone.status).toBe(200);
    expect(undone.body.data.history.changesetIds).toHaveLength(1); // the revert is itself undoable
    expect(await rows(db, `SELECT value FROM site_config WHERE key = 'site_name'`)).toEqual([{ value: 'Old' }]);
  });
});
