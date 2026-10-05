/**
 * kychon#159 — `/assets/<basename>` must resolve through the asset manifest in
 * every context, not only typed page-image fields. A port wires its logo,
 * favicon, hero and custom-HTML images as `/assets/<basename>`; that literal
 * path is not served (403/404), so each emitter has to swap in the manifest's
 * CDN URL. Ports stage the manifest at `public/_assets-manifest.json` (not via
 * the integration's `assetsDir`), so the build-time bake must read it there.
 *
 * The mock manifest mirrors the real SDJC `_assets-manifest.json` shape:
 * basename keys, camelCase-only top-level CDN fields, `.JPG` extensions.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBakeAssetManifest, parseAssetManifest, readStagedAssetManifest } from '../../src/lib/bake-asset-manifest';
import { type BlockRenderContext, heroImageRenderUrl, renderBlock, type Section } from '../../src/lib/blocks';
import { bakeChrome } from '../../src/lib/chrome-bake';
import { type AssetManifest, resolveAssetUrl, rewriteAssetUrlsInHtml } from '../../src/lib/kychon-image';
import { seed as neutralSeed } from '../../src/seeds/neutral';
import type { ProjectSeed } from '../../src/seeds/types';

const ORIGIN = 'https://pr-px6ehp.run402.com/_blob/astro';
const LOGO = `${ORIGIN}/Logo_SDJC_-1a2b3c4d.jpg`;
const HOME = `${ORIGIN}/Home_1-5e6f7a8b.JPG`;
const HOME_MEDIUM = `${ORIGIN}/Home_1-5e6f7a8b-800w.webp`;
const ADS = `${ORIGIN}/Our_Advertisers_Pic-9c0d1e2f.jpg`;

function camelRef(cdnUrl: string, extra: Record<string, unknown> = {}) {
  return {
    key: `astro/${cdnUrl.split('/').pop()}`,
    url: cdnUrl,
    cdnUrl,
    immutableUrl: cdnUrl,
    width_px: 600,
    height_px: 400,
    ...extra,
  };
}

const manifestJson = {
  version: 1,
  assets: {
    'Logo_SDJC_.jpg': camelRef(LOGO),
    'Home_1.JPG': camelRef(HOME, {
      display_url: HOME,
      variants: { medium: { cdn_url: HOME_MEDIUM, width_px: 800, height_px: 533 } },
    }),
    'Our_Advertisers_Pic.jpg': camelRef(ADS),
  },
};
const manifest = manifestJson as unknown as AssetManifest;

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => false,
  currentPath: '/',
  manifest,
  brandText: 'San Diego Jaguar Club',
  brandIconUrl: '/assets/Logo_SDJC_.jpg',
};

function section(section_type: string, config: Record<string, unknown>, zone = 'main'): Section {
  return {
    id: 1,
    page_slug: zone === 'main' ? 'index' : '*',
    zone: zone as Section['zone'],
    scope: zone === 'main' ? 'page' : 'global',
    section_type,
    config,
    position: 1,
    visible: true,
  };
}

describe('resolveAssetUrl', () => {
  it('resolves /assets/<basename> to the manifest CDN URL (camelCase-only manifest)', () => {
    expect(resolveAssetUrl('/assets/Logo_SDJC_.jpg', manifest)).toBe(LOGO);
  });

  it('leaves misses, non-/assets URLs, and manifest-less renders untouched', () => {
    expect(resolveAssetUrl('/assets/Missing.png', manifest)).toBe('/assets/Missing.png');
    expect(resolveAssetUrl('https://cdn.example/x.png', manifest)).toBe('https://cdn.example/x.png');
    expect(resolveAssetUrl('/favicon.svg', manifest)).toBe('/favicon.svg');
    expect(resolveAssetUrl('/assets/Logo_SDJC_.jpg', null)).toBe('/assets/Logo_SDJC_.jpg');
    expect(resolveAssetUrl(undefined, manifest)).toBe('');
  });
});

describe('rewriteAssetUrlsInHtml', () => {
  it('rewrites /assets src and href attributes, either quote style', () => {
    expect(rewriteAssetUrlsInHtml('<img src="/assets/Our_Advertisers_Pic.jpg" alt="ads">', manifest)).toBe(
      `<img src="${ADS}" alt="ads">`,
    );
    expect(rewriteAssetUrlsInHtml("<img src='/assets/Logo_SDJC_.jpg'>", manifest)).toBe(`<img src='${LOGO}'>`);
    expect(rewriteAssetUrlsInHtml('<a href="/assets/Logo_SDJC_.jpg">logo</a>', manifest)).toBe(
      `<a href="${LOGO}">logo</a>`,
    );
  });

  it('leaves misses, text content, and manifest-less renders untouched', () => {
    const html = '<p>See /assets/Logo_SDJC_.jpg</p><img src="/assets/Missing.png"><img src="https://x/y.png">';
    expect(rewriteAssetUrlsInHtml(html, manifest)).toBe(html);
    expect(rewriteAssetUrlsInHtml('<img src="/assets/Logo_SDJC_.jpg">', null)).toBe(
      '<img src="/assets/Logo_SDJC_.jpg">',
    );
  });
});

describe('block emitters resolve /assets/<basename>', () => {
  it('brand_header icon', () => {
    const html = renderBlock(section('brand_header', { href: '/' }, 'header'), ctx);
    expect(html).toContain(`data-brand-icon src="${LOGO}"`);
    expect(html).not.toContain('/assets/Logo_SDJC_.jpg');
  });

  it('brand_header wordmark', () => {
    const html = renderBlock(section('brand_header', { href: '/', brand_header_mode: 'wordmark' }, 'header'), {
      ...ctx,
      brandIconUrl: '',
      brandWordmarkUrl: '/assets/Logo_SDJC_.jpg',
    });
    expect(html).toContain(`data-brand-wordmark src="${LOGO}"`);
  });

  it('custom HTML <img>', () => {
    const html = renderBlock(section('custom', { html: '<img src="/assets/Our_Advertisers_Pic.jpg" alt="ads">' }), ctx);
    expect(html).toContain(`src="${ADS}"`);
    expect(html).not.toContain('/assets/Our_Advertisers_Pic.jpg');
  });

  it('background hero image (uppercase .JPG basename)', () => {
    const html = renderBlock(section('hero', { heading: 'Hi', bg_image: '/assets/Home_1.JPG' }), ctx);
    expect(html).toContain(`background-image:url('${HOME_MEDIUM}')`);
    expect(html).not.toContain('/assets/Home_1.JPG');
  });

  it('foreground hero logo overlay', () => {
    const html = renderBlock(
      section('hero', {
        mode: 'foreground',
        image_url: '/assets/Home_1.JPG',
        image_alt: 'Concours',
        logo_overlay_url: '/assets/Logo_SDJC_.jpg',
      }),
      ctx,
    );
    expect(html).toContain(`<img src="${LOGO}" alt=""`);
    expect(html).not.toContain('/assets/');
  });
});

describe('heroImageRenderUrl (hero warm-cache source)', () => {
  it('returns the URL the hero paints, not the unserved /assets path', () => {
    expect(heroImageRenderUrl({ config: { bg_image: '/assets/Home_1.JPG' } }, manifest)).toBe(HOME_MEDIUM);
    expect(heroImageRenderUrl({ config: { mode: 'foreground', image_url: '/assets/Home_1.JPG' } }, manifest)).toBe(
      HOME,
    );
  });

  it('falls back to the configured URL on a miss and null without an image', () => {
    expect(heroImageRenderUrl({ config: { bg_image: '/img/hero.jpg' } }, manifest)).toBe('/img/hero.jpg');
    expect(heroImageRenderUrl({ config: { heading: 'x' } }, manifest)).toBeNull();
  });
});

describe('port-staged manifest at public/_assets-manifest.json', () => {
  let root: string | null = null;

  function stageManifest(contents: string): string {
    root = mkdtempSync(join(tmpdir(), 'kychon-staged-manifest-'));
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'public', '_assets-manifest.json'), contents);
    return root;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    if (root) rmSync(root, { recursive: true, force: true });
    root = null;
  });

  it('parses only version-1 manifests', () => {
    expect(parseAssetManifest(JSON.stringify(manifestJson))).not.toBeNull();
    expect(parseAssetManifest('{"version":2,"assets":{}}')).toBeNull();
    expect(parseAssetManifest('not json')).toBeNull();
  });

  it('reads the staged file and returns null when absent', () => {
    const dir = stageManifest(JSON.stringify(manifestJson));
    expect(readStagedAssetManifest(dir)?.assets['Logo_SDJC_.jpg']).toBeDefined();
    expect(readStagedAssetManifest(join(dir, 'nope'))).toBeNull();
  });

  it('feeds the build-time chrome bake: brand icon and favicon resolve', () => {
    const dir = stageManifest(JSON.stringify(manifestJson));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    expect(getBakeAssetManifest()).not.toBeNull();

    const seed: ProjectSeed = {
      ...neutralSeed,
      site_config: {
        ...neutralSeed.site_config,
        brand_icon_url: { value: '/assets/Logo_SDJC_.jpg', category: 'branding' },
        favicon_url: { value: '/assets/Logo_SDJC_.jpg', category: 'branding' },
      },
    } as ProjectSeed;
    const chrome = bakeChrome(seed, 'Home');

    expect(chrome.faviconUrl).toBe(LOGO);
    expect(chrome.isSvgFavicon).toBe(false);
    expect(chrome.headerHtml).toContain(`data-brand-icon src="${LOGO}"`);
    expect(chrome.headerHtml).not.toContain('/assets/Logo_SDJC_.jpg');
  });
});
