// kychon#219 — follow-up to #190: built-in routes (/event, /events, /calendar,
// /search, ...) bake their own page-scoped header sections (page_banner) into
// the served HTML, keyed by the route's page slug. Prerendered routes read the
// build-time cache; SSR routes read the rows per request.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Section } from '../../src/lib/blocks';
import { bakeChrome } from '../../src/lib/chrome-bake';
import { currentPageSlugFromLocation } from '../../src/lib/clean-routes';
import type { AssetManifest } from '../../src/lib/kychon-image';
import { mergeSeedSections } from '../../src/lib/merge-sections';
import type { ProjectSeed, SeedSection } from '../../src/seeds/types';

const request = vi.fn();

vi.mock('@kychon/sdk', () => ({
  createKychonClient: () => ({ request }),
  KYCHON_CAPABILITY_FUNCTION_PATH: '/functions/v1/kychon-api',
}));

const { ssrPageHeaderSections, ssrRequestOrigin } = await import('../../src/lib/ssr-api');

const root = join(import.meta.dirname, '../..');

const globalNav = {
  page_slug: '*',
  zone: 'header',
  scope: 'global',
  section_type: 'nav',
  config: { items: [{ label: 'Home', href: '/', icon: 'home', public: true }] },
  position: 1,
} as unknown as SeedSection;

function banner(slug: string, imageUrl: string, caption: string, extra: Record<string, unknown> = {}): Section {
  return {
    id: 90,
    page_slug: slug,
    zone: 'header',
    scope: 'page',
    section_type: 'page_banner',
    config: { image_url: imageUrl, image_alt: `${slug} banner`, caption_html: caption, height: 'medium' },
    position: 10,
    visible: true,
    ...extra,
  } as unknown as Section;
}

const snapshot = {
  site_config: { site_name: 'Banner Club', brand_text: 'Banner Club' },
  sections: [globalNav],
} as unknown as ProjectSeed;

// Built-in routes and the page slug each bakes (must match the runtime hydrate).
const ROUTES: Array<[string, string, string]> = [
  ['src/pages/event.astro', '/event', 'event'],
  ['src/pages/events.astro', '/events', 'events'],
  ['src/pages/calendar.astro', '/calendar', 'calendar'],
  ['src/pages/search.astro', '/search', 'search'],
  ['src/pages/resources.astro', '/resources', 'resources'],
  ['src/pages/polls.astro', '/polls', 'polls'],
  ['src/pages/forum.astro', '/forum', 'forum'],
  ['src/pages/committees.astro', '/committees', 'committees'],
  ['src/pages/directory.astro', '/directory', 'directory'],
];

describe('built-in route page-header bake (kychon#219)', () => {
  it.each(ROUTES)('%s passes the slug the runtime hydrates as', (page, path, slug) => {
    expect(currentPageSlugFromLocation(path, '?id=1')).toBe(slug);
    const src = readFileSync(join(root, page), 'utf-8');
    expect(src).toMatch(new RegExp(`<Portal[^>]*pageSlug="${slug}"`));
  });

  it("bakes a route's DB-only banner (image + caption) into its header, not other routes'", () => {
    const merged = mergeSeedSections(snapshot, 'event', [
      banner('event', '/event-banner.jpg', 'Event <em>caption</em>'),
    ]);
    const chrome = bakeChrome(merged, 'Gala', { pageSlug: 'event' });
    expect(chrome.headerFullBleedHtml).toContain('data-page-banner');
    expect(chrome.headerFullBleedHtml).toContain('/event-banner.jpg');
    expect(chrome.headerFullBleedHtml).toContain('Event <em>caption</em>');
    expect(chrome.headerHtml).toContain('data-block-nav');

    const calendar = bakeChrome(merged, 'Calendar', { pageSlug: 'calendar' });
    expect(calendar.headerFullBleedHtml).not.toContain('/event-banner.jpg');
  });

  it("resolves the banner's /assets image through a request-time manifest", () => {
    const manifest = {
      version: 1,
      generated_at: '2026-10-06T00:00:00Z',
      assets: { 'events.jpg': { cdn_url: 'https://cdn.example.com/events.jpg' } },
    } as unknown as AssetManifest;
    const merged = mergeSeedSections(snapshot, 'events', [banner('events', '/assets/events.jpg', 'Events')]);
    const chrome = bakeChrome(merged, 'Events', { pageSlug: 'events', manifest });
    expect(chrome.headerFullBleedHtml).toContain('https://cdn.example.com/events.jpg');
  });

  it('Portal loads page header rows itself: build cache when prerendered, per request on SSR', () => {
    const portal = readFileSync(join(root, 'src/layouts/Portal.astro'), 'utf-8');
    expect(portal).toMatch(/Astro\.isPrerendered/);
    expect(portal).toMatch(/getBuildSections\(pageSlug\)/);
    expect(portal).toMatch(/ssrPageHeaderSections\(\{ slug: pageSlug/);
    expect(portal).toMatch(/bakeChrome\(chromeSeed, title, \{ pageSlug, manifest: requestManifest \}\)/);
  });
});

describe('ssrPageHeaderSections', () => {
  beforeEach(() => {
    request.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the slug's page-scoped header rows, visible only, in position order", async () => {
    request.mockResolvedValue({
      rows: [
        banner('event', '/b.jpg', 'B', { position: 20 }),
        banner('event', '/a.jpg', 'A', { position: 5 }),
        banner('event', '/hidden.jpg', 'H', { visible: false }),
        banner('events', '/other.jpg', 'O'),
        { ...banner('event', '/main.jpg', 'M'), zone: 'main' },
      ],
    });
    const rows = await ssrPageHeaderSections({ slug: 'event', host: 'club.kychon.com' });
    expect(request).toHaveBeenCalledWith('sections.list', 'query', {
      page_slug: 'event',
      zone: 'header',
      scope: 'page',
    });
    expect(rows.map((s) => (s.config as { image_url: string }).image_url)).toEqual(['/a.jpg', '/b.jpg']);
  });

  it('falls back to no rows when the read fails', async () => {
    request.mockRejectedValue(new Error('gateway timeout'));
    await expect(ssrPageHeaderSections({ slug: 'calendar', host: 'club.kychon.com' })).resolves.toEqual([]);
  });
});

describe('ssrRequestOrigin', () => {
  it('forces https for deployed hosts and keeps the local dev scheme', () => {
    expect(ssrRequestOrigin(new URL('http://internal/event'), 'ocey.run402.com')).toBe('https://ocey.run402.com');
    expect(ssrRequestOrigin(new URL('http://localhost:4321/event'), 'localhost:4321')).toBe('http://localhost:4321');
  });
});
