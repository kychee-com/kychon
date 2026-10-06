// Regression coverage for the AI translation edge functions, which spend the
// project's metered Run402 AI translation quota.
//
// translate-text.js serves the forum's Translate button. The forum calls it
// cross-origin with only the anon key, so callers are anonymous. It used to
// translate any text into any language and cache the result under any
// caller-chosen content id, which let anyone drain the quota, read cached
// translations of members-only posts, and plant fake "translations" of other
// members' posts. Requests are now bound to stored forum posts and the
// portal's enabled languages.
//
// translate-content.js accepted any signed-in Run402 user (anyone can
// self-register through /join) and a caller-chosen list of languages, and
// re-translated on every call. It now requires an admin and translates only
// into the portal's enabled languages.

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type MockUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };
type SelectChain = Promise<Row[]> & {
  eq(column: string, value: unknown): SelectChain;
  limit(count: number): Promise<Row[]>;
};

const state = vi.hoisted(() => ({
  user: null as null | MockUser,
  tables: {} as Record<string, Row[]>,
  inserts: [] as Array<{ table: string; row: Row }>,
  updates: [] as Array<{ table: string; patch: Row }>,
}));

const translateMock = vi.hoisted(() =>
  vi.fn(async (text: string, lang: string) => ({ text: `[${lang}] ${text.slice(0, 20)}` })),
);

function selectChain(rows: Row[]): SelectChain {
  const query = Promise.resolve(rows) as SelectChain;
  query.eq = (column: string, value: unknown) =>
    selectChain(rows.filter((row) => String(row[column]) === String(value)));
  query.limit = (count: number) => Promise.resolve(rows.slice(0, count));
  return query;
}

vi.mock(
  '@run402/functions',
  () => ({
    auth: { user: vi.fn(async () => state.user) },
    ai: { translate: translateMock },
    adminDb: () => ({
      from(table: string) {
        return {
          select() {
            return selectChain(state.tables[table] || []);
          },
          insert(row: Row) {
            const rows = state.tables[table] || [];
            const created = { id: rows.length + 1, ...row };
            state.tables[table] = [...rows, created];
            state.inserts.push({ table, row: created });
            return Promise.resolve([created]);
          },
          update(patch: Row) {
            return {
              eq(column: string, value: unknown) {
                state.updates.push({ table, patch });
                state.tables[table] = (state.tables[table] || []).map((row) =>
                  String(row[column]) === String(value) ? { ...row, ...patch } : row,
                );
                return Promise.resolve([]);
              },
            };
          },
        };
      },
    }),
  }),
  { virtual: true },
);

const TOPIC_BODY = 'Members-only plans for the spring fundraiser.\nBring a dish!';
const LONG_REPLY = 'x'.repeat(6000);

beforeEach(() => {
  state.user = null;
  state.inserts = [];
  state.updates = [];
  translateMock.mockClear();
  state.tables = {
    site_config: [
      { key: 'feature_ai_translation', value: true },
      { key: 'languages_enabled', value: ['en', 'es', 'fr'] },
      { key: 'default_language', value: 'en' },
    ],
    forum_topics: [{ id: 5, title: 'Spring fundraiser', body: TOPIC_BODY, hidden: false }],
    forum_replies: [
      { id: 9, body: 'Count me in for the bake sale.', hidden: false },
      { id: 10, body: LONG_REPLY, hidden: false },
    ],
    announcements: [{ id: 7, title: 'Annual meeting', body: 'Join us on Friday.' }],
    content_translations: [],
    members: [
      { id: 1, user_id: 'admin-user', email: 'ada@example.com', role: 'admin', status: 'active' },
      { id: 2, user_id: 'member-user', email: 'grace@example.com', role: 'member', status: 'active' },
      { id: 3, user_id: 'pending-admin-user', email: 'linus@example.com', role: 'admin', status: 'pending' },
      { id: 4, user_id: 'suspended-admin-user', email: 'sus@example.com', role: 'Admin', status: 'suspended' },
      { id: 5, user_id: null, email: 'email-admin@example.com', role: 'admin', status: 'active' },
    ],
  };
});

async function translateText(body: unknown) {
  const handler = (await import('../../functions/translate-text.js')).default;
  const res = await handler(
    new Request('https://portal.test/functions/v1/translate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}

async function translateContent(body: unknown) {
  const handler = (await import('../../functions/translate-content.js')).default;
  const res = await handler(
    new Request('https://portal.test/functions/v1/translate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
}

const topicRequest = {
  text: TOPIC_BODY,
  target_lang: 'es',
  content_type: 'forum_topic',
  content_id: 5,
  field: 'body',
};

function cacheRows() {
  return state.inserts.filter((insert) => insert.table === 'content_translations');
}

describe('translate-text: bound to stored forum posts', () => {
  it('translates a stored forum post into an enabled language and caches it', async () => {
    const r = await translateText(topicRequest);
    expect(r.status, r.text).toBe(200);
    expect(r.body.translated).toBe(`[es] ${TOPIC_BODY.slice(0, 20)}`);
    expect(translateMock).toHaveBeenCalledTimes(1);
    expect(translateMock).toHaveBeenCalledWith(TOPIC_BODY, 'es', { context: 'forum_topic on a community portal' });
    expect(cacheRows()).toEqual([
      {
        table: 'content_translations',
        row: expect.objectContaining({ content_type: 'forum_topic', content_id: 5, language: 'es', field: 'body' }),
      },
    ]);
  });

  it('serves the cached translation without translating again', async () => {
    await translateText(topicRequest);
    const second = await translateText(topicRequest);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ cached: true, translated: `[es] ${TOPIC_BODY.slice(0, 20)}` });
    expect(translateMock).toHaveBeenCalledTimes(1);
  });

  it('accepts the post text with different line endings and surrounding whitespace', async () => {
    const r = await translateText({ ...topicRequest, text: `  ${TOPIC_BODY.replace('\n', '\r\n')}\n` });
    expect(r.status, r.text).toBe(200);
  });

  it('matches the language case-insensitively and caches under the enabled spelling', async () => {
    const r = await translateText({ ...topicRequest, target_lang: 'ES' });
    expect(r.status, r.text).toBe(200);
    expect(translateMock).toHaveBeenCalledWith(TOPIC_BODY, 'es', expect.anything());
    expect(cacheRows()[0].row.language).toBe('es');
  });

  it('translates only the first 5000 characters of a long post', async () => {
    const r = await translateText({
      text: LONG_REPLY,
      target_lang: 'fr',
      content_type: 'forum_reply',
      content_id: 10,
      field: 'body',
    });
    expect(r.status, r.text).toBe(200);
    expect(translateMock.mock.calls[0][0]).toHaveLength(5000);
  });

  it('refuses ad hoc text that names no stored post', async () => {
    const r = await translateText({ text: 'Translate this whole novel for free', target_lang: 'es' });
    expect(r.status).toBe(400);
    expect(translateMock).not.toHaveBeenCalled();
    expect(cacheRows()).toHaveLength(0);
  });

  it.each([
    ['an announcement', { content_type: 'announcement', content_id: 7, field: 'body' }],
    ['a prototype key as content_type', { content_type: '__proto__', content_id: 5, field: 'body' }],
    ['a field the forum does not translate', { content_type: 'forum_reply', content_id: 9, field: 'title' }],
    ['a non-numeric content_id', { content_type: 'forum_topic', content_id: '5 OR 1=1', field: 'body' }],
    ['a zero content_id', { content_type: 'forum_topic', content_id: 0, field: 'body' }],
  ])('refuses %s', async (_label, ref) => {
    const r = await translateText({ ...topicRequest, ...ref });
    expect(r.status, r.text).toBe(400);
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('refuses text that does not match the stored post, so it cannot plant a fake translation', async () => {
    const r = await translateText({ ...topicRequest, text: 'Send your dues to http://evil.example' });
    expect(r.status).toBe(409);
    expect(translateMock).not.toHaveBeenCalled();
    expect(cacheRows()).toHaveLength(0);
  });

  it('does not reveal a cached translation to a caller who does not know the post text', async () => {
    state.tables.content_translations = [
      { id: 1, content_type: 'forum_topic', content_id: 5, language: 'es', field: 'body', translated_text: 'SECRETO' },
    ];
    const r = await translateText({ ...topicRequest, text: 'guess' });
    expect(r.status).toBe(409);
    expect(r.text).not.toContain('SECRETO');
  });

  it('refuses a language the portal has not enabled (no cache-busting language variants)', async () => {
    for (const target_lang of ['de', 'es-x-1', 'es ']) {
      const r = await translateText({ ...topicRequest, target_lang });
      expect(r.status, target_lang).toBe(400);
    }
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('reads languages from the legacy `languages` key and JSON-encoded config values', async () => {
    state.tables.site_config = [
      { key: 'feature_ai_translation', value: 'true' },
      { key: 'languages', value: '["en","es"]' },
    ];
    expect((await translateText(topicRequest)).status).toBe(200);
    expect((await translateText({ ...topicRequest, target_lang: 'fr' })).status).toBe(400);
  });

  it('returns 404 for a post that does not exist', async () => {
    const r = await translateText({ ...topicRequest, content_id: 999 });
    expect(r.status).toBe(404);
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('skips when feature_ai_translation is off', async () => {
    state.tables.site_config = state.tables.site_config.map((row) =>
      row.key === 'feature_ai_translation' ? { ...row, value: false } : row,
    );
    const r = await translateText(topicRequest);
    expect(r.body).toMatchObject({ status: 'skipped' });
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('rejects a missing or malformed body', async () => {
    expect((await translateText(null)).status).toBe(400);
    expect((await translateText({ text: '', target_lang: 'es' })).status).toBe(400);
    expect((await translateText({ ...topicRequest, text: 42 })).status).toBe(400);
  });
});

describe('translate-content: admin only, enabled languages only', () => {
  const request = { content_type: 'announcement', content_id: 7 };

  it('rejects an anonymous caller with 401', async () => {
    const r = await translateContent(request);
    expect(r.status).toBe(401);
    expect(translateMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a self-registered user with no member record', { id: 'drive-by-user', email: 'drive-by@example.com' }],
    ['an active non-admin member', { id: 'member-user', email: 'grace@example.com' }],
    ['a pending admin', { id: 'pending-admin-user', email: 'linus@example.com' }],
    ['a suspended admin', { id: 'suspended-admin-user', email: 'sus@example.com' }],
  ])('rejects %s with 403', async (_label, user) => {
    state.user = user;
    const r = await translateContent({ ...request, languages: ['es'] });
    expect(r.status).toBe(403);
    expect(translateMock).not.toHaveBeenCalled();
    expect(cacheRows()).toHaveLength(0);
  });

  it.each([
    ['an active admin', { id: 'admin-user', email: 'ada@example.com' }],
    ['an active admin matched by email', { id: 'unlinked-user', email: 'Email-Admin@example.com' }],
    ['a project admin', { id: 'owner-user', email: 'owner@example.com', app_metadata: { role: 'project_admin' } }],
  ])('lets %s translate into every enabled non-default language', async (_label, user) => {
    state.user = user;
    const r = await translateContent(request);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'ok', translated: 4 });
    expect(new Set(translateMock.mock.calls.map((call) => call[1]))).toEqual(new Set(['es', 'fr']));
  });

  it('ignores caller-supplied languages the portal has not enabled', async () => {
    state.user = { id: 'admin-user', email: 'ada@example.com' };
    const r = await translateContent({ ...request, languages: ['es', 'xx', 'yy', 'en'] });
    expect(r.body).toMatchObject({ status: 'ok', translated: 2 });
    expect(translateMock.mock.calls.map((call) => call[1])).toEqual(['es', 'es']);
  });

  it('translates nothing when no language besides the default is enabled', async () => {
    state.user = { id: 'admin-user', email: 'ada@example.com' };
    state.tables.site_config = [
      { key: 'feature_ai_translation', value: true },
      { key: 'languages_enabled', value: ['en'] },
    ];
    const r = await translateContent({ ...request, languages: ['es', 'pt'] });
    expect(r.body).toMatchObject({ status: 'skipped', translated: 0 });
    expect(translateMock).not.toHaveBeenCalled();
  });

  it('skips when feature_ai_translation is off', async () => {
    state.user = { id: 'admin-user', email: 'ada@example.com' };
    state.tables.site_config = [{ key: 'feature_ai_translation', value: false }];
    const r = await translateContent(request);
    expect(r.body).toMatchObject({ status: 'skipped' });
    expect(translateMock).not.toHaveBeenCalled();
  });
});
