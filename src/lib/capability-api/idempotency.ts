import type { CapabilityActor } from './actor.js';
import type { ActionResult, ActorReference, AuditRef, JsonValue, ObjectRef, OperationName, QueryRef } from './types.js';

export type IdempotencyStatus = 'started' | 'succeeded' | 'failed';

export interface CapabilityExecutionRecord {
  apiVersion: string;
  operation: string;
  idempotencyKey: string;
  actor: ActorReference;
  actorState: CapabilityActor['state'];
  inputDigest: string;
  status: IdempotencyStatus;
  resultDigest: string | null;
  resultPayload: JsonValue | null;
  errorPayload: JsonValue | null;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityExecutionStore {
  findExecution(apiVersion: string, idempotencyKey: string): Promise<CapabilityExecutionRecord | null>;
  createExecution(record: CapabilityExecutionRecord): Promise<CapabilityExecutionRecord>;
  updateExecution(record: CapabilityExecutionRecord): Promise<CapabilityExecutionRecord>;
}

export type IdempotencyBeginDecision =
  | { kind: 'started'; record: CapabilityExecutionRecord }
  | { kind: 'replay'; record: CapabilityExecutionRecord; result: JsonValue | null }
  | { kind: 'resume'; record: CapabilityExecutionRecord }
  | { kind: 'pending'; record: CapabilityExecutionRecord }
  | { kind: 'conflict'; record: CapabilityExecutionRecord; reason: string };

export interface BeginCapabilityExecutionInput {
  store: CapabilityExecutionStore;
  apiVersion: string;
  operation: OperationName | string;
  idempotencyKey: string;
  actor: CapabilityActor;
  input: JsonValue;
  correlationId: string;
  now?: Date;
  staleAfterMs?: number;
}

export async function beginCapabilityExecution(input: BeginCapabilityExecutionInput): Promise<IdempotencyBeginDecision> {
  const now = input.now || new Date();
  const inputDigest = await digestJson(input.input);
  const existing = await input.store.findExecution(input.apiVersion, input.idempotencyKey);

  if (existing) {
    if (existing.operation !== input.operation) {
      return { kind: 'conflict', record: existing, reason: 'Idempotency key was used with another operation.' };
    }
    if (existing.inputDigest !== inputDigest) {
      return { kind: 'conflict', record: existing, reason: 'Idempotency key was used with different input.' };
    }
    if (existing.status === 'succeeded') return { kind: 'replay', record: existing, result: existing.resultPayload };
    if (isStale(existing, now, input.staleAfterMs)) return { kind: 'resume', record: existing };
    return { kind: 'pending', record: existing };
  }

  const record: CapabilityExecutionRecord = {
    apiVersion: input.apiVersion,
    operation: String(input.operation),
    idempotencyKey: input.idempotencyKey,
    actor: actorReference(input.actor),
    actorState: input.actor.state,
    inputDigest,
    status: 'started',
    resultDigest: null,
    resultPayload: null,
    errorPayload: null,
    correlationId: input.correlationId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return { kind: 'started', record: await input.store.createExecution(record) };
}

export async function completeCapabilityExecution(
  store: CapabilityExecutionStore,
  record: CapabilityExecutionRecord,
  result: JsonValue,
  now = new Date(),
): Promise<CapabilityExecutionRecord> {
  return store.updateExecution({
    ...record,
    status: 'succeeded',
    resultDigest: await digestJson(result),
    resultPayload: result,
    errorPayload: null,
    updatedAt: now.toISOString(),
  });
}

export async function failCapabilityExecution(
  store: CapabilityExecutionStore,
  record: CapabilityExecutionRecord,
  error: JsonValue,
  now = new Date(),
): Promise<CapabilityExecutionRecord> {
  return store.updateExecution({
    ...record,
    status: 'failed',
    resultDigest: null,
    resultPayload: null,
    errorPayload: error,
    updatedAt: now.toISOString(),
  });
}

export function changedObject(type: ObjectRef['type'], id: string | number, extra: Omit<ObjectRef, 'type' | 'id'> = {}): ObjectRef {
  return {
    type,
    id: String(id),
    ...extra,
  };
}

export function auditReference(id: string | number, action: string, at?: string) {
  return {
    object: changedObject('activityEntry', id),
    action,
    ...(at ? { at } : {}),
  };
}

export function verificationQuery(operation: OperationName, input: QueryRef['input'], object?: ObjectRef): QueryRef {
  return {
    operation,
    phase: 'query',
    input,
    ...(object ? { object } : {}),
  };
}

export function actionResult<Result extends JsonValue>(
  result: Result,
  changed: ObjectRef[],
  verify: QueryRef | null,
  audit: AuditRef | null = null,
): ActionResult<Result> {
  return {
    result,
    changed,
    audit,
    verify,
  };
}

export async function digestJson(value: JsonValue): Promise<string> {
  const bytes = new TextEncoder().encode(stableJsonStringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function stableJsonStringify(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJsonStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
    .join(',')}}`;
}

function actorReference(actor: CapabilityActor): ActorReference {
  if (actor.member) {
    const ref: ActorReference = { type: 'member', id: actor.member.id };
    if (actor.member.email) ref.email = actor.member.email;
    return ref;
  }
  if (actor.user) {
    const ref: ActorReference = { type: 'user', id: actor.user.id };
    if (actor.user.email) ref.email = actor.user.email;
    return ref;
  }
  return { type: 'anonymous' };
}

function isStale(record: CapabilityExecutionRecord, now: Date, staleAfterMs = 5 * 60 * 1000): boolean {
  return now.getTime() - new Date(record.updatedAt).getTime() > staleAfterMs;
}
