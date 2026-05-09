import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  KYCHON_API_VERSION,
  actionResult,
  auditReference,
  beginCapabilityExecution,
  changedObject,
  completeCapabilityExecution,
  digestJson,
  getOperation,
  verificationQuery,
  type CapabilityActor,
  type CapabilityExecutionRecord,
  type CapabilityExecutionStore,
} from '../../src/lib/capability-api/index.ts';

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

const adminActor: CapabilityActor = {
  state: 'admin',
  authenticated: true,
  user: { id: 'user-1', email: 'admin@example.com' },
  member: {
    id: '1',
    ref: { type: 'member', id: '1', label: 'Admin' },
    userId: 'user-1',
    email: 'admin@example.com',
    displayName: 'Admin',
    role: 'admin',
    status: 'active',
    lookup: 'user_id',
  },
  authority: {
    projectAdmin: false,
    activeMemberAdmin: true,
  },
};

describe('Capability API idempotency helpers', () => {
  it('creates a durable execution record for first execution', async () => {
    const store = new MemoryExecutionStore();
    const decision = await beginCapabilityExecution({
      store,
      apiVersion: KYCHON_API_VERSION,
      operation: getOperation('events.create')!.name,
      idempotencyKey: 'create-event-1',
      actor: adminActor,
      input: { title: 'Meetup' },
      correlationId: 'corr-1',
      now: new Date('2026-05-08T10:00:00Z'),
    });

    expect(decision.kind).toBe('started');
    expect(decision.record).toMatchObject({
      apiVersion: KYCHON_API_VERSION,
      operation: 'events.create',
      idempotencyKey: 'create-event-1',
      actorState: 'admin',
      status: 'started',
      resultPayload: null,
    });
    expect(decision.record.inputDigest).toHaveLength(64);
  });

  it('returns the original result for safe retries with the same key and input', async () => {
    const store = new MemoryExecutionStore();
    const started = await beginCapabilityExecution({
      store,
      apiVersion: KYCHON_API_VERSION,
      operation: getOperation('events.create')!.name,
      idempotencyKey: 'create-event-2',
      actor: adminActor,
      input: { startsAt: '2026-06-01', title: 'Meetup' },
      correlationId: 'corr-2',
    });
    expect(started.kind).toBe('started');

    await completeCapabilityExecution(store, started.record, { eventId: 42 });

    const retry = await beginCapabilityExecution({
      store,
      apiVersion: KYCHON_API_VERSION,
      operation: getOperation('events.create')!.name,
      idempotencyKey: 'create-event-2',
      actor: adminActor,
      input: { title: 'Meetup', startsAt: '2026-06-01' },
      correlationId: 'corr-2-retry',
    });

    expect(retry.kind).toBe('replay');
    expect(retry.result).toEqual({ eventId: 42 });
  });

  it('allows stale started executions to resume after a timeout simulation', async () => {
    const store = new MemoryExecutionStore();
    const started = await beginCapabilityExecution({
      store,
      apiVersion: KYCHON_API_VERSION,
      operation: getOperation('announcements.publish')!.name,
      idempotencyKey: 'publish-1',
      actor: adminActor,
      input: { title: 'News' },
      correlationId: 'corr-3',
      now: new Date('2026-05-08T10:00:00Z'),
    });
    expect(started.kind).toBe('started');

    const retry = await beginCapabilityExecution({
      store,
      apiVersion: KYCHON_API_VERSION,
      operation: getOperation('announcements.publish')!.name,
      idempotencyKey: 'publish-1',
      actor: adminActor,
      input: { title: 'News' },
      correlationId: 'corr-3-retry',
      now: new Date('2026-05-08T10:10:01Z'),
      staleAfterMs: 10 * 60 * 1000,
    });

    expect(retry.kind).toBe('resume');
  });

  it('returns conflicts for reused keys with different operation or input', async () => {
    const store = new MemoryExecutionStore();
    await beginCapabilityExecution({
      store,
      apiVersion: KYCHON_API_VERSION,
      operation: getOperation('events.create')!.name,
      idempotencyKey: 'conflict-key',
      actor: adminActor,
      input: { title: 'Meetup' },
      correlationId: 'corr-4',
    });

    await expect(
      beginCapabilityExecution({
        store,
        apiVersion: KYCHON_API_VERSION,
        operation: getOperation('events.update')!.name,
        idempotencyKey: 'conflict-key',
        actor: adminActor,
        input: { title: 'Meetup' },
        correlationId: 'corr-4b',
      }).then((decision) => decision.kind),
    ).resolves.toBe('conflict');

    await expect(
      beginCapabilityExecution({
        store,
        apiVersion: KYCHON_API_VERSION,
        operation: getOperation('events.create')!.name,
        idempotencyKey: 'conflict-key',
        actor: adminActor,
        input: { title: 'Different' },
        correlationId: 'corr-4c',
      }).then((decision) => decision.kind),
    ).resolves.toBe('conflict');
  });

  it('exposes changed object, audit, verification, and action result helpers', () => {
    const event = changedObject('event', 42, { label: 'Meetup' });
    const audit = auditReference(99, 'events.create', '2026-05-08T10:00:00Z');
    const verify = verificationQuery(getOperation('events.get')!.name, { id: 42 }, event);

    expect(actionResult({ id: 42 }, [event], verify, audit)).toEqual({
      result: { id: 42 },
      changed: [event],
      audit,
      verify,
    });
  });

  it('uses stable JSON digests independent of object key ordering', async () => {
    await expect(digestJson({ b: 2, a: 1 })).resolves.toBe(await digestJson({ a: 1, b: 2 }));
  });
});

describe('Capability API execution ledger schema', () => {
  it('adds durable storage for idempotent capability executions', () => {
    const schema = readFileSync(join(import.meta.dirname, '../../schema.sql'), 'utf8');

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS capability_executions');
    expect(schema).toContain('UNIQUE(api_version, idempotency_key)');
    expect(schema).toContain('input_digest TEXT NOT NULL');
    expect(schema).toContain('result_payload JSONB');
    expect(schema).toContain('actor_ref JSONB NOT NULL');
  });
});
