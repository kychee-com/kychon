// Regression coverage for the member-export leak: functions/export-csv.js only
// checked for *any* signed-in Run402 user, then used adminDb() to return every
// member's email, status, role, tier, and custom fields as CSV. Anyone can
// self-register through /join, so any visitor could download the member list.
//
// The function is gone. Member data now leaves the portal only through:
//   - the admin members page, which builds the CSV in the browser from
//     `members.list` rows (private fields are returned to admins only), and
//   - the Capability API's `exports.membersCsv` / `exports.eventsCsv`, which
//     are admin-only (and not implemented, so they return 501 even to admins).
// "Admin" means an active member with role admin, or a project admin.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { collectFunctionsMap, ROOT } from '../../scripts/_lib.ts';
import { CORE_INCLUDED_FUNCTIONS } from '../../scripts/build-run402-manifest.ts';
import { type JsonObject, KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';
import { buildMembersCsv, csvCell, membersCsvHref } from '../../src/lib/members-csv.ts';

type MockUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };
type MockDbChain = Promise<JsonObject[]> & {
  eq(column: string, value: unknown): MockDbChain;
  limit(count: number): Promise<JsonObject[]>;
};

const mockState = vi.hoisted(() => ({
  user: null as null | MockUser,
  tables: {} as Record<string, JsonObject[]>,
  chain(rows: JsonObject[]): MockDbChain {
    const query = Promise.resolve(rows) as MockDbChain;
    query.eq = (column: string, value: unknown) =>
      mockState.chain(rows.filter((row) => String(row[column]) === String(value)));
    query.limit = (count: number) => Promise.resolve(rows.slice(0, count));
    return query;
  },
}));

vi.mock(
  '@run402/functions',
  () => ({
    getUser: vi.fn(async () => mockState.user),
    events: { emit: vi.fn(async () => ({ deduplicated: false })) },
    auth: { user: vi.fn(async () => mockState.user) },
    adminDb: () => ({
      sql() {
        return Promise.resolve({ rows: [] });
      },
      from(table: string) {
        return {
          select() {
            return mockState.chain(mockState.tables[table] || []);
          },
          insert(row: JsonObject) {
            const created = { id: (mockState.tables[table]?.length || 0) + 1, ...row };
            mockState.tables[table] = [...(mockState.tables[table] || []), created];
            return Promise.resolve([created]);
          },
          update(patch: JsonObject) {
            return {
              eq(column: string, value: unknown) {
                const rows = mockState.tables[table] || [];
                mockState.tables[table] = rows.map((row) =>
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

const MEMBER_EMAILS = ['ada@example.com', 'grace@example.com', 'linus@example.com'];

beforeEach(() => {
  mockState.user = null;
  mockState.tables = {
    capability_executions: [],
    activity_log: [],
    site_config: [{ id: 1, key: 'directory_public', value: false, category: 'features' }],
    members: [
      {
        id: 1,
        user_id: 'admin-user',
        email: 'ada@example.com',
        display_name: 'Ada',
        role: 'admin',
        status: 'active',
        joined_at: '2026-01-02T00:00:00Z',
        custom_fields: { phone: '+1 555 0100' },
      },
      {
        id: 2,
        user_id: 'member-user',
        email: 'grace@example.com',
        display_name: 'Grace',
        role: 'member',
        status: 'active',
        joined_at: '2026-02-03T00:00:00Z',
        custom_fields: {},
      },
      {
        id: 3,
        user_id: 'pending-admin-user',
        email: 'linus@example.com',
        display_name: 'Linus',
        role: 'admin',
        status: 'pending',
        joined_at: '2026-03-04T00:00:00Z',
        custom_fields: {},
      },
      {
        id: 4,
        user_id: 'suspended-admin-user',
        email: 'suspended@example.com',
        display_name: 'Sus',
        role: 'admin',
        status: 'suspended',
        joined_at: '2026-03-05T00:00:00Z',
        custom_fields: {},
      },
      {
        id: 5,
        user_id: null,
        email: 'email-linked-admin@example.com',
        display_name: 'Linked by email',
        role: 'admin',
        status: 'active',
        joined_at: '2026-03-06T00:00:00Z',
        custom_fields: {},
      },
    ],
  };
});

async function callApi(body: JsonObject) {
  const kychonApi = (await import('../../functions/kychon-api.js')).default;
  const res = await kychonApi(
    new Request('https://portal.test/functions/v1/kychon-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}

function exportEnvelope(operation: string, phase: 'validate' | 'execute') {
  return {
    apiVersion: KYCHON_API_VERSION,
    operation,
    phase,
    input: {},
    ...(phase === 'execute' ? { idempotencyKey: `${operation}-${Math.random()}`, confirmed: true } : {}),
  };
}

async function listMembers() {
  return callApi({ apiVersion: KYCHON_API_VERSION, operation: 'members.list', phase: 'query', input: {} });
}

const CALLERS_WITHOUT_EXPORT_ACCESS: Array<[string, MockUser | null]> = [
  ['an anonymous caller', null],
  ['a self-registered user with no member record', { id: 'drive-by-user', email: 'drive-by@example.com' }],
  ['an active non-admin member', { id: 'member-user', email: 'grace@example.com' }],
  ['a pending admin', { id: 'pending-admin-user', email: 'linus@example.com' }],
  ['a suspended admin', { id: 'suspended-admin-user', email: 'suspended@example.com' }],
  // An unverified email (e.g. a password signup) never claims the member row registered to it.
  ['an unverified email matching an unlinked admin', { id: 'unlinked-user', email: 'Email-Linked-Admin@example.com' }],
];

const ADMIN_CALLERS: Array<[string, MockUser]> = [
  ['an active admin', { id: 'admin-user', email: 'ada@example.com' }],
  ['a project admin', { id: 'owner-user', email: 'owner@example.com', app_metadata: { role: 'project_admin' } }],
];

describe('the export-csv edge function is not shipped', () => {
  it('has no source file', () => {
    expect(existsSync(join(ROOT, 'functions', 'export-csv.js'))).toBe(false);
  });

  it('is not in the functions a deploy sends', async () => {
    const functionsMap = await collectFunctionsMap(join(ROOT, 'functions'));
    expect(Object.keys(functionsMap)).not.toContain('export-csv');
    expect(Object.keys(functionsMap)).toContain('kychon-api');
  });

  it('is not in the Run402 Core function list, and every listed function exists', () => {
    expect(CORE_INCLUDED_FUNCTIONS).not.toContain('export-csv');
    for (const name of CORE_INCLUDED_FUNCTIONS) {
      expect(existsSync(join(ROOT, 'functions', `${name}.js`)), name).toBe(true);
    }
  });
});

describe('Capability API export operations are admin-only', () => {
  for (const operation of ['exports.membersCsv', 'exports.eventsCsv']) {
    for (const [label, user] of CALLERS_WITHOUT_EXPORT_ACCESS) {
      it(`${operation}: denies ${label} at validate and execute`, async () => {
        mockState.user = user;
        for (const phase of ['validate', 'execute'] as const) {
          const r = await callApi(exportEnvelope(operation, phase));
          expect(r.status, `${phase}: ${r.text}`).toBe(403);
          expect(r.body.error.code).toBe('permission.denied');
          for (const email of MEMBER_EMAILS) expect(r.text).not.toContain(email);
        }
        expect(mockState.tables.capability_executions).toHaveLength(0);
      });
    }

    for (const [label, user] of ADMIN_CALLERS) {
      it(`${operation}: lets ${label} through the permission gate (and returns no data: not implemented)`, async () => {
        mockState.user = user;
        const validate = await callApi(exportEnvelope(operation, 'validate'));
        expect(validate.status, validate.text).toBe(200);
        expect(validate.body.data.accepted).toBe(true);
        expect(validate.body.data.cost).toEqual({ class: 'privateData' });

        const execute = await callApi(exportEnvelope(operation, 'execute'));
        expect(execute.status, execute.text).toBe(501);
        expect(execute.body.error.code).toBe('api.notImplemented');
        for (const email of MEMBER_EMAILS) expect(execute.text).not.toContain(email);
      });
    }
  }

  it('requires confirmation before executing exports.membersCsv', async () => {
    mockState.user = { id: 'admin-user', email: 'ada@example.com' };
    const r = await callApi({ ...exportEnvelope('exports.membersCsv', 'execute'), confirmed: false });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('confirmation.required');
  });
});

describe('members.list returns member emails to admins only', () => {
  for (const [label, user] of ADMIN_CALLERS) {
    it(`returns emails and custom fields to ${label}`, async () => {
      mockState.user = user;
      const r = await listMembers();
      expect(r.status, r.text).toBe(200);
      const rows = r.body.data.rows as JsonObject[];
      expect(rows.map((row) => row.email)).toEqual(expect.arrayContaining(MEMBER_EMAILS));
      expect(rows.find((row) => row.id === 1)?.custom_fields).toEqual({ phone: '+1 555 0100' });
    });
  }

  it('redacts emails and custom fields for an active non-admin member', async () => {
    mockState.user = { id: 'member-user', email: 'grace@example.com' };
    const r = await listMembers();
    expect(r.status, r.text).toBe(200);
    expect((r.body.data.rows as JsonObject[]).length).toBeGreaterThan(0);
    for (const row of r.body.data.rows as JsonObject[]) {
      expect(row.email).toBeUndefined();
      expect(row.custom_fields).toBeUndefined();
    }
    for (const email of MEMBER_EMAILS) expect(r.text).not.toContain(email);
  });

  for (const [label, user] of CALLERS_WITHOUT_EXPORT_ACCESS.filter(([, u]) => u?.id !== 'member-user')) {
    it(`denies ${label} when the directory is private`, async () => {
      mockState.user = user;
      const r = await listMembers();
      expect(r.status, r.text).toBe(403);
      for (const email of MEMBER_EMAILS) expect(r.text).not.toContain(email);
    });

    it(`redacts emails for ${label} when the directory is public`, async () => {
      mockState.tables.site_config = [{ id: 1, key: 'directory_public', value: true, category: 'features' }];
      mockState.user = user;
      const r = await listMembers();
      expect(r.status, r.text).toBe(200);
      for (const email of MEMBER_EMAILS) expect(r.text).not.toContain(email);
    });
  }
});

describe('the admin members page CSV', () => {
  it('gives an admin a CSV with every member email and custom field', async () => {
    mockState.user = { id: 'admin-user', email: 'ada@example.com' };
    const rows = (await listMembers()).body.data.rows as JsonObject[];

    const csv = buildMembersCsv(rows);
    const [header, ...lines] = csv.split('\n');
    expect(header).toBe('display_name,email,status,role,tier,joined_at,custom_fields');
    expect(lines).toHaveLength(rows.length);
    for (const email of MEMBER_EMAILS) expect(csv).toContain(`"${email}"`);
    expect(csv).toContain('"{""phone"":""+1 555 0100""}"');
    expect(decodeURIComponent(membersCsvHref(rows).replace('data:text/csv;charset=utf-8,', ''))).toBe(csv);
  });

  it('cannot contain member emails when built from a non-admin member list', async () => {
    mockState.user = { id: 'member-user', email: 'grace@example.com' };
    const rows = (await listMembers()).body.data.rows as JsonObject[];
    const csv = buildMembersCsv(rows);
    for (const email of MEMBER_EMAILS) expect(csv).not.toContain(email);
  });

  it('quotes cells and keeps member-controlled text from becoming a spreadsheet formula', () => {
    expect(csvCell('Say "hi", all')).toBe('"Say ""hi"", all"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(0)).toBe('"0"');
    for (const formula of ['=HYPERLINK("https://evil.example")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1']) {
      expect(csvCell(formula).startsWith(`"'`), formula).toBe(true);
    }
    const csv = buildMembersCsv([{ display_name: '=cmd|"/C calc"!A0', email: 'x@example.com', custom_fields: null }]);
    expect(csv.split('\n')[1]).toBe('"\'=cmd|""/C calc""!A0","x@example.com","","","","","{}"');
  });
});
