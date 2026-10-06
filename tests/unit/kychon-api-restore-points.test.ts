/**
 * Restore points end to end: the real kychon-api function on the real
 * schema.sql (PGlite), with the platform's `snapshots` namespace faked in
 * memory. Covers the admin list/create/delete, the owner-only confirmed
 * restore and the changeset it records, and the restore point an AI
 * assistant's first change takes.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';
import { pgliteAdminDb } from '../helpers/pglite-admin-db';
import { freshKychonDb, rows } from '../helpers/pglite-db';

const fakeSnapshots = await vi.hoisted(async () => (await import('../helpers/fake-snapshots')).createFakeSnapshots());

const state = vi.hoisted(() => ({
  db: null as null | ReturnType<typeof import('../helpers/pglite-admin-db').pgliteAdminDb>,
  user: null as null | { id: string; email?: string; app_metadata?: Record<string, unknown> },
}));

vi.mock(
  '@run402/functions',
  () => ({
    adminDb: () => state.db,
    auth: { user: async () => state.user },
    events: { emit: async () => ({ deduplicated: false }) },
    snapshots: fakeSnapshots.api,
  }),
  { virtual: true },
);

const { default: kychonApi } = await import('../../functions/kychon-api.js');

const OWNER = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'owner@example.org',
  app_metadata: { role: 'project_admin' },
};
const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };
const MEMBER = { id: '22222222-2222-4222-8222-222222222222', email: 'member@example.org' };

let db: PGlite;
let sectionId: number;
beforeEach(async () => {
  fakeSnapshots.reset();
  db = await freshKychonDb();
  state.db = pgliteAdminDb(db);
  await db.exec(`
    INSERT INTO members (user_id, email, display_name, role, status) VALUES
      ('11111111-1111-4111-8111-111111111111', 'admin@example.org', 'Ada Admin', 'admin', 'active'),
      ('22222222-2222-4222-8222-222222222222', 'member@example.org', 'Member', 'member', 'active');
    INSERT INTO site_config (key, value, category) VALUES ('brand_text', '"Riverside Eagles"', 'branding');
  `);
  [{ id: sectionId }] = await rows<{ id: number }>(
    db,
    `INSERT INTO sections (page_slug, section_type, config, position) VALUES ('index', 'hero', '{"heading":"Welcome"}', 1) RETURNING id`,
  );
  await db.exec('TRUNCATE revisions, changesets');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary capability payloads
type Body = Record<string, any>;

async function call(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const res = await kychonApi(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ apiVersion: KYCHON_API_VERSION, ...body }),
    }),
  );
  return { status: res.status, body: (await res.json()) as Body };
}

let keys = 0;
const execute = (operation: string, input: Record<string, unknown>) =>
  call({ operation, phase: 'execute', confirmed: true, idempotencyKey: `k${++keys}`, input });
const query = (operation: string, input: Record<string, unknown> = {}) => call({ operation, phase: 'query', input });
const connector = (operation: string, input: Record<string, unknown>) =>
  call({ operation, phase: 'execute', input }, { 'x-run402-trigger': 'mcp_tool' });

async function heading() {
  const [row] = await rows<{ config: { heading: string } }>(db, `SELECT config FROM sections WHERE id = ${sectionId}`);
  return row.config.heading;
}

/** Make every Date.now() call a minute later, so polling loops give up at once. */
function fastClock() {
  let now = Date.parse('2026-10-06T12:00:00Z');
  vi.spyOn(Date, 'now').mockImplementation(() => {
    now += 60_000;
    return now;
  });
}

describe('restorePoints.list / create / delete (admin)', () => {
  it('creates a labelled manual point and lists every snapshot with a readable label and reason', async () => {
    state.user = ADMIN;
    const created = await execute('restorePoints.create', { label: '  Before spring redesign ' });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(fakeSnapshots.api.create).toHaveBeenCalledWith({
      label: 'Before spring redesign',
      metadata: { reason: 'manual', created_by: 'Ada Admin', created_by_user_id: ADMIN.id },
    });
    fakeSnapshots.add({ kind: 'scheduled' });
    fakeSnapshots.add({ label: 'Before engine upgrade', metadata: { reason: 'before_engine_upgrade' } });

    const listed = await query('restorePoints.list');
    expect(listed.status).toBe(200);
    expect(listed.body.data).toMatchObject({ siteName: 'Riverside Eagles', canRestore: false, nextCursor: null });
    expect(listed.body.data.restorePoints).toEqual([
      expect.objectContaining({ label: 'Before engine upgrade', reason: 'before_engine_upgrade', deletable: true }),
      expect.objectContaining({ label: 'Automatic snapshot', reason: 'scheduled', deletable: false }),
      expect.objectContaining({
        label: 'Before spring redesign',
        reason: 'manual',
        createdBy: 'Ada Admin',
        status: 'ready',
      }),
    ]);
  });

  it('requires a label', async () => {
    state.user = ADMIN;
    const res = await execute('restorePoints.create', { label: ' ' });
    expect(res.status).toBe(400);
    expect(fakeSnapshots.api.create).not.toHaveBeenCalled();
  });

  it('reports the platform cap in words an admin can act on', async () => {
    state.user = ADMIN;
    fakeSnapshots.store.manualCap = 0;
    const res = await execute('restorePoints.create', { label: 'One more' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/maximum number of restore points/);
  });

  it('refuses members', async () => {
    state.user = MEMBER;
    expect((await query('restorePoints.list')).status).toBe(403);
    expect((await execute('restorePoints.create', { label: 'x' })).status).toBe(403);
    expect(fakeSnapshots.api.create).not.toHaveBeenCalled();
  });

  it('deletes manual points only', async () => {
    state.user = ADMIN;
    const manual = fakeSnapshots.add({ label: 'Old' });
    const platform = fakeSnapshots.add({ kind: 'pre_restore' });
    expect((await execute('restorePoints.delete', { snapshot_id: manual.snapshot_id })).status).toBe(200);
    expect((await execute('restorePoints.delete', { snapshot_id: platform.snapshot_id })).status).toBe(400);
    expect(fakeSnapshots.store.snapshots.map((s) => s.snapshot_id)).toEqual([platform.snapshot_id]);
  });
});

describe('restorePoints.restore (owner only, confirmed by the site name)', () => {
  async function pointThenEdit() {
    state.user = ADMIN;
    const created = await execute('restorePoints.create', { label: 'Before spring redesign' });
    const id = created.body.data.result.restorePoint.id as string;
    // Rewinding the fake database is the platform's job; emulate it.
    fakeSnapshots.store.onRestore = async () => {
      await db.exec(`UPDATE sections SET config = '{"heading":"Welcome"}' WHERE id = ${sectionId}`);
      await db.exec('TRUNCATE revisions, changesets');
    };
    await execute('sections.updateConfig', { id: sectionId, config: { heading: 'Spring!' } });
    expect(await heading()).toBe('Spring!');
    return id;
  }

  it('restores, keeps a pre_restore point, and records a "Restored to" changeset', async () => {
    const id = await pointThenEdit();
    state.user = OWNER;
    const listed = await query('restorePoints.list');
    expect(listed.body.data.canRestore).toBe(true);

    const res = await execute('restorePoints.restore', { snapshot_id: id, confirm_site_name: 'riverside eagles' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.result.restore).toMatchObject({ status: 'ready', releaseMode: 'snapshot' });
    expect(fakeSnapshots.api.restorePlan).toHaveBeenCalledWith(id, { release: 'snapshot' });
    expect(await heading()).toBe('Welcome');

    const history = await query('history.list');
    expect(history.body.data.changesets).toEqual([
      expect.objectContaining({
        label: 'Restored to "Before spring redesign"',
        actor_type: 'admin',
        actor_id: OWNER.id,
      }),
    ]);
    const after = await query('restorePoints.list');
    expect(after.body.data.restorePoints[0]).toMatchObject({
      reason: 'before_restore',
      label: 'Before restoring "Before spring redesign"',
      restoreOf: id,
    });
  });

  it('restores data only when the captured release is gone', async () => {
    const id = await pointThenEdit();
    state.user = OWNER;
    fakeSnapshots.store.releaseRestorable = false;
    const res = await execute('restorePoints.restore', { snapshot_id: id, confirm_site_name: 'Riverside Eagles' });
    expect(res.body.data.result.restore.releaseMode).toBe('keep');
  });

  it('refuses a wrong site name and changes nothing', async () => {
    const id = await pointThenEdit();
    state.user = OWNER;
    const res = await execute('restorePoints.restore', { snapshot_id: id, confirm_site_name: 'Eagles' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('"Riverside Eagles"');
    expect(fakeSnapshots.api.restore).not.toHaveBeenCalled();
    expect(await heading()).toBe('Spring!');
  });

  it('refuses a non-owner admin', async () => {
    const id = await pointThenEdit();
    state.user = ADMIN;
    const res = await execute('restorePoints.restore', { snapshot_id: id, confirm_site_name: 'Riverside Eagles' });
    expect(res.status).toBe(403);
    expect(fakeSnapshots.api.restorePlan).not.toHaveBeenCalled();
    expect(await heading()).toBe('Spring!');
  });

  it('is not available to AI assistants', async () => {
    const id = await pointThenEdit();
    state.user = OWNER;
    const res = await call(
      {
        operation: 'restorePoints.restore',
        phase: 'execute',
        confirmed: true,
        input: { snapshot_id: id, confirm_site_name: 'Riverside Eagles' },
      },
      { 'x-run402-trigger': 'mcp_tool' },
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('connector.operationUnavailable');
  });

  it('hands back a long restore to poll, and records it once when done', async () => {
    const id = await pointThenEdit();
    state.user = OWNER;
    fakeSnapshots.store.restoreStatus = 'running';
    fastClock();
    const res = await execute('restorePoints.restore', { snapshot_id: id, confirm_site_name: 'Riverside Eagles' });
    expect(res.status).toBe(200);
    const restore = res.body.data.result.restore;
    expect(restore.status).toBe('running');

    const record = fakeSnapshots.store.restores[0];
    record.status = 'ready';
    record.completed_at = '2026-10-06T12:30:00Z';
    for (let i = 0; i < 2; i++) {
      const polled = await query('restorePoints.restoreStatus', { snapshot_id: id, restore_id: restore.id });
      expect(polled.body.data.restore.status).toBe('ready');
    }
    expect(await rows(db, `SELECT label FROM changesets`)).toEqual([{ label: 'Restored to "Before spring redesign"' }]);
  });

  it('reports a failed restore', async () => {
    const id = await pointThenEdit();
    state.user = OWNER;
    fakeSnapshots.store.restoreStatus = 'failed';
    const res = await execute('restorePoints.restore', { snapshot_id: id, confirm_site_name: 'Riverside Eagles' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('internal.restorePoint');
  });
});

describe('before_agent_run: a restore point before an AI assistant changes the site', () => {
  const agentPoints = () =>
    fakeSnapshots.store.snapshots.filter(
      (s) => (s.metadata as { reason?: string } | null)?.reason === 'before_agent_run',
    );

  it('takes one before the first change and reuses it within the session', async () => {
    state.user = ADMIN;
    const first = await connector('sections.updateConfig', { id: sectionId, config: { heading: 'One' } });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const second = await connector('sections.updateConfig', { id: sectionId, config: { heading: 'Two' } });
    expect(second.status).toBe(200);

    expect(agentPoints()).toEqual([
      expect.objectContaining({
        label: 'Before AI assistant changes',
        metadata: {
          reason: 'before_agent_run',
          channel: 'ai_connector',
          created_by: 'Ada Admin',
          created_by_user_id: ADMIN.id,
        },
      }),
    ]);
    expect(await heading()).toBe('Two');
  });

  it('takes none for changes made in the portal itself', async () => {
    state.user = ADMIN;
    await execute('sections.updateConfig', { id: sectionId, config: { heading: 'Browser' } });
    expect(fakeSnapshots.api.create).not.toHaveBeenCalled();
  });

  it('keeps only the newest few agent points', async () => {
    state.user = ADMIN;
    for (const hour of ['05', '06', '07']) {
      fakeSnapshots.add({
        label: 'Before AI assistant changes',
        metadata: { reason: 'before_agent_run' },
        created_at: `2026-10-01T${hour}:00:00Z`,
      });
    }
    const keep = fakeSnapshots.add({
      label: 'Mine',
      metadata: { reason: 'manual' },
      created_at: '2026-10-01T04:00:00Z',
    });
    expect((await connector('sections.updateConfig', { id: sectionId, config: { heading: 'New' } })).status).toBe(200);
    expect(agentPoints().map((s) => (s.created_at > '2026-10-02' ? 'new' : s.created_at.slice(0, 13)))).toEqual([
      'new',
      '2026-10-01T07',
      '2026-10-01T06',
    ]);
    expect(fakeSnapshots.store.snapshots).toContainEqual(keep);
  });

  it('makes no change while the restore point is still being taken', async () => {
    state.user = ADMIN;
    fakeSnapshots.store.createStatus = 'running';
    fastClock();
    const res = await connector('sections.updateConfig', { id: sectionId, config: { heading: 'Blocked' } });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/restore point is being taken/);
    expect(await heading()).toBe('Welcome');
  });

  it('makes no change when the restore point cannot be taken', async () => {
    state.user = ADMIN;
    fakeSnapshots.store.manualCap = 0;
    const res = await connector('sections.updateConfig', { id: sectionId, config: { heading: 'Blocked' } });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/No change was made/);
    expect(await heading()).toBe('Welcome');
  });

  it('carries on where the host has no snapshots', async () => {
    state.user = ADMIN;
    fakeSnapshots.store.unsupported = true;
    expect((await connector('sections.updateConfig', { id: sectionId, config: { heading: 'Core' } })).status).toBe(200);
    expect(await heading()).toBe('Core');
  });
});
