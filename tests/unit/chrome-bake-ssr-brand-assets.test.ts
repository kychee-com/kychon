// Since kychon#228 SSR routes (/event, /calendar, /search) bake a port's own
// chrome from the snapshot. A port's logo and favicon are `/assets/<name>`
// paths, which are not served, so the SSR bake must resolve them against the
// site's request-time manifest like the prerendered pages do; otherwise first
// paint requests the bare path (404) until hydration swaps the logo in.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bakeChrome, chromeNeedsAssetManifest } from '../../src/lib/chrome-bake';
import { type AssetManifest, CLIENT_ASSET_MANIFEST_URL } from '../../src/lib/kychon-image';
import { mergeSeedSections } from '../../src/lib/merge-sections';
import { resetSsrAssetManifestCache, ssrAssetManifest, ssrRequestOrigin } from '../../src/lib/ssr-api';
import type { ProjectSeed, SeedSection } from '../../src/seeds/types';

const root = join(import.meta.dirname, '../..');

const brandHeader = {
  page_slug: '*',
  zone: 'header',
  scope: 'global',
  section_type: 'brand_header',
  config: {},
  position: 1,
} as unknown as SeedSection;

function portSeed(siteConfig: Record<string, unknown>, sections: SeedSection[] = [brandHeader]): ProjectSeed {
  return {
    site_config: { site_name: 'County Bar', brand_text: 'County Bar', ...siteConfig },
    sections,
  } as unknown as ProjectSeed;
}

const manifest = {
  version: 1,
  generated_at: '2026-10-14T00:00:00Z',
  assets: {
    'logo.jpg': { cdn_url: 'https://cdn.example.com/logo.jpg' },
    'word.png': { cdn_url: 'https://cdn.example.com/word.png' },
  },
} as unknown as AssetManifest;

describe('chromeNeedsAssetManifest', () => {
  it('is true when the logo, wordmark or favicon is an /assets/ path', () => {
    expect(chromeNeedsAssetManifest(portSeed({ brand_icon_url: '/assets/logo.jpg' }))).toBe(true);
    expect(chromeNeedsAssetManifest(portSeed({ brand_wordmark_url: '/assets/word.png' }))).toBe(true);
    expect(chromeNeedsAssetManifest(portSeed({ favicon_url: '/assets/logo.jpg' }))).toBe(true);
  });

  it('is true when a visible global chrome block names an /assets/ path', () => {
    const footer = {
      ...brandHeader,
      zone: 'footer',
      section_type: 'custom',
      config: { html: '<img src="/assets/seal.png">' },
    } as unknown as SeedSection;
    expect(chromeNeedsAssetManifest(portSeed({}, [footer]))).toBe(true);
    expect(chromeNeedsAssetManifest(portSeed({}, [{ ...footer, visible: false } as SeedSection]))).toBe(false);
  });

  it('is false when the chrome uses absolute or data URLs only', () => {
    expect(
      chromeNeedsAssetManifest(
        portSeed({ brand_icon_url: 'https://cdn.example.com/logo.jpg', favicon_url: 'data:image/svg+xml,x' }),
      ),
    ).toBe(false);
  });
});

describe('SSR brand assets', () => {
  it('resolves the /assets/ logo and favicon through a request-time manifest', () => {
    const seed = portSeed({ brand_icon_url: '/assets/logo.jpg', favicon_url: '/assets/logo.jpg' });
    const chrome = bakeChrome(seed, 'Calendar', { pageSlug: 'calendar', manifest });
    expect(chrome.faviconUrl).toBe('https://cdn.example.com/logo.jpg');
    expect(chrome.headerHtml).toContain('https://cdn.example.com/logo.jpg');
    expect(chrome.headerHtml).not.toContain('"/assets/logo.jpg"');
  });

  it('Portal fetches the site manifest on SSR routes whose chrome needs it and has no bundled manifest', () => {
    const portal = readFileSync(join(root, 'src/layouts/Portal.astro'), 'utf-8');
    expect(portal).toMatch(
      /!Astro\.isPrerendered &&\s*!requestManifest &&\s*chromeNeedsAssetManifest\(chromeSeed\) &&\s*!getBakeAssetManifest\(\)\s*\) \{[\s\S]*?requestManifest = await ssrAssetManifest\(ssrRequestOrigin\(Astro\.url, host\)\);/,
    );
  });
});

// The request-time path end to end for a route like /calendar with no
// page-scoped header rows (kychon#237): the chrome alone must trigger the
// static manifest read, and the bake must resolve the logo, wordmark and favicon.
describe('SSR chrome with /assets/ brand paths and no page header rows', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetSsrAssetManifestCache();
  });

  async function bakeLikeSsr(siteConfig: Record<string, unknown>) {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith(CLIENT_ASSET_MANIFEST_URL)
        ? new Response(JSON.stringify(manifest), { status: 200 })
        : new Response('not found', { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const chromeSeed = mergeSeedSections(portSeed(siteConfig), 'calendar', []);
    expect(chromeNeedsAssetManifest(chromeSeed)).toBe(true);
    const host = 'club.example.com';
    const requestManifest = await ssrAssetManifest(ssrRequestOrigin(new URL(`http://${host}/calendar`), host));
    return {
      fetchMock,
      chrome: bakeChrome(chromeSeed, 'Calendar', { pageSlug: 'calendar', manifest: requestManifest }),
    };
  }

  it('resolves the brand icon and favicon from the static manifest file, never an SSR route', async () => {
    const { fetchMock, chrome } = await bakeLikeSsr({
      brand_icon_url: '/assets/logo.jpg',
      favicon_url: '/assets/logo.jpg',
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`https://club.example.com${CLIENT_ASSET_MANIFEST_URL}`]);
    expect(chrome.faviconUrl).toBe('https://cdn.example.com/logo.jpg');
    expect(chrome.headerHtml).toContain('https://cdn.example.com/logo.jpg');
    expect(chrome.headerHtml).not.toContain('"/assets/logo.jpg"');
  });

  it('resolves a wordmark-only brand', async () => {
    const { chrome } = await bakeLikeSsr({ brand_wordmark_url: '/assets/word.png' });
    expect(chrome.headerHtml).toContain('https://cdn.example.com/word.png');
    expect(chrome.headerHtml).not.toContain('"/assets/word.png"');
  });
});
