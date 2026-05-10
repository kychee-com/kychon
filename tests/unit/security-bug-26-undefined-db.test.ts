// Regression coverage for #26: on-signup.js and ai-content.js dereference a
// bare `db` identifier even though only `adminDb` is imported. Both throw a
// `ReferenceError` at runtime — on-signup loses every brand-new member, and
// the AI newsletter never produces a draft. These tests load the deployed
// modules, mock @run402/functions, and exercise the failing code paths.

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  counters: {} as Record<string, number>,
  authUserResponses: [] as Array<{ ok: boolean; status?: number; json: unknown }>,
  fetchCalls: [] as string[],
  insertedRows: [] as Array<{ table: string; row: Row }>,
}));

type DbChain = Promise<Row[]> & {
  eq(column: string, value: unknown): DbChain;
  gte(column: string, value: unknown): DbChain;
  order(): DbChain;
  limit(count: number): Promise<Row[]>;
};

function chain(rows: Row[]): DbChain {
  const promise = Promise.resolve(rows) as DbChain;
  promise.eq = (column: string, value: unknown) => chain(rows.filter((row) => String(row[column]) === String(value)));
  promise.gte = (column: string, value: unknown) =>
    chain(rows.filter((row) => String(row[column] ?? '') >= String(value)));
  promise.order = () => chain(rows);
  promise.limit = (count: number) => Promise.resolve(rows.slice(0, count));
  return promise;
}

function table(name: string) {
  state.tables[name] ||= [];
  return {
    select() {
      return chain(state.tables[name]);
    },
    insert(row: Row) {
      const nextId = (state.counters[name] || 0) + 1;
      state.counters[name] = nextId;
      const created = { id: nextId, ...row };
      state.tables[name] = [...state.tables[name], created];
      state.insertedRows.push({ table: name, row: created });
      return Promise.resolve([created]);
    },
  };
}

vi.mock(
  '@run402/functions',
  () => ({
    getUser: vi.fn(async () => ({ id: 'auth-user-1', email: 'new@example.com' })),
    adminDb: () => ({
      from: table,
      sql(query: string) {
        if (/count\(\*\)/i.test(query)) {
          return Promise.resolve({ rows: [{ count: 0 }] });
        }
        throw new Error(`Unexpected SQL: ${query}`);
      },
    }),
  }),
  { virtual: true },
);

beforeEach(() => {
  state.tables = {};
  state.counters = {};
  state.authUserResponses = [];
  state.fetchCalls = [];
  state.insertedRows = [];

  // The on-signup handler may fetch the auth user details for display_name/avatar.
  globalThis.fetch = vi.fn(async (url: string) => {
    state.fetchCalls.push(url);
    const next = state.authUserResponses.shift();
    if (next) {
      return new Response(JSON.stringify(next.json), {
        status: next.status ?? (next.ok ? 200 : 500),
      });
    }
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
});

describe('on-signup.js — bug #26 (undefined db)', () => {
  it('creates a member when invoked via the lifecycle hook (no ReferenceError)', async () => {
    const onSignup = (await import('../../functions/on-signup.js')).default;
    const req = new Request('https://portal.test/functions/v1/on-signup', {
      method: 'POST',
      headers: { 'x-run402-trigger': 'signup', 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: { id: 'auth-user-1', email: 'new@example.com' } }),
    });
    const res = await onSignup(req);
    const body = await res.json();
    expect(res.status, body?.error || 'on-signup unexpectedly failed').toBe(200);
    expect(body.status).toBe('created');
    expect(state.tables.members).toHaveLength(1);
    expect(state.tables.members[0]).toMatchObject({
      user_id: 'auth-user-1',
      email: 'new@example.com',
      role: 'admin', // first member becomes admin
      status: 'active',
    });
    expect(state.tables.activity_log).toHaveLength(1);
  });
});

describe('ai-content.js — bug #26 (undefined db)', () => {
  it('runs gatherWeeklyActivity without ReferenceError when newsletter feature is enabled', async () => {
    process.env.AI_API_KEY = 'sk-test';
    process.env.AI_PROVIDER = 'openai';
    state.tables.site_config = [
      { id: 1, key: 'feature_ai_newsletter', value: true },
      { id: 2, key: 'site_name', value: '"Test Community"' },
    ];
    state.tables.events = [];
    state.tables.announcements = [];
    state.tables.forum_topics = [];
    state.tables.resources = [];
    state.tables.members = [];
    state.tables.newsletter_drafts = [];

    // Mock OpenAI response — fetch is already mocked in beforeEach; override
    // for this test to return a valid newsletter JSON envelope.
    let openaiCalls = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      state.fetchCalls.push(url);
      if (url.includes('openai.com')) {
        openaiCalls += 1;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"subject":"Hi","body":"<p>Hi</p>"}' } }],
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const aiContent = (await import('../../functions/ai-content.js')).default;
    const buildReq = () =>
      new Request('https://portal.test/functions/v1/ai-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

    const res = await aiContent(buildReq());
    const body = await res.json();
    // Handler may "skip" when activity is empty — but it must NOT 500 with
    // ReferenceError. status === 'skipped' is acceptable; status >= 500 is not.
    expect(res.status, body?.error || 'ai-content unexpectedly failed').toBeLessThan(500);
    expect(body?.error ?? '').not.toMatch(/db is not defined|ReferenceError/);

    // Sanity: with content present we expect a draft. Add some activity and
    // exercise the path again.
    state.tables.announcements.push({ id: 1, title: 'News', body: 'Body', created_at: new Date().toISOString() });
    const res2 = await aiContent(buildReq());
    const body2 = await res2.json();
    expect(res2.status, body2?.error || 'ai-content gather failed with content').toBe(200);
    expect(body2.status).toBe('ok');
    expect(state.tables.newsletter_drafts).toHaveLength(1);
    expect(openaiCalls).toBeGreaterThan(0);
  });
});
