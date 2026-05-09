import { KYCHON_API_VERSION, SUPPORTED_API_VERSIONS } from './types.js';
import { getOperation } from './operations.js';
import { resolveCapabilityActor, type ActorResolutionDependencies, type CapabilityActor } from './actor.js';
import { authExplainDenied, authPermissions, authWhoami } from './auth-operations.js';
import { buildCapabilityManifest, buildPortalVersion, buildWellKnownKychon } from './discovery.js';
import { checkOperationPermission } from './permissions.js';
import { CapabilityQueryError, runCapabilityQuery, type CapabilityQueryDb } from './query-handlers.js';
import {
  CapabilityMutationError,
  executeCapabilityMutation,
  type CapabilityAi,
  type CapabilityJobs,
  type CapabilityMutationDb,
  type CapabilityStorage,
} from './mutation-handlers.js';
import type {
  ActionPlan,
  CapabilityError,
  CapabilityRequestEnvelope,
  CostClass,
  JsonObject,
  OperationPhase,
  OperationRegistryEntry,
} from './types.js';

export interface CapabilityGatewayDependencies extends ActorResolutionDependencies {
  createCorrelationId?: () => string;
  engineVersion?: string;
  schemaVersion?: string;
  queryDb?: CapabilityQueryDb;
  mutationDb?: CapabilityMutationDb;
  storage?: CapabilityStorage;
  ai?: CapabilityAi;
  jobs?: CapabilityJobs;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  Vary: 'Authorization',
} as const;

export async function handleCapabilityApiRequest(
  req: Request,
  deps: CapabilityGatewayDependencies,
): Promise<Response> {
  const correlationId = getCorrelationId(req, deps);
  const parsed = await parseRequestEnvelope(req);
  if (!parsed.ok) return errorResponse(correlationId, parsed.status, parsed.error);

  const envelope = parsed.envelope;
  const versionCheck = validateApiVersion(envelope.apiVersion);
  if (!versionCheck.ok) return errorResponse(correlationId, 400, versionCheck.error);

  const operation = getOperation(envelope.operation);
  if (!operation) {
    return errorResponse(correlationId, 404, {
      code: 'api.unknownOperation',
      message: `Unknown Kychon Capability API operation: ${envelope.operation}`,
      detail: { operation: envelope.operation },
      retryable: false,
    });
  }

  if (!operation.phases.includes(envelope.phase)) {
    return errorResponse(correlationId, 400, {
      code: 'api.unsupportedPhase',
      message: `Operation ${operation.name} does not support phase ${envelope.phase}.`,
      detail: {
        operation: operation.name,
        phase: envelope.phase,
        supportedPhases: [...operation.phases],
      },
      retryable: false,
    });
  }

  if (envelope.phase === 'execute' && !envelope.idempotencyKey) {
    return errorResponse(correlationId, 400, {
      code: 'request.invalidEnvelope',
      message: `Executing ${operation.name} requires an idempotencyKey.`,
      detail: { operation: operation.name, phase: envelope.phase },
      retryable: false,
    });
  }

  const actor = await resolveCapabilityActor(req, deps);
  const permission = checkOperationPermission(actor, operation);
  if (!permission.allowed && envelope.phase !== 'validate') {
    return errorResponse(correlationId, 403, {
      code: 'permission.denied',
      message: `Permission denied for ${operation.name}.`,
      detail: permission as unknown as JsonObject,
      retryable: false,
    });
  }

  if (envelope.phase === 'query') return queryResponse({ correlationId, actor, envelope, operation, deps });

  if (envelope.phase === 'validate') {
    return successResponse(correlationId, createActionPlan(operation, envelope.input, permission.allowed, actor.state));
  }

  if (operation.confirmation === 'required' && envelope.confirmed !== true) {
    return errorResponse(correlationId, 409, {
      code: 'confirmation.required',
      message: `Executing ${operation.name} requires confirmed: true.`,
      detail: { operation: operation.name },
      retryable: false,
    });
  }

  if (deps.mutationDb) {
    try {
      return successResponse(
        correlationId,
        await executeCapabilityMutation(operation.name, envelope.input, {
          actor,
          db: deps.mutationDb,
          ...(deps.storage ? { storage: deps.storage } : {}),
          ...(deps.ai ? { ai: deps.ai } : {}),
          ...(deps.jobs ? { jobs: deps.jobs } : {}),
        }),
      );
    } catch (error) {
      if (error instanceof CapabilityMutationError) {
        return errorResponse(correlationId, mutationStatus(error.code), {
          code: mutationErrorCode(error.code),
          message: error.message,
          ...(error.detail ? { detail: error.detail } : {}),
          retryable: false,
        });
      }
      throw error;
    }
  }

  return errorResponse(correlationId, 501, {
    code: 'internal.error',
    message: `Execution handler for ${operation.name} is not implemented yet.`,
    detail: { operation: operation.name, phase: envelope.phase },
    retryable: false,
  });
}

function mutationStatus(code: string): number {
  if (code === 'permission.denied') return 403;
  if (code === 'validation.failed') return 400;
  if (code === 'notFound.object') return 404;
  if (code === 'conflict.state') return 409;
  return 501;
}

function mutationErrorCode(code: string) {
  if (
    code === 'permission.denied' ||
    code === 'validation.failed' ||
    code === 'notFound.object' ||
    code === 'conflict.state'
  ) {
    return code;
  }
  return 'internal.error';
}

type ParseResult =
  | { ok: true; envelope: CapabilityRequestEnvelope }
  | { ok: false; status: number; error: CapabilityError };

async function parseRequestEnvelope(req: Request): Promise<ParseResult> {
  let body: unknown;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      status: 400,
      error: {
        code: 'request.invalidJson',
        message: 'Request body must be valid JSON.',
        retryable: false,
      },
    };
  }

  if (!isRecord(body)) {
    return invalidEnvelope('Request body must be a JSON object.');
  }

  const apiVersion = body.apiVersion;
  const operation = body.operation;
  const phase = body.phase;
  const input = body.input;
  if (typeof apiVersion !== 'string' || typeof operation !== 'string' || !isOperationPhase(phase) || input === undefined) {
    return invalidEnvelope('Request envelope requires apiVersion, operation, phase, and input.');
  }

  return {
    ok: true,
    envelope: {
      apiVersion,
      operation,
      phase,
      input: (isRecord(input) ? input : { value: input }) as JsonObject,
      ...(typeof body.idempotencyKey === 'string' ? { idempotencyKey: body.idempotencyKey } : {}),
      ...(typeof body.confirmed === 'boolean' ? { confirmed: body.confirmed } : {}),
    },
  };
}

function invalidEnvelope(message: string): ParseResult {
  return {
    ok: false,
    status: 400,
    error: {
      code: 'request.invalidEnvelope',
      message,
      retryable: false,
    },
  };
}

function validateApiVersion(apiVersion: string):
  | { ok: true }
  | {
      ok: false;
      error: CapabilityError;
    } {
  if ((SUPPORTED_API_VERSIONS as readonly string[]).includes(apiVersion)) return { ok: true };
  return {
    ok: false,
    error: {
      code: 'api.unsupportedVersion',
      message: `Unsupported Kychon Capability API version: ${apiVersion}`,
      detail: { apiVersion, supportedApiVersions: [...SUPPORTED_API_VERSIONS] },
      retryable: false,
    },
  };
}

async function queryResponse({
  correlationId,
  actor,
  envelope,
  operation,
  deps,
}: {
  correlationId: string;
  actor: CapabilityActor;
  envelope: CapabilityRequestEnvelope;
  operation: OperationRegistryEntry;
  deps: CapabilityGatewayDependencies;
}): Promise<Response> {
  switch (operation.name) {
    case 'portal.discover':
      return successResponse(correlationId, buildWellKnownKychon({
        ...discoveryOptions(deps),
        ...(reqlessOrigin(envelope.input) ? { portalUrl: reqlessOrigin(envelope.input)! } : {}),
      }));
    case 'portal.capabilities':
      return successResponse(correlationId, buildCapabilityManifest(discoveryOptions(deps)));
    case 'portal.health':
      return successResponse(correlationId, {
        ok: true,
        apiVersion: KYCHON_API_VERSION,
      });
    case 'portal.version':
      return successResponse(correlationId, buildPortalVersion(discoveryOptions(deps)));
    case 'auth.whoami':
      return successResponse(correlationId, authWhoami(actor));
    case 'auth.permissions':
      return successResponse(correlationId, authPermissions(actor));
    case 'auth.explainDenied':
      return successResponse(correlationId, authExplainDenied(actor, { operation: String(envelope.input.operation || '') }));
    default:
      if (deps.queryDb) {
        try {
          return successResponse(
            correlationId,
            await runCapabilityQuery(operation.name, envelope.input, { actor, db: deps.queryDb }),
          );
        } catch (error) {
          if (error instanceof CapabilityQueryError) {
            return errorResponse(correlationId, error.code === 'permission.denied' ? 403 : 501, {
              code: error.code === 'permission.denied' ? 'permission.denied' : 'internal.error',
              message: error.message,
              detail: error.detail,
              retryable: false,
            });
          }
          throw error;
        }
      }
      return errorResponse(correlationId, 501, {
        code: 'internal.error',
        message: `Query handler for ${operation.name} is not implemented yet.`,
        detail: { operation: operation.name },
        retryable: false,
      });
  }
}

function discoveryOptions(deps: CapabilityGatewayDependencies) {
  return {
    ...(deps.engineVersion ? { engineVersion: deps.engineVersion } : {}),
    ...(deps.schemaVersion ? { schemaVersion: deps.schemaVersion } : {}),
  };
}

function createActionPlan(
  operation: OperationRegistryEntry,
  normalizedInput: JsonObject,
  allowed: boolean,
  actorState: CapabilityActor['state'],
): ActionPlan<JsonObject> {
  return {
    accepted: allowed,
    normalizedInput,
    requiresConfirmation: operation.confirmation === 'required',
    permission: {
      allowed,
      actorState,
      requiredState: operation.auth.minimumActorState,
      permission: operation.auth.permission,
      ...(allowed ? {} : { reason: `Requires ${operation.auth.minimumActorState}.` }),
    },
    warnings: operation.confirmation === 'recommended'
      ? [
          {
            code: 'confirmation.recommended',
            message: `${operation.name} is marked confirmation-recommended.`,
          },
        ]
      : [],
    sideEffects: [],
    cost: costFor(operation.costClass),
  };
}

function costFor(costClass: CostClass) {
  return costClass === 'free'
    ? null
    : {
        class: costClass,
        rationale: `${costClass} operation; validate before execute.`,
      };
}

function successResponse(correlationId: string, data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      correlationId,
      data,
    }),
    {
      status,
      headers: JSON_HEADERS,
    },
  );
}

function errorResponse(correlationId: string, status: number, error: CapabilityError): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      correlationId,
      error,
    }),
    {
      status,
      headers: JSON_HEADERS,
    },
  );
}

function getCorrelationId(req: Request, deps: CapabilityGatewayDependencies): string {
  const fromHeader = req.headers.get('x-correlation-id') || req.headers.get('x-request-id');
  if (fromHeader) return fromHeader;
  return deps.createCorrelationId?.() || crypto.randomUUID();
}

function isOperationPhase(value: unknown): value is OperationPhase {
  return value === 'query' || value === 'validate' || value === 'execute';
}

function isRecord(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function reqlessOrigin(input: JsonObject): string | null {
  return typeof input.portalUrl === 'string' ? input.portalUrl : null;
}
