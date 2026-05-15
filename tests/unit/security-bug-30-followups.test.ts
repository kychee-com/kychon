import { describe, expect, it } from 'vitest';

import {
  type CapabilityActor,
  type CapabilityMutationDb,
  executeCapabilityMutation,
  handleCapabilityApiRequest,
  type JsonObject,
  KYCHON_API_VERSION,
  sanitizeRichHtmlServer,
  validateCapabilityMutation,
} from '../../src/lib/capability-api/index.ts';

class MemoryMutationDb implements CapabilityMutationDb {
  counters: Record<string, number> = {};

  constructor(public tables: Record<string, JsonObject[]>) {}

  async select(table: string) {
    return this.tables[table] || [];
  }

  async insert(table: string, row: JsonObject) {
    const nextId = (this.counters[table] || this.maxId(table)) + 1;
    this.counters[table] = nextId;
    const created = { id: nextId, ...row };
    this.tables[table] = [...(this.tables[table] || []), created];
    return created;
  }

  async update(table: string, id: string | number, patch: JsonObject) {
    const rows = this.tables[table] || [];
    const index = rows.findIndex((row) => String(row.id) === String(id));
    if (index < 0) return null;
    rows[index] = { ...rows[index], ...patch };
    return rows[index];
  }

  async delete(table: string, id: string | number) {
    const rows = this.tables[table] || [];
    const index = rows.findIndex((row) => String(row.id) === String(id));
    if (index < 0) return null;
    const [deleted] = rows.splice(index, 1);
    return deleted || null;
  }

  private maxId(table: string) {
    return Math.max(0, ...(this.tables[table] || []).map((row) => Number(row.id || 0)));
  }
}

const adminActor: CapabilityActor = {
  state: 'admin',
  authenticated: true,
  user: { id: 'admin-user', email: 'admin@example.com' },
  member: {
    id: '1',
    ref: { type: 'member', id: '1' },
    userId: 'admin-user',
    email: 'admin@example.com',
    displayName: 'Admin',
    role: 'admin',
    status: 'active',
    lookup: 'user_id',
  },
  authority: { projectAdmin: false, activeMemberAdmin: true },
};

function requireMember(actor: CapabilityActor) {
  if (!actor.member) throw new Error(`Expected ${actor.state} actor to have a member`);
  return actor.member;
}

const memberActor: CapabilityActor = {
  ...adminActor,
  state: 'active_member',
  user: { id: 'member-user', email: 'member@example.com' },
  member: {
    ...requireMember(adminActor),
    id: '2',
    userId: 'member-user',
    email: 'member@example.com',
    role: 'member',
  },
  authority: { projectAdmin: false, activeMemberAdmin: false },
};

function request(body: unknown): Request {
  return new Request('https://portal.test/functions/v1/kychon-api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readJson(res: Response) {
  return { status: res.status, body: await res.json() };
}

function expectRejectedPlan(plan: Awaited<ReturnType<typeof validateCapabilityMutation>>, code: string) {
  expect(plan.accepted).toBe(false);
  expect(plan.permission.allowed).toBe(false);
  expect(plan.warnings.some((warning) => warning.code === code)).toBe(true);
}

describe('bug #30 — server rich-HTML sanitizer closes known regex bypasses', () => {
  it.each([
    ['slash-separated SVG event handler', '<svg/onload=alert(1)>', /onload|<svg/i],
    ['slash-separated details event handler', '<details/open/ontoggle=alert(1)>', /ontoggle|<details/i],
    ['style attribute CSS injection', '<img style="background:url(javascript:alert(1))">', /style\s*=|javascript:/i],
    ['entity-obfuscated javascript href', '<a href="&#106;avascript:alert(1)">x</a>', /javascript:|&#106;avascript/i],
  ])('strips %s', (_name, input, forbidden) => {
    expect(sanitizeRichHtmlServer(input)).not.toMatch(forbidden);
  });

  it('still preserves safe Tiptap-compatible markup', () => {
    expect(sanitizeRichHtmlServer('<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>')).toBe(
      '<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>',
    );
  });
});

describe('bug #30 — validate phase runs the same semantic checks as execute', () => {
  it('rejects validating another member profile update even though active members can update profiles', async () => {
    const db = new MemoryMutationDb({ members: [] });

    const plan = await validateCapabilityMutation(
      'members.updateProfile',
      { id: 925, display_name: 'PWNED' },
      { actor: memberActor, db },
    );

    expectRejectedPlan(plan, 'permission.denied');
    expect(plan.permission.reason).toMatch(/active member profile/);
  });

  it('rejects cross-poll option ids during validate and execute', async () => {
    const db = new MemoryMutationDb({
      polls: [{ id: 1, question: 'Poll', poll_type: 'single', is_open: true }],
      poll_options: [
        { id: 10, poll_id: 1, label: 'Yes' },
        { id: 20, poll_id: 2, label: 'Other poll option' },
      ],
      poll_votes: [],
      activity_log: [],
    });

    const plan = await validateCapabilityMutation(
      'pollVotes.cast',
      { pollId: 1, optionId: 20 },
      { actor: memberActor, db },
    );

    expectRejectedPlan(plan, 'validation.failed');
    await expect(
      executeCapabilityMutation('pollVotes.cast', { pollId: 1, optionId: 20 }, { actor: memberActor, db }),
    ).rejects.toMatchObject({ code: 'validation.failed' });
    expect(db.tables.poll_votes).toHaveLength(0);
  });

  it('rejects replies to locked topics during validate', async () => {
    const db = new MemoryMutationDb({
      forum_topics: [{ id: 2, title: 'Locked', locked: true, reply_count: 0 }],
      forum_replies: [],
      activity_log: [],
    });

    const plan = await validateCapabilityMutation(
      'forum.replies.create',
      { topicId: 2, body: 'Nope' },
      { actor: memberActor, db },
    );

    expectRejectedPlan(plan, 'conflict.state');
  });

  it('applies semantic validate checks through the gateway when a mutation db is available', async () => {
    const mutationDb = new MemoryMutationDb({
      polls: [{ id: 1, question: 'Poll', poll_type: 'single', is_open: true }],
      poll_options: [{ id: 20, poll_id: 2, label: 'Other poll option' }],
      poll_votes: [],
      activity_log: [],
    });
    const res = await handleCapabilityApiRequest(
      request({
        apiVersion: KYCHON_API_VERSION,
        operation: 'pollVotes.cast',
        phase: 'validate',
        input: { pollId: 1, optionId: 20 },
      }),
      {
        createCorrelationId: () => 'corr-test',
        getUser: async () => ({ id: 'member-user', email: 'member@example.com' }),
        mutationDb,
        adminDb: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                limit: () => [
                  { id: 2, user_id: 'member-user', role: 'member', status: 'active', email: 'member@example.com' },
                ],
              }),
            }),
          }),
        }),
      },
    );
    const out = await readJson(res);

    expect(out.status).toBe(200);
    expect(out.body.data.accepted).toBe(false);
    expect(out.body.data.warnings.some((warning: JsonObject) => warning.code === 'validation.failed')).toBe(true);
  });
});
