import { getOperation } from './operations.js';
import { allowedOperationsForActor, checkOperationPermission } from './permissions.js';
import type { CapabilityActor } from './actor.js';
import type { OperationName } from './types.js';

export interface AuthWhoamiResponse {
  actor: CapabilityActor;
}

export interface AuthPermissionsResponse {
  actorState: CapabilityActor['state'];
  operations: Array<{
    name: OperationName;
    phases: readonly string[];
    permission?: string;
  }>;
}

export interface AuthExplainDeniedInput {
  operation: string;
}

export interface AuthExplainDeniedResponse {
  operation: string;
  allowed: boolean;
  requiredState?: string;
  actorState: string;
  permission?: string;
  reason?: string;
}

export function authWhoami(actor: CapabilityActor): AuthWhoamiResponse {
  return { actor };
}

export function authPermissions(actor: CapabilityActor): AuthPermissionsResponse {
  return {
    actorState: actor.state,
    operations: allowedOperationsForActor(actor).map((operation) => ({
      name: operation.name,
      phases: operation.phases,
      ...(operation.auth.permission ? { permission: operation.auth.permission } : {}),
    })),
  };
}

export function authExplainDenied(actor: CapabilityActor, input: AuthExplainDeniedInput): AuthExplainDeniedResponse {
  const operation = getOperation(input.operation);
  const check = checkOperationPermission(actor, input.operation);

  return {
    operation: input.operation,
    allowed: check.allowed,
    actorState: actor.state,
    ...(operation ? { requiredState: operation.auth.minimumActorState } : {}),
    ...(operation?.auth.permission ? { permission: operation.auth.permission } : {}),
    ...(check.reason ? { reason: check.reason } : {}),
  };
}
