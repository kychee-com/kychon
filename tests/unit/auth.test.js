import { beforeEach, describe, expect, it, vi } from 'vitest';

// auth.ts is now a cookie-session actor cache: getSession/getRole/isAdmin/
// isAuthenticated read an in-memory actor populated from auth.whoami (via
// api.ts getCurrentActorContext). Mock that one dependency.
const { whoami } = vi.hoisted(() => ({ whoami: vi.fn() }));
vi.mock('../../src/lib/api', () => ({
  getCurrentActorContext: (...args) => whoami(...args),
}));

const ADMIN_ACTOR = {
  state: 'admin',
  authenticated: true,
  user: { id: 'u1', email: 'Owner@Test.com' },
  member: {
    id: 'm1',
    userId: 'u1',
    email: 'owner@test.com',
    displayName: 'Owner',
    role: 'admin',
    status: 'active',
    avatarUrl: 'https://img.test/a.png',
  },
};

let auth;

describe('auth.ts (cookie-session actor cache)', () => {
  beforeEach(async () => {
    vi.resetModules();
    whoami.mockReset();
    auth = await import('../../src/lib/auth.ts');
  });

  describe('getSession shim', () => {
    it('returns null before whoami resolves / when anonymous', () => {
      expect(auth.getSession()).toBeNull();
    });

    it('returns a session-shaped view of the cached actor', () => {
      auth.setActor(ADMIN_ACTOR);
      const session = auth.getSession();
      expect(session.user.id).toBe('u1');
      expect(session.user.email).toBe('Owner@Test.com');
      expect(session.user.display_name).toBe('Owner');
      expect(session.user.avatar_url).toBe('https://img.test/a.png');
      expect(session.user.member.id).toBe('m1');
      expect(session.user.member.role).toBe('admin');
    });

    it('clearActor drops the session', () => {
      auth.setActor(ADMIN_ACTOR);
      auth.clearActor();
      expect(auth.getSession()).toBeNull();
    });

    it('setSessionMember overlays the full member record', () => {
      auth.setActor(ADMIN_ACTOR);
      auth.setSessionMember({
        id: 'm1',
        role: 'admin',
        display_name: 'Owner',
        avatar_url: 'https://img.test/b.png',
        bio: 'hello',
      });
      const session = auth.getSession();
      expect(session.user.member.bio).toBe('hello');
      expect(session.user.avatar_url).toBe('https://img.test/b.png');
    });
  });

  describe('role checks', () => {
    it('getRole / isAdmin reflect the member role', () => {
      auth.setActor({
        ...ADMIN_ACTOR,
        state: 'active_member',
        member: { ...ADMIN_ACTOR.member, role: 'member' },
      });
      expect(auth.getRole()).toBe('member');
      expect(auth.isAdmin()).toBe(false);
    });

    it('a project_admin actor reads as admin even without a member', () => {
      auth.setActor({
        state: 'project_admin',
        authenticated: true,
        user: { id: 'u9', email: 'pa@test.com' },
        member: null,
      });
      expect(auth.isProjectAdminSession()).toBe(true);
      expect(auth.getRole()).toBe('admin');
      expect(auth.isAdmin()).toBe(true);
    });

    it('getRole is null and isAdmin false when anonymous', () => {
      expect(auth.getRole()).toBeNull();
      expect(auth.isAdmin()).toBe(false);
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('is true once an authenticated actor is cached', () => {
      auth.setActor(ADMIN_ACTOR);
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('an authenticated_non_member is signed in but has no member', () => {
      auth.setActor({
        state: 'authenticated_non_member',
        authenticated: true,
        user: { id: 'u2', email: 'x@test.com' },
        member: null,
      });
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.getSession().user.member).toBeUndefined();
      expect(auth.getRole()).toBeNull();
    });
  });

  describe('getSessionEmail', () => {
    it('normalizes the actor email', () => {
      auth.setActor(ADMIN_ACTOR);
      expect(auth.getSessionEmail()).toBe('owner@test.com');
    });

    it('is empty when anonymous', () => {
      expect(auth.getSessionEmail()).toBe('');
    });
  });

  describe('memberViewFromActor', () => {
    it('maps actor member fields to the session member shape', () => {
      expect(auth.memberViewFromActor(ADMIN_ACTOR.member)).toEqual({
        id: 'm1',
        user_id: 'u1',
        email: 'owner@test.com',
        display_name: 'Owner',
        role: 'admin',
        status: 'active',
        avatar_url: 'https://img.test/a.png',
      });
    });

    it('returns null for a missing member', () => {
      expect(auth.memberViewFromActor(null)).toBeNull();
    });
  });

  describe('loadActor', () => {
    it('populates the cache from whoami and memoizes', async () => {
      whoami.mockResolvedValue({ actor: ADMIN_ACTOR });
      const actor = await auth.loadActor();
      expect(actor.authenticated).toBe(true);
      expect(auth.getSession().user.member.role).toBe('admin');
      await auth.loadActor();
      expect(whoami).toHaveBeenCalledTimes(1);
    });

    it('force re-fetches', async () => {
      whoami.mockResolvedValue({ actor: ADMIN_ACTOR });
      await auth.loadActor();
      await auth.loadActor(true);
      expect(whoami).toHaveBeenCalledTimes(2);
    });

    it('resolves anonymous when whoami throws', async () => {
      whoami.mockRejectedValue(new Error('network'));
      const actor = await auth.loadActor();
      expect(actor).toBeNull();
      expect(auth.getSession()).toBeNull();
    });

    it('treats a non-authenticated actor as signed out', async () => {
      whoami.mockResolvedValue({
        actor: { state: 'anonymous', authenticated: false, user: null, member: null },
      });
      await auth.loadActor();
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.getSession()).toBeNull();
    });
  });
});
