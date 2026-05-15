import { beforeEach, describe, expect, it, vi } from 'vitest';

import kychonApi from '../../functions/kychon-api.js';
import { type JsonObject, KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';

type MockDbChain = Promise<JsonObject[]> & {
  eq(column: string, value: unknown): MockDbChain;
  limit(count: number): Promise<JsonObject[]>;
};

const mockState = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string },
  tables: {} as Record<string, JsonObject[]>,
  counters: {} as Record<string, number>,
  postgrestWriteRlsTables: new Set<string>(),
  chain(rows: JsonObject[]): MockDbChain {
    const query = Promise.resolve(rows) as MockDbChain;
    query.eq = (column: string, value: unknown) =>
      mockState.chain(rows.filter((row) => String(row[column]) === String(value)));
    query.limit = (count: number) => Promise.resolve(rows.slice(0, count));
    return query;
  },
  insert(table: string, row: JsonObject) {
    if (mockState.postgrestWriteRlsTables.has(table)) {
      throw new Error(`PostgREST RLS blocked insert on ${table}`);
    }
    const nextId = (mockState.counters[table] || maxId(mockState.tables[table] || [])) + 1;
    mockState.counters[table] = nextId;
    const created = { id: nextId, ...row };
    mockState.tables[table] = [...(mockState.tables[table] || []), created];
    return Promise.resolve(created);
  },
  update(table: string, column: string, value: unknown, patch: JsonObject) {
    if (mockState.postgrestWriteRlsTables.has(table)) {
      throw new Error(`PostgREST RLS blocked update on ${table}`);
    }
    const rows = mockState.tables[table] || [];
    const updated: JsonObject[] = [];
    mockState.tables[table] = rows.map((row) => {
      if (String(row[column]) !== String(value)) return row;
      const next = { ...row, ...patch };
      updated.push(next);
      return next;
    });
    return Promise.resolve(updated);
  },
  delete(table: string, column: string, value: unknown) {
    if (mockState.postgrestWriteRlsTables.has(table)) {
      throw new Error(`PostgREST RLS blocked delete on ${table}`);
    }
    const rows = mockState.tables[table] || [];
    const kept: JsonObject[] = [];
    const deleted: JsonObject[] = [];
    for (const row of rows) {
      if (String(row[column]) === String(value)) deleted.push(row);
      else kept.push(row);
    }
    mockState.tables[table] = kept;
    return Promise.resolve(deleted);
  },
  insertSql(table: string, row: JsonObject) {
    const nextId = (mockState.counters[table] || maxId(mockState.tables[table] || [])) + 1;
    mockState.counters[table] = nextId;
    const created = { id: nextId, ...row };
    mockState.tables[table] = [...(mockState.tables[table] || []), created];
    return Promise.resolve([created]);
  },
  updateSql(table: string, column: string, value: unknown, patch: JsonObject) {
    const rows = mockState.tables[table] || [];
    const updated: JsonObject[] = [];
    mockState.tables[table] = rows.map((row) => {
      if (String(row[column]) !== String(value)) return row;
      const next = { ...row, ...patch };
      updated.push(next);
      return next;
    });
    return Promise.resolve(updated);
  },
  deleteSql(table: string, column: string, value: unknown) {
    const rows = mockState.tables[table] || [];
    const kept: JsonObject[] = [];
    const deleted: JsonObject[] = [];
    for (const row of rows) {
      if (String(row[column]) === String(value)) deleted.push(row);
      else kept.push(row);
    }
    mockState.tables[table] = kept;
    return Promise.resolve(deleted);
  },
}));

vi.mock(
  '@run402/functions',
  () => ({
    getUser: vi.fn(async () => mockState.user),
    adminDb: () => ({
      sql(query: string, params: unknown[] = []) {
        return mockSql(query, params);
      },
      from(table: string) {
        return {
          select() {
            return mockState.chain(mockState.tables[table] || []);
          },
          insert(row: JsonObject) {
            return mockState.insert(table, row);
          },
          update(patch: JsonObject) {
            return {
              eq(column: string, value: unknown) {
                return mockState.update(table, column, value, patch);
              },
            };
          },
          delete() {
            return {
              eq(column: string, value: unknown) {
                return mockState.delete(table, column, value);
              },
            };
          },
        };
      },
    }),
  }),
  { virtual: true },
);

function maxId(rows: JsonObject[]) {
  return Math.max(0, ...rows.map((row) => Number(row.id || 0)));
}

function mockSql(query: string, params: unknown[]) {
  const normalized = query.replace(/\s+/g, ' ').trim();
  const insert = normalized.match(/^INSERT INTO "([^"]+)" \(([^)]+)\) VALUES \(([^)]+)\) RETURNING \*$/);
  if (insert) {
    const [, table, columns] = insert;
    const row = Object.fromEntries(columns.split(', ').map((column, index) => [column.slice(1, -1), params[index]]));
    return mockState.insertSql(table, row);
  }

  const update = normalized.match(/^UPDATE "([^"]+)" SET (.+) WHERE "([^"]+)" = \$([0-9]+) RETURNING \*$/);
  if (update) {
    const [, table, assignments, column, idParam] = update;
    const patch = Object.fromEntries(
      assignments.split(', ').map((assignment) => {
        const [, rawColumn, rawParam] = assignment.match(/^"([^"]+)" = \$([0-9]+)$/) || [];
        return [rawColumn, params[Number(rawParam) - 1]];
      }),
    );
    return mockState.updateSql(table, column, params[Number(idParam) - 1], patch);
  }

  const select = normalized.match(/^SELECT \* FROM "([^"]+)" WHERE "([^"]+)" = \$1 LIMIT 1$/);
  if (select) {
    const [, table, column] = select;
    return Promise.resolve(
      (mockState.tables[table] || []).filter((row) => String(row[column]) === String(params[0])).slice(0, 1),
    );
  }

  const del = normalized.match(/^DELETE FROM "([^"]+)" WHERE "([^"]+)" = \$1 RETURNING \*$/);
  if (del) {
    const [, table, column] = del;
    return mockState.deleteSql(table, column, params[0]);
  }

  throw new Error(`Unexpected SQL: ${normalized}`);
}

function apiRequest(body: JsonObject) {
  return kychonApi(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

async function json(res: Response) {
  return {
    status: res.status,
    body: await res.json(),
  };
}

beforeEach(() => {
  mockState.user = null;
  mockState.counters = {};
  mockState.postgrestWriteRlsTables = new Set<string>();
  mockState.tables = {
    members: [],
    events: [],
    activity_log: [],
    capability_executions: [],
  };
});

describe('deployable kychon-api execute mutations', () => {
  it('replays identical idempotency keys and rejects same-key input conflicts', async () => {
    mockState.user = { id: 'admin-user', email: 'admin@example.com' };
    mockState.postgrestWriteRlsTables = new Set(['events']);
    mockState.tables.members = [
      {
        id: 1,
        user_id: 'admin-user',
        email: 'admin@example.com',
        display_name: 'Admin',
        role: 'admin',
        status: 'active',
      },
    ];
    const envelope = {
      apiVersion: KYCHON_API_VERSION,
      operation: 'events.create',
      phase: 'execute',
      idempotencyKey: 'event-create-1',
      input: { title: 'Meet', starts_at: '2026-06-01T10:00:00Z' },
    };

    const first = await json(await apiRequest(envelope));
    const replay = await json(await apiRequest(envelope));
    const conflict = await json(
      await apiRequest({ ...envelope, input: { title: 'Changed', starts_at: '2026-06-01T10:00:00Z' } }),
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(first.body.data.result.id).toBe(1);
    expect(replay.body.data.result.id).toBe(1);
    expect(mockState.tables.events).toHaveLength(1);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('conflict.idempotencyKey');
  });

  it('uses SQL-backed writes for resources when PostgREST table writes are RLS-blocked', async () => {
    mockState.user = { id: 'admin-user', email: 'admin@example.com' };
    mockState.postgrestWriteRlsTables = new Set(['resources']);
    mockState.tables.members = [
      {
        id: 1,
        user_id: 'admin-user',
        email: 'admin@example.com',
        display_name: 'Admin',
        role: 'admin',
        status: 'active',
      },
    ];

    const created = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'resources.upload',
        phase: 'execute',
        idempotencyKey: 'resource-upload-1',
        input: { file: { name: 'guide.pdf' }, metadata: { title: 'Guide' } },
      }),
    );

    expect(created.status).toBe(200);
    expect(created.body.data.result).toMatchObject({ id: 1, title: 'Guide', uploaded_by: '1' });
    expect(mockState.tables.resources).toHaveLength(1);
  });

  it('self-scopes members.updateProfile and drops admin-only fields', async () => {
    mockState.user = { id: 'member-user', email: 'member@example.com' };
    mockState.tables.members = [
      {
        id: 1,
        user_id: 'member-user',
        email: 'member@example.com',
        display_name: 'Self',
        role: 'member',
        status: 'active',
        tier_id: 1,
        custom_fields: {},
      },
      {
        id: 2,
        user_id: 'other-user',
        email: 'other@example.com',
        display_name: 'Other',
        role: 'member',
        status: 'active',
        tier_id: 1,
      },
    ];

    const denied = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'members.updateProfile',
        phase: 'execute',
        idempotencyKey: 'profile-cross-member',
        input: { id: 2, display_name: 'Hijacked' },
      }),
    );
    const updated = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'members.updateProfile',
        phase: 'execute',
        idempotencyKey: 'profile-self-member',
        input: {
          display_name: 'Updated Self',
          avatar_url: '/avatars/self.png',
          bio: 'Hello',
          custom_fields: { phone: '555-0100' },
          role: 'admin',
          status: 'suspended',
          tier_id: 99,
          user_id: 'attacker-user',
        },
      }),
    );

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('permission.denied');
    expect(updated.status).toBe(200);
    expect(mockState.tables.members[0]).toMatchObject({
      display_name: 'Updated Self',
      avatar_url: '/avatars/self.png',
      bio: 'Hello',
      custom_fields: { phone: '555-0100' },
      role: 'member',
      status: 'active',
      tier_id: 1,
      user_id: 'member-user',
    });
    expect(mockState.tables.members[1].display_name).toBe('Other');
  });

  it('validate phase rejects member profile updates for another member', async () => {
    mockState.user = { id: 'member-user', email: 'member@example.com' };
    mockState.tables.members = [
      {
        id: 1,
        user_id: 'member-user',
        email: 'member@example.com',
        display_name: 'Self',
        role: 'member',
        status: 'active',
      },
      {
        id: 2,
        user_id: 'other-user',
        email: 'other@example.com',
        display_name: 'Other',
        role: 'member',
        status: 'active',
      },
    ];

    const validated = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'members.updateProfile',
        phase: 'validate',
        input: { id: 2, display_name: 'Hijacked' },
      }),
    );

    expect(validated.status).toBe(200);
    expect(validated.body.data.accepted).toBe(false);
    expect(validated.body.data.warnings.some((warning: JsonObject) => warning.code === 'permission.denied')).toBe(true);
  });

  it('sanitizes announcement body bypass payloads on deployable function write', async () => {
    mockState.user = { id: 'admin-user', email: 'admin@example.com' };
    mockState.tables.members = [
      {
        id: 1,
        user_id: 'admin-user',
        email: 'admin@example.com',
        display_name: 'Admin',
        role: 'admin',
        status: 'active',
      },
    ];
    mockState.tables.announcements = [];

    const created = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'announcements.publish',
        phase: 'execute',
        confirmed: true,
        idempotencyKey: 'announcement-sanitize-bug30',
        input: {
          title: 'News',
          body: [
            '<p>safe</p>',
            '<svg/onload=alert(1)>',
            '<details/open/ontoggle=alert(1)>',
            '<img style="background:url(javascript:alert(1))">',
            '<a href="&#106;avascript:alert(1)">x</a>',
          ].join(''),
        },
      }),
    );

    expect(created.status).toBe(200);
    const stored = String(mockState.tables.announcements[0]?.body || '');
    expect(stored).toContain('<p>safe</p>');
    expect(stored).not.toMatch(/onload|ontoggle|style\s*=|javascript:|&#106;avascript|<svg|<details/i);
  });

  it.each(['members.suspend', 'members.reject'])('refuses to %s the only active admin', async (operation) => {
    mockState.user = { id: 'admin-user', email: 'admin@example.com' };
    mockState.tables.members = [
      {
        id: 1,
        user_id: 'admin-user',
        email: 'admin@example.com',
        display_name: 'Admin',
        role: 'admin',
        status: 'active',
      },
    ];

    const validated = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation,
        phase: 'validate',
        input: { id: 1 },
      }),
    );
    const executed = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation,
        phase: 'execute',
        confirmed: true,
        idempotencyKey: `${operation}-last-admin`,
        input: { id: 1 },
      }),
    );

    expect(validated.status).toBe(200);
    expect(validated.body.data.accepted).toBe(false);
    expect(validated.body.data.warnings.some((warning: JsonObject) => warning.code === 'conflict.state')).toBe(true);
    expect(executed.status).toBe(409);
    expect(executed.body.error.code).toBe('conflict.state');
    expect(mockState.tables.members[0]).toMatchObject({ role: 'admin', status: 'active' });
  });

  it('allows suspending an admin when another active admin remains', async () => {
    mockState.user = { id: 'admin-user', email: 'admin@example.com' };
    mockState.tables.members = [
      {
        id: 1,
        user_id: 'admin-user',
        email: 'admin@example.com',
        display_name: 'Admin',
        role: 'admin',
        status: 'active',
      },
      {
        id: 2,
        user_id: 'backup-admin',
        email: 'backup@example.com',
        display_name: 'Backup',
        role: 'admin',
        status: 'active',
      },
    ];

    const executed = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'members.suspend',
        phase: 'execute',
        confirmed: true,
        idempotencyKey: 'members-suspend-non-last-admin',
        input: { id: 1 },
      }),
    );

    expect(executed.status).toBe(200);
    expect(mockState.tables.members[0]).toMatchObject({ role: 'admin', status: 'suspended' });
  });
});
