import { describe, expect, it } from 'vitest';

import {
  countManifestAssetLists,
  sortSerializedManifestAssets,
} from '../../src/integrations/deterministic-server-manifest.mjs';

describe('sortSerializedManifestAssets', () => {
  it('makes two crawl orders of the same asset list byte-identical', () => {
    const a =
      'deserializeManifest({"base":"/","assets":["/custom/brand.json","/css/a11y.css","/_astro/x.js"],"key":"k"})';
    const b =
      'deserializeManifest({"base":"/","assets":["/css/a11y.css","/_astro/x.js","/custom/brand.json"],"key":"k"})';
    expect(sortSerializedManifestAssets(a)).toBe(sortSerializedManifestAssets(b));
    expect(sortSerializedManifestAssets(a)).toContain('"assets":["/_astro/x.js","/css/a11y.css","/custom/brand.json"]');
  });

  it('keeps escaped characters and leaves non-string arrays alone', () => {
    expect(sortSerializedManifestAssets('{"assets":["/b\\"q.css","/a.js"]}')).toBe('{"assets":["/a.js","/b\\"q.css"]}');
    expect(sortSerializedManifestAssets('{"assets":[{"src":"/b"},{"src":"/a"}]}')).toBe(
      '{"assets":[{"src":"/b"},{"src":"/a"}]}',
    );
  });

  it('counts unsorted lists in both compact and esbuild-reprinted form', () => {
    expect(countManifestAssetLists('{"assets":["/b","/a"]}')).toEqual({ total: 1, unsorted: 1 });
    expect(countManifestAssetLists('{ "assets": ["/b", "/a"] }')).toEqual({ total: 1, unsorted: 1 });
    expect(countManifestAssetLists('{ "assets": ["/a", "/b"] }')).toEqual({ total: 1, unsorted: 0 });
    expect(countManifestAssetLists('{"other":[]}')).toEqual({ total: 0, unsorted: 0 });
  });
});
