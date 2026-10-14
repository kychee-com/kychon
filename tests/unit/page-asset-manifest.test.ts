// @vitest-environment happy-dom
/**
 * kychon#238: a port with ~1,600 uploaded images has a 9.2 MB
 * `/_assets-manifest.json`, too large to inline, so every cold visit fetched
 * all of it before re-rendered `/assets/<name>` images could resolve. Each
 * built page now inlines only the entries it references (filled in by the
 * middleware at build time), marked `partial`; a lookup that misses there
 * fetches the slim client manifest once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPageManifestScript,
  fillPageAssetManifest,
  inlineAssetManifest,
  PAGE_MANIFEST_PLACEHOLDER,
  pageAssetManifest,
  parseAssetManifest,
} from '../../src/lib/bake-asset-manifest';
import {
  type AssetManifest,
  getGlobalManifest,
  hasUnresolvedAssetImages,
  isPartialManifest,
  lookupAssetRef,
  onPartialManifestMiss,
  type PartialManifestFields,
  rewriteAssetUrlsInHtml,
  setGlobalManifest,
} from '../../src/lib/kychon-image';

const ORIGIN = 'https://pr-px6ehp.run402.com/_blob/astro';

/** One entry in the shape `assets-put-dir --manifest-out` writes (trimmed). */
function entry(name: string) {
  const original = `${ORIGIN}/${name}.jpg`;
  const variant = (kind: string, w: number) => ({
    kind,
    format: 'webp',
    width_px: w,
    height_px: w / 2,
    sha256: 'f'.repeat(64),
    url: `${ORIGIN}/${name}-v1-${kind}.webp`,
    immutable_url: `${ORIGIN}/${name}-v1-${kind}.webp`,
    cdn_url: `${ORIGIN}/${name}-v1-${kind}.webp`,
    cdn_immutable_url: `${ORIGIN}/${name}-v1-${kind}.webp`,
  });
  return {
    key: `astro/${name}.jpg`,
    sha256: 'a'.repeat(64),
    size_bytes: 532000,
    content_type: 'image/jpeg',
    url: original,
    immutable_url: `${ORIGIN}/${name}-208645fa.jpg`,
    cdn_url: original,
    cdn_immutable_url: `${ORIGIN}/${name}-208645fa.jpg`,
    etag: '"sha256-aaaa"',
    content_digest: 'sha-256=:IIZF=:',
    width_px: 2000,
    height_px: 1000,
    blurhash: 'LJG9ES^%tLtR?1IAD*xuTCE0IUIA',
    display_url: original,
    display_immutable_url: `${ORIGIN}/${name}-208645fa.jpg`,
    image_info: { bit_depth: 8, has_alpha: false },
    blurhash_data_url: `data:image/png;base64,${'A'.repeat(1200)}`,
    variants: { large: variant('large', 1920), medium: variant('medium', 800), thumb: variant('thumb', 320) },
  };
}

function siteManifest(): AssetManifest {
  const names = Array.from({ length: 200 }, (_, i) => `Gallery_${i}`);
  const assets = Object.fromEntries(
    [...names, 'Logo_SDJC_', 'Sponsor_A', 'Sponsor_B'].map((n) => [`${n}.jpg`, entry(n)]),
  );
  const parsed = parseAssetManifest(JSON.stringify({ version: 1, generated_at: '2026-10-14T00:00:00Z', assets }));
  if (!parsed) throw new Error('fixture manifest did not parse');
  return parsed;
}

/** A built /links page: baked chrome + body with resolved URLs, island props carrying the raw row. */
const builtPage = [
  '<html><head>',
  `<script>${PAGE_MANIFEST_PLACEHOLDER}</script>`,
  '</head><body>',
  `<header><img data-brand-icon src="${ORIGIN}/Logo_SDJC_.jpg" alt="SDJC"></header>`,
  // A baked `<picture>` resolves to variant URLs, listed in a srcset.
  `<picture><source type="image/webp" srcset="${ORIGIN}/Sponsor_A-v1-thumb.webp 320w, ${ORIGIN}/Sponsor_A-v1-medium.webp 800w" /></picture>`,
  // Island props: the raw row, HTML-escaped JSON.
  '<astro-island props="{&quot;initialPage&quot;:[0,{&quot;content&quot;:[0,&quot;&lt;img src=\\&quot;/assets/Sponsor_B.jpg\\&quot;&gt;&quot;]}]}"></astro-island>',
  '<a href="/assets/Bylaws.pdf">Bylaws</a>',
  '</body></html>',
].join('');

describe('pageAssetManifest', () => {
  const manifest = siteManifest();
  const subset = pageAssetManifest(manifest, builtPage);

  it('keeps the entries the page references, raw or already resolved', () => {
    expect(Object.keys(subset.assets)).toEqual(['Logo_SDJC_.jpg', 'Sponsor_A.jpg', 'Sponsor_B.jpg']);
    expect(subset.partial).toBe(true);
  });

  it('lists referenced names the site manifest lacks, so they do not trigger a fetch', () => {
    expect(subset.absent).toEqual(['Bylaws.pdf']);
  });

  it('carries only the fields the browser reads', () => {
    const ref = subset.assets['Sponsor_A.jpg'] as unknown as Record<string, unknown>;
    expect(ref.cdn_url).toBe(`${ORIGIN}/Sponsor_A.jpg`);
    expect(ref.blurhash).toBe('LJG9ES^%tLtR?1IAD*xuTCE0IUIA');
    for (const field of [
      'url',
      'immutable_url',
      'cdn_immutable_url',
      'content_digest',
      'blurhash_data_url',
      'sha256',
    ]) {
      expect(ref).not.toHaveProperty(field);
    }
    const full = JSON.stringify(manifest).length;
    expect(JSON.stringify(inlineAssetManifest(manifest)).length).toBeLessThan(full / 4);
    expect(JSON.stringify(subset).length).toBeLessThan(full / 100);
  });

  it('is empty, not absent, for a page with no images', () => {
    const empty = pageAssetManifest(manifest, '<p>Hello</p>');
    expect(empty).toMatchObject({ version: 1, assets: {}, partial: true });
    expect(empty).not.toHaveProperty('absent');
  });
});

describe('fillPageAssetManifest', () => {
  it('replaces the placeholder with the page subset script', () => {
    const html = fillPageAssetManifest(builtPage, siteManifest());
    expect(html).not.toContain(PAGE_MANIFEST_PLACEHOLDER);
    expect(html).toContain('Sponsor_B.jpg');
    expect(html).not.toContain('Gallery_7.jpg');
  });

  it('leaves pages without the placeholder (manifest inlined whole) untouched', () => {
    const html = '<html><head></head><body><img src="/assets/Logo_SDJC_.jpg"></body></html>';
    expect(fillPageAssetManifest(html, siteManifest())).toBe(html);
    expect(fillPageAssetManifest(builtPage, null)).toBe(builtPage);
  });
});

describe('page manifest inline script', () => {
  const w = window as unknown as Record<string, unknown>;
  afterEach(() => {
    delete w.__KYCHON_ASSET_MANIFEST;
    delete w.__KYCHON_ASSET_MANIFEST_INLINED;
  });

  const run = (subset: AssetManifest & PartialManifestFields) => new Function(buildPageManifestScript(subset))();
  const sub = (keys: string[], extra: PartialManifestFields = { partial: true }) =>
    ({
      version: 1,
      assets: Object.fromEntries(keys.map((k) => [k, { cdn_url: `${ORIGIN}/${k}` }])),
      ...extra,
    }) as AssetManifest & PartialManifestFields;

  it('installs the subset as the build-inlined global manifest', () => {
    const changed = vi.fn();
    window.addEventListener('kychon:manifest-changed', changed);
    run(sub(['a.jpg']));
    window.removeEventListener('kychon:manifest-changed', changed);
    expect(isPartialManifest(getGlobalManifest())).toBe(true);
    expect(w.__KYCHON_ASSET_MANIFEST_INLINED).toBe(true);
    expect(changed).toHaveBeenCalledOnce();
  });

  it('merges into the previous page manifest after a view transition', () => {
    run(sub(['a.jpg']));
    run(sub(['b.jpg']));
    expect(Object.keys(getGlobalManifest()?.assets ?? {}).sort()).toEqual(['a.jpg', 'b.jpg']);
    expect(isPartialManifest(getGlobalManifest())).toBe(true);
  });

  it('stays complete when the previous manifest was the whole site', () => {
    w.__KYCHON_ASSET_MANIFEST = sub(['a.jpg', 'c.jpg'], {});
    run(sub(['b.jpg'], { partial: true, absent: ['x.pdf'] }));
    const merged = getGlobalManifest() as AssetManifest & PartialManifestFields;
    expect(Object.keys(merged.assets).sort()).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(isPartialManifest(merged)).toBe(false);
    expect(merged.absent).toBeUndefined();
  });
});

describe('partial manifest misses', () => {
  afterEach(() => {
    onPartialManifestMiss(null);
    vi.useRealTimers();
  });

  const partial = {
    version: 1,
    assets: { 'Logo.jpg': { cdn_url: `${ORIGIN}/Logo.jpg` } },
    partial: true,
    absent: ['Bylaws.pdf'],
  } as unknown as AssetManifest;

  it('reports an /assets/ miss once, after render', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    onPartialManifestMiss(handler);
    expect(lookupAssetRef('/assets/New.jpg', partial)).toBeNull();
    expect(lookupAssetRef('/assets/Other.jpg', partial)).toBeNull();
    expect(handler).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not report hits, known-absent names, or misses in a complete manifest', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    onPartialManifestMiss(handler);
    expect(lookupAssetRef('/assets/Logo.jpg', partial)?.cdn_url).toBe(`${ORIGIN}/Logo.jpg`);
    lookupAssetRef('/assets/Bylaws.pdf', partial);
    lookupAssetRef('https://example.com/x.jpg', partial);
    lookupAssetRef('/assets/New.jpg', { version: 1, assets: {} } as unknown as AssetManifest);
    vi.runAllTimers();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('authored HTML images', () => {
  const manifest = siteManifest();
  afterEach(() => setGlobalManifest(null));

  it('get the served variant and its dimensions when the author set none', () => {
    expect(rewriteAssetUrlsInHtml('<p><img src="/assets/Sponsor_A.jpg" alt="A"></p>', manifest)).toBe(
      `<p><img src="${ORIGIN}/Sponsor_A-v1-large.webp" alt="A" width="1920" height="960"></p>`,
    );
    expect(rewriteAssetUrlsInHtml('<img src="/assets/Sponsor_A.jpg" />', manifest)).toBe(
      `<img src="${ORIGIN}/Sponsor_A-v1-large.webp" width="1920" height="960" />`,
    );
  });

  it("keep the author's own sizing", () => {
    expect(rewriteAssetUrlsInHtml('<img width="120" src="/assets/Sponsor_A.jpg">', manifest)).toBe(
      `<img width="120" src="${ORIGIN}/Sponsor_A-v1-large.webp">`,
    );
  });

  it('are detected while still unresolved', () => {
    expect(hasUnresolvedAssetImages('<img alt="" src="/assets/Sponsor_A.jpg">')).toBe(true);
    expect(hasUnresolvedAssetImages(`<img src="${ORIGIN}/Sponsor_A.jpg">`)).toBe(false);
    expect(hasUnresolvedAssetImages('<a href="/assets/Bylaws.pdf">Bylaws</a> /assets/x.jpg')).toBe(false);
    expect(hasUnresolvedAssetImages(null)).toBe(false);
  });
});
