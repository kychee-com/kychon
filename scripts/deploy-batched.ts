/**
 * Batched deploy for large asset sets (the demo deploys: eagles, silver-pines,
 * barrio). Splits site files into ~25MB chunks and deploys each with
 * `inherit: true` so the previous deployment's files are preserved during the
 * gap.
 *
 * Replaces the legacy `deploy-batched.js` (CLI shell-out via execSync) with
 * typed @run402/sdk/node calls. Tracked in
 * openspec/changes/deploy-sdk-migration/.
 *
 * NOTE: the batching loop is a temp patch. Once a single-shot bundleDeploy
 * against a production-sized (~68MB) payload is verified reliable, this file
 * should collapse into the same flow as deploy.ts. See spec
 * `Deploy batching is preserved pending single-shot verification` for the
 * supersession contract.
 *
 * Usage:
 *   RUN402_PROJECT_ID=prj_xxx SUBDOMAIN=eagles npx tsx scripts/deploy-batched.ts
 *   npx tsx scripts/deploy-batched.ts --dry-run
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { run402 } from "@run402/sdk/node";

import {
  buildAstro,
  collectFilesWithSize,
  collectFunctions,
  IMAGE_EXTS,
  injectEnvJs,
  isDryRun,
  prettyPrintError,
  readMigrations,
  resolveDeployTarget,
  RLS_CONFIG,
  type BundleDeployOptions,
  type SiteFile,
  type SizedSiteFile,
} from "./_lib.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = isDryRun(process.argv);

/** Max bytes per file batch before base64 expansion. Matches legacy script. */
const MAX_BATCH_BYTES = 25 * 1024 * 1024;

/**
 * Slice an array of sized files into batches under `maxBytes`. Each batch is a
 * plain SiteFile[] (sizes dropped — the SDK doesn't need them).
 *
 * If a single file exceeds `maxBytes`, it gets its own batch (we don't split
 * within a file).
 */
function sliceBySize(items: readonly SizedSiteFile[], maxBytes: number): SiteFile[][] {
  const batches: SiteFile[][] = [];
  let cur: SiteFile[] = [];
  let size = 0;
  for (const item of items) {
    if (size + item.bytes > maxBytes && cur.length > 0) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(item.file);
    size += item.bytes;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

async function main(): Promise<void> {
  const r = run402();
  const target = await resolveDeployTarget(r);

  buildAstro();

  const distDir = join(ROOT, "dist");
  injectEnvJs(distDir, target.anonKey);

  const migrations = readMigrations(ROOT);
  const all = await collectFilesWithSize(distDir);
  const functions = await collectFunctions(join(ROOT, "functions"));

  // Split images vs code: images go in size-bounded batches; code goes last
  const images = all.filter((s) => IMAGE_EXTS.test(s.file.file));
  const code = all.filter((s) => !IMAGE_EXTS.test(s.file.file));
  const imageBatches = sliceBySize(images, MAX_BATCH_BYTES);

  const totalCalls = (imageBatches.length === 0 ? 1 : imageBatches.length + 1);
  const totalImageBytes = images.reduce((s, f) => s + f.bytes, 0);

  console.log(
    `Deploying to project ${target.projectId} (subdomain: ${target.subdomain})\n` +
      `  ${images.length} images in ${imageBatches.length} batch(es) ` +
      `(~${(totalImageBytes / 1024 / 1024).toFixed(1)}MB)\n` +
      `  ${code.length} code files + ${functions.length} functions in final batch`,
  );

  if (dryRun) {
    console.log("[dry-run] Would issue these SDK calls:");
    const summary = {
      projectId: target.projectId,
      totalCalls,
      imageBatches: imageBatches.map((b, i) => ({
        idx: i,
        files: b.length,
        bytes: imageBatches[i]?.length ?? 0,
      })),
      codeFiles: code.length,
      functions: functions.length,
      migrationsBytes: migrations.length,
      rlsTables: RLS_CONFIG.tables.length,
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // Special case: no images — single bundleDeploy with all code files
  if (imageBatches.length === 0) {
    const opts: BundleDeployOptions = {
      migrations,
      rls: RLS_CONFIG,
      files: code.map((s) => s.file),
      subdomain: target.subdomain,
      inherit: true,
    };
    if (functions.length > 0) opts.functions = functions;
    console.log(`\n--- Batch 1/1: code + migrations + functions (${code.length} files) ---`);
    const result = await r.apps.bundleDeploy(target.projectId, opts);
    console.log("  OK");
    if (result.subdomain_url) console.log("\nLive at:", result.subdomain_url);
    return;
  }

  // Batch 1 of N: bundleDeploy with metadata + first image slice
  const firstBatch = imageBatches[0];
  if (!firstBatch) throw new Error("internal: imageBatches non-empty but [0] is undefined");
  const firstOpts: BundleDeployOptions = {
    migrations,
    rls: RLS_CONFIG,
    files: firstBatch,
    subdomain: target.subdomain,
    inherit: true,
  };
  if (functions.length > 0) firstOpts.functions = functions;

  console.log(
    `\n--- Batch 1/${totalCalls}: ${firstBatch.length} images + migrations + rls + functions ---`,
  );
  await r.apps.bundleDeploy(target.projectId, firstOpts);
  console.log("  OK");

  // Batches 2..N-1: file-only sites.deploy for remaining image slices
  for (let i = 1; i < imageBatches.length; i++) {
    const batch = imageBatches[i];
    if (!batch) continue;
    console.log(`\n--- Batch ${i + 1}/${totalCalls}: ${batch.length} images ---`);
    await r.sites.deploy(target.projectId, { files: batch, inherit: true });
    console.log("  OK");
  }

  // Final batch: code files via sites.deploy
  console.log(
    `\n--- Batch ${totalCalls}/${totalCalls}: ${code.length} code files ---`,
  );
  const finalResult = await r.sites.deploy(target.projectId, {
    files: code.map((s) => s.file),
    inherit: true,
  });
  console.log("  OK");
  console.log("\nDeploy complete!");
  if (finalResult.url) console.log("Live at:", finalResult.url);
  if (finalResult.deployment_id) console.log("Deployment id:", finalResult.deployment_id);
}

try {
  await main();
} catch (err) {
  console.error(await prettyPrintError(err));
  process.exit(1);
}
