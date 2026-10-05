import { readFileSync } from 'node:fs';
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
  let raw: string;
  try {
    raw = readFileSync(join(root, STAGED_ASSET_MANIFEST_PATH), 'utf8');
  } catch {
    return null;
  }
  return parseAssetManifest(raw);
}

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
