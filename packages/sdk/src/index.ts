export const KYCHON_API_VERSION = '2026-05-08' as const;
export const SUPPORTED_API_VERSIONS = [KYCHON_API_VERSION] as const;
export const OPERATION_PHASES = ['query', 'validate', 'execute'] as const;
export const DEFAULT_RUN402_API_BASE_URL = 'https://api.run402.com';
export const KYCHON_CAPABILITY_FUNCTION_PATH = '/functions/v1/kychon-api';

export type KychonApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];
export type OperationPhase = (typeof OPERATION_PHASES)[number];
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type OperationName = string & { readonly __operationName: unique symbol };
export type ObjectType = (typeof OBJECT_TYPES)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];
export type ActorState = (typeof ACTOR_STATES)[number];
export type CostClass = 'free' | 'metered' | 'expensive' | 'external' | 'privateData';

export const ACTOR_STATES = [
  'anonymous',
  'authenticated_non_member',
  'pending_member',
  'active_member',
  'moderator',
  'admin',
  'project_admin',
] as const;

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
  'internal.error',
] as const;

export const OPERATION_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){1,2}$/;
export const OBJECT_TYPE_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;
export const ERROR_CODE_PATTERN =
  /^(request|api|auth|permission|validation|conflict|notFound|confirmation|rateLimit|cost|internal)\.[a-z][a-zA-Z0-9]*$/;

export interface ActorReference {
  type: 'anonymous' | 'user' | 'member' | 'projectAdmin' | 'service';
  id?: string;
  email?: string;
}

export interface ObjectRef {
  type: ObjectType;
  id: string;
  label?: string;
  url?: string;
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

export interface KychonDemoPortal {
  key: 'eagles' | 'silver-pines' | 'barrio-unido';
  deployKey: 'eagles' | 'silver-pines' | 'barrio';
  project: 'eagles' | 'silver-pines' | 'barrio-unido';
  name: string;
  organizationName: string;
  portalUrl: string;
  sdkCompatible: boolean;
}

export const KYCHON_DEMO_PORTALS = [
  {
    key: 'eagles',
    deployKey: 'eagles',
    project: 'eagles',
    name: 'Eagles',
    organizationName: 'The Eagles -- Good Samaritans of Wichita',
    portalUrl: 'https://eagles.kychon.com',
    sdkCompatible: true,
  },
  {
    key: 'silver-pines',
    deployKey: 'silver-pines',
    project: 'silver-pines',
    name: 'Silver Pines',
    organizationName: 'Silver Pines Senior Center',
    portalUrl: 'https://silver-pines.kychon.com',
    sdkCompatible: true,
  },
  {
    key: 'barrio-unido',
    deployKey: 'barrio',
    project: 'barrio-unido',
    name: 'Barrio Unido',
    organizationName: 'Centro Comunitario Barrio Unido',
    portalUrl: 'https://barrio.kychon.com',
    sdkCompatible: true,
  },
] as const satisfies readonly KychonDemoPortal[];

export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

const jsonValueSchema = {
  oneOf: [
    { type: 'null' },
    { type: 'boolean' },
    { type: 'number' },
    { type: 'string' },
    { type: 'array', items: { $ref: '#/$defs/jsonValue' } },
    { type: 'object', additionalProperties: { $ref: '#/$defs/jsonValue' } },
  ],
};

const objectRefSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'id'],
  properties: {
    type: {
      type: 'string',
      enum: [...OBJECT_TYPES],
      pattern: OBJECT_TYPE_PATTERN.source,
    },
    id: { type: 'string', minLength: 1 },
    label: { type: 'string' },
    url: { type: 'string' },
  },
};

const warningSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message'],
  properties: {
    code: { type: 'string', minLength: 1 },
    message: { type: 'string', minLength: 1 },
    detail: { type: 'object', additionalProperties: { $ref: '#/$defs/jsonValue' } },
    object: { $ref: '#/$defs/objectRef' },
  },
};

const permissionCheckSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['allowed', 'actorState'],
  properties: {
    allowed: { type: 'boolean' },
    actorState: { type: 'string' },
    requiredState: { type: 'string' },
    permission: { type: 'string' },
    reason: { type: 'string' },
  },
};

export const CAPABILITY_API_REQUEST_SCHEMA = {
  $schema: JSON_SCHEMA_DIALECT,
  $id: 'https://kychon.dev/schemas/capability-api/v1/request-envelope.json',
  title: 'Kychon Capability API Request Envelope',
  type: 'object',
  additionalProperties: false,
  required: ['apiVersion', 'operation', 'phase', 'input'],
  properties: {
    apiVersion: {
      type: 'string',
      enum: [...SUPPORTED_API_VERSIONS],
    },
    operation: {
      type: 'string',
      pattern: OPERATION_NAME_PATTERN.source,
    },
    phase: {
      type: 'string',
      enum: [...OPERATION_PHASES],
    },
    input: { $ref: '#/$defs/jsonValue' },
    idempotencyKey: { type: 'string', minLength: 8 },
    confirmed: { type: 'boolean' },
    onBehalfOf: {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['anonymous', 'user', 'member', 'projectAdmin', 'service'] },
        id: { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
  $defs: {
    jsonValue: jsonValueSchema,
  },
} as const;

export const CAPABILITY_API_SUCCESS_RESPONSE_SCHEMA = {
  $schema: JSON_SCHEMA_DIALECT,
  $id: 'https://kychon.dev/schemas/capability-api/v1/success-response-envelope.json',
  title: 'Kychon Capability API Success Response Envelope',
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'correlationId', 'data'],
  properties: {
    ok: { const: true },
    correlationId: { type: 'string', minLength: 1 },
    data: { $ref: '#/$defs/jsonValue' },
    warnings: { type: 'array', items: { $ref: '#/$defs/warning' } },
  },
  $defs: {
    jsonValue: jsonValueSchema,
    objectRef: objectRefSchema,
    warning: warningSchema,
  },
} as const;

export const CAPABILITY_API_ERROR_RESPONSE_SCHEMA = {
  $schema: JSON_SCHEMA_DIALECT,
  $id: 'https://kychon.dev/schemas/capability-api/v1/error-response-envelope.json',
  title: 'Kychon Capability API Error Response Envelope',
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'correlationId', 'error'],
  properties: {
    ok: { const: false },
    correlationId: { type: 'string', minLength: 1 },
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message', 'retryable'],
      properties: {
        code: {
          type: 'string',
          enum: [...ERROR_CODES],
          pattern: ERROR_CODE_PATTERN.source,
        },
        message: { type: 'string', minLength: 1 },
        detail: { type: 'object', additionalProperties: { $ref: '#/$defs/jsonValue' } },
        retryable: { type: 'boolean' },
        field: { type: 'string' },
        object: { $ref: '#/$defs/objectRef' },
      },
    },
  },
  $defs: {
    jsonValue: jsonValueSchema,
    objectRef: objectRefSchema,
  },
} as const;

export const ACTION_PLAN_SCHEMA = {
  $schema: JSON_SCHEMA_DIALECT,
  $id: 'https://kychon.dev/schemas/capability-api/v1/action-plan.json',
  title: 'Kychon Capability API Action Plan',
  type: 'object',
  additionalProperties: false,
  required: ['accepted', 'normalizedInput', 'requiresConfirmation', 'permission', 'warnings', 'sideEffects', 'cost'],
  properties: {
    accepted: { type: 'boolean' },
    normalizedInput: { $ref: '#/$defs/jsonValue' },
    requiresConfirmation: { type: 'boolean' },
    permission: { $ref: '#/$defs/permissionCheck' },
    warnings: { type: 'array', items: { $ref: '#/$defs/warning' } },
    sideEffects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'object'],
        properties: {
          type: {
            type: 'string',
            enum: ['create', 'update', 'delete', 'publish', 'send', 'export', 'upload', 'translate', 'job', 'audit'],
          },
          object: { $ref: '#/$defs/objectRef' },
          description: { type: 'string' },
        },
      },
    },
    cost: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['class'],
          properties: {
            class: { type: 'string', enum: ['free', 'metered', 'expensive', 'external', 'privateData'] },
            estimatedUnits: { type: 'number' },
            estimatedUsd: { type: 'number' },
            boundedBy: { type: 'string' },
            rationale: { type: 'string' },
          },
        },
      ],
    },
  },
  $defs: {
    jsonValue: jsonValueSchema,
    objectRef: objectRefSchema,
    warning: warningSchema,
    permissionCheck: permissionCheckSchema,
  },
} as const;

export const ACTION_RESULT_SCHEMA = {
  $schema: JSON_SCHEMA_DIALECT,
  $id: 'https://kychon.dev/schemas/capability-api/v1/action-result.json',
  title: 'Kychon Capability API Action Result',
  type: 'object',
  additionalProperties: false,
  required: ['result', 'changed', 'audit', 'verify'],
  properties: {
    result: { $ref: '#/$defs/jsonValue' },
    changed: { type: 'array', items: { $ref: '#/$defs/objectRef' } },
    audit: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['object', 'action'],
          properties: {
            object: { $ref: '#/$defs/objectRef' },
            action: { type: 'string' },
            at: { type: 'string' },
          },
        },
      ],
    },
    verify: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['operation', 'phase', 'input'],
          properties: {
            operation: { type: 'string', pattern: OPERATION_NAME_PATTERN.source },
            phase: { const: 'query' },
            input: { $ref: '#/$defs/jsonValue' },
            object: { $ref: '#/$defs/objectRef' },
          },
        },
      ],
    },
  },
  $defs: {
    jsonValue: jsonValueSchema,
    objectRef: objectRefSchema,
  },
} as const;

export const CAPABILITY_API_COMMON_SCHEMAS = {
  requestEnvelope: CAPABILITY_API_REQUEST_SCHEMA,
  successResponseEnvelope: CAPABILITY_API_SUCCESS_RESPONSE_SCHEMA,
  errorResponseEnvelope: CAPABILITY_API_ERROR_RESPONSE_SCHEMA,
  actionPlan: ACTION_PLAN_SCHEMA,
  actionResult: ACTION_RESULT_SCHEMA,
} as const;

export interface KychonClientOptions {
  portalUrl: string;
  apiBaseUrl?: string;
  apiEndpoint?: string;
  apiKey?: string | (() => string | Promise<string | null> | null);
  apiVersion?: string;
  authToken?: string | (() => string | Promise<string | null> | null);
  fetch?: typeof fetch;
}

export interface CapabilityCallOptions {
  idempotencyKey?: string;
  confirmed?: boolean;
}

export class KychonApiError extends Error {
  code: string;
  correlationId: string;
  detail?: JsonObject;
  retryable: boolean;

  constructor(correlationId: string, error: CapabilityError) {
    super(error.message);
    this.name = 'KychonApiError';
    this.code = error.code;
    this.correlationId = correlationId;
    this.detail = error.detail;
    this.retryable = error.retryable;
  }
}

export function isKychonApiError(error: unknown): error is KychonApiError {
  return error instanceof KychonApiError;
}

export function createIdempotencyKey(prefix = 'kychon'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createKychonClient(options: KychonClientOptions) {
  const apiVersion = options.apiVersion || KYCHON_API_VERSION;
  const fetchImpl = options.fetch || fetch;
  const portalUrl = options.portalUrl.replace(/\/$/, '');
  let transportPromise: Promise<KychonTransport> | undefined;
  let discoveryPromise: Promise<JsonObject | undefined> | undefined;
  let runtimeEnvPromise: Promise<RuntimeEnv> | undefined;

  async function authTokenHeader(): Promise<Record<string, string>> {
    const token = typeof options.authToken === 'function' ? await options.authToken() : options.authToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function apiKeyHeader(): Promise<Record<string, string>> {
    const transport = await resolveTransport();
    return transport.apiKey ? { apikey: transport.apiKey } : {};
  }

  async function requestHeaders(includeContentType = false): Promise<Record<string, string>> {
    return {
      ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
      ...(await apiKeyHeader()),
      ...(await authTokenHeader()),
    };
  }

  async function fetchDiscovery(): Promise<JsonObject | undefined> {
    discoveryPromise ||= (async () => {
      try {
        const res = await fetchImpl(`${portalUrl}/.well-known/kychon.json`);
        if (!res.ok) return undefined;
        const body = (await res.json()) as JsonObject;
        return body && typeof body === 'object' ? body : undefined;
      } catch {
        return undefined;
      }
    })();
    return discoveryPromise;
  }

  async function fetchRuntimeEnv(): Promise<RuntimeEnv> {
    runtimeEnvPromise ||= (async () => {
      const fromWindow = readBrowserRuntimeEnv();
      if (fromWindow.apiBaseUrl || fromWindow.apiKey) return fromWindow;

      try {
        const res = await fetchImpl(`${portalUrl}/js/env.js`);
        if (!res.ok) return {};
        return parseRuntimeEnv(await res.text());
      } catch {
        return {};
      }
    })();
    return runtimeEnvPromise;
  }

  async function resolveTransport(): Promise<KychonTransport> {
    transportPromise ||= (async () => {
      const browserEnv = readBrowserRuntimeEnv();
      const needsDiscovery = !options.apiEndpoint;
      const needsRuntimeEnv = !options.apiKey || (!options.apiEndpoint && !options.apiBaseUrl && !browserEnv.apiBaseUrl);
      const [discovery, runtimeEnv] = await Promise.all([
        needsDiscovery ? fetchDiscovery() : Promise.resolve(undefined),
        needsRuntimeEnv ? fetchRuntimeEnv() : Promise.resolve(browserEnv),
      ]);
      const apiBaseUrl = (
        options.apiBaseUrl ||
        runtimeEnv.apiBaseUrl ||
        browserEnv.apiBaseUrl ||
        DEFAULT_RUN402_API_BASE_URL
      ).replace(/\/$/, '');
      const discoveredEndpoint = readApiEndpoint(discovery);
      const endpoint = absolutizeApiEndpoint(
        options.apiEndpoint ||
          (browserEnv.apiBaseUrl ? `${browserEnv.apiBaseUrl}${KYCHON_CAPABILITY_FUNCTION_PATH}` : undefined) ||
          discoveredEndpoint ||
          `${apiBaseUrl}${KYCHON_CAPABILITY_FUNCTION_PATH}`,
        portalUrl,
        apiBaseUrl,
      );
      const rawApiKey = typeof options.apiKey === 'function' ? await options.apiKey() : options.apiKey;
      const apiKey = rawApiKey || runtimeEnv.apiKey || browserEnv.apiKey;
      return { apiBaseUrl, endpoint, apiKey: apiKey || undefined };
    })();
    return transportPromise;
  }

  async function call<Data = JsonValue>(
    operation: string,
    phase: OperationPhase,
    input: JsonObject = {},
    callOptions: CapabilityCallOptions = {},
  ): Promise<Data> {
    const envelope: CapabilityRequestEnvelope = {
      apiVersion,
      operation,
      phase,
      input,
      ...(callOptions.idempotencyKey ? { idempotencyKey: callOptions.idempotencyKey } : {}),
      ...(callOptions.confirmed != null ? { confirmed: callOptions.confirmed } : {}),
    };
    const transport = await resolveTransport();

    const res = await fetchImpl(transport.endpoint, {
      method: 'POST',
      headers: await requestHeaders(true),
      body: JSON.stringify(envelope),
    });
    const body = (await res.json()) as CapabilityResponseEnvelope<Data>;
    if (!body.ok) throw new KychonApiError(body.correlationId, body.error);
    return body.data;
  }

  const query = <Data = JsonValue>(operation: string, input: JsonObject = {}) => call<Data>(operation, 'query', input);
  const validate = <Data = ActionPlan<JsonObject>>(operation: string, input: JsonObject = {}) =>
    call<Data>(operation, 'validate', input);
  const execute = <Data = ActionResult<JsonValue>>(
    operation: string,
    input: JsonObject = {},
    executeOptions: CapabilityCallOptions = {},
  ) =>
    call<Data>(operation, 'execute', input, {
      ...executeOptions,
      idempotencyKey: executeOptions.idempotencyKey || createIdempotencyKey(operation.replace(/\./g, '-')),
    });

  const mutation = (operation: string) => ({
    validate: (input: JsonObject = {}) => validate(operation, input),
    execute: (input: JsonObject = {}, executeOptions: CapabilityCallOptions = {}) => execute(operation, input, executeOptions),
  });

  return {
    apiVersion,
    portalUrl,
    schemas: CAPABILITY_API_COMMON_SCHEMAS,
    request: call,
    query,
    validate,
    execute,
    discover: async () => {
      const headers = await authTokenHeader();
      const res = await fetchImpl(`${portalUrl}/.well-known/kychon.json`, { headers });
      if (res.ok) return res.json() as Promise<JsonObject>;
      return query<JsonObject>('portal.discover', { portalUrl });
    },
    capabilities: () => query<JsonObject>('portal.capabilities'),
    portal: {
      discover: () => query<JsonObject>('portal.discover', { portalUrl }),
      capabilities: () => query<JsonObject>('portal.capabilities'),
      health: () => query<JsonObject>('portal.health'),
      version: () => query<JsonObject>('portal.version'),
    },
    auth: {
      whoami: () => query<JsonObject>('auth.whoami'),
      permissions: () => query<JsonObject>('auth.permissions'),
      explainDenied: (input: JsonObject) => query<JsonObject>('auth.explainDenied', input),
    },
    search: {
      query: (input: JsonObject) => query<JsonObject>('search.query', input),
      suggest: (input: JsonObject) => query<JsonObject>('search.suggest', input),
    },
    config: {
      get: (input: JsonObject = {}) => query<JsonObject>('config.get', input),
      set: mutation('config.set'),
      setMany: mutation('config.setMany'),
      branding: { update: mutation('config.branding.update') },
      theme: { update: mutation('config.theme.update') },
      general: { update: mutation('config.general.update') },
      eventDisplay: { update: mutation('config.eventDisplay.update') },
      featureFlags: { set: mutation('config.featureFlags.set') },
    },
    pages: domain('pages', ['list', 'get'], ['create', 'update', 'publish', 'unpublish', 'delete'], query, mutation),
    sections: domain('sections', ['list', 'get'], ['create', 'updateConfig', 'reorder', 'setVisibility', 'setScope', 'setColumnSpan', 'delete'], query, mutation),
    members: domain('members', ['list', 'get'], ['updateProfile', 'approve', 'reject', 'suspend', 'reactivate', 'changeTier', 'changeRole', 'setExpiration', 'linkUser'], query, mutation),
    tiers: domain('tiers', ['list'], ['create', 'update', 'delete', 'setDefault', 'reorder'], query, mutation),
    memberFields: domain('memberFields', ['list'], ['create', 'update', 'delete', 'reorder'], query, mutation),
    events: domain('events', ['list', 'get'], ['create', 'update', 'delete', 'setTimezone', 'reviewImport'], query, mutation),
    registrationOptions: domain('registrationOptions', ['list'], ['create', 'update', 'markReviewed', 'ignore', 'disable', 'enable'], query, mutation),
    rsvps: domain('rsvps', ['listForEvent', 'listMine'], ['setStatus', 'cancel'], query, mutation),
    announcements: domain('announcements', ['list', 'get'], ['publish', 'update', 'pin', 'unpin', 'delete'], query, mutation),
    resources: domain('resources', ['list', 'get'], ['upload', 'update', 'delete'], query, mutation),
    assets: {
      upload: mutation('assets.upload'),
    },
    forum: {
      categories: domain('forum.categories', ['list', 'get'], ['create', 'update', 'reorder', 'delete'], query, mutation),
      topics: domain('forum.topics', ['list', 'get'], ['create', 'update', 'pin', 'unpin', 'lock', 'unlock', 'hide', 'unhide', 'delete'], query, mutation),
      replies: domain('forum.replies', ['list'], ['create', 'update', 'hide', 'unhide', 'delete'], query, mutation),
    },
    polls: {
      ...domain('polls', ['list', 'get', 'getAttached'], ['create', 'update', 'attach', 'detach', 'close', 'reopen', 'delete'], query, mutation),
      options: domain('pollOptions', [], ['add', 'update', 'reorder', 'delete'], query, mutation),
      votes: domain('pollVotes', [], ['cast', 'clearMine'], query, mutation),
      results: { get: (input: JsonObject) => query<JsonObject>('pollResults.get', input) },
    },
    committees: domain('committees', ['list', 'get'], ['create', 'update', 'delete'], query, mutation),
    committeeMembers: domain('committeeMembers', ['list'], ['add', 'changeRole', 'remove'], query, mutation),
    reactions: domain('reactions', ['list'], ['add', 'remove', 'toggle'], query, mutation),
    moderation: domain('moderation', ['queue'], ['approve', 'hide', 'markReviewed'], query, mutation),
    translations: domain('translations', ['list'], ['translateText', 'translateContent', 'delete'], query, mutation),
    newsletters: {
      drafts: domain('newsletters.drafts', ['list', 'get'], ['generate', 'update', 'delete'], query, mutation),
    },
    insights: domain('insights', ['list'], ['updateStatus', 'dismiss'], query, mutation),
    exports: {
      membersCsv: mutation('exports.membersCsv'),
      eventsCsv: mutation('exports.eventsCsv'),
      portalData: mutation('exports.portalData'),
    },
    activity: {
      list: (input: JsonObject = {}) => query<JsonObject>('activity.list', input),
    },
    jobs: {
      checkExpirations: mutation('jobs.checkExpirations'),
      sendEventReminders: mutation('jobs.sendEventReminders'),
      generateNewsletter: mutation('jobs.generateNewsletter'),
      status: (input: JsonObject = {}) => query<JsonObject>('jobs.status', input),
    },
    raw: {
      capability: call,
      postgrest: async (path: string, init: RequestInit = {}) => {
        const transport = await resolveTransport();
        const res = await fetchImpl(`${transport.apiBaseUrl}/rest/v1/${path}`, {
          ...init,
          headers: {
            ...(init.headers || {}),
            ...(await requestHeaders()),
          },
        });
        return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
      },
    },
  };
}

type MutationHelper = {
  validate: (input?: JsonObject) => Promise<ActionPlan<JsonObject>>;
  execute: (input?: JsonObject, options?: CapabilityCallOptions) => Promise<ActionResult<JsonValue>>;
};

type DomainNamespace<Reads extends readonly string[], Mutations extends readonly string[]> = {
  [Key in Reads[number]]: (input?: JsonObject) => Promise<JsonObject>;
} & {
  [Key in Mutations[number]]: MutationHelper;
};

function domain<const Reads extends readonly string[], const Mutations extends readonly string[]>(
  prefix: string,
  reads: Reads,
  mutations: Mutations,
  query: <Data = JsonValue>(operation: string, input?: JsonObject) => Promise<Data>,
  mutation: (operation: string) => MutationHelper,
): DomainNamespace<Reads, Mutations> {
  const out: Record<string, unknown> = {};
  for (const read of reads) out[read] = (input: JsonObject = {}) => query<JsonObject>(`${prefix}.${read}`, input);
  for (const verb of mutations) out[verb] = mutation(`${prefix}.${verb}`);
  return out as DomainNamespace<Reads, Mutations>;
}

export const SDK_EXAMPLES = {
  discovery: { operation: 'portal.discover', phase: 'query', input: {} },
  auth: { operation: 'auth.whoami', phase: 'query', input: {} },
  search: { operation: 'search.query', phase: 'query', input: { q: 'budget' } },
  createEvent: { operation: 'events.create', phase: 'validate', input: { title: 'Board meeting' } },
  approveMember: { operation: 'members.approve', phase: 'validate', input: { id: 'member-1' } },
  publishAnnouncement: { operation: 'announcements.publish', phase: 'validate', input: { title: 'News', body: 'Hello' } },
  forumTopicCreate: { operation: 'forum.topics.create', phase: 'validate', input: { title: 'Welcome', body: 'Hi' } },
  pollVote: { operation: 'pollVotes.cast', phase: 'validate', input: { pollId: 'poll-1', optionId: 'option-1' } },
  resourceUpload: { operation: 'resources.upload', phase: 'validate', input: { metadata: { title: 'Guide' } } },
  exportMembers: { operation: 'exports.membersCsv', phase: 'validate', input: {} },
} as const;

export const DEMO_PORTAL_FIXTURES = KYCHON_DEMO_PORTALS;

interface RuntimeEnv {
  apiBaseUrl?: string;
  apiKey?: string;
}

interface KychonTransport {
  apiBaseUrl: string;
  endpoint: string;
  apiKey?: string;
}

function readApiEndpoint(discovery?: JsonObject): string | undefined {
  const api = discovery?.api;
  if (!api || typeof api !== 'object' || Array.isArray(api)) return undefined;
  const endpoint = (api as JsonObject).endpoint;
  return typeof endpoint === 'string' ? endpoint : undefined;
}

function absolutizeApiEndpoint(endpoint: string, portalUrl: string, apiBaseUrl: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  if (endpoint.startsWith(KYCHON_CAPABILITY_FUNCTION_PATH)) return `${apiBaseUrl}${endpoint}`;
  if (endpoint.startsWith('/')) return `${portalUrl}${endpoint}`;
  return new URL(endpoint, `${portalUrl}/`).toString();
}

function readBrowserRuntimeEnv(): RuntimeEnv {
  const maybeWindow = (globalThis as typeof globalThis & {
    window?: { __KYCHON_API?: string; __KYCHON_ANON_KEY?: string };
  }).window;
  return {
    ...(typeof maybeWindow?.__KYCHON_API === 'string' ? { apiBaseUrl: maybeWindow.__KYCHON_API } : {}),
    ...(typeof maybeWindow?.__KYCHON_ANON_KEY === 'string' ? { apiKey: maybeWindow.__KYCHON_ANON_KEY } : {}),
  };
}

function parseRuntimeEnv(source: string): RuntimeEnv {
  return {
    ...matchRuntimeAssignment(source, '__KYCHON_API', 'apiBaseUrl'),
    ...matchRuntimeAssignment(source, '__KYCHON_ANON_KEY', 'apiKey'),
  };
}

function matchRuntimeAssignment(source: string, name: string, key: keyof RuntimeEnv): RuntimeEnv {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*=\\s*['"]([^'"]+)['"]`));
  return match?.[1] ? { [key]: match[1] } : {};
}
