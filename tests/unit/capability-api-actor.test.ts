import { describe, expect, it, vi } from 'vitest';

import {
  allowedOperationsForActor,
  authExplainDenied,
  authPermissions,
  authWhoami,
  checkOperationPermission,
  resolveCapabilityActor,
  type MemberRowLike,
  type Run402UserLike,
} from '../../src/lib/capability-api/index.ts';

function makeRequest(body?: unknown): Request {
  return new Request('https://portal.test/functions/v1/kychon-api', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
  });
}

function makeDeps(user: Run402UserLike | null, members: MemberRowLike[]) {
  return {
    getUser: vi.fn(async () => user),
    adminDb: () => ({
      from(table: string) {
        expect(table).toBe('members');
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                return {
                  limit(count: number) {
                    const normalized = typeof value === 'string' ? value.toLowerCase() : value;
                    return members
                      .filter((member) => {
                        const candidate = member[column as keyof MemberRowLike];
                        return typeof candidate === 'string' ? candidate.toLowerCase() === normalized : candidate === value;
                      })
                      .slice(0, count);
                  },
                };
              },
            };
          },
        };
      },
    }),
  };
}

describe('Capability API actor resolution', () => {
  it('resolves anonymous requests without trusting client input', async () => {
    const deps = makeDeps(null, []);
    const actor = await resolveCapabilityActor(makeRequest({ role: 'admin' }), deps);

    expect(actor.state).toBe('anonymous');
    expect(actor.authenticated).toBe(false);
    expect(deps.getUser).toHaveBeenCalledOnce();
  });

  it('resolves authenticated non-members', async () => {
    const actor = await resolveCapabilityActor(makeRequest(), makeDeps({ id: 'user-1', email: 'a@example.com' }, []));

    expect(actor.state).toBe('authenticated_non_member');
    expect(actor.user?.id).toBe('user-1');
    expect(actor.member).toBeNull();
  });

  it('looks up members by user_id before using controlled email fallback', async () => {
    const actor = await resolveCapabilityActor(
      makeRequest(),
      makeDeps({ id: 'legacy-user', email: 'legacy@example.com' }, [
        { id: 7, user_id: null, email: 'legacy@example.com', role: 'member', status: 'active' },
      ]),
    );

    expect(actor.state).toBe('active_member');
    expect(actor.member?.lookup).toBe('email');
    expect(actor.member?.id).toBe('7');
  });

  it('resolves pending, active member, moderator, and admin states from active member rows', async () => {
    await expect(
      resolveCapabilityActor(
        makeRequest(),
        makeDeps({ id: 'pending' }, [{ id: 1, user_id: 'pending', role: 'member', status: 'pending' }]),
      ).then((actor) => actor.state),
    ).resolves.toBe('pending_member');

    await expect(
      resolveCapabilityActor(
        makeRequest(),
        makeDeps({ id: 'member' }, [{ id: 2, user_id: 'member', role: 'member', status: 'active' }]),
      ).then((actor) => actor.state),
    ).resolves.toBe('active_member');

    await expect(
      resolveCapabilityActor(
        makeRequest(),
        makeDeps({ id: 'mod' }, [{ id: 3, user_id: 'mod', role: 'moderator', status: 'active' }]),
      ).then((actor) => actor.state),
    ).resolves.toBe('moderator');

    await expect(
      resolveCapabilityActor(
        makeRequest(),
        makeDeps({ id: 'admin' }, [{ id: 4, user_id: 'admin', role: 'admin', status: 'active' }]),
      ).then((actor) => actor.state),
    ).resolves.toBe('admin');
  });

  it('does not grant Kychon admin authority from inactive admin member rows', async () => {
    const actor = await resolveCapabilityActor(
      makeRequest(),
      makeDeps({ id: 'inactive-admin' }, [{ id: 5, user_id: 'inactive-admin', role: 'admin', status: 'suspended' }]),
    );

    expect(actor.state).toBe('authenticated_non_member');
    expect(actor.authority.activeMemberAdmin).toBe(false);
  });

  it('resolves trusted project admins independently from member rows', async () => {
    const actor = await resolveCapabilityActor(
      makeRequest(),
      makeDeps({ id: 'project-admin', app_metadata: { role: 'project_admin' } }, []),
    );

    expect(actor.state).toBe('project_admin');
    expect(actor.authority.projectAdmin).toBe(true);
  });

  it('ignores client-supplied role fields for authorization', async () => {
    const actor = await resolveCapabilityActor(
      makeRequest({ role: 'admin', member: { role: 'admin' } }),
      makeDeps({ id: 'member' }, [{ id: 6, user_id: 'member', role: 'member', status: 'active' }]),
    );

    expect(actor.state).toBe('active_member');
    expect(checkOperationPermission(actor, 'config.set').allowed).toBe(false);
  });
});

describe('Capability API permission and auth operations', () => {
  it('derives allowed operations from operation registry metadata', async () => {
    const actor = await resolveCapabilityActor(makeRequest(), makeDeps(null, []));
    const allowed = allowedOperationsForActor(actor).map((operation) => operation.name);

    expect(allowed).toContain('portal.discover');
    expect(allowed).toContain('search.query');
    expect(allowed).not.toContain('config.set');
  });

  it('implements auth.whoami, auth.permissions, and auth.explainDenied helpers', async () => {
    const actor = await resolveCapabilityActor(makeRequest(), makeDeps(null, []));

    expect(authWhoami(actor).actor.state).toBe('anonymous');
    expect(authPermissions(actor).operations.some((operation) => operation.name === 'portal.capabilities')).toBe(true);
    expect(authExplainDenied(actor, { operation: 'events.create' })).toMatchObject({
      operation: 'events.create',
      allowed: false,
      actorState: 'anonymous',
      requiredState: 'admin',
    });
  });
});
