/**
 * Import a `kychon-bundle/v1` (from the `bundle.export` capability) into a
 * project as its initial import, then deploy the engine there.
 *
 * Target from env, as for `deploy.ts` (RUN402_PROJECT_ID / ANON_KEY / SUBDOMAIN).
 *
 * Usage:
 *   npx tsx scripts/import-bundle.ts <bundle.json>
 *   npx tsx scripts/import-bundle.ts <bundle.json> --reimport=<subdomain>   # replace an installed project's content
 *
 * Every asset is fetched and checked against its SHA-256 before anything is
 * written to the target; a mismatch names the asset and leaves the target as it was.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { run402 } from "@run402/sdk/node";

import { STAGED_ASSET_MANIFEST_PATH } from "../src/lib/bake-asset-manifest.ts";
import { prettyPrintError, ROOT, reimportFromArgv, resolveDeployTarget, runDeploy } from "./_lib.ts";
import {
  bundleToSeedSql,
  fetchVerifiedAssets,
  parseBundle,
  rewriteBundleUrls,
  targetAssetManifest,
  uploadBundleAssets,
} from "./content-bundle.ts";
import { assertReimportConfirmed, readInstallMarker } from "./initial-import.ts";

async function main(): Promise<void> {
  const bundlePath = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!bundlePath) throw new Error("Usage: npx tsx scripts/import-bundle.ts <bundle.json> [--reimport=<subdomain>]");
  const bundle = parseBundle(JSON.parse(readFileSync(resolve(bundlePath), "utf-8")));
  if (bundle.unresolved_asset_urls.length) {
    console.warn(
      `[bundle] ${bundle.unresolved_asset_urls.length} asset URL(s) could not be resolved at export and are kept as-is:\n  ${bundle.unresolved_asset_urls.join("\n  ")}`,
    );
  }

  const r = run402();
  const target = await resolveDeployTarget(r);
  const reimport = reimportFromArgv(process.argv);
  if (reimport) assertReimportConfirmed(target.subdomain, reimport.confirmSubdomain);
  const project = await r.project(target.projectId);

  // An installed project only takes a bundle as an explicit re-import.
  const marker = await readInstallMarker((sql) => project.projects.sql(sql));
  if (marker === undefined) throw new Error(`Could not read the install marker of ${target.projectId}; not importing.`);
  if (marker && !reimport) {
    throw new Error(
      `${target.subdomain} is already installed (${marker.import_source}). Pass --reimport=${target.subdomain} to replace its content.`,
    );
  }

  const stagedManifest = join(ROOT, STAGED_ASSET_MANIFEST_PATH);
  if (existsSync(stagedManifest)) {
    throw new Error(`${STAGED_ASSET_MANIFEST_PATH} already exists; move it aside before importing a bundle.`);
  }

  console.log(`[bundle] verifying ${bundle.assets.length} asset reference(s)`);
  const verified = await fetchVerifiedAssets(bundle);
  console.log(`[bundle] uploading ${verified.size} asset(s) to ${target.projectId}`);
  const { urlMap, manifestAssets } = await uploadBundleAssets(bundle, verified, (asset) =>
    project.assets.put(asset.key, asset.bytes, { contentType: asset.contentType, visibility: "public", immutable: true }),
  );

  const workDir = mkdtempSync(join(tmpdir(), "kychon-bundle-"));
  const seedFile = join(workDir, "bundle.seed.sql");
  writeFileSync(seedFile, bundleToSeedSql(rewriteBundleUrls(bundle.tables, urlMap)));
  if (Object.keys(manifestAssets).length) {
    writeFileSync(stagedManifest, targetAssetManifest(target.projectId, manifestAssets));
  }
  try {
    await runDeploy(r, {
      projectId: target.projectId,
      anonKey: target.anonKey,
      subdomain: target.subdomain,
      seedFile,
      ...(reimport ? { reimport } : {}),
    });
  } finally {
    rmSync(stagedManifest, { force: true });
    rmSync(workDir, { recursive: true, force: true });
  }
  console.log(`[bundle] imported ${bundle.source.site_url ?? "bundle"} into ${target.subdomain}`);
}

main().catch(async (err) => {
  console.error(await prettyPrintError(err));
  process.exit(1);
});
