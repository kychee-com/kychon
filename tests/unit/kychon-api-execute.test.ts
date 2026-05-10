import { beforeEach, describe, expect, it, vi } from 'vitest';

import kychonApi from '../../functions/kychon-api.js';
import { KYCHON_API_VERSION, type JsonObject } from '../../src/lib/capability-api/index.ts';

const mockState = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string },
  tables: {} as Record<string, JsonObject[]>,
  counters: {} as Record<string, number>,
  chain(rows: JsonObject[]) {
    return {
      then(resolve: (rows: JsonObject[]) => unknown, reject?: (error: unknown) => unknown) {
        return Promise.resolve(rows).then(resolve, reject);
      },
      eq(column: string, value: unknown) {
        return mockState.chain(rows.filter((row) => String(row[column]) === String(value)));
      },
      limit(count: number) {
        return Promise.resolve(rows.slice(0, count));
      },
    };
  },
  insert(table: string, row: JsonObject) {
    const nextId = (mockState.counters[table] || maxId(mockState.tables[table] || [])) + 1;
    mockState.counters[table] = nextId;
    const created = { id: nextId, ...row };
    mockState.tables[table] = [...(mockState.tables[table] || []), created];
    return Promise.resolve(created);
  },
  update(table: string, column: string, value: unknown, patch: JsonObject) {
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
    mockState.tables.members = [
      { id: 1, user_id: 'admin-user', email: 'admin@example.com', display_name: 'Admin', role: 'admin', status: 'active' },
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
});
