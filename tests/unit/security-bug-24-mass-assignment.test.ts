// Regression coverage for #24: capability-API mass-assignment.
//
// Several mutation handlers thread caller-supplied actor fields straight into
// the row insert via `input.X ?? memberId(actor)`. The capability gate confirms
// "you may post a forum reply" but does not constrain that you may only post
// **as yourself** — so an active member can spoof author_id / member_id /
// created_by, pin their own forum topic without the moderator-only `.pin`
// operation, RSVP another member to an event, attribute activity to others,
// etc. pollVotes.cast also fails to validate that optionId belongs to pollId.
//
// These tests pin the safe behavior: writes must use the actor's identity,
// privileged fields are stripped from create-path inputs, and pollVotes.cast
// rejects cross-poll option ids.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type JsonObject, KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';

type MockDbChain = Promise<JsonObject[]> & {
  eq(column: string, value: unknown): MockDbChain;
  limit(count: number): Promise<JsonObject[]>;
};

const mockState = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string },
  tables: {} as Record<string, JsonObject[]>,
  counters: {} as Record<string, number>,
  postgrestWriteRlsTables: new Set<string>(),
  chain(rows: JsonObject[]): MockDbChain {
    const query = Promise.resolve(rows) as MockDbChain;
    query.eq = (column: string, value: unknown) =>
      mockState.chain(rows.filter((row) => String(row[column]) === String(value)));
    query.limit = (count: number) => Promise.resolve(rows.slice(0, count));
    return query;
  },
  insert(table: string, row: JsonObject) {
    if (mockState.postgrestWriteRlsTables.has(table)) {
      throw new Error(`PostgREST RLS blocked insert on ${table}`);
    }
    const nextId = (mockState.counters[table] || maxId(mockState.tables[table] || [])) + 1;
    mockState.counters[table] = nextId;
    const created = { id: nextId, ...row };
    mockState.tables[table] = [...(mockState.tables[table] || []), created];
    return Promise.resolve(created);
  },
  update(table: string, column: string, value: unknown, patch: JsonObject) {
    const rows = mockState.tables[table] || [];
    const updated: JsonObject[] = [];
    mockState.tables[table] = rows.map((row) => {
      if (String(row[column]) !== String(value)) return row;
      const next = { ...row, ...patch };
      updated.push(next);
      return next;
    });
    return Promise.resolve(updated);
  },
  delete(table: string, column: string, value: unknown) {
    const rows = mockState.tables[table] || [];
    const kept: JsonObject[] = [];
    const deleted: JsonObject[] = [];
    for (const row of rows) {
      if (String(row[column]) === String(value)) deleted.push(row);
      else kept.push(row);
    }
    mockState.tables[table] = kept;
    return Promise.resolve(deleted);
  },
}));

vi.mock(
  '@run402/functions',
  () => ({
    getUser: vi.fn(async () => mockState.user),
    auth: { user: vi.fn(async () => mockState.user) },
    adminDb: () => ({
      sql(query: string, params: unknown[] = []) {
        return mockSql(query, params);
      },
      from(table: string) {
        return {
          select() {
            return mockState.chain(mockState.tables[table] || []);
          },
          insert(row: JsonObject) {
            return mockState.insert(table, row);
          },
          update(patch: JsonObject) {
            return {
              eq(column: string, value: unknown) {
                return mockState.update(table, column, value, patch);
              },
            };
          },
          delete() {
            return {
              eq(column: string, value: unknown) {
                return mockState.delete(table, column, value);
              },
            };
          },
        };
      },
    }),
  }),
  { virtual: true },
);

function maxId(rows: JsonObject[]) {
  return Math.max(0, ...rows.map((row) => Number(row.id || 0)));
}

function mockSql(query: string, params: unknown[]) {
  const normalized = query.replace(/\s+/g, ' ').trim();
  const insert = normalized.match(/^INSERT INTO "([^"]+)" \(([^)]+)\) VALUES \(([^)]+)\) RETURNING \*$/);
  if (insert) {
    const [, table, columns] = insert;
    const row = Object.fromEntries(columns.split(', ').map((column, index) => [column.slice(1, -1), params[index]]));
    const nextId = (mockState.counters[table] || maxId(mockState.tables[table] || [])) + 1;
    mockState.counters[table] = nextId;
    const created = { id: nextId, ...row };
    mockState.tables[table] = [...(mockState.tables[table] || []), created];
    return Promise.resolve([created]);
  }
  const update = normalized.match(/^UPDATE "([^"]+)" SET (.+) WHERE "([^"]+)" = \$([0-9]+) RETURNING \*$/);
  if (update) {
    const [, table, assignments, column, idParam] = update;
    const patch = Object.fromEntries(
      assignments.split(', ').map((assignment) => {
        const [, rawColumn, rawParam] = assignment.match(/^"([^"]+)" = \$([0-9]+)$/) || [];
        return [rawColumn, params[Number(rawParam) - 1]];
      }),
    );
    const rows = mockState.tables[table] || [];
    const updated: JsonObject[] = [];
    mockState.tables[table] = rows.map((row) => {
      if (String(row[column]) !== String(params[Number(idParam) - 1])) return row;
      const next = { ...row, ...patch };
      updated.push(next);
      return next;
    });
    return Promise.resolve(updated);
  }
  const select = normalized.match(/^SELECT \* FROM "([^"]+)" WHERE "([^"]+)" = \$1 LIMIT 1$/);
  if (select) {
    const [, table, column] = select;
    return Promise.resolve(
      (mockState.tables[table] || []).filter((row) => String(row[column]) === String(params[0])).slice(0, 1),
    );
  }
  const del = normalized.match(/^DELETE FROM "([^"]+)" WHERE "([^"]+)" = \$1 RETURNING \*$/);
  if (del) {
    const [, table, column] = del;
    const rows = mockState.tables[table] || [];
    const kept: JsonObject[] = [];
    const deleted: JsonObject[] = [];
    for (const row of rows) {
      if (String(row[column]) === String(params[0])) deleted.push(row);
      else kept.push(row);
    }
    mockState.tables[table] = kept;
    return Promise.resolve(deleted);
  }
  throw new Error(`Unexpected SQL: ${normalized}`);
}

const ATTACKER = {
  user_id: 'attacker-user',
  email: 'attacker@example.com',
  display_name: 'Attacker',
  role: 'member' as const,
  status: 'active' as const,
};

const VICTIM_MEMBER_ID = 999;

async function apiRequest(body: JsonObject) {
  const kychonApi = (await import('../../functions/kychon-api.js')).default;
  return kychonApi(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

async function callJson(body: JsonObject) {
  const res = await apiRequest(body);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  mockState.user = { id: ATTACKER.user_id, email: ATTACKER.email };
  mockState.counters = {};
  mockState.postgrestWriteRlsTables = new Set<string>();
  mockState.tables = {
    members: [
      { id: 1, ...ATTACKER },
      {
        id: VICTIM_MEMBER_ID,
        user_id: 'victim-user',
        email: 'victim@example.com',
        role: 'admin',
        status: 'active',
        display_name: 'Admin',
      },
    ],
    forum_categories: [{ id: 1, name: 'General', position: 1 }],
    forum_topics: [],
    forum_replies: [],
    events: [{ id: 1, title: 'Meetup', starts_at: '2099-01-01T10:00:00Z' }],
    event_rsvps: [{ id: 1, event_id: 1, member_id: VICTIM_MEMBER_ID, status: 'going' }],
    polls: [
      { id: 1, question: 'Poll A', poll_type: 'single', is_open: true },
      { id: 2, question: 'Poll B', poll_type: 'single', is_open: true },
    ],
    poll_options: [
      { id: 10, poll_id: 1, label: 'A1', position: 0 },
      { id: 11, poll_id: 1, label: 'A2', position: 1 },
      { id: 20, poll_id: 2, label: 'B1', position: 0 },
    ],
    poll_votes: [],
    activity_log: [],
    capability_executions: [],
    reactions: [],
    announcements: [],
  };
});

describe('bug #24 — capability API mass-assignment', () => {
  it('forum.topics.create ignores caller-supplied author_id', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'forum.topics.create',
      phase: 'execute',
      idempotencyKey: 'topic-author-spoof',
      input: {
        categoryId: 1,
        title: 'Spoofed',
        body: 'body',
        author_id: VICTIM_MEMBER_ID,
        author_name: 'Admin',
      },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const topic = mockState.tables.forum_topics[0];
    expect(String(topic.author_id)).toBe('1'); // attacker member id, not VICTIM
    expect(topic.author_name).toBe(ATTACKER.display_name);
  });

  it('forum.topics.create ignores caller-supplied is_pinned (moderator-only via .pin)', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'forum.topics.create',
      phase: 'execute',
      idempotencyKey: 'topic-self-pin',
      input: { categoryId: 1, title: 'Self-pin attempt', body: 'body', is_pinned: true },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const topic = mockState.tables.forum_topics[0];
    expect(topic.is_pinned).toBe(false);
  });

  it('forum.replies.create ignores caller-supplied author_id', async () => {
    mockState.tables.forum_topics = [{ id: 5, category_id: 1, title: 'Topic', locked: false, reply_count: 0 }];
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'forum.replies.create',
      phase: 'execute',
      idempotencyKey: 'reply-author-spoof',
      input: {
        topicId: 5,
        body: 'reply body',
        author_id: VICTIM_MEMBER_ID,
        author_name: 'Admin',
      },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const reply = mockState.tables.forum_replies[0];
    expect(String(reply.author_id)).toBe('1');
    expect(reply.author_name).toBe(ATTACKER.display_name);
  });

  it('rsvps.setStatus ignores caller-supplied member_id (cannot RSVP another member)', async () => {
    mockState.tables.event_rsvps = []; // no existing RSVP for attacker
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'rsvps.setStatus',
      phase: 'execute',
      idempotencyKey: 'rsvp-member-spoof',
      input: { eventId: 1, status: 'going', memberId: VICTIM_MEMBER_ID },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(mockState.tables.event_rsvps).toHaveLength(1);
    expect(String(mockState.tables.event_rsvps[0].member_id)).toBe('1');
  });

  it("rsvps.setStatus ignores caller-supplied id targeting another member's RSVP", async () => {
    // Pre-existing RSVP belongs to VICTIM_MEMBER_ID. Attacker tries to flip
    // it via id=1.
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'rsvps.setStatus',
      phase: 'execute',
      idempotencyKey: 'rsvp-id-spoof',
      input: { id: 1, status: 'cancelled' },
    });
    // Attacker has no RSVP of their own, so this should NOT mutate someone
    // else's row. Either reject with permission.denied or create a new
    // attacker-owned RSVP.
    if (r.status === 200) {
      expect(String(mockState.tables.event_rsvps[0].member_id)).toBe(String(VICTIM_MEMBER_ID));
      expect(mockState.tables.event_rsvps[0].status).toBe('going');
    } else {
      expect(r.body.error?.code).toBe('permission.denied');
    }
  });

  it('pollVotes.cast rejects optionId from a different poll', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'pollVotes.cast',
      phase: 'execute',
      idempotencyKey: 'poll-vote-cross',
      input: { pollId: 1, optionId: 20 }, // option 20 belongs to poll 2, not 1
    });
    expect(r.status, JSON.stringify(r.body)).toBe(400);
    expect(r.body.error.code).toBe('validation.failed');
    expect(mockState.tables.poll_votes).toHaveLength(0);
  });

  it('pollVotes.cast accepts optionId that belongs to the poll', async () => {
    const r = await callJson({
      apiVersion: KYCHON_API_VERSION,
      operation: 'pollVotes.cast',
      phase: 'execute',
      idempotencyKey: 'poll-vote-ok',
      input: { pollId: 1, optionId: 10 },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(mockState.tables.poll_votes).toHaveLength(1);
    expect(String(mockState.tables.poll_votes[0].member_id)).toBe('1');
    expect(String(mockState.tables.poll_votes[0].option_id)).toBe('10');
  });
});
