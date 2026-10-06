// Regression coverage for the cron-style edge functions: moderate-content,
// event-reminders, check-expirations, ai-content, and prune-history.
//
// Every functions/*.js file ships to every portal, and anyone holding the
// portal's public anon key can call it at /functions/v1/<name>. These functions
// used to run for any caller, so an anonymous request could email every member
// who RSVP'd to an event starting within the hour (on every call), send
// membership-expiry emails, spend the AI moderation quota or the portal's own
// AI key, write newsletter drafts or public recap announcements, prune content
// history, or start a moderation pass long enough to time out (one did on
// 2026-10-06 and failed a concurrent deploy's post-deploy error gate).
//
// They now run only when the platform starts them (the gateway sets
// x-run402-trigger on the runs it starts and never forwards a caller's
// x-run402-* headers to a function) or when an active admin or a project admin
// calls them. Anonymous callers get 401 and other callers 403, before any
// database, AI, or email work. Runs against the real schema.sql (PGlite).

import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pgliteAdminDb } from '../helpers/pglite-admin-db';
import { freshKychonDb, rows } from '../helpers/pglite-db';

type MockUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };
type AdminDb = ReturnType<typeof pgliteAdminDb>;

const state = vi.hoisted(() => ({
  db: null as null | AdminDb,
  user: null as null | MockUser,
  // Every adminDb() call a function makes, e.g. 'select members', 'sql UPDATE event_rsvps'.
  calls: [] as string[],
  sqlCalls: [] as Array<{ text: string; params: unknown[] }>,
}));

const emailSend = vi.hoisted(() => vi.fn(async (_message: Record<string, unknown>) => ({ id: 'msg_1' })));
const aiModerate = vi.hoisted(() =>
  vi.fn(async (_text: string) => ({ flagged: true, category_scores: { harassment: 0.9, violence: 0.01 } })),
);

vi.mock(
  '@run402/functions',
  () => ({
    adminDb: () => state.db,
    auth: { user: vi.fn(async () => state.user) },
    email: { send: emailSend },
    ai: { moderate: aiModerate },
  }),
  { virtual: true },
);

// Records each call, then delegates to the PGlite-backed adminDb.
function recordingAdminDb(inner: AdminDb): AdminDb {
  return {
    sql(text: string, params: unknown[] = []) {
      state.calls.push(`sql ${text.trim().split(/\s+/).slice(0, 2).join(' ')}`);
      state.sqlCalls.push({ text, params });
      return inner.sql(text, params);
    },
    from(table: string) {
      const builder = inner.from(table);
      return {
        select(cols?: string) {
          state.calls.push(`select ${table}`);
          return builder.select(cols);
        },
        insert(row: Record<string, unknown>) {
          state.calls.push(`insert ${table}`);
          return builder.insert(row);
        },
        update(patch: Record<string, unknown>) {
          state.calls.push(`update ${table}`);
          return builder.update(patch);
        },
        delete() {
          state.calls.push(`delete ${table}`);
          return builder.delete();
        },
      };
    },
  };
}

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'ada@example.org' };
const MEMBER = { id: '22222222-2222-4222-8222-222222222222', email: 'grace@example.org' };
const PENDING_ADMIN = { id: '33333333-3333-4333-8333-333333333333', email: 'linus@example.org' };
const SUSPENDED_ADMIN = { id: '44444444-4444-4444-8444-444444444444', email: 'sus@example.org' };
const UNLINKED_ADMIN = { id: '55555555-5555-4555-8555-555555555555', email: 'Email-Admin@example.org' };
const STRANGER = { id: '66666666-6666-4666-8666-666666666666', email: 'drive-by@example.org' };
const PROJECT_ADMIN = {
  id: '77777777-7777-4777-8777-777777777777',
  email: 'owner@example.org',
  app_metadata: { role: 'project_admin' },
};

const PLATFORM_RUN = { 'x-run402-trigger': 'function_run', 'x-run402-run-id': 'fnrun_test' };

const NON_ADMIN_CALLERS: Array<[string, MockUser]> = [
  ['a self-registered user with no member record', STRANGER],
  ['an active non-admin member', MEMBER],
  ['a pending admin', PENDING_ADMIN],
  ['a suspended admin', SUSPENDED_ADMIN],
];

const ALLOWED_CALLERS: Array<[string, MockUser | null, Record<string, string>]> = [
  ['a platform-started run (schedule trigger)', null, PLATFORM_RUN],
  ['an active admin', ADMIN, {}],
  ['an active admin matched by email', UNLINKED_ADMIN, {}],
  ['a project admin', PROJECT_ADMIN, {}],
];

const HANDLERS = {
  'moderate-content': () => import('../../functions/moderate-content.js'),
  'event-reminders': () => import('../../functions/event-reminders.js'),
  'check-expirations': () => import('../../functions/check-expirations.js'),
  'ai-content': () => import('../../functions/ai-content.js'),
  'prune-history': () => import('../../functions/prune-history.js'),
};
type FunctionName = keyof typeof HANDLERS;

async function invoke(name: FunctionName, headers: Record<string, string> = {}, body: unknown = {}) {
  const handler = (await HANDLERS[name]()).default;
  const res = await handler(
    new Request(`https://portal.test/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}

// Tables a run could write, as one comparable value.
const WRITABLE_TABLES = [
  'events',
  'event_rsvps',
  'forum_topics',
  'forum_replies',
  'moderation_log',
  'announcements',
  'newsletter_drafts',
  'member_insights',
  'revisions',
  'changesets',
];
async function snapshot() {
  const out: Record<string, unknown[]> = {};
  for (const table of WRITABLE_TABLES) out[table] = await rows(db, `SELECT * FROM ${table} ORDER BY id`);
  return out;
}

function utcDay(daysFromNow: number) {
  // The same computation check-expirations uses for its expiry windows.
  const day = new Date();
  day.setDate(day.getDate() + daysFromNow);
  return day.toISOString().split('T')[0];
}

let db: PGlite;
beforeAll(async () => {
  db = await freshKychonDb();
});

beforeEach(async () => {
  state.db = recordingAdminDb(pgliteAdminDb(db));
  state.user = null;
  emailSend.mockClear();
  aiModerate.mockClear();
  globalThis.fetch = vi.fn(async () =>
    Response.json({ choices: [{ message: { content: '{"title":"Recap","subject":"News","body":"<p>Hi</p>"}' } }] }),
  ) as unknown as typeof fetch;
  delete process.env.AI_API_KEY;

  await db.exec(`
    TRUNCATE members, events, event_rsvps, forum_topics, forum_replies, moderation_log, announcements,
      newsletter_drafts, member_insights, activity_log, site_config, pages, revisions, changesets
      RESTART IDENTITY CASCADE;

    INSERT INTO site_config (key, value) VALUES
      ('site_name', '"Eagles"'),
      ('feature_ai_moderation', 'true'),
      ('feature_ai_newsletter', 'true'),
      ('feature_ai_event_recaps', 'true'),
      ('feature_ai_insights', 'true');

    INSERT INTO members (user_id, email, display_name, role, status, expires_at) VALUES
      ('${ADMIN.id}', 'ada@example.org', 'Ada', 'admin', 'active', NULL),
      ('${MEMBER.id}', 'grace@example.org', 'Grace <script>alert(1)</script>', 'member', 'active', NULL),
      ('${PENDING_ADMIN.id}', 'linus@example.org', 'Linus', 'admin', 'pending', NULL),
      ('${SUSPENDED_ADMIN.id}', 'sus@example.org', 'Sus', 'Admin', 'suspended', NULL),
      (NULL, 'email-admin@example.org', 'Emma', 'admin', 'active', NULL),
      (NULL, 'expiring@example.org', 'Eve <b>Bold</b>', 'member', 'active', '${utcDay(7)}T12:00:00Z');

    INSERT INTO events (title, location, starts_at, ends_at) VALUES
      ('Bake & <b>Sale</b>', '<i>Hall</i>', now() + interval '30 minutes', now() + interval '2 hours'),
      ('Picnic', 'Park', now() - interval '3 hours', now() - interval '1 hour'),
      ('Gala', 'Ballroom', now() + interval '3 hours', now() + interval '5 hours');

    -- Grace (going) and Ada (maybe) are due a reminder for the bake sale;
    -- Linus cancelled, and the gala starts too late for this run.
    INSERT INTO event_rsvps (event_id, member_id, status) VALUES (1, 2, 'going'), (1, 1, 'maybe'), (1, 3, 'cancelled'),
      (2, 2, 'going'), (3, 2, 'going');

    INSERT INTO forum_topics (title, body, author_id) VALUES ('Cheap pills', 'Buy now', 2);
    INSERT INTO forum_replies (topic_id, body, author_id) VALUES (1, 'Me too', 2);
    INSERT INTO announcements (title, body) VALUES ('Annual meeting', 'Friday at 7');
  `);
  state.calls = [];
  state.sqlCalls = [];
});

afterEach(() => {
  delete process.env.AI_API_KEY;
});

// What a successful run of each function does, starting from the fixture.
const EXPECTED_RUN: Record<FunctionName, (r: Awaited<ReturnType<typeof invoke>>) => Promise<void>> = {
  async 'moderate-content'(r) {
    expect(r.body).toEqual({ status: 'ok', moderated: 2 });
    expect(aiModerate).toHaveBeenCalledTimes(2);
    expect(await rows(db, 'SELECT content_type, action FROM moderation_log ORDER BY id')).toEqual([
      { content_type: 'forum_topic', action: 'hidden' },
      { content_type: 'forum_reply', action: 'hidden' },
    ]);
  },
  async 'event-reminders'(r) {
    expect(r.body).toEqual({ status: 'ok', events_checked: 1, reminders_sent: 2 });
    expect(emailSend.mock.calls.map(([message]) => message.to).sort()).toEqual([
      'ada@example.org',
      'grace@example.org',
    ]);
  },
  async 'check-expirations'(r) {
    expect(r.body).toMatchObject({ status: 'ok', reminders_sent: 1 });
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(emailSend.mock.calls[0][0].to).toBe('expiring@example.org');
  },
  async 'ai-content'(r) {
    expect(r.body).toEqual({ status: 'ok', subject: 'News' });
    expect(await rows(db, 'SELECT subject, status FROM newsletter_drafts')).toEqual([
      { subject: 'News', status: 'draft' },
    ]);
  },
  async 'prune-history'(r) {
    expect(r.body).toMatchObject({ status: 'ok', summary: { retention_days: 365 } });
  },
};

describe.each(Object.keys(HANDLERS) as FunctionName[])('%s: only the platform or an admin may run it', (name) => {
  beforeEach(() => {
    // Give ai-content and check-expirations an AI key to spend.
    process.env.AI_API_KEY = 'sk-test';
  });

  it('rejects an anonymous caller with 401 before any database, AI, or email work', async () => {
    const before = await snapshot();
    const r = await invoke(name);
    expect(r.status, r.text).toBe(401);
    expect(r.body).toEqual({ error: 'Unauthorized' });
    expect(state.calls).toEqual([]);
    expect(emailSend).not.toHaveBeenCalled();
    expect(aiModerate).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(await snapshot()).toEqual(before);
  });

  it('does not treat an empty x-run402-trigger header as a platform run', async () => {
    const r = await invoke(name, { 'x-run402-trigger': '' });
    expect(r.status, r.text).toBe(401);
    expect(state.calls).toEqual([]);
  });

  it.each(NON_ADMIN_CALLERS)('rejects %s with 403 after only a member lookup', async (_label, user) => {
    state.user = user;
    const before = await snapshot();
    const r = await invoke(name);
    expect(r.status, r.text).toBe(403);
    expect(r.body).toEqual({ error: 'Admin access required' });
    expect(new Set(state.calls)).toEqual(new Set(['select members']));
    expect(emailSend).not.toHaveBeenCalled();
    expect(aiModerate).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(await snapshot()).toEqual(before);
  });

  it.each(ALLOWED_CALLERS)('runs for %s', async (_label, user, headers) => {
    delete process.env.AI_API_KEY; // keep check-expirations to its emails
    if (name === 'ai-content') process.env.AI_API_KEY = 'sk-test';
    state.user = user;
    const r = await invoke(name, headers);
    expect(r.status, r.text).toBe(200);
    await EXPECTED_RUN[name](r);
  });
});

describe('event-reminders: one reminder per RSVP, escaped, parameterized', () => {
  it('reminds each going/maybe RSVP once, however often it runs', async () => {
    const first = await invoke('event-reminders', PLATFORM_RUN);
    expect(first.body.reminders_sent).toBe(2);

    // A retried run, an overlapping run, or an admin re-running it sends nothing new.
    state.user = ADMIN;
    const again = await invoke('event-reminders');
    expect(again.body).toEqual({ status: 'ok', events_checked: 1, reminders_sent: 0 });
    expect(emailSend).toHaveBeenCalledTimes(2);

    // Someone who RSVPs afterwards still gets theirs on the next run.
    await db.exec(`INSERT INTO event_rsvps (event_id, member_id, status) VALUES (1, 5, 'going')`);
    const later = await invoke('event-reminders', PLATFORM_RUN);
    expect(later.body.reminders_sent).toBe(1);
    expect(emailSend.mock.lastCall?.[0].to).toBe('email-admin@example.org');

    expect(
      await rows(
        db,
        'SELECT event_id, member_id FROM event_rsvps WHERE reminder_sent_at IS NOT NULL ORDER BY member_id',
      ),
    ).toEqual([
      { event_id: 1, member_id: 1 },
      { event_id: 1, member_id: 2 },
      { event_id: 1, member_id: 5 },
    ]);
  });

  it('escapes the event title, location, and member name in the email HTML', async () => {
    await invoke('event-reminders', PLATFORM_RUN);
    const toGrace = emailSend.mock.calls.find(([message]) => message.to === 'grace@example.org')?.[0];
    expect(toGrace?.html).toContain('Hi Grace &lt;script&gt;alert(1)&lt;/script&gt;,');
    expect(toGrace?.html).toContain('<strong>Bake &amp; &lt;b&gt;Sale&lt;/b&gt;</strong>');
    expect(toGrace?.html).toContain(' at &lt;i&gt;Hall&lt;/i&gt;.');
    expect(toGrace?.html).not.toContain('<script>');
  });

  it('passes the event id as a bound parameter, not SQL text', async () => {
    await invoke('event-reminders', PLATFORM_RUN);
    const claim = state.sqlCalls.find(({ text }) => /UPDATE event_rsvps/.test(text));
    expect(claim?.text).toMatch(/r\.event_id = \$1/);
    expect(claim?.params).toEqual([1]);
  });
});

describe('check-expirations: escaped, and the AI key is spent only for allowed runs', () => {
  it('escapes the member name in the email HTML', async () => {
    await invoke('check-expirations', PLATFORM_RUN);
    expect(emailSend.mock.calls[0][0].html).toContain('Hi Eve &lt;b&gt;Bold&lt;/b&gt;,');
  });

  it('generates member insights with the portal AI key on a platform run', async () => {
    process.env.AI_API_KEY = 'sk-test';
    const r = await invoke('check-expirations', PLATFORM_RUN);
    expect(r.body.insights_generated).toBeGreaterThan(0);
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});

describe('ai-content: event recaps', () => {
  it('lets an admin publish a recap of an event that has ended', async () => {
    process.env.AI_API_KEY = 'sk-test';
    state.user = ADMIN;
    const r = await invoke('ai-content', {}, { event_id: 2 });
    expect(r.status, r.text).toBe(200);
    expect(await rows(db, 'SELECT title FROM announcements ORDER BY id')).toEqual([
      { title: 'Annual meeting' },
      { title: 'Recap' },
    ]);
  });

  it('refuses an anonymous recap request before reading the event or calling the AI', async () => {
    process.env.AI_API_KEY = 'sk-test';
    const r = await invoke('ai-content', {}, { event_id: 2 });
    expect(r.status).toBe(401);
    expect(state.calls).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('prune-history: prunes for an allowed run', () => {
  it('deletes superseded revisions past retention', async () => {
    await db.exec(`INSERT INTO pages (slug, title) VALUES ('about', 'v1')`);
    await db.exec(`UPDATE pages SET title = 'v2' WHERE slug = 'about'`);
    await db.exec(`UPDATE revisions SET created_at = now() - interval '400 days'`);
    await db.exec(`UPDATE pages SET title = 'v3' WHERE slug = 'about'`);

    const r = await invoke('prune-history', PLATFORM_RUN);
    expect(r.body.summary).toMatchObject({ retention_days: 365, revisions: 2 });
    expect(
      await rows(db, `SELECT after ->> 'title' AS title FROM revisions WHERE table_name = 'pages' ORDER BY id`),
    ).toEqual([{ title: 'v3' }]);
  });
});
