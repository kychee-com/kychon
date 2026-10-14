// Since kychon#228 SSR routes (/event, /calendar, /search) bake a port's own
// chrome from the snapshot. A port's logo and favicon are `/assets/<name>`
// paths, which are not served, so the SSR bake must resolve them against the
// site's request-time manifest like the prerendered pages do; otherwise first
// paint requests the bare path (404) until hydration swaps the logo in.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bakeChrome, chromeNeedsAssetManifest } from '../../src/lib/chrome-bake';
import type { AssetManifest } from '../../src/lib/kychon-image';
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
  assets: { 'logo.jpg': { cdn_url: 'https://cdn.example.com/logo.jpg' } },
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
