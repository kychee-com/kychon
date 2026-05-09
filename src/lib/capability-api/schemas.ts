import { ERROR_CODES, OBJECT_TYPES, OPERATION_PHASES, SUPPORTED_API_VERSIONS } from './types.js';
import { ERROR_CODE_PATTERN, OBJECT_TYPE_PATTERN, OPERATION_NAME_PATTERN } from './operations.js';

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
