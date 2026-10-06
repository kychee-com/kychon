// Regression coverage for translations.translateText on the Capability API
// gateway (functions/kychon-api.js). It spends the project's metered Run402
// translation quota, and it replaces the translate-text function, which could
// not tell who was calling: the forum called it cross-origin with only the anon
// key. The gateway resolves the actor from the session, so:
//
//   1. Anonymous callers, signed-in non-members and pending members are refused.
//   2. An active member translates only a stored forum post they can see (the
//      stored text, never caller text) into an enabled language.
//   3. Admins may also translate ad hoc text (block editor fields), up to 5000
//      characters.
//   4. Each post is translated once per language, then served to every reader
//      from content_translations.
//   5. Translations not served from the cache are rate limited per actor.
//   6. The execution ledger keeps no copy of a cached post's translation.
//
// The database is the real schema.sql in PGlite, so the rate-limit count, the
// cache key and the content-history triggers run as SQL.

import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';
import { pgliteAdminDb } from '../helpers/pglite-admin-db';
import { freshKychonDb, rows } from '../helpers/pglite-db';

type MockUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };

const state = vi.hoisted(() => ({
  db: null as null | ReturnType<typeof import('../helpers/pglite-admin-db').pgliteAdminDb>,
  user: null as null | MockUser,
}));

const translateMock = vi.hoisted(() =>
  vi.fn(async (text: string, lang: string, _options?: { context?: string }) => ({
    text: `[${lang}] ${text.slice(0, 20)}`,
    from: 'en',
    to: lang,
  })),
);

vi.mock(
  '@run402/functions',
  () => ({
    adminDb: () => state.db,
    ai: { translate: translateMock },
    auth: { user: async () => state.user },
    events: { emit: async () => ({ deduplicated: false }) },
  }),
  { virtual: true },
);

const { default: kychonApi } = await import('../../functions/kychon-api.js');

// members.id follows fixture order: ADMIN 1, MEMBER 2, OTHER_MEMBER 3, MODERATOR 4, PENDING 5.
const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };
const MEMBER = { id: '22222222-2222-4222-8222-222222222222', email: 'member@example.org' };
const OTHER_MEMBER = { id: '33333333-3333-4333-8333-333333333333', email: 'other@example.org' };
const MODERATOR = { id: '44444444-4444-4444-8444-444444444444', email: 'mod@example.org' };
const PENDING = { id: '55555555-5555-4555-8555-555555555555', email: 'pending@example.org' };
const NON_MEMBER = { id: '66666666-6666-4666-8666-666666666666', email: 'drive-by@example.org' };
const PROJECT_ADMIN = {
  id: '77777777-7777-4777-8777-777777777777',
  email: 'owner@example.org',
  app_metadata: { role: 'project_admin' },
};
const MEMBER_REF = { type: 'member', id: '2' };
const ADMIN_REF = { type: 'member', id: '1' };

// forum_topics: 1 visible, 2 hidden. forum_replies: 1 visible, 2 hidden,
// 3 visible but under hidden topic 2, 4 visible and long.
const TOPIC_BODY = 'Members-only plans for the spring fundraiser.\nBring a dish!';
const LONG_REPLY = 'x'.repeat(6000);
const topicBody = { content_type: 'forum_topic', content_id: 1, field: 'body', target_lang: 'es' };
const fakeTranslation = (lang: string, text: string) => `[${lang}] ${text.slice(0, 20)}`;

let db: PGlite;
let seedBatch = 0;
let requestKey = 0;

beforeAll(async () => {
  db = await freshKychonDb();
  state.db = pgliteAdminDb(db);
});

beforeEach(async () => {
  state.user = null;
  translateMock.mockClear();
  await db.exec(`
    TRUNCATE members, site_config, forum_topics, forum_replies, content_translations, capability_executions,
      activity_log, revisions, changesets RESTART IDENTITY CASCADE;
    INSERT INTO members (user_id, email, display_name, role, status) VALUES
      ('${ADMIN.id}', '${ADMIN.email}', 'Ada', 'admin', 'active'),
      ('${MEMBER.id}', '${MEMBER.email}', 'Grace', 'member', 'active'),
      ('${OTHER_MEMBER.id}', '${OTHER_MEMBER.email}', 'Linus', 'member', 'active'),
      ('${MODERATOR.id}', '${MODERATOR.email}', 'Mo', 'moderator', 'active'),
      ('${PENDING.id}', '${PENDING.email}', 'Pat', 'member', 'pending');
    INSERT INTO site_config (key, value, category) VALUES
      ('feature_ai_translation', 'true', 'features'),
      ('languages_enabled', '["en", "es", "fr"]', 'i18n'),
      ('default_language', '"en"', 'i18n');
  `);
  await db.query('INSERT INTO forum_topics (title, body, hidden) VALUES ($1, $2, false), ($3, $4, true)', [
    'Spring fundraiser',
    TOPIC_BODY,
    'Moderated topic',
    'A hidden topic body',
  ]);
  await db.query(
    'INSERT INTO forum_replies (topic_id, body, hidden) VALUES (1, $1, false), (1, $2, true), (2, $3, false), (1, $4, false)',
    ['Count me in for the bake sale.', 'A hidden reply', 'A reply under a hidden topic', LONG_REPLY],
  );
  // Ignore history from fixture setup.
  await db.exec('TRUNCATE revisions, changesets');
});

async function call(phase: 'execute' | 'validate', input: Record<string, unknown>, idempotencyKey?: string) {
  const res = await kychonApi(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KYCHON_API_VERSION,
        operation: 'translations.translateText',
        phase,
        input,
        ...(phase === 'execute'
          ? { confirmed: true, idempotencyKey: idempotencyKey ?? `translate-${++requestKey}` }
          : {}),
      }),
    }),
  );
  // biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary capability payloads
  return { status: res.status, headers: res.headers, body: (await res.json()) as Record<string, any> };
}

function translate(input: Record<string, unknown>, idempotencyKey?: string) {
  return call('execute', input, idempotencyKey);
}

function cacheRows() {
  return rows(
    db,
    'SELECT content_type, content_id, language, field, translated_text FROM content_translations ORDER BY id',
  );
}

function ledgerCount() {
  return rows(db, 'SELECT id FROM capability_executions').then((list) => list.length);
}

// Earlier translateText executions for an actor, as the gateway records them.
async function seedExecutions(
  actorRef: { type: string; id: string },
  count: number,
  { status = 'succeeded', cached = false, errorCode = null as string | null, minutesAgo = 10 } = {},
) {
  seedBatch += 1;
  await db.query(
    `INSERT INTO capability_executions
       (api_version, operation, idempotency_key, actor_ref, actor_state, input_digest, status,
        result_payload, error_payload, correlation_id, created_at, updated_at)
     SELECT $1, 'translations.translateText', 'seed-' || $2::text || '-' || g, $3::jsonb, 'active_member',
            'digest', $4, $5::jsonb, $6::jsonb, 'seed', now() - make_interval(mins => $7::int),
            now() - make_interval(mins => $7::int)
       FROM generate_series(1, $8::int) AS g`,
    [
      KYCHON_API_VERSION,
      String(seedBatch),
      JSON.stringify(actorRef),
      status,
      status === 'succeeded' ? JSON.stringify({ result: { cached }, changed: [] }) : null,
      errorCode ? JSON.stringify({ code: errorCode }) : null,
      minutesAgo,
      count,
    ],
  );
}

describe('translateText: who may translate', () => {
  it('refuses an anonymous caller without spending quota or writing the ledger', async () => {
    const r = await translate(topicBody);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('permission.denied');
    expect(translateMock).not.toHaveBeenCalled();
    expect(await ledgerCount()).toBe(0);
  });

  it.each([
    ['a signed-in user with no member record', NON_MEMBER],
    ['a pending member', PENDING],
  ])('refuses %s', async (_label, user) => {
    state.user = user;
    const r = await translate(topicBody);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('permission.denied');
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('gates the validate phase the same way', async () => {
    const r = await call('validate', topicBody);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('permission.denied');
  });

  it('lets an active member translate a forum post they can see, and caches it', async () => {
    state.user = MEMBER;
    const r = await translate(topicBody);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.result).toEqual({
      translated: fakeTranslation('es', TOPIC_BODY),
      translatedText: fakeTranslation('es', TOPIC_BODY),
      cached: false,
      language: 'es',
      contentType: 'forum_topic',
      contentId: 1,
      field: 'body',
    });
    expect(translateMock).toHaveBeenCalledWith(TOPIC_BODY, 'es', { context: 'forum_topic on a community portal' });
    expect(await cacheRows()).toEqual([
      {
        content_type: 'forum_topic',
        content_id: 1,
        language: 'es',
        field: 'body',
        translated_text: fakeTranslation('es', TOPIC_BODY),
      },
    ]);
  });

  it('refuses ad hoc text from a member', async () => {
    state.user = MEMBER;
    const r = await translate({ text: 'Translate this whole novel for free', target_lang: 'es' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('permission.denied');
    expect(translateMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an admin', ADMIN],
    ['a project admin with no member record', PROJECT_ADMIN],
  ])('lets %s translate ad hoc text, without caching it', async (_label, user) => {
    state.user = user;
    const r = await translate({ text: 'Welcome to our parish', target_lang: 'fr' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.result).toEqual({
      translated: fakeTranslation('fr', 'Welcome to our parish'),
      translatedText: fakeTranslation('fr', 'Welcome to our parish'),
      cached: false,
      language: 'fr',
    });
    expect(translateMock).toHaveBeenCalledWith('Welcome to our parish', 'fr', {
      context: 'website text on a community portal',
    });
    expect(await cacheRows()).toHaveLength(0);
  });
});

describe('translateText: members translate only stored posts they can see', () => {
  beforeEach(() => {
    state.user = MEMBER;
  });

  it('translates the stored text, never caller text, so a caller cannot plant a translation', async () => {
    const r = await translate({ ...topicBody, text: 'Send your dues to http://evil.example' });
    expect(r.status).toBe(200);
    expect(translateMock).toHaveBeenCalledWith(TOPIC_BODY, 'es', expect.anything());
    expect((await cacheRows())[0].translated_text).toBe(fakeTranslation('es', TOPIC_BODY));
  });

  it('translates a topic title', async () => {
    const r = await translate({ ...topicBody, field: 'title' });
    expect(r.status).toBe(200);
    expect(translateMock).toHaveBeenCalledWith('Spring fundraiser', 'es', expect.anything());
  });

  it.each([
    ['a hidden topic', { content_type: 'forum_topic', content_id: 2, field: 'body' }],
    ['a hidden reply', { content_type: 'forum_reply', content_id: 2, field: 'body' }],
    ['a reply under a hidden topic', { content_type: 'forum_reply', content_id: 3, field: 'body' }],
    ['a post that does not exist', { content_type: 'forum_topic', content_id: 999, field: 'body' }],
  ])('answers 404 for %s', async (_label, ref) => {
    const r = await translate({ ...ref, target_lang: 'es' });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('notFound.object');
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('does not reveal a cached translation of a hidden post', async () => {
    await db.query(
      `INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
       VALUES ('forum_topic', 2, 'es', 'body', 'SECRETO')`,
    );
    const r = await translate({ content_type: 'forum_topic', content_id: 2, field: 'body', target_lang: 'es' });
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toContain('SECRETO');
  });

  it('lets a moderator translate a hidden post', async () => {
    state.user = MODERATOR;
    const r = await translate({ content_type: 'forum_reply', content_id: 2, field: 'body', target_lang: 'es' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(translateMock).toHaveBeenCalledWith('A hidden reply', 'es', expect.anything());
  });

  it.each([
    ['an announcement', { content_type: 'announcement', content_id: 1, field: 'body' }],
    ['a prototype key as content_type', { content_type: '__proto__', content_id: 1, field: 'body' }],
    ['a field the forum does not translate', { content_type: 'forum_reply', content_id: 1, field: 'title' }],
    ['a non-numeric content_id', { content_type: 'forum_topic', content_id: '1 OR 1=1', field: 'body' }],
    ['a zero content_id', { content_type: 'forum_topic', content_id: 0, field: 'body' }],
    ['a boolean content_id', { content_type: 'forum_topic', content_id: true, field: 'body' }],
    ['an out-of-range content_id', { content_type: 'forum_topic', content_id: 2 ** 31, field: 'body' }],
    ['a field without a content_type', { field: 'body', text: 'Hello there' }],
  ])('refuses %s', async (_label, ref) => {
    const r = await translate({ ...ref, target_lang: 'es' });
    expect(r.status, JSON.stringify(r.body)).toBe(400);
    expect(r.body.error.code).toBe('validation.failed');
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('translates only the first 5000 characters of a long post', async () => {
    const r = await translate({ content_type: 'forum_reply', content_id: 4, field: 'body', target_lang: 'fr' });
    expect(r.status).toBe(200);
    expect(translateMock.mock.calls[0][0]).toHaveLength(5000);
  });

  it('refuses a language the portal has not enabled (no cache-busting variants)', async () => {
    for (const target_lang of ['de', 'es-x-1', 'es ', '']) {
      const r = await translate({ ...topicBody, target_lang });
      expect(r.status, target_lang).toBe(400);
      expect(r.body.error.code).toBe('validation.failed');
    }
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('matches the language case-insensitively and caches under the enabled spelling', async () => {
    const r = await translate({ ...topicBody, target_lang: 'ES' });
    expect(r.status).toBe(200);
    expect(translateMock).toHaveBeenCalledWith(TOPIC_BODY, 'es', expect.anything());
    expect((await cacheRows())[0].language).toBe('es');
  });

  it('reads the legacy `languages` key and JSON-encoded config values', async () => {
    await db.exec('DELETE FROM site_config');
    await db.query(
      "INSERT INTO site_config (key, value) VALUES ('feature_ai_translation', to_jsonb($1::text)), ('languages', to_jsonb($2::text))",
      ['true', '["en","es"]'],
    );
    expect((await translate(topicBody)).status).toBe(200);
    expect((await translate({ ...topicBody, target_lang: 'fr' })).status).toBe(400);
  });

  it('refuses while feature_ai_translation is off', async () => {
    await db.exec("UPDATE site_config SET value = 'false' WHERE key = 'feature_ai_translation'");
    const r = await translate(topicBody);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('conflict.state');
    expect(translateMock).not.toHaveBeenCalled();
  });
});

describe('translateText: admin ad hoc text', () => {
  beforeEach(() => {
    state.user = ADMIN;
  });

  it.each([
    ['text over 5000 characters', { text: 'y'.repeat(5001) }],
    ['empty text', { text: '   ' }],
    ['no text and no forum post', {}],
  ])('refuses %s', async (_label, input) => {
    const r = await translate({ ...input, target_lang: 'fr' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation.failed');
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('still needs an enabled language and the feature flag', async () => {
    expect((await translate({ text: 'Welcome', target_lang: 'de' })).status).toBe(400);
    await db.exec("UPDATE site_config SET value = 'false' WHERE key = 'feature_ai_translation'");
    expect((await translate({ text: 'Welcome', target_lang: 'fr' })).status).toBe(409);
    expect(translateMock).not.toHaveBeenCalled();
  });
});

describe('translateText: content_translations cache', () => {
  it('translates a post once per language and serves every reader from the cache', async () => {
    state.user = MEMBER;
    const first = await translate(topicBody);
    state.user = OTHER_MEMBER;
    const second = await translate(topicBody);
    expect(second.status).toBe(200);
    expect(second.body.data.result).toMatchObject({ cached: true, translated: first.body.data.result.translated });
    expect(second.body.data.changed).toEqual([]);
    expect(translateMock).toHaveBeenCalledTimes(1);

    await translate({ ...topicBody, target_lang: 'fr' });
    expect(translateMock).toHaveBeenCalledTimes(2);
    expect(await cacheRows()).toHaveLength(2);
  });

  it('records the cache write in content history, attributed to the member', async () => {
    state.user = MEMBER;
    const r = await translate(topicBody);
    expect(r.body.data.changed).toEqual([{ type: 'translation', id: '1' }]);
    expect(r.body.data.history.changesetIds).toHaveLength(1);
    const sets = await rows(
      db,
      `SELECT c.actor_type, c.actor_id, c.label FROM changesets c JOIN revisions r ON r.changeset_id = c.id
        WHERE r.table_name = 'content_translations'`,
    );
    expect(sets).toEqual([{ actor_type: 'jwt', actor_id: MEMBER.id, label: 'translations.translateText' }]);
  });

  it('returns the fresh translation when another request cached the post first', async () => {
    state.user = MEMBER;
    translateMock.mockImplementationOnce(async (text: string, lang: string) => {
      // A concurrent request stores its translation while this one translates.
      await db.query(
        `INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
         VALUES ('forum_topic', 1, 'es', 'body', 'stored first')`,
      );
      return { text: fakeTranslation(lang, text), from: 'en', to: lang };
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const r = await translate(topicBody);
      expect(r.status).toBe(200);
      expect(r.body.data.result).toMatchObject({ cached: false, translated: fakeTranslation('es', TOPIC_BODY) });
      expect(r.body.data.changed).toEqual([]);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
    expect((await cacheRows()).map((row) => row.translated_text)).toEqual(['stored first']);
  });
});

describe('translateText: execution ledger and replays', () => {
  it('keeps no copy of a post translation, and a replay serves it from the cache', async () => {
    state.user = MEMBER;
    const first = await translate(topicBody, 'replay-post');
    const [ledger] = await rows<{ result_payload: Record<string, unknown> }>(
      db,
      "SELECT result_payload FROM capability_executions WHERE idempotency_key = 'replay-post'",
    );
    expect(ledger.result_payload.result).toEqual({
      cached: false,
      language: 'es',
      contentType: 'forum_topic',
      contentId: 1,
      field: 'body',
    });
    expect(JSON.stringify(ledger.result_payload)).not.toContain(first.body.data.result.translated);

    const replay = await translate(topicBody, 'replay-post');
    expect(replay.status).toBe(200);
    expect(replay.body.data.result).toMatchObject({ cached: true, translated: first.body.data.result.translated });
    expect(translateMock).toHaveBeenCalledTimes(1);
    expect(await ledgerCount()).toBe(1);
  });

  it('checks access again on a replay', async () => {
    state.user = MEMBER;
    await translate(topicBody, 'replay-hidden');
    await db.exec('UPDATE forum_topics SET hidden = true WHERE id = 1');
    const replay = await translate(topicBody, 'replay-hidden');
    expect(replay.status).toBe(404);
    expect(replay.body.error.code).toBe('notFound.object');
  });

  it('keeps an ad hoc translation, which is stored nowhere else, for replay', async () => {
    state.user = ADMIN;
    const input = { text: 'Welcome to our parish', target_lang: 'fr' };
    const first = await translate(input, 'replay-text');
    const replay = await translate(input, 'replay-text');
    expect(replay.body.data).toEqual(first.body.data);
    expect(translateMock).toHaveBeenCalledTimes(1);
  });
});

describe('translateText: per-actor rate limit', () => {
  it("refuses a member's 31st translation within the hour with a retryable 429", async () => {
    state.user = MEMBER;
    await seedExecutions(MEMBER_REF, 30);
    const r = await translate(topicBody);
    expect(r.status).toBe(429);
    expect(r.body.error).toMatchObject({
      code: 'rateLimit.exceeded',
      retryable: true,
      detail: { limit: 30, windowSeconds: 3600 },
    });
    expect(r.body.error.message).toContain('Try again in 50 minutes');
    // The oldest counted translation (10 minutes ago) leaves the window in 50 minutes.
    expect(r.body.error.detail.retryAfterSeconds).toBeGreaterThan(49 * 60);
    expect(r.body.error.detail.retryAfterSeconds).toBeLessThanOrEqual(50 * 60);
    expect(r.headers.get('Retry-After')).toBe(String(r.body.error.detail.retryAfterSeconds));
    expect(translateMock).not.toHaveBeenCalled();
    expect(await cacheRows()).toHaveLength(0);
  });

  it("counts the member's own translations made through the API", async () => {
    state.user = MEMBER;
    await seedExecutions(MEMBER_REF, 29);
    expect((await translate(topicBody)).status).toBe(200);
    expect((await translate({ ...topicBody, target_lang: 'fr' })).status).toBe(429);
    expect(translateMock).toHaveBeenCalledTimes(1);
  });

  it('records a refused request so it does not count against the member', async () => {
    state.user = MEMBER;
    await seedExecutions(MEMBER_REF, 30);
    await translate(topicBody, 'limited');
    const [row] = await rows(
      db,
      "SELECT status, error_payload->>'code' AS code FROM capability_executions WHERE idempotency_key = 'limited'",
    );
    expect(row).toEqual({ status: 'failed', code: 'rateLimit.exceeded' });
  });

  it('still serves cached translations to a limited member', async () => {
    state.user = OTHER_MEMBER;
    await translate(topicBody);
    state.user = MEMBER;
    await seedExecutions(MEMBER_REF, 30);
    const r = await translate(topicBody);
    expect(r.status).toBe(200);
    expect(r.body.data.result.cached).toBe(true);
  });

  it.each([
    ['cache hits', { cached: true }],
    ['translations older than the window', { minutesAgo: 61 }],
    ['requests refused by the rate limit', { status: 'failed', errorCode: 'rateLimit.exceeded' }],
    ['requests refused before translating', { status: 'failed', errorCode: 'validation.failed' }],
  ])('does not count %s', async (_label, seed) => {
    state.user = MEMBER;
    await seedExecutions(MEMBER_REF, 30, seed);
    expect((await translate(topicBody)).status).toBe(200);
  });

  it.each([
    ['translations in flight', { status: 'started' }],
    ['translations that failed while translating', { status: 'failed', errorCode: 'internal.error' }],
  ])('counts %s', async (_label, seed) => {
    state.user = MEMBER;
    await seedExecutions(MEMBER_REF, 30, seed);
    expect((await translate(topicBody)).status).toBe(429);
  });

  it('limits each actor separately', async () => {
    await seedExecutions(MEMBER_REF, 30);
    state.user = OTHER_MEMBER;
    expect((await translate(topicBody)).status).toBe(200);
  });

  it('gives admins a higher limit', async () => {
    state.user = ADMIN;
    await seedExecutions(ADMIN_REF, 30);
    expect((await translate({ text: 'Welcome', target_lang: 'fr' })).status).toBe(200);
    await seedExecutions(ADMIN_REF, 169);
    const r = await translate({ text: 'Welcome back', target_lang: 'fr' });
    expect(r.status).toBe(429);
    expect(r.body.error.detail.limit).toBe(200);
  });
});

describe('translateText: validate phase and catalog', () => {
  it('reports what execute would refuse, without translating or writing', async () => {
    state.user = MEMBER;
    const hidden = await call('validate', {
      content_type: 'forum_topic',
      content_id: 2,
      field: 'body',
      target_lang: 'es',
    });
    expect(hidden.status).toBe(200);
    expect(hidden.body.data.accepted).toBe(false);
    expect(hidden.body.data.warnings[0].code).toBe('notFound.object');

    const ok = await call('validate', topicBody);
    expect(ok.body.data).toMatchObject({ accepted: true, cost: { class: 'metered' } });
    expect(translateMock).not.toHaveBeenCalled();
    expect(await cacheRows()).toHaveLength(0);
    expect(await ledgerCount()).toBe(0);
  });

  it('lists translateText for active members as a metered operation', async () => {
    const res = await kychonApi(
      new Request('https://portal.test/functions/v1/kychon-api', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apiVersion: KYCHON_API_VERSION,
          operation: 'portal.capabilities',
          phase: 'query',
          input: {},
        }),
      }),
    );
    const body = await res.json();
    const operation = body.data.operations.find(
      (entry: { name: string }) => entry.name === 'translations.translateText',
    );
    expect(operation).toMatchObject({
      auth: { minimumActorState: 'active_member', allowAnonymous: false },
      costClass: 'metered',
    });
  });
});
