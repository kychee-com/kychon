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
