/**
 * kychon#224: a free `deployMode: "check"` on a fresh project built against the
 * empty pre-import DB, so seeded content never rendered and a render error in
 * it (an AssetRef with no `cdn_url` from a trimmed port manifest) failed only
 * the paid deploy's post-import rebuild, after the initial release was live.
 *
 * Covers: manifest normalization from `url` (entry + variants), up-front staged
 * manifest validation, the seed-rows build data source, and check mode's seed
 * render build.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execSync = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execSync,
}));

import { checkSeedRender, ROOT } from '../../scripts/_lib';
import { generateSeedSql } from '../../scripts/generate-seed-sql';
import { seedRenderRows } from '../../scripts/seed-render-rows';
import {
  _clearBuildAnnouncementsCacheForTests,
  ensureBuildAnnouncementsLoaded,
  getAllBuildAnnouncements,
} from '../../src/lib/build-announcements';
import { _clearBuildEventsCacheForTests, ensureBuildEventsLoaded, getAllBuildEvents } from '../../src/lib/build-events';
import {
  _clearBuildMembersCacheForTests,
  ensureBuildMembersLoaded,
  getAllBuildMembers,
  getAllBuildMemberTiers,
} from '../../src/lib/build-members';
import { _clearBuildPagesCacheForTests, ensureBuildPagesLoaded, getAllBuildPages } from '../../src/lib/build-pages';
import {
  _clearBuildSectionsCacheForTests,
  ensureBuildSectionsLoaded,
  getBuildSections,
} from '../../src/lib/build-sections';
import { BUILD_SEED_ROWS_ENV, type BuildSeedRows } from '../../src/lib/build-seed-rows';
import { type AssetRef, normalizeManifestAssetRef } from '../../src/lib/kychon-image';
import {
  assertStagedAssetManifestServable,
  parseAssetManifest,
  StagedAssetManifestError,
} from '../../src/lib/staged-asset-manifest';
import { seed as eaglesSeed } from '../../src/seeds/eagles';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kychon-224-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env[BUILD_SEED_ROWS_ENV];
  execSync.mockReset();
});

const BLOB = 'https://pr-x.run402.com/_blob/astro/hero.jpg';

describe('manifest normalization fills cdn_url from url', () => {
  it('fills the entry cdn_url from plain url (a trimmed snake_case manifest)', () => {
    const ref = normalizeManifestAssetRef({ url: BLOB, width_px: 800, height_px: 600 } as unknown as AssetRef);
    expect(ref.cdn_url).toBe(BLOB);
  });

  it('prefers cdn_url, then cdnUrl, over url', () => {
    expect(normalizeManifestAssetRef({ cdn_url: 'a', url: 'b' } as unknown as AssetRef).cdn_url).toBe('a');
    expect(normalizeManifestAssetRef({ cdnUrl: 'c', url: 'b' } as unknown as AssetRef).cdn_url).toBe('c');
  });

  it('fills each variant cdn_url from its url', () => {
    const ref = normalizeManifestAssetRef({
      cdn_url: BLOB,
      variants: { medium: { url: `${BLOB}?w=800`, width_px: 800 }, large: { cdn_url: 'kept', width_px: 1600 } },
    } as unknown as AssetRef);
    const variants = ref.variants as Record<string, { cdn_url?: string }>;
    expect(variants.medium.cdn_url).toBe(`${BLOB}?w=800`);
    expect(variants.large.cdn_url).toBe('kept');
  });

  it('returns an already-normalized ref unchanged', () => {
    const ref = { cdn_url: BLOB, variants: { medium: { cdn_url: BLOB } } } as unknown as AssetRef;
    expect(normalizeManifestAssetRef(ref)).toBe(ref);
  });

  it('parseAssetManifest normalizes url-only entries', () => {
    const parsed = parseAssetManifest(JSON.stringify({ version: 1, assets: { 'hero.jpg': { url: BLOB } } }));
    expect(parsed?.assets['hero.jpg'].cdn_url).toBe(BLOB);
  });
});

describe('assertStagedAssetManifestServable', () => {
  const stage = (manifest: unknown) => {
    mkdirSync(join(dir, 'public'), { recursive: true });
    writeFileSync(
      join(dir, 'public', '_assets-manifest.json'),
      typeof manifest === 'string' ? manifest : JSON.stringify(manifest),
    );
  };

  it('is a no-op when no manifest is staged', () => {
    expect(() => assertStagedAssetManifestServable(dir)).not.toThrow();
  });

  it('accepts entries that are servable after normalization', () => {
    stage({
      version: 1,
      assets: {
        'a.jpg': { cdn_url: BLOB },
        'b.jpg': { cdnUrl: BLOB },
        'c.jpg': { url: BLOB, variants: { medium: { url: BLOB } } },
      },
    });
    expect(() => assertStagedAssetManifestServable(dir)).not.toThrow();
  });

  it('rejects an unparseable or wrong-version manifest', () => {
    stage('{not json');
    expect(() => assertStagedAssetManifestServable(dir)).toThrow(StagedAssetManifestError);
    stage({ version: 2, assets: {} });
    expect(() => assertStagedAssetManifestServable(dir)).toThrow(/not a valid asset manifest/);
  });

  it('names every entry and variant with no servable URL', () => {
    stage({
      version: 1,
      assets: {
        'ok.jpg': { cdn_url: BLOB },
        'slide-1.jpg': { key: 'astro/slide-1.jpg', width_px: 800 },
        'slide-2.jpg': { cdn_url: BLOB, variants: { thumb: { width_px: 400 } } },
      },
    });
    let message = '';
    try {
      assertStagedAssetManifestServable(dir);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('2 entries');
    expect(message).toContain('slide-1.jpg: no servable URL');
    expect(message).toContain('slide-2.jpg: variant "thumb" has no servable URL');
    expect(message).not.toContain('ok.jpg');
  });
});

const ROWS: BuildSeedRows = {
  version: 1,
  tables: {
    pages: [
      { slug: 'about', title: 'About', published: true, requires_auth: false },
      { slug: 'draft', title: 'Draft', published: false },
      { slug: 'members-only', title: 'Members', requires_auth: true },
    ],
    sections: [
      { id: 2, page_slug: 'index', zone: 'main', scope: 'page', position: 2, section_type: 'slideshow', config: {} },
      { id: 1, page_slug: 'index', zone: 'main', scope: 'page', position: 1, section_type: 'hero', config: {} },
      {
        id: 3,
        page_slug: 'index',
        zone: 'main',
        scope: 'page',
        position: 3,
        visible: false,
        section_type: 'cta',
        config: {},
      },
      { id: 4, page_slug: 'about', zone: 'main', scope: 'page', position: 1, section_type: 'hero', config: {} },
      { id: 5, page_slug: '*', zone: 'footer', scope: 'global', position: 1, section_type: 'footer_links', config: {} },
    ],
    events: [
      { id: 2, title: 'Later', starts_at: '2026-12-01T00:00:00Z', created_by: 'u1' },
      { id: 1, title: 'Sooner', starts_at: '2026-11-01T00:00:00Z', created_by: 'u1' },
      { id: 3, title: 'Private', starts_at: '2026-10-01T00:00:00Z', is_members_only: true },
    ],
    announcements: [
      { id: 1, title: 'Old', created_at: '2026-01-01T00:00:00Z', author_id: 'u1' },
      { id: 2, title: 'Pinned', created_at: '2025-01-01T00:00:00Z', is_pinned: true },
      { id: 3, title: 'New', created_at: '2026-06-01T00:00:00Z' },
    ],
    members: [
      { id: 'm2', display_name: 'Zed', status: 'active', email: 'z@example.org' },
      { id: 'm1', display_name: 'Amy', status: 'active', email: 'a@example.org' },
      { id: 'm3', display_name: 'Pending', status: 'pending' },
    ],
    membership_tiers: [{ id: 't1', name: 'Standard' }],
  },
};

describe('build-time loaders read seed rows when KYCHON_BUILD_SEED_ROWS is set', () => {
  beforeEach(() => {
    const path = join(dir, 'rows.json');
    writeFileSync(path, JSON.stringify(ROWS));
    process.env[BUILD_SEED_ROWS_ENV] = path;
    _clearBuildSectionsCacheForTests();
    _clearBuildPagesCacheForTests();
    _clearBuildEventsCacheForTests();
    _clearBuildAnnouncementsCacheForTests();
    _clearBuildMembersCacheForTests();
  });

  it('sections: the page-scoped, visible rows for the slug, by position (no gateway env needed)', async () => {
    await ensureBuildSectionsLoaded('index');
    expect(getBuildSections('index').map((s) => s.id)).toEqual([1, 2]);
  });

  it('pages: published and ungated only', async () => {
    await ensureBuildPagesLoaded();
    expect(getAllBuildPages().map((p) => p.slug)).toEqual(['about']);
  });

  it('events: public only, by start time, without created_by', async () => {
    await ensureBuildEventsLoaded();
    const events = getAllBuildEvents() ?? [];
    expect(events.map((e) => e.title)).toEqual(['Sooner', 'Later']);
    expect(events[0]).not.toHaveProperty('created_by');
  });

  it('announcements: pinned first then newest, without author_id', async () => {
    await ensureBuildAnnouncementsLoaded();
    const rows = getAllBuildAnnouncements() ?? [];
    expect(rows.map((a) => a.title)).toEqual(['Pinned', 'New', 'Old']);
    expect(rows[2]).not.toHaveProperty('author_id');
  });

  it('members: active members by name in the anon projection, plus tiers', async () => {
    await ensureBuildMembersLoaded({ publicAccess: true });
    expect(getAllBuildMembers()?.map((m) => m.display_name)).toEqual(['Amy', 'Zed']);
    expect(getAllBuildMembers()?.[0]).not.toHaveProperty('email');
    expect(getAllBuildMemberTiers()).toHaveLength(1);
  });
});

describe('seedRenderRows', () => {
  it("reads back the rows a typed seed's initial import inserts", async () => {
    const rows = await seedRenderRows(ROOT, generateSeedSql(eaglesSeed));
    const sections = rows.tables.sections ?? [];
    const seeded = eaglesSeed.sections.filter((s) => s.page_slug === 'index' && s.scope === 'page').length;
    expect(seeded).toBeGreaterThan(0);
    expect(sections.filter((s) => s.page_slug === 'index' && s.scope === 'page')).toHaveLength(seeded);
    expect(JSON.parse(JSON.stringify(rows))).toEqual(rows);
  }, 30_000);

  it('reads an SQL seed file (the port path)', async () => {
    const sql = `INSERT INTO pages (slug, title, content, published) VALUES ('race-calendar', 'Race calendar', '<p>x</p>', true);
INSERT INTO sections (page_slug, zone, scope, position, section_type, config)
  VALUES ('index', 'main', 'page', 1, 'slideshow', '{"items":[{"src":"/assets/slide-1.jpg"}]}');`;
    const rows = await seedRenderRows(ROOT, sql);
    expect(rows.tables.pages?.map((p) => p.slug)).toContain('race-calendar');
    expect(rows.tables.sections?.[0]).toMatchObject({
      section_type: 'slideshow',
      config: { items: [{ src: '/assets/slide-1.jpg' }] },
    });
  }, 30_000);
});

describe('checkSeedRender', () => {
  const opts = (seedFile: string) => ({ anonKey: 'anon', projectId: 'prj_test', seedFile });

  it('builds once with the seed rows as the content source', async () => {
    const seedFile = join(dir, 'seed.sql');
    writeFileSync(
      seedFile,
      `INSERT INTO sections (page_slug, zone, scope, position, section_type, config) VALUES ('index', 'main', 'page', 1, 'hero', '{}');`,
    );
    let seenRows: BuildSeedRows | null = null;
    execSync.mockImplementation((command: string, options: { env: NodeJS.ProcessEnv }) => {
      if (command === 'npx astro build') {
        seenRows = JSON.parse(readFileSync(options.env[BUILD_SEED_ROWS_ENV] as string, 'utf8'));
        expect(options.env.KYCHON_ANON_KEY).toBe('anon');
        expect(options.env.KYCHON_PROJECT_ID).toBe('prj_test');
      }
      return Buffer.from('');
    });
    await checkSeedRender(opts(seedFile));
    expect(execSync).toHaveBeenCalledWith('npx astro build', expect.anything());
    expect((seenRows as BuildSeedRows | null)?.tables.sections).toHaveLength(1);
  }, 30_000);

  it('fails the check when the seed content does not render', async () => {
    const seedFile = join(dir, 'seed.sql');
    writeFileSync(seedFile, '');
    execSync.mockImplementation((command: string) => {
      if (command === 'npx astro build')
        throw new Error('Run402ImageError: AssetRef is missing the required `cdn_url` field.');
      return Buffer.from('');
    });
    await expect(checkSeedRender(opts(seedFile))).rejects.toThrow(/fails to build from the seed's content/);
  }, 30_000);
});
