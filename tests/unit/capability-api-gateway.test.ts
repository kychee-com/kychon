import { describe, expect, it, vi } from 'vitest';

import { KYCHON_API_VERSION, handleCapabilityApiRequest, type MemberRowLike } from '../../src/lib/capability-api/index.ts';

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
}: {
  user?: { id?: string; email?: string; app_metadata?: Record<string, unknown> } | null;
  members?: MemberRowLike[];
} = {}) {
  return {
    createCorrelationId: () => 'corr-test',
    getUser: vi.fn(async () => user),
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
    expect(out.body.data.operations.some((operation: { name: string }) => operation.name === 'forum.topics.create')).toBe(
      true,
    );
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
      request({ apiVersion: KYCHON_API_VERSION, operation: 'events.create', phase: 'validate', input: { title: 'Meet' } }),
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
      request({ apiVersion: KYCHON_API_VERSION, operation: 'events.create', phase: 'execute', input: { title: 'Meet' } }),
      deps({
        user: { id: 'admin-user' },
        members: [{ id: 1, user_id: 'admin-user', role: 'admin', status: 'active' }],
      }),
    );
    const out = await json(res);

    expect(out.status).toBe(400);
    expect(out.body.error.code).toBe('request.invalidEnvelope');
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
