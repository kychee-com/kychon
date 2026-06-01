// auth.ts — Cookie-session auth state for the browser.
//
// The session lives in the platform-minted HttpOnly `__Host-` cookie; the
// browser never sees a token. This module holds an in-memory **actor cache**
// populated once per page load from `auth.whoami` (over the same-origin
// /api/kychon capability route) and exposes the same synchronous read surface
// the islands already use (getSession / getRole / isAdmin / isAuthenticated).
// `wl-auth-changed` stays the re-render fan-out, so island bodies don't change.

import { getCurrentActorContext } from './api.js';

export type ActorState =
  | 'anonymous'
  | 'authenticated_non_member'
  | 'pending_member'
  | 'active_member'
  | 'moderator'
  | 'admin'
  | 'project_admin';

export interface ActorMember {
  id: string;
  userId?: string | null;
  email?: string | null;
  displayName?: string | null;
  role?: string;
  status?: string;
  avatarUrl?: string | null;
}

export interface Actor {
  state: ActorState;
  authenticated: boolean;
  user: { id: string; email: string } | null;
  member: ActorMember | null;
  authority?: unknown;
}

let actorCache: Actor | null = null;
let actorPromise: Promise<Actor | null> | null = null;
// Full member record (DB row) when config.ts enriches it for admins or the
// profile editor saves changes. Falls back to the lean whoami actor member.
let sessionMember: any | null = null;

function normalizeActor(raw: any): Actor | null {
  if (!raw || typeof raw !== 'object') return null;
  const user =
    raw.user && raw.user.id ? { id: String(raw.user.id), email: String(raw.user.email || '') } : null;
  return {
    state: (raw.state as ActorState) || 'anonymous',
    authenticated: !!raw.authenticated,
    user,
    member: raw.member && raw.member.id ? (raw.member as ActorMember) : null,
    authority: raw.authority,
  };
}

export function getActor(): Actor | null {
  return actorCache;
}

/** Store a freshly-resolved whoami actor; resets any enriched member overlay. */
export function setActor(raw: any): void {
  actorCache = normalizeActor(raw);
  sessionMember = null;
}

/** Drop all in-memory auth state (sign-out / force-logout of a stale session). */
export function clearActor(): void {
  actorCache = null;
  actorPromise = null;
  sessionMember = null;
}

/** Overlay the full member record onto the session view (config.ts admin
 *  enrich, profile save). Read back through getSession().user.member. */
export function setSessionMember(member: any): void {
  sessionMember = member;
}

/** Resolve the cookie actor via whoami, memoized for the page lifetime so
 *  AuthProviderIsland and config.ts share a single round-trip. */
export async function loadActor(force = false): Promise<Actor | null> {
  if (force) actorPromise = null;
  actorPromise ||= (async () => {
    try {
      const context = await getCurrentActorContext();
      setActor(context?.actor);
    } catch {
      actorCache = null;
    }
    return actorCache;
  })();
  return actorPromise;
}

/** Session-shaped view of the lean whoami member, for island readers. */
export function memberViewFromActor(member: Actor['member']): any | null {
  if (!member?.id) return null;
  return {
    id: member.id,
    user_id: member.userId ?? null,
    email: member.email ?? '',
    display_name: member.displayName ?? '',
    role: member.role ?? 'member',
    status: member.status ?? 'pending',
    avatar_url: member.avatarUrl ?? null,
  };
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// --- Synchronous read surface (re-backed by the actor cache) ---

/**
 * Compatibility shim: returns a session-SHAPED view of the cached actor so the
 * island readers (session.user.member.role / .member.id, session.user.email /
 * .display_name / .avatar_url) keep working unchanged. Null when anonymous or
 * before whoami resolves (treated as anonymous until `wl-auth-changed`).
 */
export function getSession(): any {
  const actor = actorCache;
  if (!actor || !actor.authenticated || !actor.user) return null;

  const member = sessionMember ?? memberViewFromActor(actor.member);
  const displayName = member?.display_name || actor.member?.displayName || null;
  const avatarUrl = member?.avatar_url || actor.member?.avatarUrl || null;

  return {
    user: {
      id: actor.user.id,
      email: actor.user.email,
      display_name: displayName,
      avatar_url: avatarUrl,
      ...(member ? { member } : {}),
    },
  };
}

export function getSessionEmail(session = getSession()): string {
  return normalizeEmail(session?.user?.email || session?.user?.member?.email || '');
}

export function isProjectAdminSession(): boolean {
  return actorCache?.state === 'project_admin';
}

export function getRole(): string | null {
  if (actorCache?.state === 'project_admin') return 'admin';
  return getSession()?.user?.member?.role || null;
}

export function isAdmin(): boolean {
  return getRole() === 'admin';
}

export function isAuthenticated(): boolean {
  return !!actorCache?.authenticated;
}

export function requireAuth(): boolean {
  return isAuthenticated();
}

export function requireAdmin(): boolean {
  return isAdmin();
}
