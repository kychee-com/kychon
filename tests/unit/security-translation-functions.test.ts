// Regression coverage for the AI translation edge function, which spends the
// project's metered Run402 AI translation quota.
//
// The forum's Translate button used to call an anonymous translate-text
// function. It now calls the Capability API's translations.translateText,
// which resolves the actor server-side: see
// security-translate-text-capability.test.ts.
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

function cacheRows() {
  return state.inserts.filter((insert) => insert.table === 'content_translations');
}

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
