import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getBuildTimeManifest } from '@run402/astro/build-manifest';
import type { AssetManifest } from './kychon-image.js';

/**
 * Where a port stages its uploaded-asset manifest before `astro build`
 * (`run402:project -- assets-put-dir ... --manifest-out public/_assets-manifest.json`).
 * Astro copies it to `dist/_assets-manifest.json`, served at
 * `/_assets-manifest.json`.
 */
export const STAGED_ASSET_MANIFEST_PATH = join('public', '_assets-manifest.json');

/** Parse a manifest JSON string; null unless it is a `version: 1` manifest. */
export function parseAssetManifest(raw: string): AssetManifest | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as { version?: unknown; assets?: unknown };
    if (candidate.version !== 1 || !candidate.assets || typeof candidate.assets !== 'object') return null;
    return parsed as AssetManifest;
  } catch {
    return null;
  }
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
  return `window.__KYCHON_ASSET_MANIFEST = ${json};`;
}
