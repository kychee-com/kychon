/**
 * Parsing and up-front validation of a port's staged asset manifest. Kept
 * free of build-only imports (`@run402/astro/build-manifest` reads a Vite
 * virtual module) so the deploy script can validate before `astro build`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assetRefServabilityProblems, normalizeManifestAssetRef, type AssetManifest } from './kychon-image.js';

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
    // Port manifests (`assets-put-dir --manifest-out`, or a hand-trimmed copy)
    // may carry camelCase `cdnUrl` or plain `url` only; @run402/astro's image
    // renderer requires snake_case `cdn_url` and fails the build without it.
    // Normalize every entry (and variant) up front.
    const manifest = parsed as AssetManifest;
    const assets: AssetManifest['assets'] = {};
    for (const [key, ref] of Object.entries(manifest.assets)) assets[key] = normalizeManifestAssetRef(ref);
    return { ...manifest, assets };
  } catch {
    return null;
  }
}

export class StagedAssetManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StagedAssetManifestError';
  }
}

/**
 * Fail fast on a staged manifest the build cannot render: unparseable, not a
 * `version: 1` manifest, or an entry/variant with no servable URL even after
 * normalization. Without this the bake throws inside `<Run402Image>` mid-build
 * — on a fresh project that is the post-import rebuild of a paid deploy,
 * after the initial release has already been published (kychon#224).
 * No-op when no manifest is staged.
 */
export function assertStagedAssetManifestServable(root: string = process.cwd()): void {
  const path = join(root, STAGED_ASSET_MANIFEST_PATH);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  if (!parseAssetManifest(raw)) {
    throw new StagedAssetManifestError(
      `${STAGED_ASSET_MANIFEST_PATH} is not a valid asset manifest (expected JSON with "version": 1 and an "assets" object).`,
    );
  }
  const assets = (JSON.parse(raw) as { assets: Record<string, unknown> }).assets;
  const problems: string[] = [];
  for (const [key, ref] of Object.entries(assets)) {
    for (const problem of assetRefServabilityProblems(ref)) problems.push(`  ${key}: ${problem}`);
  }
  if (problems.length === 0) return;
  const shown = problems.slice(0, 20);
  if (problems.length > shown.length) shown.push(`  … and ${problems.length - shown.length} more`);
  throw new StagedAssetManifestError(
    `${STAGED_ASSET_MANIFEST_PATH} has ${problems.length} entr${problems.length === 1 ? 'y' : 'ies'} the build cannot render:\n${shown.join('\n')}\n` +
      'Every entry and variant needs a servable URL (`cdn_url`, or `url`/`cdnUrl` to normalize from). Re-stage the manifest from the uploader output.',
  );
}
