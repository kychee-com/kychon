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

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsonObject } from '../../src/lib/capability-api/index.ts';

const mockState = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string },
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
  assetRmCalls: [] as string[],
  assetLsCalls: [] as Array<Record<string, unknown>>,
  assetLsResponse: { blobs: [] as unknown[], next_cursor: null as string | null },
  uploadResponse: { ok: true, url: '/storage/test', status: 200 },
  deleteResponse: { ok: true, status: 200 },
  sqlCalls: [] as Array<{ query: string; params: unknown[] }>,
}));

vi.mock(
  '@run402/functions',
  () => ({
    getUser: vi.fn(async () => mockState.user),
    auth: { user: vi.fn(async () => mockState.user) },
    adminDb: () => ({
      sql(query: string, params: unknown[] = []) {
        mockState.sqlCalls.push({ query, params });
        const lc = query.replace(/\s+/g, ' ').trim().toLowerCase();
        if (lc.startsWith('select role from members')) {
          const want = String(params[0] ?? '');
          const found = mockState.members.find((m) => String(m.user_id) === want);
          return Promise.resolve(found ? { rows: [{ role: found.role }] } : { rows: [] });
        }
        if (lc.startsWith('select id from members')) {
          const want = String(params[0] ?? '');
          const found = mockState.members.find((m) => String(m.user_id) === want);
          return Promise.resolve(found ? { rows: [{ id: found.id }] } : { rows: [] });
        }
        return Promise.resolve({ rows: [] });
      },
      from(table: string) {
        return {
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
      // fake AssetRef shape so the handler's url-pick logic runs. v1.50 +
      // admin-content-management refactor: metadata + exifPolicy threaded
      // through opts; width/height/format come from the platform.
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
      rm(key: string) {
        mockState.assetRmCalls.push(key);
        if (mockState.deleteResponse.status >= 400 && mockState.deleteResponse.status !== 404) {
          return Promise.reject(new Error(`mock rm failed: ${mockState.deleteResponse.status}`));
        }
        return Promise.resolve();
      },
      ls(opts: Record<string, unknown>) {
        mockState.assetLsCalls.push(opts);
        return Promise.resolve(mockState.assetLsResponse);
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
  mockState.uploadResponse = { ok: true, url: '/storage/test', status: 200 };
  mockState.deleteResponse = { ok: true, status: 200 };
  process.env.RUN402_SERVICE_KEY = 'service-key-test';

  globalThis.fetch = vi.fn(async (url: string, init?: { method?: string }) => {
    const method = init?.method || 'GET';
    mockState.fetchCalls.push({ url: String(url), method });
    if (method === 'DELETE') {
      return new Response(JSON.stringify({ deleted: true }), {
        status: mockState.deleteResponse.status,
      });
    }
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

describe('bug #25 — upload-asset.js path traversal in delete', () => {
  it('rejects body.path containing ".." path traversal', async () => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [{ id: 7, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' }];
    const handler = (await import('../../functions/upload-asset.js')).default;
    const res = await handler(jsonReq('upload-asset', { action: 'delete', path: '../resources/secret.pdf' }));
    expect(res.status).toBe(400);
    // Crucially — no DELETE request should have been issued upstream.
    expect(mockState.fetchCalls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('rejects body.path with leading slash (escapes bucket prefix)', async () => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [{ id: 7, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' }];
    const handler = (await import('../../functions/upload-asset.js')).default;
    const res = await handler(jsonReq('upload-asset', { action: 'delete', path: '/etc/secret' }));
    expect(res.status).toBe(400);
    expect(mockState.fetchCalls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('rejects body.path with double slash', async () => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [{ id: 7, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' }];
    const handler = (await import('../../functions/upload-asset.js')).default;
    const res = await handler(jsonReq('upload-asset', { action: 'delete', path: 'foo//bar' }));
    expect(res.status).toBe(400);
    expect(mockState.fetchCalls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('accepts a clean asset path and delegates to assets.rm (#28; v1.50 refactor)', async () => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [{ id: 7, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' }];
    const handler = (await import('../../functions/upload-asset.js')).default;
    const res = await handler(jsonReq('upload-asset', { action: 'delete', path: 'logo.png' }));
    expect(res.status).toBe(200);
    // The admin-content-management refactor switched the delete path from a
    // raw fetch() against /storage/v1/blob/<key> to assets.rm(<key>). The
    // platform handles variant revocation + CDN invalidation; we just call
    // through with the prefixed key.
    expect(mockState.assetRmCalls).toContain('assets/logo.png');
    expect(mockState.fetchCalls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });
});

describe('bug #25 — upload-asset.js parameterized SQL', () => {
  it('uses parameterized $1 binding for user_id (not string interpolation)', async () => {
    mockState.user = { id: 'admin-user' };
    mockState.members = [{ id: 7, user_id: 'admin-user', email: 'admin@example.com', role: 'admin', status: 'active' }];
    const handler = (await import('../../functions/upload-asset.js')).default;
    await handler(jsonReq('upload-asset', { action: 'delete', path: 'logo.png' }));

    const roleQuery = mockState.sqlCalls.find((c) => /role from members/i.test(c.query));
    expect(roleQuery, 'expected a SELECT role FROM members SQL call').toBeDefined();
    expect(roleQuery?.query).toMatch(/\$1/);
    expect(roleQuery?.query).not.toMatch(/'admin-user'/);
    expect(roleQuery?.params).toEqual(['admin-user']);
  });
});
