// Regression coverage for #27: capability API hardening bag.
// None of these are individually exploitable, but each is a friction-reducer
// for an attacker or makes the API contract a little less honest.
//
//   1. Envelope coercion silently allows non-object `input` (null, arrays).
//   2. idempotencyKey conflict response discloses the prior operation name.
//   3. Anon `validate` phase enumerates the whole mutation surface.
//   4. `config.get` returns the full site_config to anonymous callers.
//   5. `events.list` / `announcements.list` expose `created_by` / `author_id`
//      to anonymous callers — usable as IDOR pivots for #24.
//   6. `requiredAny` accepts the empty string "" as a valid id.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type JsonObject, KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';

type MockDbChain = Promise<JsonObject[]> & {
  eq(column: string, value: unknown): MockDbChain;
  limit(count: number): Promise<JsonObject[]>;
};

const mockState = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string },
  tables: {} as Record<string, JsonObject[]>,
  counters: {} as Record<string, number>,
  chain(rows: JsonObject[]): MockDbChain {
    const query = Promise.resolve(rows) as MockDbChain;
    query.eq = (column: string, value: unknown) =>
      mockState.chain(rows.filter((row) => String(row[column]) === String(value)));
    query.limit = (count: number) => Promise.resolve(rows.slice(0, count));
    return query;
  },
  insert(table: string, row: JsonObject) {
    const nextId = (mockState.counters[table] || 0) + 1;
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
      sql() {
        return Promise.resolve({ rows: [] });
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

async function callJson(body: unknown) {
  const kychonApi = (await import('../../functions/kychon-api.js')).default;
  const res = await kychonApi(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  mockState.user = null;
  mockState.counters = {};
  mockState.tables = {
    members: [],
    capability_executions: [],
    activity_log: [],
    site_config: [
      { id: 1, key: 'site_name', value: '"Public"', category: 'branding' },
      { id: 2, key: 'feature_polls', value: true, category: 'features' },
      { id: 3, key: 'webhook_url', value: 'https://hooks.example/secret', category: 'private' },
      { id: 4, key: 'integration_token', value: 'shh', category: 'secrets' },
    ],
    events: [
      {
        id: 1,
        title: 'Public Meetup',
        starts_at: '2099-01-01T10:00:00Z',
        is_members_only: false,
        created_by: 42,
      },
    ],
    announcements: [{ id: 1, title: 'Hello', body: 'World', author_id: 42, is_pinned: false }],
    pages: [],
    sections: [],
  };
});

describe('bug #27 — envelope coercion (item 1)', () => {
  it('rejects null input with request.invalidEnvelope', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'events.list',
      phase: 'query',
      input: null,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(400);
    expect(r.body.error.code).toBe('request.invalidEnvelope');
  });

  it('rejects array input with request.invalidEnvelope', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'events.list',
      phase: 'query',
      input: [1, 2, 3],
    });
    expect(r.status, JSON.stringify(r.body)).toBe(400);
    expect(r.body.error.code).toBe('request.invalidEnvelope');
  });
});

describe('bug #27 — idempotencyKey conflict info disclosure (item 2)', () => {
  it('does not disclose the prior operation name in conflict response', async () => {
    mockState.user = { id: 'admin-user', email: 'admin@example.com' };
    mockState.tables.members = [
      { id: 1, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' },
    ];

    // First call seeds an idempotency key under operation A.
    const first = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'pages.create',
      phase: 'execute',
      idempotencyKey: 'shared-key',
      input: { title: 'A', slug: 'a' },
    });
    expect(first.status, JSON.stringify(first.body)).toBe(200);

    // Second call reuses the key but with operation B — should conflict but
    // not leak the existing op name.
    const conflict = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'sections.create',
      phase: 'execute',
      idempotencyKey: 'shared-key',
      input: { section_type: 'hero', config: {}, position: 1 },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('conflict.idempotencyKey');
    const detailJson = JSON.stringify(conflict.body.error.detail || {});
    expect(detailJson).not.toMatch(/pages\.create/);
    expect(detailJson).not.toContain('existingOperation');
  });
});

describe('bug #27 — anon validate-phase enumeration (item 3)', () => {
  it('does not expose required-state hints to anonymous callers', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'members.changeRole',
      phase: 'validate',
      input: { id: 1, role: 'admin' },
    });
    // Either deny outright (recommended) or strip requiredState from the
    // permission detail. Both close the enumeration oracle.
    if (r.status === 200) {
      expect(r.body.data.permission?.requiredState).toBeUndefined();
    } else {
      expect(r.status).toBe(403);
    }
  });
});

describe('bug #27 — config.get visibility (item 4)', () => {
  it('only exposes public categories (branding/features/theme/demo) to anonymous', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'config.get',
      phase: 'query',
      input: {},
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const keys = (r.body.data.rows || []).map((row: JsonObject) => row.key);
    expect(keys).toContain('site_name');
    expect(keys).toContain('feature_polls');
    expect(keys).not.toContain('webhook_url');
    expect(keys).not.toContain('integration_token');
  });

  it('exposes a private key to admins', async () => {
    mockState.user = { id: 'admin-user', email: 'admin@example.com' };
    mockState.tables.members = [
      { id: 1, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' },
    ];
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'config.get',
      phase: 'query',
      input: {},
    });
    expect(r.status).toBe(200);
    const keys = (r.body.data.rows || []).map((row: JsonObject) => row.key);
    expect(keys).toContain('webhook_url');
  });
});

describe('bug #27 — created_by / author_id leak in anonymous list (item 5)', () => {
  it('events.list strips created_by from anonymous projections', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'events.list',
      phase: 'query',
      input: {},
    });
    expect(r.status).toBe(200);
    for (const row of r.body.data.rows as JsonObject[]) {
      expect(row.created_by, JSON.stringify(row)).toBeUndefined();
    }
  });

  it('announcements.list strips author_id from anonymous projections', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'announcements.list',
      phase: 'query',
      input: {},
    });
    expect(r.status).toBe(200);
    for (const row of r.body.data.rows as JsonObject[]) {
      expect(row.author_id, JSON.stringify(row)).toBeUndefined();
    }
  });

  it('events.list keeps created_by visible to admins', async () => {
    mockState.user = { id: 'admin-user', email: 'admin@example.com' };
    mockState.tables.members = [
      { id: 1, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' },
    ];
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'events.list',
      phase: 'query',
      input: {},
    });
    expect(r.status).toBe(200);
    expect(r.body.data.rows[0].created_by).toBe(42);
  });
});

describe('bug #27 — requiredAny accepts empty string (item 6)', () => {
  it('rejects empty-string id with validation.failed', async () => {
    mockState.user = { id: 'admin-user', email: 'admin@example.com' };
    mockState.tables.members = [
      { id: 1, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' },
    ];
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'pages.update',
      phase: 'execute',
      idempotencyKey: 'pages-update-empty-id',
      input: { id: '', title: 'X' },
    });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation.failed');
  });
});
