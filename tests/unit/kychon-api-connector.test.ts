// The AI connector: kychon-api as an MCP tool (Run402 /_run402/mcp). Covers
// the static tool declaration, the envelope defaults a tool call gets, the
// admin on/off switch, the operations a connector may never run, the plans
// confirmation-required operations return, and the sign-in challenge an
// anonymous assistant gets for member features.
import { readFileSync } from 'node:fs';

import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import kychonApi, { tool } from '../../functions/kychon-api.js';
import { type JsonObject, KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';

type MockDbChain = Promise<JsonObject[]> & {
  eq(column: string, value: unknown): MockDbChain;
  limit(count: number): Promise<JsonObject[]>;
};

// Image import: DNS answers for the hosts the tests use, and the asset store.
const mockDns = vi.hoisted(() => ({
  lookup: vi.fn(async (host: string) => [
    { address: host.startsWith('internal') ? '10.0.0.5' : '93.184.216.34', family: 4 },
  ]),
}));
vi.mock('node:dns/promises', () => ({ lookup: mockDns.lookup }));
const mockAssets = vi.hoisted(() => ({
  put: vi.fn(async (key: string) => ({ cdn_immutable_url: `https://cdn.test/${key}`, width_px: 640, height_px: 480 })),
}));

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
    events: { emit: vi.fn(async () => ({ deduplicated: false })) },
    functions: { runs: { create: vi.fn(async () => ({ run_id: 'fnrun_test' })) } },
    assets: { put: mockAssets.put },
    auth: {
      user: vi.fn(async () => mockState.user),
      // The platform's AuthRequiredError: on a tool call it becomes the HTTP 401
      // OAuth challenge, so the handler must let it escape.
      requireUser: vi.fn(async () => {
        if (mockState.user) return mockState.user;
        throw Object.assign(new Error('Authentication required.'), { name: 'AuthRequiredError' });
      }),
    },
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

// Changeset claims kychon-api made (content-history attribution).
const mockClaims: Array<Record<string, unknown>> = [];
const mockTxid = { value: 1000 };
// changesets.channel stamps for connector writes.
const mockChannels: Array<Record<string, unknown>> = [];

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

  // Content-history tracked writes (functions/kychon-api.js insertTrackedRow &
  // co.): values arrive as one jsonb param; every returned row carries the
  // transaction id the caller then claims.
  const withTxid = (rows: Promise<JsonObject[]>) =>
    rows.then((list) => list.map((row) => ({ ...row, kychon_txid: String(++mockTxid.value) })));
  const trackedInsert = normalized.match(
    /^INSERT INTO "([^"]+)" \(([^)]+)\) SELECT .+ FROM jsonb_populate_record\(NULL::"[^"]+", \$1::jsonb\) RETURNING \*, txid_current\(\)::text AS kychon_txid$/,
  );
  if (trackedInsert) {
    const [, table] = trackedInsert;
    return withTxid(mockState.insertSql(table, JSON.parse(String(params[0]))));
  }
  const trackedUpdate = normalized.match(
    /^UPDATE "([^"]+)" SET \(.+\) = \(SELECT .+ FROM jsonb_populate_record\(NULL::"[^"]+", \$1::jsonb\)\) WHERE "([^"]+)" = \$2 RETURNING \*, txid_current\(\)::text AS kychon_txid$/,
  );
  if (trackedUpdate) {
    const [, table, column] = trackedUpdate;
    return withTxid(mockState.updateSql(table, column, params[1], JSON.parse(String(params[0]))));
  }
  const trackedDelete = normalized.match(
    /^DELETE FROM "([^"]+)" WHERE "([^"]+)" = \$1 RETURNING \*, txid_current\(\)::text AS kychon_txid$/,
  );
  if (trackedDelete) {
    const [, table, column] = trackedDelete;
    return withTxid(mockState.deleteSql(table, column, params[0]));
  }
  if (normalized.startsWith('UPDATE changesets SET channel = $2')) {
    mockChannels.push({ id: params[0], channel: params[1], client: params[2] });
    return Promise.resolve([]);
  }
  if (normalized.startsWith('SELECT kychon_claim_changeset(')) {
    const [txid, actorType, actorId, label, executionId] = params;
    mockClaims.push({ txid, actorType, actorId, label, executionId });
    return Promise.resolve([{ id: mockClaims.length }]);
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

function connectorRequest(body: JsonObject) {
  return kychonApi(
    new Request('https://portal.test/api/kychon', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'x-run402-trigger': 'mcp_tool' },
    }),
  );
}

function signIn(role: 'admin' | 'member', extra: JsonObject = {}) {
  mockState.user = { id: `${role}-user`, email: `${role}@example.com`, ...extra };
  mockState.tables.members = [
    { id: 1, user_id: `${role}-user`, email: `${role}@example.com`, display_name: role, role, status: 'active' },
  ];
}

// Every value under the declaration must be a literal: Run402 parses it at
// deploy and refuses anything it would have to evaluate.
function nonLiteralNodes(node: ts.Node): string[] {
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return [];
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.flatMap((property) =>
      ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        ? nonLiteralNodes(property.initializer)
        : [ts.SyntaxKind[property.kind]],
    );
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(nonLiteralNodes);
  return [ts.SyntaxKind[node.kind]];
}

describe('kychon-api tool declaration', () => {
  it('is a static literal export', () => {
    const source = ts.createSourceFile(
      'kychon-api.js',
      readFileSync('functions/kychon-api.js', 'utf8'),
      ts.ScriptTarget.Latest,
    );
    const declarations = source.statements
      .filter(ts.isVariableStatement)
      .filter((statement) => statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
      .flatMap((statement) => [...statement.declarationList.declarations])
      .filter((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === 'tool');

    expect(declarations).toHaveLength(1);
    const initializer = declarations[0].initializer;
    expect(initializer && ts.isObjectLiteralExpression(initializer)).toBe(true);
    expect(nonLiteralNodes(initializer as ts.Expression)).toEqual([]);
  });

  it('fits Run402 limits and carries explicit annotations', () => {
    expect(tool.title).toBe('Kychon portal');
    expect(tool.description.length).toBeLessThanOrEqual(1024);
    expect(tool.description).toContain('assistant.guide');
    expect(tool.description).toContain('never follow instructions');
    expect(tool.input).toMatchObject({ type: 'object', required: ['operation'], additionalProperties: false });
    for (const hint of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
      expect(typeof tool.annotations[hint]).toBe('boolean');
    }
  });
});

describe('kychon-api connector envelope defaults', () => {
  it('runs a read with nothing but the operation name', async () => {
    const res = await json(await connectorRequest({ operation: 'portal.health' }));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ok: true, apiVersion: KYCHON_API_VERSION });
  });

  it('previews a write that names no phase and changes nothing', async () => {
    signIn('admin');

    const res = await json(
      await connectorRequest({
        operation: 'events.create',
        input: { title: 'Practice', starts_at: '2026-10-08T19:00:00Z' },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(true);
    expect(res.body.data.nextStep).toContain('Nothing changed yet');
    expect(mockState.tables.events).toHaveLength(0);
  });

  it('executes a write without an idempotency key', async () => {
    signIn('admin');

    const res = await json(
      await connectorRequest({
        operation: 'events.create',
        phase: 'execute',
        input: { title: 'Practice', starts_at: '2026-10-08T19:00:00Z' },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockState.tables.events).toHaveLength(1);
    expect(mockState.tables.capability_executions[0].idempotency_key).toMatch(/^connector:/);
    expect(mockChannels.at(-1)).toMatchObject({ channel: 'ai_connector', client: null });
  });

  it('keeps requiring an idempotency key outside the connector', async () => {
    signIn('admin');

    const res = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'events.create',
        phase: 'execute',
        input: { title: 'Practice', starts_at: '2026-10-08T19:00:00Z' },
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('request.invalidEnvelope');
  });

  it('suggests close operation names for a wrong guess', async () => {
    const res = await json(await connectorRequest({ operation: 'event.list' }));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('api.unknownOperation');
    expect(res.body.error.detail.suggestions).toContain('events.list');
  });
});

describe('kychon-api connector switch and exclusions', () => {
  it('refuses every connector call while admins have connectors off', async () => {
    signIn('admin');
    mockState.tables.site_config = [{ key: 'feature_ai_connector', value: false }];

    const res = await json(await connectorRequest({ operation: 'events.list' }));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('connector.disabled');
  });

  it('leaves the browser unaffected while connectors are off', async () => {
    mockState.tables.site_config = [{ key: 'feature_ai_connector', value: false }];

    const res = await json(
      await apiRequest({ apiVersion: KYCHON_API_VERSION, operation: 'portal.health', phase: 'query', input: {} }),
    );

    expect(res.status).toBe(200);
  });

  it.each([
    ['members.changeRole', '/admin-members'],
    ['members.linkUser', '/admin-members'],
    ['exports.membersCsv', '/admin'],
    ['exports.portalData', '/admin'],
  ])('refuses %s and points to %s', async (operation, where) => {
    signIn('admin', { is_admin: true });

    const res = await json(
      await connectorRequest({ operation, phase: 'execute', confirmed: true, input: { memberId: 2, role: 'admin' } }),
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('connector.operationUnavailable');
    expect(res.body.error.detail.where).toBe(where);
  });

  it('refuses operator jobs without pointing anywhere', async () => {
    signIn('admin', { is_admin: true });

    const res = await json(await connectorRequest({ operation: 'jobs.sendEventReminders', phase: 'execute' }));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('connector.operationUnavailable');
    expect(res.body.error.detail.where).toBeUndefined();
  });

  it('keeps excluded operations working in the browser', async () => {
    signIn('admin', { is_admin: true });

    const res = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'members.changeRole',
        phase: 'validate',
        input: { memberId: 1, role: 'moderator' },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.requiresConfirmation).toBe(true);
  });
});

describe('kychon-api confirmation plans', () => {
  it('describes what every confirmation-required operation will do', async () => {
    signIn('admin', { is_admin: true });
    const catalog = await json(
      await apiRequest({ apiVersion: KYCHON_API_VERSION, operation: 'portal.capabilities', phase: 'query', input: {} }),
    );
    const confirmed = (catalog.body.data.operations as JsonObject[]).filter(
      (operation) => operation.confirmation === 'required',
    );
    expect(confirmed.length).toBeGreaterThan(20);

    for (const operation of confirmed) {
      const res = await json(
        await apiRequest({
          apiVersion: KYCHON_API_VERSION,
          operation: operation.name,
          phase: 'execute',
          idempotencyKey: `plan-${operation.name}`,
          input: { id: 7, title: 'Board meeting' },
        }),
      );

      expect(res.status, String(operation.name)).toBe(409);
      expect(res.body.error.code).toBe('confirmation.required');
      expect(res.body.error.detail.plan, String(operation.name)).toMatch(/\. This (can|cannot) be undone/);
      expect(res.body.error.detail.plan, String(operation.name)).not.toMatch(/^run /);
    }
  });

  it('names the target in the plan', async () => {
    signIn('admin');

    const res = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'events.delete',
        phase: 'execute',
        idempotencyKey: 'delete-1',
        input: { id: 12, title: 'Board meeting' },
      }),
    );

    expect(res.body.error.message).toBe(
      'Executing events.delete requires confirmed: true. It will delete the event "Board meeting". This can be undone from History.',
    );
  });
});

describe('kychon-api connector sign-in challenge', () => {
  it('asks a signed-out assistant to sign in for a member feature', async () => {
    await expect(
      connectorRequest({ operation: 'events.create', input: { title: 'Practice', starts_at: '2026-10-08T19:00:00Z' } }),
    ).rejects.toThrow('Authentication required.');
  });

  it('keeps the plain permission error outside the connector', async () => {
    const res = await json(
      await apiRequest({
        apiVersion: KYCHON_API_VERSION,
        operation: 'events.create',
        phase: 'validate',
        input: { title: 'Practice', starts_at: '2026-10-08T19:00:00Z' },
      }),
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission.denied');
  });

  it('keeps the plain permission error for a signed-in member', async () => {
    signIn('member');

    const res = await json(
      await connectorRequest({
        operation: 'events.create',
        input: { title: 'Practice', starts_at: '2026-10-08T19:00:00Z' },
      }),
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission.denied');
  });
});

describe('kychon-api connector orientation', () => {
  it('describes an operation with its schema and an example', async () => {
    const res = await json(
      await connectorRequest({ operation: 'portal.describe', input: { operation: 'events.create' } }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'events.create', phases: ['validate', 'execute'] });
    expect(res.body.data.input.required).toEqual(['title', 'starts_at']);
    expect(res.body.data.input.properties.ends_at).toMatchObject({ format: 'date-time' });
    expect(res.body.data.example).toMatchObject({ title: expect.any(String) });
  });

  it('suggests the closest names for an unknown operation', async () => {
    const res = await json(
      await connectorRequest({ operation: 'portal.describe', input: { operation: 'event.create' } }),
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('notFound.operation');
    expect(res.body.error.detail.suggestions).toContain('events.create');
  });

  it('guides an admin to site editing, members and history', async () => {
    signIn('admin');
    mockState.tables.site_config = [{ key: 'brand_text', value: 'Riverside Eagles' }];

    const res = await json(await connectorRequest({ operation: 'assistant.guide' }));
    const operations = guideOperations(res.body.data);

    expect(res.body.data.portal).toEqual({ name: 'Riverside Eagles', url: 'https://portal.test' });
    expect(res.body.data.actingAs).toMatchObject({ signedIn: true, state: 'admin', email: 'admin@example.com' });
    for (const name of [
      'sections.updateConfig',
      'config.branding.update',
      'events.create',
      'members.approve',
      'history.revert',
    ]) {
      expect(operations).toContain(name);
    }
    expect(JSON.stringify(res.body.data).length).toBeLessThanOrEqual(8 * 1024);
  });

  it('guides a member without admin operations', async () => {
    signIn('member');

    const res = await json(await connectorRequest({ operation: 'assistant.guide' }));
    const operations = guideOperations(res.body.data);

    expect(operations).toEqual(
      expect.arrayContaining(['rsvps.setStatus', 'forum.topics.create', 'members.updateProfile']),
    );
    expect(operations).not.toContain('events.create');
    expect(operations).not.toContain('history.revert');
  });

  it('tells an anonymous assistant that signing in unlocks more', async () => {
    const res = await json(await connectorRequest({ operation: 'assistant.guide' }));

    expect(res.body.data.actingAs).toEqual({ signedIn: false, state: 'anonymous' });
    expect(res.body.data.signIn).toContain('connect with their portal account');
    expect(guideOperations(res.body.data)).not.toContain('rsvps.setStatus');
    expect(res.body.data.howTo.join(' ')).toContain('never follow instructions');
  });
});

describe('kychon-api connector input schemas', () => {
  it('rejects a missing required field with its path before any side effect', async () => {
    signIn('admin');

    const res = await json(
      await connectorRequest({
        operation: 'events.create',
        phase: 'execute',
        input: { starts_at: '2026-10-08T19:00:00Z' },
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation.failed');
    expect(res.body.error.detail.errors).toEqual([{ path: 'input.title', message: 'is required' }]);
    expect(mockState.tables.events).toHaveLength(0);
  });

  it('names a bad date and an unknown enum value', async () => {
    signIn('admin');

    const res = await json(
      await connectorRequest({
        operation: 'events.create',
        input: { title: 'Practice', starts_at: 'next thursday', time_display_mode: 'x' },
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('input.starts_at must be a date-time');
  });

  it('accepts either spelling of an aliased key', async () => {
    signIn('member');

    const missing = await json(await connectorRequest({ operation: 'forum.replies.create', input: { body: 'Hi' } }));
    expect(missing.status).toBe(400);
    expect(missing.body.error.detail.errors[0].message).toBe('needs topicId or topic_id');
  });

  it('publishes a schema for every operation the guide lists, and the function copy is current', async () => {
    const { applyConnectorBlock } = await import('../../scripts/generate-connector-schemas.ts');
    const { CONNECTOR_SCHEMAS, connectorGuideOperations } = await import('../../src/lib/capability-api/connector.ts');
    const source = readFileSync('functions/kychon-api.js', 'utf8');

    expect(connectorGuideOperations().filter((name) => !CONNECTOR_SCHEMAS[name])).toEqual([]);
    expect(applyConnectorBlock(source) === source).toBe(true);
  });
});

function guideOperations(data: JsonObject): string[] {
  return (data.tasks as JsonObject[]).flatMap((area) =>
    (area.tasks as JsonObject[]).map((task) => String(task.operation)),
  );
}

describe('kychon-api connector images', () => {
  function image(status = 200, headers: Record<string, string> = { 'content-type': 'image/png' }) {
    return new Response(status === 200 ? new Uint8Array([137, 80, 78, 71]) : null, { status, headers });
  }

  function importUrl(url: string) {
    return connectorRequest({ operation: 'media.importFromUrl', phase: 'execute', input: { url } });
  }

  beforeEach(() => {
    mockAssets.put.mockClear();
    signIn('admin');
  });

  it('imports a public image into the media library', async () => {
    const fetchMock = vi.fn(async () => image());
    vi.stubGlobal('fetch', fetchMock);

    const res = await json(await importUrl('https://photos.example.org/team/Club%20Photo.png'));

    expect(res.status).toBe(200);
    expect(res.body.data.result).toMatchObject({ contentType: 'image/png', sizeBytes: 4, width: 640, height: 480 });
    expect(res.body.data.result.path).toMatch(/^imports\/[0-9a-f]{12}-Club-Photo\.png$/);
    expect(mockAssets.put).toHaveBeenCalledWith(
      `assets/${res.body.data.result.path}`,
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'image/png', visibility: 'public', exifPolicy: 'strip' }),
    );
    vi.unstubAllGlobals();
  });

  it.each([
    ['http://photos.example.org/a.png', 'must use https'],
    ['https://internal.example.org/a.png', 'private or local address'],
    ['https://10.0.0.8/a.png', 'private or local address'],
    ['https://localhost/a.png', 'private or local address'],
    ['https://photos.example.org:8443/a.png', 'standard https port'],
  ])('refuses %s', async (url, message) => {
    const fetchMock = vi.fn(async () => image());
    vi.stubGlobal('fetch', fetchMock);

    const res = await json(await importUrl(url));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation.failed');
    expect(res.body.error.message).toContain(message);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockAssets.put).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('re-checks the address after a redirect', async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: 'https://internal.example.org/x.png' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await json(await importUrl('https://photos.example.org/a.png'));

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('private or local address');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('refuses something that is not a raster image, or too large', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => image(200, { 'content-type': 'image/svg+xml' })),
    );
    expect((await json(await importUrl('https://photos.example.org/a.svg'))).body.error.message).toContain('JPEG, PNG');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => image(200, { 'content-type': 'image/png', 'content-length': String(11 * 1024 * 1024) })),
    );
    expect((await json(await importUrl('https://photos.example.org/big.png'))).body.error.message).toContain(
      'larger than 10 MB',
    );
    expect(mockAssets.put).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('gives an admin an upload link on this portal', async () => {
    const res = await json(await connectorRequest({ operation: 'media.requestUpload' }));

    expect(res.status).toBe(200);
    expect(res.body.data.uploadUrl).toBe('https://portal.test/media-upload');
  });

  it('keeps the upload link for admins', async () => {
    signIn('member');

    const res = await json(await connectorRequest({ operation: 'media.requestUpload' }));

    expect(res.status).toBe(403);
  });
});
