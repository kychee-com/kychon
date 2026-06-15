export const KYCHON_API_VERSION = '2026-05-08' as const;

export const SUPPORTED_API_VERSIONS = [KYCHON_API_VERSION] as const;

export type KychonApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

export const OPERATION_PHASES = ['query', 'validate', 'execute'] as const;

export type OperationPhase = (typeof OPERATION_PHASES)[number];

export const ACTOR_STATES = [
  'anonymous',
  'authenticated_non_member',
  'pending_member',
  'active_member',
  'moderator',
  'admin',
  'project_admin',
] as const;

export type ActorState = (typeof ACTOR_STATES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface CapabilityRequestEnvelope<Input = JsonObject> {
  apiVersion: KychonApiVersion | string;
  operation: string;
  phase: OperationPhase;
  input: Input;
  idempotencyKey?: string;
  confirmed?: boolean;
  onBehalfOf?: ActorReference;
}

export interface CapabilitySuccessEnvelope<Data = JsonValue> {
  ok: true;
  correlationId: string;
  data: Data;
  warnings?: CapabilityWarning[];
}

export interface CapabilityErrorEnvelope {
  ok: false;
  correlationId: string;
  error: CapabilityError;
}

export type CapabilityResponseEnvelope<Data = JsonValue> = CapabilitySuccessEnvelope<Data> | CapabilityErrorEnvelope;

export interface CapabilityError {
  code: ErrorCode;
  message: string;
  detail?: JsonObject;
  retryable: boolean;
  field?: string;
  object?: ObjectRef;
}

export interface ObjectRef {
  type: ObjectType;
  id: string;
  label?: string;
  url?: string;
}

export interface ActorReference {
  type: 'anonymous' | 'user' | 'member' | 'projectAdmin' | 'service';
  id?: string;
  email?: string;
}

export interface PermissionCheck {
  allowed: boolean;
  actorState: ActorState;
  requiredState?: ActorState;
  permission?: string;
  reason?: string;
}

export interface CapabilityWarning {
  code: string;
  message: string;
  detail?: JsonObject;
  object?: ObjectRef;
}

export interface SideEffect {
  type: 'create' | 'update' | 'delete' | 'publish' | 'send' | 'export' | 'upload' | 'translate' | 'job' | 'audit';
  object: ObjectRef;
  description?: string;
}

export interface CostEstimate {
  class: CostClass;
  estimatedUnits?: number;
  estimatedUsd?: number;
  boundedBy?: string;
  rationale?: string;
}

export interface AuditRef {
  object: ObjectRef;
  action: string;
  at?: string;
}

export interface QueryRef<Input = JsonObject> {
  operation: OperationName;
  phase: Extract<OperationPhase, 'query'>;
  input: Input;
  object?: ObjectRef;
}

export interface ActionPlan<NormalizedInput = JsonValue> {
  accepted: boolean;
  normalizedInput: NormalizedInput;
  requiresConfirmation: boolean;
  permission: PermissionCheck;
  warnings: CapabilityWarning[];
  sideEffects: SideEffect[];
  cost: CostEstimate | null;
}

export interface ActionResult<Result = JsonValue> {
  result: Result;
  changed: ObjectRef[];
  audit: AuditRef | null;
  verify: QueryRef | null;
}

export type CostClass = 'free' | 'metered' | 'expensive' | 'external' | 'privateData';

export type ConfirmationPolicy = 'never' | 'recommended' | 'required';

export type SchemaRef = string;

export interface OperationAuthMetadata {
  minimumActorState: ActorState;
  permission?: string;
  allowAnonymous?: boolean;
}

export interface OperationDeprecationMetadata {
  deprecated: boolean;
  since?: KychonApiVersion | string;
  replacedBy?: OperationName;
  sunsetAt?: string;
  note?: string;
}

export interface OperationRegistryEntry {
  name: OperationName;
  phases: readonly OperationPhase[];
  auth: OperationAuthMetadata;
  confirmation: ConfirmationPolicy;
  costClass: CostClass;
  inputSchema: SchemaRef;
  outputSchema: SchemaRef;
  deprecation: OperationDeprecationMetadata;
  summary: string;
}

export type ObjectType = (typeof OBJECT_TYPES)[number];

export type ErrorCode = (typeof ERROR_CODES)[number];

export type OperationName = string & { readonly __operationName: unique symbol };

export const OBJECT_TYPES = [
  'portal',
  'config.entry',
  'page',
  'section',
  'member',
  'member.tier',
  'member.field',
  'event',
  'event.registrationOption',
  'event.rsvp',
  'announcement',
  'resource',
  'asset',
  'forum.category',
  'forum.topic',
  'forum.reply',
  'poll',
  'poll.option',
  'poll.vote',
  'committee',
  'committee.member',
  'reaction',
  'moderation.review',
  'translation',
  'newsletterDraft',
  'insight',
  'activityEntry',
  'job',
] as const;

export const ERROR_CODES = [
  'request.invalidJson',
  'request.invalidEnvelope',
  'api.unsupportedVersion',
  'api.unknownOperation',
  'api.unsupportedPhase',
  'auth.required',
  'auth.invalidToken',
  'permission.denied',
  'validation.failed',
  'conflict.idempotencyKey',
  'conflict.state',
  'notFound.object',
  'confirmation.required',
  'rateLimit.exceeded',
  'cost.limitExceeded',
  'api.notImplemented',
  'internal.error',
] as const;
