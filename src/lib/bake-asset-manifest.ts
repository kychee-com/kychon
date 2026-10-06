import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getBuildTimeManifest } from '@run402/astro/build-manifest';
import { lookupAssetRef, normalizeManifestAssetRef, type AssetManifest } from './kychon-image.js';
import { parseAssetManifest, STAGED_ASSET_MANIFEST_PATH } from './staged-asset-manifest.js';

export {
  assertStagedAssetManifestServable,
  parseAssetManifest,
  STAGED_ASSET_MANIFEST_PATH,
  StagedAssetManifestError,
} from './staged-asset-manifest.js';

// Per-entry fields nothing in the browser reads: hashes, integrity, cache
// metadata, EXIF, and camelCase/immutable duplicates of URLs we keep in
// snake_case. `blurhash_data_url` (~1.2 KB each) is dropped too; the client
// decodes the short `blurhash` string instead.
const INLINE_DROP_FIELDS = new Set([
  'sha256', 'contentSha256', 'sri', 'etag', 'contentDigest', 'cdn', 'cacheKind',
  'size', 'size_bytes', 'visibility', 'metadata', 'image_info', 'image_exif', 'image_exif_policy',
  'cdnUrl', 'cdnMutableUrl', 'immutableUrl', 'thumbUrl', 'displayUrl', 'display_immutable_url',
  'blurhash_data_url',
]);
const INLINE_DROP_VARIANT_FIELDS = new Set(['sha256', 'immutable_url', 'cdn_immutable_url', 'url']);

/**
 * The manifest as inlined into every page's `<head>` (Portal.astro): the same
 * entries with fields the browser never reads stripped. A gallery-heavy port
 * (~300 photos) inlined the raw manifest at ~1.7 MB per page; this keeps it to
 * what `kychon-image.ts` needs (URLs, dims, blurhash, variants). The full file
 * is still served at `/_assets-manifest.json`.
 *
 * `generated_at` is blanked: `@run402/astro` stamps it with the build's
 * wall-clock time and nothing in the browser reads it, so carrying it would
 * change every baked page's bytes on every deploy even when no asset changed.
 */
export function inlineAssetManifest(manifest: AssetManifest): AssetManifest {
  const assets: AssetManifest['assets'] = {};
  for (const [key, ref] of Object.entries(manifest.assets)) {
    const slim: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(normalizeManifestAssetRef(ref))) {
      if (INLINE_DROP_FIELDS.has(field) || value == null) continue;
      if (field === 'variants' && value && typeof value === 'object') {
        const variants: Record<string, unknown> = {};
        for (const [kind, variant] of Object.entries(value as Record<string, Record<string, unknown>>)) {
          const v: Record<string, unknown> = {};
          for (const [vf, vv] of Object.entries(variant ?? {})) {
            // keep `url` only when it is the sole servable URL
            if (INLINE_DROP_VARIANT_FIELDS.has(vf) && !(vf === 'url' && !variant.cdn_url)) continue;
            v[vf] = vv;
          }
          variants[kind] = v;
        }
        slim.variants = variants;
        continue;
      }
      slim[field] = value;
    }
    assets[key] = slim as unknown as AssetManifest['assets'][string];
  }
  return { ...manifest, generated_at: '', assets };
}

/**
 * The slim manifest entries for just the given image URLs, keyed as
 * `lookupAssetRef` looks them up (`/assets/<basename>` → `<basename>`); null
 * when none resolve. Islands whose images come from build-time data (event
 * cards) take this as a prop so the server render resolves `/assets/...`
 * without the window manifest, and without serializing the whole manifest
 * into island props.
 */
export function pickAssetManifestEntries(
  manifest: AssetManifest | null,
  urls: Iterable<string | null | undefined>,
): AssetManifest | null {
  if (!manifest) return null;
  const assets: AssetManifest['assets'] = {};
  for (const url of urls) {
    const ref = lookupAssetRef(url, manifest);
    if (url && ref) assets[url.replace(/^\/assets\//, '')] = ref;
  }
  if (Object.keys(assets).length === 0) return null;
  return inlineAssetManifest({ ...manifest, assets });
}

/**
 * Read the port-staged manifest from `<root>/public/_assets-manifest.json`.
 * Null when the file is absent (demo builds, which use the integration's
 * `assetsDir` instead) or unreadable (the SSR Lambda at request time).
 */
export function readStagedAssetManifest(root: string = process.cwd()): AssetManifest | null {
  const path = join(root, STAGED_ASSET_MANIFEST_PATH);
  let mtimeMs: number;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    return null;
  }
  // The bake asks for the manifest several times per page; a port's can be
  // megabytes, so parse once per file version.
  const cached = stagedCache.get(path);
  if (cached && cached.mtimeMs === mtimeMs) return cached.manifest;
  let manifest: AssetManifest | null;
  try {
    manifest = parseAssetManifest(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
  stagedCache.set(path, { mtimeMs, manifest });
  return manifest;
}

const stagedCache = new Map<string, { mtimeMs: number; manifest: AssetManifest | null }>();

function tryGetBuildTimeManifest(): AssetManifest | null {
  // Build-time-only accessor (reads the integration's Vite virtual module);
  // it throws at request time inside the SSR Lambda.
  try {
    return getBuildTimeManifest();
  } catch {
    return null;
  }
}

/**
 * The asset manifest available while baking HTML. Demo builds get it from the
 * `@run402/astro` integration (`assetsDir`); ported sites upload their assets
 * separately and stage the manifest at `public/_assets-manifest.json`, which
 * the integration never sees — so fall back to that file. Without the
 * fallback, every `/assets/<basename>` reference on a port (logo, favicon,
 * hero, custom HTML) bakes as the literal path, which is not served.
 */
export function getBakeAssetManifest(): AssetManifest | null {
  return tryGetBuildTimeManifest() ?? readStagedAssetManifest();
}

/**
 * Largest manifest Portal inlines into every page's <head>. Demo manifests
 * are ~60 KB; a port with thousands of gallery photos produces several MB,
 * which would bloat every page. Above the cap the runtime fetches (and
 * caches) `/_assets-manifest.json` instead; baked HTML is unaffected because
 * the build resolves URLs against the full manifest server-side.
 */
export const MAX_INLINE_MANIFEST_BYTES = 256 * 1024;

/** The `window.__KYCHON_ASSET_MANIFEST = …;` script body, or "" when absent or too large. */
export function buildInlineManifestScript(
  manifest: AssetManifest | null,
  maxBytes: number = MAX_INLINE_MANIFEST_BYTES,
): string {
  if (!manifest) return '';
  // Escape `<` so a `</script>` in the data cannot close the tag.
  const json = JSON.stringify(manifest).replace(/</g, '\\u003c');
  if (Buffer.byteLength(json, 'utf8') > maxBytes) return '';
  // The flag tells page-render.ts this manifest came from the build (fresh),
  // not from a previous visit's localStorage seed.
  return `window.__KYCHON_ASSET_MANIFEST = ${json}; window.__KYCHON_ASSET_MANIFEST_INLINED = true;`;
}
