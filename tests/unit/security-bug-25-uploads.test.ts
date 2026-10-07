// Regression coverage for #25: upload edge-function vulnerabilities.
//
// 1. functions/upload-resource.js requires only "any signed-in Run402 user" —
//    not a Kychon admin and not even a Kychon member. uploaded_by is taken
//    from caller-supplied metadata. Result: anyone who can authenticate to
//    Run402 can write a file and a row into the project.
// 2. functions/upload-asset.js interpolates `body.path` straight into the
//    Run402 storage delete URL with the service key, allowing path traversal
//    out of the assets/ bucket.
// 3. functions/upload-asset.js builds a SQL query via string concatenation on
//    `user.id`. Safe today because user.id is a UUID, but this is a
//    defense-in-depth issue — should use parameterized SQL.
// 4. Both functions accepted any member with role admin, so a pending or
//    suspended admin could still upload and delete assets. They now require an
//    active admin (matched by user id, then email) or a project admin.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsonObject } from '../../src/lib/capability-api/index.ts';

type MockUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };

const mockState = vi.hoisted(() => ({
  user: null as null | MockUser,
  members: [] as JsonObject[],
  resources: [] as JsonObject[],
  fetchCalls: [] as Array<{ url: string; method: string }>,
  assetPutCalls: [] as Array<{
    key: string;
    size: number;
    contentType?: string;
    metadata?: Record<string, unknown>;
    exifPolicy?: string;
  }>,
  uploadResponse: { ok: true, url: '/storage/test', status: 200 },
  sqlCalls: [] as Array<{ query: string; params: unknown[] }>,
  memberLookups: [] as Array<{ column: string; value: unknown }>,
}));

vi.mock(
  '@run402/functions',
  () => ({
    getUser: vi.fn(async () => mockState.user),
    events: { emit: vi.fn(async () => ({ deduplicated: false })) },
    auth: { user: vi.fn(async () => mockState.user) },
    adminDb: () => ({
      sql(query: string, params: unknown[] = []) {
        mockState.sqlCalls.push({ query, params });
        return Promise.resolve({ rows: [] });
      },
      from(table: string) {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                if (table === 'members') mockState.memberLookups.push({ column, value });
                const rows = table === 'members' ? mockState.members : [];
                const matched = rows.filter((row) => String(row[column]) === String(value));
                return { limit: (count: number) => Promise.resolve(matched.slice(0, count)) };
              },
            };
          },
          insert(row: JsonObject) {
            if (table === 'resources') {
              const created = { id: mockState.resources.length + 1, ...row };
              mockState.resources.push(created);
              return Promise.resolve([created]);
            }
            return Promise.resolve([row]);
          },
        };
      },
    }),
    assets: {
      // @run402/functions surface. The runtime call hits
      // /apply/v1/service-asset-put; here we record the call and return a
      // fake AssetRef shape so the handler's url-pick logic runs. metadata +
      // exifPolicy thread through opts; width/height/format come from the
      // platform.
      put(
        key: string,
        source: Uint8Array | string,
        opts?: {
          contentType?: string;
          metadata?: Record<string, unknown>;
          exifPolicy?: string;
        },
      ) {
        const size = typeof source === 'string' ? source.length : source.byteLength;
        const callRecord: {
          key: string;
          size: number;
          contentType?: string;
          metadata?: Record<string, unknown>;
          exifPolicy?: string;
        } = { key, size };
        if (opts?.contentType) callRecord.contentType = opts.contentType;
        if (opts?.metadata) callRecord.metadata = opts.metadata;
        if (opts?.exifPolicy) callRecord.exifPolicy = opts.exifPolicy;
        mockState.assetPutCalls.push(callRecord);
        return Promise.resolve({
          key,
          sha256: 'mockedsha',
          size_bytes: size,
          content_type: opts?.contentType || 'application/octet-stream',
          visibility: 'public',
          immutable: true,
          width_px: 800,
          height_px: 600,
          metadata: opts?.metadata ?? null,
          image_exif_policy: opts?.exifPolicy ?? 'strip',
          url: `https://cdn.example/blob/${key}`,
          immutable_url: `https://cdn.example/blob/${key}?sha=mockedsha`,
          cdn_url: `https://cdn.example/blob/${key}`,
          cdn_immutable_url: `https://cdn.example/blob/${key}?sha=mockedsha`,
          sri: 'sha256-mock',
          etag: 'etag-mock',
          content_digest: 'sha256=mock',
          immutableUrl: `https://cdn.example/blob/${key}?sha=mockedsha`,
          cdnUrl: `https://cdn.example/blob/${key}`,
          cdnImmutableUrl: `https://cdn.example/blob/${key}?sha=mockedsha`,
          size,
          contentType: opts?.contentType || 'application/octet-stream',
          contentSha256: 'mockedsha',
        });
      },
    },
  }),
  { virtual: true },
);

beforeEach(() => {
  mockState.user = null;
  mockState.members = [];
  mockState.resources = [];
  mockState.fetchCalls = [];
  mockState.assetPutCalls = [];
  mockState.sqlCalls = [];
  mockState.memberLookups = [];
  mockState.uploadResponse = { ok: true, url: '/storage/test', status: 200 };
  process.env.RUN402_SERVICE_KEY = 'service-key-test';

  globalThis.fetch = vi.fn(async (url: string, init?: { method?: string }) => {
    const method = init?.method || 'GET';
    mockState.fetchCalls.push({ url: String(url), method });
    return new Response(JSON.stringify({ url: mockState.uploadResponse.url }), {
      status: mockState.uploadResponse.status,
    });
  }) as unknown as typeof fetch;
});

function jsonReq(path: string, body: unknown) {
  return new Request(`https://portal.test/functions/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
    body: JSON.stringify(body),
  });
}

describe('bug #25 — upload-resource.js role check + uploaded_by spoof', () => {
  it('rejects non-admin Kychon members with 403', async () => {
    mockState.user = { id: 'plain-user', email: 'plain@example.com' };
    mockState.members = [
      { id: 1, user_id: 'plain-user', email: 'plain@example.com', role: 'member', status: 'active' },
    ];
    const handler = (await import('../../functions/upload-resource.js')).default;
    const res = await handler(
      jsonReq('upload-resource', {
        file: { name: 'guide.pdf', type: 'application/pdf', data: btoa('hello') },
        metadata: { title: 'Guide' },
      }),
    );
    expect(res.status).toBe(403);
    expect(mockState.resources).toHaveLength(0);
  });

  it('rejects unauthenticated callers with 401', async () => {
    mockState.user = null;
    const handler = (await import('../../functions/upload-resource.js')).default;
    const res = await handler(
      jsonReq('upload-resource', {
        file: { name: 'guide.pdf', type: 'application/pdf', data: btoa('hello') },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('overwrites caller-supplied uploaded_by with the actor member id', async () => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [{ id: 7, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' }];
    const handler = (await import('../../functions/upload-resource.js')).default;
    const res = await handler(
      jsonReq('upload-resource', {
        file: { name: 'guide.pdf', type: 'application/pdf', data: btoa('hi') },
        metadata: { title: 'Guide', uploaded_by: 999 },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockState.resources).toHaveLength(1);
    expect(String(mockState.resources[0].uploaded_by)).toBe('7');
  });

  it('rejects unsafe file names (path traversal in storage path)', async () => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [{ id: 7, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' }];
    const handler = (await import('../../functions/upload-resource.js')).default;
    const res = await handler(
      jsonReq('upload-resource', {
        file: { name: '../../etc/passwd', type: 'text/plain', data: btoa('pwn') },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockState.resources).toHaveLength(0);
  });
});

describe('bug #25 — upload-asset.js path traversal in upload', () => {
  const ADMIN = { id: 7, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' };
  const uploadTo = (path: string) =>
    jsonReq('upload-asset', { file: { name: 'logo.png', type: 'image/png', data: btoa('png') }, path });

  it.each([
    ['".." path traversal', '../resources/secret.pdf'],
    ['a leading slash (escapes the prefix)', '/etc/secret'],
    ['a double slash', 'foo//bar'],
  ])('rejects a path with %s', async (_label, path) => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [ADMIN];
    const handler = (await import('../../functions/upload-asset.js')).default;
    const res = await handler(uploadTo(path));
    expect(res.status).toBe(400);
    expect(mockState.assetPutCalls).toHaveLength(0);
  });

  it('uploads a clean path under the assets/ prefix', async () => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [ADMIN];
    const handler = (await import('../../functions/upload-asset.js')).default;
    const res = await handler(uploadTo('logo.png'));
    expect(res.status).toBe(200);
    expect(mockState.assetPutCalls.map((c) => c.key)).toEqual(['assets/logo.png']);
  });
});

describe('bug #25 — upload-asset.js never builds SQL from user.id', () => {
  it('looks the caller up through the query builder, with the user id as a filter value', async () => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [{ id: 7, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' }];
    const handler = (await import('../../functions/upload-asset.js')).default;
    const res = await handler(
      jsonReq('upload-asset', { file: { name: 'logo.png', type: 'image/png', data: btoa('png') }, path: 'logo.png' }),
    );

    expect(res.status).toBe(200);
    expect(mockState.memberLookups).toEqual([{ column: 'user_id', value: 'admin-user' }]);
    expect(mockState.sqlCalls.filter((c) => c.query.includes('admin-user'))).toEqual([]);
  });
});

describe('uploads require an active admin or a project admin', () => {
  const upload = {
    'upload-asset': () =>
      jsonReq('upload-asset', { file: { name: 'logo.png', type: 'image/png', data: btoa('png') }, path: 'logo.png' }),
    'upload-resource': () =>
      jsonReq('upload-resource', {
        file: { name: 'guide.pdf', type: 'application/pdf', data: btoa('pdf') },
        metadata: { title: 'Guide' },
      }),
  };
  const handlers = {
    'upload-asset': () => import('../../functions/upload-asset.js'),
    'upload-resource': () => import('../../functions/upload-resource.js'),
  };
  const MEMBERS: JsonObject[] = [
    { id: 1, user_id: 'pending-admin', email: 'linus@example.com', role: 'admin', status: 'pending' },
    { id: 2, user_id: 'suspended-admin', email: 'sus@example.com', role: 'Admin', status: 'suspended' },
    { id: 3, user_id: null, email: 'email-admin@example.com', role: 'admin', status: 'active' },
  ];

  for (const name of ['upload-asset', 'upload-resource'] as const) {
    it.each([
      ['a pending admin', { id: 'pending-admin', email: 'linus@example.com' }],
      ['a suspended admin', { id: 'suspended-admin', email: 'sus@example.com' }],
    ])(`${name}: rejects %s with 403 and stores nothing`, async (_label, user) => {
      mockState.user = user;
      mockState.members = MEMBERS;
      const res = await (await handlers[name]()).default(upload[name]());
      expect(res.status).toBe(403);
      expect(mockState.assetPutCalls).toHaveLength(0);
      expect(mockState.resources).toHaveLength(0);
    });

    it.each([
      ['an active admin matched by email', { id: 'unlinked-user', email: 'Email-Admin@example.com' }],
      ['a project admin', { id: 'owner-user', email: 'owner@example.com', app_metadata: { role: 'project_admin' } }],
    ])(`${name}: lets %s upload`, async (_label, user) => {
      mockState.user = user;
      mockState.members = MEMBERS;
      const res = await (await handlers[name]()).default(upload[name]());
      expect(res.status).toBe(200);
      expect(mockState.assetPutCalls).toHaveLength(1);
    });
  }

  it('upload-asset: rejects an upload from a pending admin', async () => {
    mockState.user = { id: 'pending-admin', email: 'linus@example.com' };
    mockState.members = MEMBERS;
    const res = await (await handlers['upload-asset']()).default(upload['upload-asset']());
    expect(res.status).toBe(403);
    expect(mockState.assetPutCalls).toHaveLength(0);
  });

  it('upload-resource credits an admin matched by email with their own member row', async () => {
    mockState.user = { id: 'unlinked-user', email: 'Email-Admin@example.com' };
    mockState.members = MEMBERS;
    const res = await (await handlers['upload-resource']()).default(upload['upload-resource']());
    expect(res.status).toBe(200);
    expect(mockState.resources[0].uploaded_by).toBe(3);
  });

  it('upload-resource records no uploader for a project admin without a member row', async () => {
    mockState.user = { id: 'owner-user', email: 'owner@example.com', app_metadata: { role: 'project_admin' } };
    mockState.members = MEMBERS;
    const res = await (await handlers['upload-resource']()).default(upload['upload-resource']());
    expect(res.status).toBe(200);
    expect(mockState.resources[0].uploaded_by).toBeNull();
  });
});
