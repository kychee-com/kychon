import { describe, expect, it, vi } from 'vitest';

import {
  type CapabilityExecutionRecord,
  type CapabilityExecutionStore,
  type CapabilityMutationDb,
  handleCapabilityApiRequest,
  type JsonObject,
  KYCHON_API_VERSION,
  type MemberRowLike,
} from '../../src/lib/capability-api/index.ts';

class MemoryMutationDb implements CapabilityMutationDb {
  counters: Record<string, number> = {};

  constructor(public tables: Record<string, JsonObject[]>) {}

  async select(table: string) {
    return this.tables[table] || [];
  }

  async insert(table: string, row: JsonObject) {
    const nextId = (this.counters[table] || this.maxId(table)) + 1;
    this.counters[table] = nextId;
    const created = { id: nextId, ...row };
    this.tables[table] = [...(this.tables[table] || []), created];
    return created;
  }

  async update(table: string, id: string | number, patch: JsonObject) {
    const rows = this.tables[table] || [];
    const index = rows.findIndex((row) => String(row.id) === String(id) || String(row.key) === String(id));
    if (index < 0) return null;
    rows[index] = { ...rows[index], ...patch };
    return rows[index];
  }

  async delete(table: string, id: string | number) {
    const rows = this.tables[table] || [];
    const index = rows.findIndex((row) => String(row.id) === String(id));
    if (index < 0) return null;
    const [deleted] = rows.splice(index, 1);
    return deleted || null;
  }

  private maxId(table: string) {
    return Math.max(0, ...(this.tables[table] || []).map((row) => Number(row.id || 0)));
  }
}

class MemoryExecutionStore implements CapabilityExecutionStore {
  records = new Map<string, CapabilityExecutionRecord>();

  async findExecution(apiVersion: string, idempotencyKey: string) {
    return this.records.get(`${apiVersion}:${idempotencyKey}`) || null;
  }

  async createExecution(record: CapabilityExecutionRecord) {
    this.records.set(`${record.apiVersion}:${record.idempotencyKey}`, record);
    return record;
  }

  async updateExecution(record: CapabilityExecutionRecord) {
    this.records.set(`${record.apiVersion}:${record.idempotencyKey}`, record);
    return record;
  }
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://portal.test/functions/v1/kychon-api', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function deps({
  user = null,
  members = [],
  mutationDb,
  executionStore,
}: {
  user?: { id?: string; email?: string; app_metadata?: Record<string, unknown> } | null;
  members?: MemberRowLike[];
  mutationDb?: CapabilityMutationDb;
  executionStore?: CapabilityExecutionStore;
} = {}) {
  return {
    createCorrelationId: () => 'corr-test',
    getUser: vi.fn(async () => user),
    ...(mutationDb ? { mutationDb } : {}),
    ...(executionStore ? { executionStore } : {}),
    adminDb: () => ({
      from(table: string) {
        expect(table).toBe('members');
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                return {
                  limit(count: number) {
                    return members.filter((member) => member[column as keyof MemberRowLike] === value).slice(0, count);
                  },
                };
              },
            };
          },
        };
      },
    }),
  };
}

async function json(res: Response) {
  return {
    status: res.status,
    body: await res.json(),
  };
}

describe('Capability API gateway', () => {
  it('rejects invalid JSON with a typed error and correlation ID', async () => {
    const res = await handleCapabilityApiRequest(request('{bad json'), deps());
    const out = await json(res);

    expect(out.status).toBe(400);
    expect(out.body).toMatchObject({
      ok: false,
      correlationId: 'corr-test',
      error: { code: 'request.invalidJson' },
    });
  });

  it('rejects unsupported API versions', async () => {
    const res = await handleCapabilityApiRequest(
      request({ apiVersion: '2026-01-01', operation: 'portal.version', phase: 'query', input: {} }),
      deps(),
    );
    const out = await json(res);

    expect(out.status).toBe(400);
    expect(out.body.error.code).toBe('api.unsupportedVersion');
    expect(out.body.error.detail.supportedApiVersions).toEqual([KYCHON_API_VERSION]);
  });

  it('rejects unknown operations', async () => {
    const res = await handleCapabilityApiRequest(
      request({ apiVersion: KYCHON_API_VERSION, operation: 'events.teleport', phase: 'query', input: {} }),
      deps(),
    );
    const out = await json(res);

    expect(out.status).toBe(404);
    expect(out.body.error.code).toBe('api.unknownOperation');
  });

  it('rejects unsupported phases for known operations', async () => {
    const res = await handleCapabilityApiRequest(
      request({ apiVersion: KYCHON_API_VERSION, operation: 'events.list', phase: 'execute', input: {} }),
      deps(),
    );
    const out = await json(res);

    expect(out.status).toBe(400);
    expect(out.body.error.code).toBe('api.unsupportedPhase');
    expect(out.body.error.detail.supportedPhases).toEqual(['query']);
  });

  it('returns portal capabilities through the query dispatcher', async () => {
    const res = await handleCapabilityApiRequest(
      request(
        { apiVersion: KYCHON_API_VERSION, operation: 'portal.capabilities', phase: 'query', input: {} },
        { 'x-correlation-id': 'from-header' },
      ),
      deps(),
    );
    const out = await json(res);

    expect(out.status).toBe(200);
    expect(out.body.ok).toBe(true);
    expect(out.body.correlationId).toBe('from-header');
    expect(
      out.body.data.operations.some((operation: { name: string }) => operation.name === 'forum.topics.create'),
    ).toBe(true);
  });

  it('returns auth context from server-derived actor state', async () => {
    const res = await handleCapabilityApiRequest(
      request({ apiVersion: KYCHON_API_VERSION, operation: 'auth.whoami', phase: 'query', input: {} }),
      deps({
        user: { id: 'admin-user' },
        members: [{ id: 1, user_id: 'admin-user', role: 'admin', status: 'active' }],
      }),
    );
    const out = await json(res);

    expect(out.status).toBe(200);
    expect(out.body.data.actor.state).toBe('admin');
  });

  it('returns validation plans without requiring idempotency keys', async () => {
    const res = await handleCapabilityApiRequest(
      request({
        apiVersion: KYCHON_API_VERSION,
        operation: 'events.create',
        phase: 'validate',
        input: { title: 'Meet' },
      }),
      deps({
        user: { id: 'admin-user' },
        members: [{ id: 1, user_id: 'admin-user', role: 'admin', status: 'active' }],
      }),
    );
    const out = await json(res);

    expect(out.status).toBe(200);
    expect(out.body.data).toMatchObject({
      accepted: true,
      normalizedInput: { title: 'Meet' },
      requiresConfirmation: false,
    });
  });

  it('requires idempotency keys for execute-phase mutations', async () => {
    const res = await handleCapabilityApiRequest(
      request({
        apiVersion: KYCHON_API_VERSION,
        operation: 'events.create',
        phase: 'execute',
        input: { title: 'Meet' },
      }),
      deps({
        user: { id: 'admin-user' },
        members: [{ id: 1, user_id: 'admin-user', role: 'admin', status: 'active' }],
      }),
    );
    const out = await json(res);

    expect(out.status).toBe(400);
    expect(out.body.error.code).toBe('request.invalidEnvelope');
  });

  it('records, replays, and conflict-checks execute idempotency keys', async () => {
    const mutationDb = new MemoryMutationDb({ events: [], activity_log: [] });
    const executionStore = new MemoryExecutionStore();
    const baseDeps = deps({
      user: { id: 'admin-user' },
      members: [{ id: 1, user_id: 'admin-user', role: 'admin', status: 'active' }],
      mutationDb,
      executionStore,
    });
    const envelope = {
      apiVersion: KYCHON_API_VERSION,
      operation: 'events.create',
      phase: 'execute',
      idempotencyKey: 'event-create-1',
      input: { title: 'Meet', starts_at: '2026-06-01T10:00:00Z' },
    };

    const first = await json(await handleCapabilityApiRequest(request(envelope), baseDeps));
    const replay = await json(await handleCapabilityApiRequest(request(envelope), baseDeps));
    const conflict = await json(
      await handleCapabilityApiRequest(
        request({ ...envelope, input: { title: 'Changed', starts_at: '2026-06-01T10:00:00Z' } }),
        baseDeps,
      ),
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(first.body.data.result.id).toBe(1);
    expect(replay.body.data.result.id).toBe(1);
    expect(mutationDb.tables.events).toHaveLength(1);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('conflict.idempotencyKey');
  });

  it('returns notFound.object when approving a nonexistent member', async () => {
    const mutationDb = new MemoryMutationDb({
      members: [{ id: 1, display_name: 'Admin', role: 'admin', status: 'active', user_id: 'admin-user' }],
    });

    const res = await handleCapabilityApiRequest(
      request({
        apiVersion: KYCHON_API_VERSION,
        operation: 'members.approve',
        phase: 'execute',
        idempotencyKey: 'approve-missing-member',
        input: { id: 99999999 },
      }),
      deps({
        user: { id: 'admin-user' },
        members: [{ id: 1, user_id: 'admin-user', role: 'admin', status: 'active' }],
        mutationDb,
      }),
    );
    const out = await json(res);

    expect(out.status).toBe(404);
    expect(out.body).toMatchObject({
      ok: false,
      error: {
        code: 'notFound.object',
        detail: { object: { type: 'member', id: '99999999' } },
      },
    });
  });

  it('rejects missing confirmation for confirmation-required mutations', async () => {
    const res = await handleCapabilityApiRequest(
      request({
        apiVersion: KYCHON_API_VERSION,
        operation: 'events.delete',
        phase: 'execute',
        input: { id: '1' },
        idempotencyKey: 'delete-event-1',
      }),
      deps({
        user: { id: 'admin-user' },
        members: [{ id: 1, user_id: 'admin-user', role: 'admin', status: 'active' }],
      }),
    );
    const out = await json(res);

    expect(out.status).toBe(409);
    expect(out.body.error.code).toBe('confirmation.required');
  });
});
