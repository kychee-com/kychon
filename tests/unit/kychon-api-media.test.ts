/**
 * Media library capabilities against the real kychon-api function (PGlite for
 * the database): media.list and media.delete call the platform asset API
 * directly, admin-only, inside the `assets/` prefix.
 */
import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';
import { pgliteAdminDb } from '../helpers/pglite-admin-db';
import { freshKychonDb } from '../helpers/pglite-db';

const state = vi.hoisted(() => ({
  db: null as null | ReturnType<typeof import('../helpers/pglite-admin-db').pgliteAdminDb>,
  user: null as null | { id: string; email?: string },
  list: vi.fn(),
  remove: vi.fn(),
}));

vi.mock(
  '@run402/functions',
  () => ({
    adminDb: () => state.db,
    auth: { user: async () => state.user },
    events: { emit: async () => ({ deduplicated: false }) },
    assets: { list: state.list, delete: state.remove },
  }),
  { virtual: true },
);

const { default: kychonApi } = await import('../../functions/kychon-api.js');
const { mediaAssetUrls } = await import('../../src/components/kychon/MediaPickerIsland');

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };
const PENDING_ADMIN = { id: '33333333-3333-4333-8333-333333333333', email: 'pending@example.org' };
const LOGO = {
  key: 'assets/logo.png',
  sha256: 'a'.repeat(64),
  size_bytes: 3,
  content_type: 'image/png',
  cdn_url: 'https://pr-x.run402.com/_blob/assets/logo.png',
  cdn_immutable_url: 'https://pr-x.run402.com/_blob/assets/logo-aaaaaaaa.png',
  variants: { thumb: { cdn_url: 'https://pr-x.run402.com/_blob/assets/logo-aaaaaaaa-v1-thumb-bbbbbbbb.webp' } },
};

let db: PGlite;
beforeEach(async () => {
  db = await freshKychonDb();
  state.db = pgliteAdminDb(db);
  state.user = ADMIN;
  state.list.mockReset().mockResolvedValue({ blobs: [LOGO], next_cursor: 'next-1' });
  state.remove.mockReset().mockResolvedValue({ deleted: true, key: 'assets/logo.png' });
  await db.exec(`
    INSERT INTO members (user_id, email, display_name, role, status) VALUES
      ('${ADMIN.id}', '${ADMIN.email}', 'Admin', 'admin', 'active'),
      ('${PENDING_ADMIN.id}', '${PENDING_ADMIN.email}', 'Pending', 'admin', 'pending');
  `);
});

async function call(operation: string, phase: 'query' | 'execute', input: Record<string, unknown>) {
  const res = await kychonApi(
    new Request('https://portal.test/api/kychon', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KYCHON_API_VERSION,
        operation,
        phase,
        input,
        ...(phase === 'execute' ? { confirmed: true, idempotencyKey: crypto.randomUUID() } : {}),
      }),
    }),
  );
  // biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary capability payloads
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

describe('media.list', () => {
  it('lists the admin uploads newest first, with the URLs the picker renders', async () => {
    const res = await call('media.list', 'query', { cursor: 'c1' });
    expect(res.status).toBe(200);
    expect(state.list).toHaveBeenCalledWith({ prefix: 'assets/', sort: 'createdAt:desc', limit: 40, cursor: 'c1' });
    expect(res.body.data).toEqual({ assets: [LOGO], nextCursor: 'next-1' });
  });

  it('is admin-only', async () => {
    state.user = PENDING_ADMIN;
    const res = await call('media.list', 'query', {});
    expect(res.status).toBe(403);
    expect(state.list).not.toHaveBeenCalled();
  });

  it('reports a platform failure as a retryable error', async () => {
    state.list.mockRejectedValue(new Error('Asset list failed (503)'));
    const res = await call('media.list', 'query', {});
    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: 'internal.error', retryable: true });
  });
});

describe('media.delete', () => {
  it('deletes the key under the assets/ prefix', async () => {
    const res = await call('media.delete', 'execute', { path: 'logo.png' });
    expect(res.status).toBe(200);
    expect(state.remove).toHaveBeenCalledWith('assets/logo.png');
    expect(res.body.data.result).toMatchObject({ status: 'deleted', path: 'logo.png', inUse: false });
  });

  it.each([
    ['".." traversal', '../resources/secret.pdf'],
    ['a leading slash', '/etc/secret'],
    ['a double slash', 'foo//bar'],
    ['a "." segment', 'a/./b.png'],
  ])('refuses a path with %s and deletes nothing', async (_label, path) => {
    const res = await call('media.delete', 'execute', { path });
    expect(res.status).toBe(400);
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('treats an already-deleted key as deleted', async () => {
    state.remove.mockRejectedValue(new Error('Asset delete failed (404): RESOURCE_NOT_FOUND: Blob not found'));
    const res = await call('media.delete', 'execute', { path: 'logo.png' });
    expect(res.status).toBe(200);
    expect(res.body.data.result.status).toBe('deleted');
  });

  it('asks for confirmation before deleting an image content still uses, by any of its URLs', async () => {
    // The picker stores the immutable URL; the in-use check gets every URL form.
    await db.exec(`INSERT INTO announcements (title, body) VALUES ('Gala', '<img src="${LOGO.cdn_immutable_url}">')`);
    const urls = mediaAssetUrls(LOGO);
    expect(urls).toContain(LOGO.cdn_immutable_url);

    const preview = await call('media.delete', 'execute', { path: 'logo.png', urls });
    expect(preview.body.data.result).toMatchObject({ status: 'pending_confirmation', inUse: true });
    expect(state.remove).not.toHaveBeenCalled();

    const confirmed = await call('media.delete', 'execute', { path: 'logo.png', urls, confirmed: true });
    expect(confirmed.body.data.result).toMatchObject({ status: 'deleted', inUse: true });
    expect(state.remove).toHaveBeenCalledWith('assets/logo.png');
  });

  it('deletes without asking when no content uses the image', async () => {
    const res = await call('media.delete', 'execute', { path: 'logo.png', urls: mediaAssetUrls(LOGO) });
    expect(res.body.data.result).toMatchObject({ status: 'deleted', inUse: false });
  });

  it('is refused for a pending admin', async () => {
    state.user = PENDING_ADMIN;
    const res = await call('media.delete', 'execute', { path: 'logo.png' });
    expect(res.status).toBe(403);
    expect(state.remove).not.toHaveBeenCalled();
  });
});
