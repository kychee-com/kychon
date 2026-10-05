/**
 * Follow-ups to kychon#159 found porting a gallery-heavy Wild Apricot site
 * (OCEY, ~300 photos):
 *  - the per-page inlined manifest was ~1.7 MB (raw entries are ~5.7 KB each);
 *  - port manifests carry camelCase `cdnUrl` only, and @run402/astro's image
 *    renderer needs snake_case `cdn_url` (build failed baking a slideshow);
 *  - `<img src="/assets/X">` in authored HTML resolved to the multi-MB original.
 * Plus nav `presentation.header_position`, which never reached the element
 * that reads `--nav-header-position`.
 */
import { describe, expect, it } from 'vitest';
import { inlineAssetManifest, parseAssetManifest } from '../../src/lib/bake-asset-manifest';
import { bakeChrome, headerPositionFromSeed } from '../../src/lib/chrome-bake';
import { type AssetManifest, rewriteAssetUrlsInHtml } from '../../src/lib/kychon-image';
import { seed as neutralSeed } from '../../src/seeds/neutral';
import type { ProjectSeed } from '../../src/seeds/types';

const ORIGIN = 'https://pr-qp28ky.run402.com/_blob/astro';

/** One entry in the shape `assets-put-dir --manifest-out` writes. */
function portEntry(name: string) {
  const original = `${ORIGIN}/${name}.jpg`;
  const immutable = `${ORIGIN}/${name}-18eb1de0.jpg`;
  const variant = (kind: string, w: number) => ({
    kind,
    format: 'webp',
    width_px: w,
    height_px: Math.round(w * 0.66),
    sha256: 'f'.repeat(64),
    url: `${ORIGIN}/${name}-v1-${kind}.webp`,
    immutable_url: `${ORIGIN}/${name}-v1-${kind}.webp`,
    cdn_url: `${ORIGIN}/${name}-v1-${kind}.webp`,
    cdn_immutable_url: `${ORIGIN}/${name}-v1-${kind}.webp`,
  });
  return {
    key: `astro/${name}.jpg`,
    size_bytes: 3344069,
    sha256: 'a'.repeat(64),
    visibility: 'public',
    url: original,
    immutable_url: immutable,
    size: 3344069,
    contentSha256: 'a'.repeat(64),
    contentType: 'image/jpeg',
    immutableUrl: immutable,
    cdnUrl: immutable,
    cdnMutableUrl: original,
    etag: '"sha256-aaaa"',
    sri: 'sha256-GOsd4LXAqiP8hVl1riVzHqV2VGp/i9Xr5D28Gg7VjWk=',
    contentDigest: 'sha-256=:GOsd4LXAqiP8hVl1riVzHqV2VGp/i9Xr5D28Gg7VjWk=:',
    cacheKind: 'immutable',
    cdn: { version: 'blob-gateway-v2', ready: true, hint: 'Use cdnUrl + imgTag()' },
    width_px: 3862,
    height_px: 2574,
    blurhash: 'L8Bp:{00EL4n~cW[9bRUI*~p02Rm',
    blurhash_data_url: `data:image/png;base64,${'A'.repeat(1200)}`,
    variant_spec_version: 'v1',
    display_url: original,
    display_immutable_url: immutable,
    variants: { large: variant('large', 1920), medium: variant('medium', 800), thumb: variant('thumb', 320) },
    image_exif: { Make: 'Canon' },
  };
}

const raw = JSON.stringify({
  version: 1,
  assets: { 'slide1.jpg': portEntry('slide1'), 'logo.png': { ...portEntry('logo'), variants: undefined } },
});

function parsed(): AssetManifest {
  const m = parseAssetManifest(raw);
  if (!m) throw new Error('fixture manifest did not parse');
  return m;
}

describe('parseAssetManifest', () => {
  it('fills snake_case cdn_url from camelCase cdnUrl on every entry', () => {
    const m = parsed();
    expect(m.assets['slide1.jpg'].cdn_url).toBe(`${ORIGIN}/slide1-18eb1de0.jpg`);
    expect(m.assets['logo.png'].cdn_url).toBe(`${ORIGIN}/logo-18eb1de0.jpg`);
  });
});

describe('inlineAssetManifest', () => {
  const full = parsed();
  const slim = inlineAssetManifest(full);
  const entry = slim.assets['slide1.jpg'] as unknown as Record<string, unknown>;

  it('keeps what kychon-image reads', () => {
    expect(entry.cdn_url).toBe(`${ORIGIN}/slide1-18eb1de0.jpg`);
    expect(entry.display_url).toBe(`${ORIGIN}/slide1.jpg`);
    expect(entry.width_px).toBe(3862);
    expect(entry.blurhash).toBe('L8Bp:{00EL4n~cW[9bRUI*~p02Rm');
    const large = (entry.variants as Record<string, Record<string, unknown>>).large;
    expect(large).toEqual({
      kind: 'large',
      format: 'webp',
      width_px: 1920,
      height_px: 1267,
      cdn_url: `${ORIGIN}/slide1-v1-large.webp`,
    });
  });

  it('drops hashes, cache metadata, EXIF, duplicates and the pre-decoded blurhash', () => {
    for (const field of [
      'sha256',
      'sri',
      'etag',
      'cdn',
      'cdnUrl',
      'immutableUrl',
      'cdnMutableUrl',
      'image_exif',
      'blurhash_data_url',
      'size_bytes',
    ]) {
      expect(entry).not.toHaveProperty(field);
    }
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(full).length / 3);
  });
});

describe('rewriteAssetUrlsInHtml', () => {
  const manifest = parsed();

  it('gives authored <img src> the 1920w variant, not the multi-MB original', () => {
    expect(rewriteAssetUrlsInHtml('<p><img src="/assets/slide1.jpg" alt=""></p>', manifest)).toBe(
      `<p><img src="${ORIGIN}/slide1-v1-large.webp" alt=""></p>`,
    );
  });

  it('keeps the original for href and for refs without a ladder', () => {
    expect(rewriteAssetUrlsInHtml('<a href="/assets/slide1.jpg">full size</a>', manifest)).toBe(
      `<a href="${ORIGIN}/slide1.jpg">full size</a>`,
    );
    expect(rewriteAssetUrlsInHtml("<img src='/assets/logo.png'>", manifest)).toBe(`<img src='${ORIGIN}/logo.jpg'>`);
  });
});

describe('nav header_position', () => {
  const withNav = (presentation: Record<string, unknown>): ProjectSeed => ({
    ...neutralSeed,
    sections: [
      {
        page_slug: '*',
        zone: 'header',
        scope: 'global',
        section_type: 'nav',
        config: { items: [], presentation },
        position: 1,
      },
    ],
  });

  it('bakes header_position for the [data-nav-shell] that reads it', () => {
    expect(headerPositionFromSeed(withNav({ header_position: 'static' }))).toBe('static');
    expect(bakeChrome(withNav({ header_position: 'static' }), 'Home').headerPosition).toBe('static');
  });

  it('ignores unset or invalid values (default stays sticky)', () => {
    expect(headerPositionFromSeed(withNav({}))).toBeNull();
    expect(headerPositionFromSeed(withNav({ header_position: 'fixed; top:0' }))).toBeNull();
  });
});
