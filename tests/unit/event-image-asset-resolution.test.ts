/**
 * Event images authored as `/assets/<basename>` must resolve through the
 * asset manifest on every event surface (kychee-com/kychon#186, #169).
 *
 * The `/assets/...` path itself is not served (404s), so the server render —
 * where `window.__KYCHON_ASSET_MANIFEST` does not exist — has to resolve it
 * against the build-time manifest, and the client has to pick it up once the
 * runtime manifest lands (ports above the inline cap fetch it after mount) —
 * see event-image-manifest-client.test.ts for the client half.
 *
 * Runs in the node environment: no `window`, exactly like the Astro bake.
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EventDetailPageApp from '../../src/components/kychon/EventDetailPageApp';
import { renderEventsListStaticHtml } from '../../src/components/kychon/EventsListIsland';
import EventsPageApp from '../../src/components/kychon/EventsPageApp';
import { pickAssetManifestEntries } from '../../src/lib/bake-asset-manifest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';
import type { AssetManifest } from '../../src/lib/kychon-image';
import type { Event } from '../../src/schemas/event';

// `@run402/astro/react`'s <Run402Image> passes HTML `class` (not
// `className`), and with `priority` HTML `fetchpriority` (not `fetchPriority`),
// to createElement for byte-identity with its HTML renderer, which React's dev
// build reports. Upstream behavior, not under test here; silence only those
// messages so any other console.error still surfaces.
const consoleError = console.error.bind(console);
vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].startsWith('Invalid DOM property `%s`') &&
    (args[1] === 'class' || args[1] === 'fetchpriority')
  )
    return;
  consoleError(...args);
});

const CDN = 'https://pr-test.run402.com/_blob/astro/foo-1a2b3c4d.jpg';
const OTHER = 'https://pr-test.run402.com/_blob/astro/other-5e6f7a8b.jpg';

const manifest = {
  version: 1,
  assets: {
    'foo.jpg': { key: 'astro/foo-1a2b3c4d.jpg', url: CDN, cdnUrl: CDN, width_px: 600, height_px: 400 },
    'other.jpg': { key: 'astro/other-5e6f7a8b.jpg', url: OTHER, cdnUrl: OTHER, width_px: 600, height_px: 400 },
  },
} as unknown as AssetManifest;

const event: Event = {
  id: 7,
  title: 'Spring Gala',
  description: null,
  location: 'Hall',
  starts_at: '2099-05-01T18:00:00Z',
  ends_at: null,
  capacity: null,
  image_url: '/assets/foo.jpg',
  is_members_only: false,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('pickAssetManifestEntries', () => {
  it('keeps only the entries the given URLs reference', () => {
    const subset = pickAssetManifestEntries(manifest, ['/assets/foo.jpg', 'https://x.test/a.jpg', null, '']);
    expect(subset?.version).toBe(1);
    expect(Object.keys(subset?.assets ?? {})).toEqual(['foo.jpg']);
    expect(pickAssetManifestEntries(null, ['/assets/foo.jpg'])).toBeNull();
    expect(pickAssetManifestEntries(manifest, ['/assets/missing.jpg'])).toBeNull();
  });
});

describe('/events page cards (EventsPageApp)', () => {
  it('server render resolves /assets/<name> via the build-time manifest', () => {
    const html = renderToString(
      createElement(EventsPageApp, {
        initialEvents: [event],
        assetManifest: pickAssetManifestEntries(manifest, ['/assets/foo.jpg']),
      }),
    );
    expect(html).toContain(CDN);
    expect(html).not.toContain('"/assets/foo.jpg"');
  });
});

describe('/event detail (EventDetailPageApp)', () => {
  it('server render carries the event itself and resolves its hero and description images', () => {
    const detailed: Event = {
      ...event,
      description: '<p>Dinner and dancing.</p><img src="/assets/other.jpg" alt="">',
    };
    const html = renderToString(
      createElement(EventDetailPageApp, {
        initialEvent: detailed,
        assetManifest: pickAssetManifestEntries(manifest, ['/assets/foo.jpg', '/assets/other.jpg']),
      }),
    );
    expect(html).toContain('Spring Gala');
    expect(html).toContain('Hall');
    expect(html).toContain('Dinner and dancing.');
    expect(html).toContain('2099');
    expect(html).toContain(CDN);
    expect(html).toContain(OTHER);
    expect(html).not.toContain('"/assets/foo.jpg"');
    expect(html).not.toContain('"/assets/other.jpg"');
  });

  it('server render without an event is the loading skeleton', () => {
    const html = renderToString(createElement(EventDetailPageApp, { initialEvent: null }));
    expect(html).toContain('All Events');
    expect(html).not.toContain('Spring Gala');
  });
});

describe('events_list block (EventsListIsland)', () => {
  const config = { layout: 'grid' as const, show_image: true, count: 4, filter: 'upcoming' as const };

  it('static render resolves /assets/<name> via the build-time manifest', () => {
    const html = renderEventsListStaticHtml({ events: [event], config, manifest });
    expect(html).toContain(CDN);
    expect(html).not.toContain('"/assets/foo.jpg"');
  });

  it('build-time block bake passes ctx.manifest through', () => {
    const section: Section = {
      id: 41,
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'events_list',
      position: 1,
      config,
    };
    const ctx: BlockRenderContext = {
      admin: false,
      locale: 'en',
      manifest,
      buildEvents: [event],
    } as BlockRenderContext;
    const html = renderBlock(section, ctx);
    expect(html).toContain(CDN);
    expect(html).not.toContain('src="/assets/foo.jpg"');
  });
});
