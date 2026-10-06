/**
 * Actor → member mapping in the real kychon-api function against the real
 * schema.sql (PGlite). A user maps to a member row by user_id; the email
 * fallback may only claim an unlinked row, and only for a Run402-verified
 * address (auth.user() reports emailVerified=false on the Bearer path and an
 * empty email on the cookie path).
 */
import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';
import { pgliteAdminDb } from '../helpers/pglite-admin-db';
import { freshKychonDb, rows } from '../helpers/pglite-db';

type TestUser = { id: string; email: string; emailVerified: boolean };

const state = vi.hoisted(() => ({
  db: null as null | ReturnType<typeof import('../helpers/pglite-admin-db').pgliteAdminDb>,
  user: null as null | TestUser,
}));

vi.mock(
  '@run402/functions',
  () => ({
    adminDb: () => state.db,
    auth: { user: async () => state.user },
    events: { emit: async () => ({ deduplicated: false }) },
  }),
  { virtual: true },
);

const { default: kychonApi } = await import('../../functions/kychon-api.js');

const OWNER = '11111111-1111-4111-8111-111111111111';
const NEWCOMER = '33333333-3333-4333-8333-333333333333';

let db: PGlite;
beforeEach(async () => {
  db = await freshKychonDb();
  state.db = pgliteAdminDb(db);
  await db.exec(`
    INSERT INTO members (user_id, email, display_name, role, status) VALUES
      ('${OWNER}', 'admin@example.org', 'Admin', 'admin', 'active'),
      (NULL, 'imported-admin@example.org', 'Imported Admin', 'admin', 'active'),
      (NULL, 'imported@example.org', 'Imported', 'member', 'active');
  `);
});

async function whoami(user: TestUser | null) {
  state.user = user;
  const res = await kychonApi(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiVersion: KYCHON_API_VERSION, operation: 'auth.whoami', phase: 'query', input: {} }),
    }),
  );
  // biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary capability payloads
  const body = (await res.json()) as Record<string, any>;
  expect(res.status, JSON.stringify(body)).toBe(200);
  return body.data.actor;
}

async function userIdFor(email: string) {
  const [row] = await rows<{ user_id: string | null }>(db, `SELECT user_id FROM members WHERE email = '${email}'`);
  return row.user_id;
}

describe('kychon-api actor → member mapping', () => {
  it.each([
    'admin@example.org',
    'imported-admin@example.org',
  ])('does not map an unverified email to the member row for %s', async (email) => {
    const actor = await whoami({ id: NEWCOMER, email, emailVerified: false });

    expect(actor.state).toBe('authenticated_non_member');
    expect(actor.member).toBeNull();
    expect(actor.authority.activeMemberAdmin).toBe(false);
    expect(await userIdFor(email)).toBe(email === 'admin@example.org' ? OWNER : null);
  });

  it('does not map a verified email onto a row already linked to another user', async () => {
    const actor = await whoami({ id: NEWCOMER, email: 'ADMIN@example.org', emailVerified: true });

    expect(actor.state).toBe('authenticated_non_member');
    expect(actor.member).toBeNull();
    expect(await userIdFor('admin@example.org')).toBe(OWNER);
  });

  it('links an unlinked row to a verified email and resolves by user_id afterwards', async () => {
    const first = await whoami({ id: NEWCOMER, email: 'Imported-Admin@example.org', emailVerified: true });
    expect(first.state).toBe('admin');
    expect(first.member).toMatchObject({ lookup: 'email', userId: NEWCOMER, email: 'imported-admin@example.org' });
    expect(await userIdFor('imported-admin@example.org')).toBe(NEWCOMER);

    // The link persists: a later cookie-path call (no email) still finds the row.
    const later = await whoami({ id: NEWCOMER, email: '', emailVerified: true });
    expect(later.state).toBe('admin');
    expect(later.member).toMatchObject({ lookup: 'user_id', userId: NEWCOMER });
  });

  it('keeps the user_id lookup first for an existing member', async () => {
    const actor = await whoami({ id: OWNER, email: '', emailVerified: true });
    expect(actor.state).toBe('admin');
    expect(actor.member).toMatchObject({ lookup: 'user_id', userId: OWNER });
  });
});
