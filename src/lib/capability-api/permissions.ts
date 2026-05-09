import { getOperation, listOperations } from './operations.js';
import type { CapabilityActor } from './actor.js';
import type { ActorState, OperationRegistryEntry, PermissionCheck } from './types.js';

const ACTOR_STATE_RANK: Record<ActorState, number> = {
  anonymous: 0,
  authenticated_non_member: 1,
  pending_member: 2,
  active_member: 3,
  moderator: 4,
  admin: 5,
  project_admin: 6,
};

export function actorSatisfiesState(actor: CapabilityActor, required: ActorState): boolean {
  if (actor.state === 'project_admin') return true;
  if (actor.state === 'admin') return required !== 'project_admin';
  return ACTOR_STATE_RANK[actor.state] >= ACTOR_STATE_RANK[required];
}

export function checkOperationPermission(
  actor: CapabilityActor,
  operation: OperationRegistryEntry | string,
): PermissionCheck {
  const entry = typeof operation === 'string' ? getOperation(operation) : operation;

  if (!entry) {
    return {
      allowed: false,
      actorState: actor.state,
      reason: 'Unknown operation.',
    };
  }

  const allowed = actorSatisfiesState(actor, entry.auth.minimumActorState);
  return {
    allowed,
    actorState: actor.state,
    requiredState: entry.auth.minimumActorState,
    permission: entry.auth.permission,
    ...(allowed ? {} : { reason: `Requires ${entry.auth.minimumActorState}.` }),
  };
}

export function allowedOperationsForActor(actor: CapabilityActor): OperationRegistryEntry[] {
  return listOperations().filter((operation) => checkOperationPermission(actor, operation).allowed);
}

export function deniedOperationsForActor(actor: CapabilityActor): OperationRegistryEntry[] {
  return listOperations().filter((operation) => !checkOperationPermission(actor, operation).allowed);
}
