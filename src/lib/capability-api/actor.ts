import type { ActorState, ObjectRef } from './types.js';

export interface Run402UserLike {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  raw_user_meta_data?: Record<string, unknown> | null;
}

export interface MemberRowLike {
  id: string | number;
  user_id?: string | null;
  email?: string | null;
  display_name?: string | null;
  role?: string | null;
  status?: string | null;
}

export interface ActorMemberContext {
  id: string;
  ref: ObjectRef;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: string;
  status: string;
  lookup: 'user_id' | 'email';
}

export interface CapabilityActor {
  state: ActorState;
  authenticated: boolean;
  user: {
    id: string;
    email: string | null;
  } | null;
  member: ActorMemberContext | null;
  authority: {
    projectAdmin: boolean;
    activeMemberAdmin: boolean;
  };
}

export interface ActorResolutionDependencies {
  getUser(req: Request): Promise<Run402UserLike | null | undefined>;
  adminDb(): {
    from(table: string): {
      select(columns?: string): {
        eq(column: string, value: unknown): {
          limit(count: number): Promise<MemberRowLike[]> | MemberRowLike[];
        };
      };
    };
  };
}

const MEMBER_SELECT = 'id,user_id,email,display_name,role,status';

export async function resolveCapabilityActor(
  req: Request,
  deps: ActorResolutionDependencies,
): Promise<CapabilityActor> {
  const user = await getAuthenticatedUser(req, deps);
  if (!user?.id) return anonymousActor();

  const projectAdmin = isProjectAdminUser(user);
  const member = await findMemberForUser(deps.adminDb(), user);
  const state = deriveActorState({ member, projectAdmin });

  return {
    state,
    authenticated: true,
    user: {
      id: user.id,
      email: normalizeEmail(user.email) || null,
    },
    member,
    authority: {
      projectAdmin,
      activeMemberAdmin: member?.status === 'active' && member.role === 'admin',
    },
  };
}

export function anonymousActor(): CapabilityActor {
  return {
    state: 'anonymous',
    authenticated: false,
    user: null,
    member: null,
    authority: {
      projectAdmin: false,
      activeMemberAdmin: false,
    },
  };
}

export function isProjectAdminUser(user: Run402UserLike): boolean {
  return (
    user.is_admin === true ||
    user.role === 'project_admin' ||
    user.app_metadata?.role === 'project_admin' ||
    user.app_metadata?.is_admin === true ||
    user.user_metadata?.role === 'project_admin' ||
    user.raw_user_meta_data?.role === 'project_admin'
  );
}

function deriveActorState({
  member,
  projectAdmin,
}: {
  member: ActorMemberContext | null;
  projectAdmin: boolean;
}): ActorState {
  if (projectAdmin) return 'project_admin';
  if (!member) return 'authenticated_non_member';
  if (member.status === 'pending') return 'pending_member';
  if (member.status !== 'active') return 'authenticated_non_member';
  if (member.role === 'admin') return 'admin';
  if (member.role === 'moderator') return 'moderator';
  return 'active_member';
}

async function getAuthenticatedUser(
  req: Request,
  deps: ActorResolutionDependencies,
): Promise<Run402UserLike | null> {
  try {
    const user = await deps.getUser(req);
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

async function findMemberForUser(
  db: ReturnType<ActorResolutionDependencies['adminDb']>,
  user: Run402UserLike,
): Promise<ActorMemberContext | null> {
  const userId = typeof user.id === 'string' ? user.id : '';
  if (userId) {
    const rows = await db.from('members').select(MEMBER_SELECT).eq('user_id', userId).limit(1);
    const byUserId = rows[0];
    if (byUserId) return normalizeMember(byUserId, 'user_id');
  }

  const email = normalizeEmail(user.email);
  if (email) {
    const rows = await db.from('members').select(MEMBER_SELECT).eq('email', email).limit(1);
    const byEmail = rows[0];
    if (byEmail) return normalizeMember(byEmail, 'email');
  }

  return null;
}

function normalizeMember(row: MemberRowLike, lookup: 'user_id' | 'email'): ActorMemberContext {
  const id = String(row.id);
  const role = normalizeRole(row.role);
  const status = normalizeStatus(row.status);
  const label = typeof row.display_name === 'string' && row.display_name.trim() ? row.display_name.trim() : undefined;

  return {
    id,
    ref: {
      type: 'member',
      id,
      ...(label ? { label } : {}),
    },
    userId: typeof row.user_id === 'string' && row.user_id ? row.user_id : null,
    email: normalizeEmail(row.email) || null,
    displayName: label || null,
    role,
    status,
    lookup,
  };
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeRole(value: unknown): string {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return role || 'member';
}

function normalizeStatus(value: unknown): string {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return status || 'pending';
}
