// Moderation and event reminders run as one-off Run402 function runs that
// kychon-api queues after a mutation, not on schedules (a portal's tier caps
// its schedules, and these functions never actually ran on one):
//   - forum.topics.create and forum.replies.create queue a moderate-content
//     run for the new post, when feature_ai_moderation is on;
//   - creating or editing an event, and a going or maybe RSVP, queue an
//     event-reminders run for an hour before the event starts.
// moderate-content handles one post per run and event-reminders one event per
// run, so neither can outlast the function timeout on a backlog. Demo portals,
// whose members are seeded with real-looking addresses, never send reminders.
// Runs against the real schema.sql (PGlite).

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectFunctionsMap, ROOT } from '../../scripts/_lib.ts';
import { KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';
import { pgliteAdminDb } from '../helpers/pglite-admin-db';
import { freshKychonDb, rows } from '../helpers/pglite-db';

const state = vi.hoisted(() => ({
  db: null as null | ReturnType<typeof import('../helpers/pglite-admin-db').pgliteAdminDb>,
  user: null as null | { id: string; email?: string },
}));
const runsCreate = vi.hoisted(() =>
  vi.fn(async (_name: string, _options: Record<string, unknown>) => ({ run_id: 'fnrun_1' })),
);
const emailSend = vi.hoisted(() => vi.fn(async (_message: Record<string, unknown>) => ({ id: 'msg_1' })));
const aiModerate = vi.hoisted(() =>
  vi.fn(async (_text: string) => ({ flagged: true, category_scores: { harassment: 0.9 } })),
);

vi.mock(
  '@run402/functions',
  () => ({
    adminDb: () => state.db,
    auth: { user: async () => state.user },
    events: { emit: async () => ({ deduplicated: false }) },
    ai: { moderate: aiModerate },
    email: { send: emailSend },
    functions: { runs: { create: runsCreate } },
  }),
  { virtual: true },
);

const { default: kychonApi } = await import('../../functions/kychon-api.js');
const { default: moderateContent } = await import('../../functions/moderate-content.js');
const { default: eventReminders } = await import('../../functions/event-reminders.js');

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };
const MEMBER = { id: '22222222-2222-4222-8222-222222222222', email: 'member@example.org' };
const HOUR = 60 * 60 * 1000;

let db: PGlite;
beforeAll(async () => {
  db = await freshKychonDb();
});

beforeEach(async () => {
  state.db = pgliteAdminDb(db);
  state.user = null;
  runsCreate.mockClear();
  emailSend.mockClear();
  aiModerate.mockClear();
  await db.exec(`
    TRUNCATE members, events, event_rsvps, forum_topics, forum_replies, moderation_log, site_config,
      capability_executions, activity_log, revisions, changesets
      RESTART IDENTITY CASCADE;
    INSERT INTO site_config (key, value) VALUES ('feature_ai_moderation', 'true');
    INSERT INTO members (user_id, email, display_name, role, status) VALUES
      ('${ADMIN.id}', 'admin@example.org', 'Admin', 'admin', 'active'),
      ('${MEMBER.id}', 'member@example.org', 'Member', 'member', 'active');
  `);
});

let key = 0;
async function execute(api: typeof kychonApi, operation: string, input: Record<string, unknown>) {
  key += 1;
  const res = await api(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KYCHON_API_VERSION,
        operation,
        phase: 'execute',
        confirmed: true,
        idempotencyKey: `key-${key}`,
        input,
      }),
    }),
  );
  // biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary capability payloads
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

// A function run as the platform dispatches it: the trigger header plus an envelope.
async function run(handler: (req: Request) => Promise<Response>, payload: Record<string, unknown>) {
  const res = await handler(
    new Request('https://portal.test/functions/v1/background', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-run402-trigger': 'function_run' },
      body: JSON.stringify({ trigger: 'function_run', run_id: 'fnrun_1', event_type: 'test', payload }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

function queued(functionName: string) {
  return runsCreate.mock.calls.filter(([name]) => name === functionName).map(([, options]) => options);
}

async function insertEvent(startsInMs: number, sourceTimezone: string | null = null) {
  const [event] = await rows<{ id: number; starts_at: Date }>(
    db,
    'INSERT INTO events (title, starts_at, source_timezone) VALUES ($1, $2, $3) RETURNING id, starts_at',
    ['Picnic', new Date(Date.now() + startsInMs).toISOString(), sourceTimezone],
  );
  return event;
}

describe('kychon-api queues a moderation run for each new forum post', () => {
  it('queues moderate-content for a new topic', async () => {
    state.user = MEMBER;
    const res = await execute(kychonApi, 'forum.topics.create', { title: 'Hello', body: 'World' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const id = res.body.data.result.id;
    expect(queued('moderate-content')).toEqual([
      {
        eventType: 'forum.post_created',
        payload: { content_type: 'forum_topic', content_id: id },
        idempotencyKey: `moderate:forum_topic:${id}`,
      },
    ]);
  });

  it('queues moderate-content for a new reply', async () => {
    await db.exec(`INSERT INTO forum_topics (title, body) VALUES ('Topic', 'Body')`);
    state.user = MEMBER;
    const res = await execute(kychonApi, 'forum.replies.create', { topicId: 1, body: 'Reply' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const id = res.body.data.result.id;
    expect(queued('moderate-content')).toEqual([
      expect.objectContaining({
        payload: { content_type: 'forum_reply', content_id: id },
        idempotencyKey: `moderate:forum_reply:${id}`,
      }),
    ]);
  });

  it('queues nothing while AI moderation is off', async () => {
    await db.exec(`UPDATE site_config SET value = 'false' WHERE key = 'feature_ai_moderation'`);
    state.user = MEMBER;
    const res = await execute(kychonApi, 'forum.topics.create', { title: 'Hello', body: 'World' });
    expect(res.status).toBe(200);
    expect(runsCreate).not.toHaveBeenCalled();
  });

  it('still creates the post when the run cannot be queued', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    runsCreate.mockRejectedValueOnce(new Error('platform unavailable'));
    state.user = MEMBER;
    const res = await execute(kychonApi, 'forum.topics.create', { title: 'Hello', body: 'World' });
    expect(res.status).toBe(200);
    expect(await rows(db, 'SELECT title FROM forum_topics')).toEqual([{ title: 'Hello' }]);
    expect(consoleError).toHaveBeenCalledWith(
      'follow-up run not queued (forum.topics.create):',
      'platform unavailable',
    );
    consoleError.mockRestore();
  });
});

describe('kychon-api queues a reminder run for an hour before each event', () => {
  const startsAt = () => new Date(Math.ceil((Date.now() + 3 * 24 * HOUR) / 60000) * 60000);

  function reminderRequest(eventId: number, starts: Date) {
    const iso = starts.toISOString();
    return {
      eventType: 'event.reminder',
      payload: { event_id: eventId, starts_at: iso },
      idempotencyKey: `event-reminder:${eventId}:${iso}`,
      runAt: new Date(starts.getTime() - HOUR),
      expiresAt: starts,
    };
  }

  it('queues one when an admin creates an event', async () => {
    state.user = ADMIN;
    const starts = startsAt();
    const res = await execute(kychonApi, 'events.create', { title: 'Gala', starts_at: starts.toISOString() });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(queued('event-reminders')).toEqual([reminderRequest(res.body.data.result.id, starts)]);
  });

  it('sends the same request for an edit that keeps the time, and a new one when the time moves', async () => {
    state.user = ADMIN;
    const starts = startsAt();
    const created = await execute(kychonApi, 'events.create', { title: 'Gala', starts_at: starts.toISOString() });
    const id = created.body.data.result.id;
    await execute(kychonApi, 'events.update', { id, title: 'Spring Gala' });
    const moved = new Date(starts.getTime() + 2 * HOUR);
    await execute(kychonApi, 'events.update', { id, starts_at: moved.toISOString() });
    // Run402 dedupes the repeated key; the moved event gets its own run.
    expect(queued('event-reminders')).toEqual([
      reminderRequest(id, starts),
      reminderRequest(id, starts),
      reminderRequest(id, moved),
    ]);
  });

  it('queues one when a member RSVPs going or maybe, not when they cancel', async () => {
    const event = await insertEvent(3 * 24 * HOUR);
    state.user = MEMBER;
    await execute(kychonApi, 'rsvps.setStatus', { eventId: event.id, status: 'cancelled' });
    expect(queued('event-reminders')).toEqual([]);
    await execute(kychonApi, 'rsvps.setStatus', { eventId: event.id, status: 'maybe' });
    expect(queued('event-reminders')).toEqual([reminderRequest(event.id, new Date(event.starts_at))]);
  });

  it('queues nothing for an event that has already started', async () => {
    state.user = ADMIN;
    const res = await execute(kychonApi, 'events.create', {
      title: 'Earlier',
      starts_at: new Date(Date.now() - HOUR).toISOString(),
    });
    expect(res.status).toBe(200);
    expect(queued('event-reminders')).toEqual([]);
  });

  it('quietly skips an event beyond the tier delay horizon', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    runsCreate.mockRejectedValueOnce(
      Object.assign(new Error('run_at exceeds the tier delay horizon'), { status: 400 }),
    );
    state.user = ADMIN;
    const res = await execute(kychonApi, 'events.create', {
      title: 'Next year',
      starts_at: new Date(Date.now() + 200 * 24 * HOUR).toISOString(),
    });
    expect(res.status).toBe(200);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('moderate-content moderates one post per run', () => {
  beforeEach(async () => {
    await db.exec(`
      INSERT INTO forum_topics (title, body) VALUES ('Cheap pills', 'Buy now');
      INSERT INTO forum_replies (topic_id, body) VALUES (1, 'Me too');
    `);
  });

  it('hides a flagged topic and logs the decision', async () => {
    const r = await run(moderateContent, { content_type: 'forum_topic', content_id: 1 });
    expect(r.body).toEqual({ status: 'ok', action: 'hidden' });
    expect(aiModerate.mock.calls).toEqual([['Cheap pills\n\nBuy now']]);
    expect(await rows(db, 'SELECT hidden FROM forum_topics')).toEqual([{ hidden: true }]);
    expect(await rows(db, 'SELECT content_type, content_id, action FROM moderation_log')).toEqual([
      { content_type: 'forum_topic', content_id: 1, action: 'hidden' },
    ]);
  });

  it('moderates a reply, and approves what is not flagged', async () => {
    aiModerate.mockResolvedValueOnce({ flagged: false, category_scores: { harassment: 0.02 } });
    const r = await run(moderateContent, { content_type: 'forum_reply', content_id: 1 });
    expect(r.body).toEqual({ status: 'ok', action: 'approved' });
    expect(await rows(db, 'SELECT hidden FROM forum_replies')).toEqual([{ hidden: false }]);
  });

  it('moderates a post once, however often its run repeats', async () => {
    await run(moderateContent, { content_type: 'forum_topic', content_id: 1 });
    const again = await run(moderateContent, { content_type: 'forum_topic', content_id: 1 });
    expect(again.body).toEqual({ status: 'skipped', reason: 'already moderated' });
    expect(aiModerate).toHaveBeenCalledTimes(1);
  });

  it('skips a missing or already hidden post, and does nothing while moderation is off', async () => {
    expect((await run(moderateContent, { content_type: 'forum_topic', content_id: 99 })).body).toEqual({
      status: 'skipped',
      reason: 'post not found',
    });
    await db.exec('UPDATE forum_replies SET hidden = true');
    expect((await run(moderateContent, { content_type: 'forum_reply', content_id: 1 })).body).toEqual({
      status: 'skipped',
      reason: 'post already hidden',
    });
    await db.exec(`UPDATE site_config SET value = 'false' WHERE key = 'feature_ai_moderation'`);
    expect((await run(moderateContent, { content_type: 'forum_topic', content_id: 1 })).body).toMatchObject({
      status: 'skipped',
    });
    expect(aiModerate).not.toHaveBeenCalled();
  });

  it.each([
    ['no post', {}],
    ['an unknown content type', { content_type: '__proto__', content_id: 1 }],
    ['a non-numeric id', { content_type: 'forum_topic', content_id: '1 OR 1=1' }],
  ])('rejects a run that names %s', async (_label, payload) => {
    const r = await run(moderateContent, payload);
    expect(r.status).toBe(400);
    expect(aiModerate).not.toHaveBeenCalled();
  });
});

describe('event-reminders reminds one event per run', () => {
  async function rsvp(eventId: number, count: number) {
    for (let i = 0; i < count; i++) {
      await db.query(
        `WITH m AS (INSERT INTO members (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id)
         INSERT INTO event_rsvps (event_id, member_id, status) SELECT $3, id, 'going' FROM m`,
        [`guest${i}@example.org`, `Guest ${i}`, eventId],
      );
    }
  }

  it('reminds every going RSVP exactly once, claiming them a few at a time', async () => {
    const event = await insertEvent(40 * 60 * 1000);
    await rsvp(event.id, 7);
    const r = await run(eventReminders, { event_id: event.id });
    expect(r.body).toEqual({ status: 'ok', reminders_sent: 7 });
    expect(new Set(emailSend.mock.calls.map(([message]) => message.to)).size).toBe(7);
    expect(await rows(db, 'SELECT count(*)::int AS n FROM event_rsvps WHERE reminder_sent_at IS NULL')).toEqual([
      { n: 0 },
    ]);
  });

  it.each([
    ['an event that starts in three hours', 3 * HOUR, 'not due'],
    ['an event that already started', -10 * 60 * 1000, 'not due'],
  ])('does nothing for %s', async (_label, startsIn, reason) => {
    const event = await insertEvent(startsIn);
    await rsvp(event.id, 1);
    expect((await run(eventReminders, { event_id: event.id })).body).toEqual({ status: 'skipped', reason });
    expect(emailSend).not.toHaveBeenCalled();
  });

  it('does nothing for a deleted event', async () => {
    expect((await run(eventReminders, { event_id: 42 })).body).toEqual({
      status: 'skipped',
      reason: 'event not found',
    });
  });

  it('gives the start time in the event time zone, else the portal default, else UTC', async () => {
    const expected = (starts: Date, timeZone: string) => {
      const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone }).format(starts);
      const zone = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'short' })
        .formatToParts(starts)
        .find((part) => part.type === 'timeZoneName')?.value;
      return `starts at ${time} ${zone}`;
    };
    const chicago = await insertEvent(40 * 60 * 1000, 'America/Chicago');
    const plain = await insertEvent(40 * 60 * 1000);
    await rsvp(chicago.id, 1);
    await db.query(
      `INSERT INTO event_rsvps (event_id, member_id, status) SELECT $1, id, 'going' FROM members WHERE email = 'guest0@example.org'`,
      [plain.id],
    );

    await run(eventReminders, { event_id: chicago.id });
    expect(emailSend.mock.lastCall?.[0].html).toContain(expected(new Date(chicago.starts_at), 'America/Chicago'));

    await run(eventReminders, { event_id: plain.id });
    expect(emailSend.mock.lastCall?.[0].html).toContain(expected(new Date(plain.starts_at), 'UTC'));

    await db.exec(`
      UPDATE event_rsvps SET reminder_sent_at = NULL;
      INSERT INTO site_config (key, value) VALUES ('event_source_timezone', '"Europe/Paris"');
    `);
    await run(eventReminders, { event_id: plain.id });
    expect(emailSend.mock.lastCall?.[0].html).toContain(expected(new Date(plain.starts_at), 'Europe/Paris'));
  });

  it('sends nothing on a portal whose settings say it is a demo', async () => {
    const event = await insertEvent(40 * 60 * 1000);
    await rsvp(event.id, 2);
    await db.exec(`INSERT INTO site_config (key, value) VALUES ('demo_mode', 'true')`);
    expect((await run(eventReminders, { event_id: event.id })).body).toEqual({
      status: 'skipped',
      reason: 'demo portal',
    });
    expect(emailSend).not.toHaveBeenCalled();
  });
});

describe('demo portals never send event reminders', () => {
  const tmp = join(ROOT, 'tmp', 'background-runs-test');
  let demo: Awaited<ReturnType<typeof collectFunctionsMap>>;

  beforeAll(async () => {
    demo = await collectFunctionsMap(join(ROOT, 'functions'), { demo: true });
    mkdirSync(tmp, { recursive: true });
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  // Imports a function as the demo deploy builds it.
  async function demoBuild(name: string) {
    const file = join(tmp, `${name}.js`);
    writeFileSync(file, String(demo[name].source));
    return (await import(file)).default;
  }

  it('marks the demo build at deploy time, where no admin can change it', async () => {
    const portal = await collectFunctionsMap(join(ROOT, 'functions'));
    for (const name of ['kychon-api', 'event-reminders']) {
      expect(String(demo[name].source)).toContain("const DEMO_PORTAL = 'true';");
      expect(String(portal[name].source)).toContain("const DEMO_PORTAL = 'false';");
    }
    for (const spec of [...Object.values(demo), ...Object.values(portal)]) {
      expect(String(spec.source)).not.toContain('__KYCHON_DEMO_PORTAL__');
    }
  });

  it('kychon-api still queues moderation on a demo, but no reminders', async () => {
    const demoApi = await demoBuild('kychon-api');
    state.user = ADMIN;
    const res = await execute(demoApi, 'events.create', {
      title: 'Gala',
      starts_at: new Date(Date.now() + 3 * 24 * HOUR).toISOString(),
    });
    expect(res.status).toBe(200);
    state.user = MEMBER;
    await execute(demoApi, 'rsvps.setStatus', { eventId: res.body.data.result.id, status: 'going' });
    await execute(demoApi, 'forum.topics.create', { title: 'Hello', body: 'World' });
    expect(queued('event-reminders')).toEqual([]);
    expect(queued('moderate-content')).toHaveLength(1);
  });

  it('event-reminders refuses to email even a due event', async () => {
    const demoReminders = await demoBuild('event-reminders');
    const event = await insertEvent(40 * 60 * 1000);
    await db.query(`INSERT INTO event_rsvps (event_id, member_id, status) VALUES ($1, 2, 'going')`, [event.id]);
    expect((await run(demoReminders, { event_id: event.id })).body).toEqual({
      status: 'skipped',
      reason: 'demo portal',
    });
    expect(emailSend).not.toHaveBeenCalled();
    expect(await rows(db, 'SELECT reminder_sent_at FROM event_rsvps')).toEqual([{ reminder_sent_at: null }]);
  });
});
