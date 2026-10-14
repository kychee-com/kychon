import { getBakeAssetManifest, inlineAssetManifest } from '../lib/bake-asset-manifest';

export const prerender = true;

/**
 * `CLIENT_ASSET_MANIFEST_URL`: the site manifest with only the fields the
 * browser reads (`inlineAssetManifest`). Fetched when a page has no inlined
 * manifest (SSR routes) or its inlined subset misses; the raw
 * `/_assets-manifest.json` stays as the deploy tooling's full record.
 * `null` when the build has no manifest.
 */
export function GET() {
  const manifest = getBakeAssetManifest();
  return new Response(JSON.stringify(manifest ? inlineAssetManifest(manifest) : null), {
    headers: { 'Content-Type': 'application/json' },
  });
}
