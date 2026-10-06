/**
 * kychon-bundle/v1 round trip on real Postgres (PGlite): export portal A through
 * the real kychon-api `bundle.export`, verify + upload its assets, import it into
 * a fresh project B through the initial-import wrapper, and compare.
 */
import { createHash } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUNDLE_TABLE_ORDER,
  BundleImportError,
  bundleToSeedSql,
  fetchVerifiedAssets,
  type KychonBundle,
  parseBundle,
  rewriteBundleUrls,
  uploadBundleAssets,
} from '../../scripts/content-bundle';
import { generateSeedSql } from '../../scripts/generate-seed-sql';
import { wrapInitialImport } from '../../scripts/initial-import';
import { KYCHON_API_VERSION } from '../../src/lib/capability-api/index.ts';
import { seed as eaglesSeed } from '../../src/seeds/eagles';
import { pgliteAdminDb } from '../helpers/pglite-admin-db';
import { freshKychonDb, rows } from '../helpers/pglite-db';

const HERO_BYTES = new TextEncoder().encode('hero image bytes');
const LOGO_BYTES = new TextEncoder().encode('logo bytes');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const HERO_SHA = sha(HERO_BYTES);
const LOGO_SHA = sha(LOGO_BYTES);
const SOURCE = 'https://pr-source.run402.com';
const HERO_IMMUTABLE = `${SOURCE}/_blob/assets/hero-${HERO_SHA.slice(0, 8)}.jpg`;
const HERO_VARIANT = `${SOURCE}/_blob/assets/hero-${HERO_SHA.slice(0, 8)}-v1-large-0123abcd.webp`;
const LOGO_IMMUTABLE = `${SOURCE}/_blob/astro/logo-${LOGO_SHA.slice(0, 8)}.png`;

const state = vi.hoisted(() => ({
  db: null as null | ReturnType<typeof import('../helpers/pglite-admin-db').pgliteAdminDb>,
  user: null as null | { id: string; email?: string },
  blobs: [] as Array<Record<string, unknown>>,
}));

vi.mock(
  '@run402/functions',
  () => ({
    adminDb: () => state.db,
    auth: { user: async () => state.user },
    events: { emit: async () => ({ deduplicated: false }) },
    assets: { list: async () => ({ blobs: state.blobs, next_cursor: null }) },
  }),
  { virtual: true },
);

const { default: kychonApi } = await import('../../functions/kychon-api.js');

const ADMIN = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.org' };

async function exportBundle(input: Record<string, unknown> = {}) {
  const res = await kychonApi(
    new Request('https://eagles.example.org/api/kychon', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiVersion: KYCHON_API_VERSION, operation: 'bundle.export', phase: 'query', input }),
    }),
  );
  // biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary capability payloads
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

let a: PGlite;
beforeEach(async () => {
  a = await freshKychonDb();
  state.db = pgliteAdminDb(a);
  state.user = ADMIN;
  state.blobs = [
    { key: 'assets/hero.jpg', sha256: HERO_SHA, size_bytes: HERO_BYTES.length, content_type: 'image/jpeg' },
  ];
  await a.exec(wrapInitialImport(generateSeedSql(eaglesSeed), { source: 'seed.sql' }));
  await a.exec(`
    INSERT INTO members (user_id, email, display_name, role, status) VALUES
      ('${ADMIN.id}', '${ADMIN.email}', 'Admin', 'admin', 'active');
    INSERT INTO announcements (title, body, author_id) VALUES
      ('Gala', '<p><img src="${HERO_IMMUTABLE}"><img src="${HERO_VARIANT}"><img src="/assets/logo.png"></p>',
       (SELECT id FROM members WHERE email = '${ADMIN.email}'));
  `);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === 'https://eagles.example.org/_assets-manifest.json') {
        return Response.json({
          version: 1,
          assets: {
            'logo.png': {
              key: 'astro/logo.png',
              sha256: LOGO_SHA,
              content_type: 'image/png',
              size_bytes: LOGO_BYTES.length,
              cdn_immutable_url: LOGO_IMMUTABLE,
            },
          },
        });
      }
      return new Response('not found', { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sourceFetch(overrides: Record<string, Uint8Array> = {}) {
  const files: Record<string, Uint8Array> = {
    [HERO_IMMUTABLE]: HERO_BYTES,
    [LOGO_IMMUTABLE]: LOGO_BYTES,
    ...overrides,
  };
  return (async (url: string) =>
    files[url] ? new Response(files[url]) : new Response('missing', { status: 404 })) as unknown as typeof fetch;
}

const fakePut = async (asset: { key: string; sha256: string }) => {
  const base = `https://pr-target.run402.com/_blob/${asset.key.replace(/(\.\w+)$/, `-${asset.sha256.slice(0, 8)}$1`)}`;
  return {
    key: asset.key,
    url: base,
    immutable_url: base,
    variants: { large: { url: `${base}-large.webp`, immutable_url: `${base}-large.webp` } },
  };
};

async function tableRows(db: PGlite, table: string) {
  const key = table === 'site_config' ? 'key' : 'id';
  return rows<Record<string, unknown>>(db, `SELECT * FROM ${table} ORDER BY ${key}`);
}

describe('bundle.export', () => {
  it('exports the tracked tables and the assets content references, without members or history', async () => {
    const { status, body } = await exportBundle();
    expect(status).toBe(200);
    const bundle = parseBundle(body.data.bundle);
    expect(bundle.format).toBe('kychon-bundle/v1');
    expect(bundle.include_members).toBe(false);
    expect(bundle.tables.members).toBeUndefined();
    expect(Object.keys(bundle.tables)).not.toContain('revisions');
    expect(bundle.tables.pages.length).toBeGreaterThan(0);
    expect(bundle.tables.sections.length).toBeGreaterThan(0);
    expect(bundle.tables.announcements.every((row) => row.author_id === null)).toBe(true);

    expect(bundle.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: HERO_IMMUTABLE, sha256: HERO_SHA, variant: null, source_url: HERO_IMMUTABLE }),
        expect.objectContaining({ url: HERO_VARIANT, sha256: HERO_SHA, variant: 'large', source_url: HERO_IMMUTABLE }),
        expect.objectContaining({ url: '/assets/logo.png', sha256: LOGO_SHA, source_url: LOGO_IMMUTABLE }),
      ]),
    );
  });

  it('includes members only on request, unlinked from their logins', async () => {
    const { body } = await exportBundle({ include_members: true });
    const bundle = parseBundle(body.data.bundle);
    expect(bundle.tables.members.find((row) => row.email === ADMIN.email)).toMatchObject({ user_id: null });
    expect(bundle.tables.members.every((row) => row.user_id === null)).toBe(true);
    expect(bundle.tables.announcements.find((row) => row.title === 'Gala')?.author_id).not.toBeNull();
  });

  it('is admin-only', async () => {
    state.user = null;
    const { status } = await exportBundle();
    expect(status).toBe(403);
  });
});

describe('bundle import', () => {
  it('round trip: a fresh project imports the bundle and matches the source, with target asset URLs', async () => {
    const bundle = parseBundle((await exportBundle()).body.data.bundle);
    const verified = await fetchVerifiedAssets(bundle, sourceFetch());
    expect(verified.size).toBe(2);
    const { urlMap, manifestAssets } = await uploadBundleAssets(bundle, verified, fakePut);
    expect(Object.keys(manifestAssets)).toEqual(['logo.png']);
    const tables = rewriteBundleUrls(bundle.tables, urlMap);

    const b = await freshKychonDb();
    await b.exec(wrapInitialImport(bundleToSeedSql(tables), { source: 'bundle' }));

    for (const table of BUNDLE_TABLE_ORDER) {
      if (!tables[table]) continue;
      expect(JSON.parse(JSON.stringify(await tableRows(b, table))), table).toEqual(tables[table]);
    }
    const [announcement] = await rows<{ body: string }>(b, "SELECT body FROM announcements WHERE title = 'Gala'");
    expect(announcement.body).toContain(`https://pr-target.run402.com/_blob/assets/hero-${HERO_SHA.slice(0, 8)}.jpg`);
    expect(announcement.body).toContain('-large.webp');
    expect(announcement.body).toContain('/assets/logo.png');
    expect(announcement.body).not.toContain('pr-source');

    // The import ran once, and ids keep counting past the imported rows.
    expect(await rows(b, 'SELECT import_source FROM kychon_install')).toEqual([{ import_source: 'bundle' }]);
    await b.exec(`INSERT INTO pages (slug, title) VALUES ('new-page', 'New')`);
  });

  it('fails on a tampered asset, names it, and writes nothing', async () => {
    const bundle = parseBundle((await exportBundle()).body.data.bundle);
    const tampered = new TextEncoder().encode('swapped bytes');
    const put = vi.fn(fakePut);
    const attempt = fetchVerifiedAssets(bundle, sourceFetch({ [HERO_IMMUTABLE]: tampered })).then((verified) =>
      uploadBundleAssets(bundle, verified, put),
    );
    await expect(attempt).rejects.toThrow(BundleImportError);
    await expect(attempt).rejects.toThrow(HERO_IMMUTABLE);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects a document that is not a kychon bundle', () => {
    expect(() => parseBundle({ format: 'something-else' })).toThrow(BundleImportError);
    const bundle: KychonBundle = {
      format: 'kychon-bundle/v1',
      engine_version: 'x',
      exported_at: 'now',
      source: { project_id: null, site_url: null },
      include_members: false,
      tables: { revisions: [] },
      assets: [],
      unresolved_asset_urls: [],
    };
    expect(() => parseBundle(bundle)).toThrow(/unknown tables: revisions/);
  });
});
