/**
 * CI deploy entry point for demo sites.
 *
 * Uses GitHub Actions OIDC (no stored private keys) and `patchDeploy` for
 * smart diffs — only changed site files and functions are uploaded.
 * Demo account bootstrapping is skipped because accounts persist across
 * deploys; run `deploy-demo.ts` locally when you need to re-bootstrap.
 *
 * Usage (GitHub Actions — see deploy-demos.yml):
 *   npx tsx scripts/deploy-ci.ts <eagles|silver-pines|barrio>
 *
 * Required GitHub Actions variables (set via setup-ci-bindings.ts):
 *   EAGLES_PROJECT_ID, EAGLES_ANON_KEY
 *   SILVER_PINES_PROJECT_ID, SILVER_PINES_ANON_KEY
 *   BARRIO_PROJECT_ID, BARRIO_ANON_KEY
 */

import { execSync } from "node:child_process";
import { join } from "node:path";

import { githubActionsCredentials, run402 } from "@run402/sdk/node";

import { findDemoPortalByDeployKey } from "../src/lib/demo-portals.ts";
import { DEMOS, assertDemoStaticAssets, copyAssets } from "./deploy-demo.ts";
import { ROOT, patchDeploy, prettyPrintError } from "./_lib.ts";

const key = process.argv[2];
const config = DEMOS[key ?? ""];
if (!config) {
  console.error(`Usage: tsx scripts/deploy-ci.ts <${Object.keys(DEMOS).join("|")}>`);
  process.exit(2);
}

const projectId = process.env[config.projectIdEnvVar];
const anonKey = process.env[config.anonKeyEnvVar];

if (!projectId) {
  console.error(`Missing GitHub Actions variable: ${config.projectIdEnvVar}`);
  console.error("Run scripts/setup-ci-bindings.ts locally to create bindings and print the variables to add.");
  process.exit(1);
}
if (!anonKey) {
  console.error(`Missing GitHub Actions variable: ${config.anonKeyEnvVar}`);
  console.error("Run scripts/setup-ci-bindings.ts locally to print the anon key variable to add.");
  process.exit(1);
}

console.log(`=== CI Deploy: ${config.displayName} ===`);
console.log(`Project: ${projectId}`);

assertDemoStaticAssets(config);
const cleanupAssets = copyAssets(join(ROOT, config.assetsDir), join(ROOT, "public/assets"));

const previousProject = process.env.KYCHON_PROJECT;
const previousPublicUrl = process.env.KYCHON_PUBLIC_URL;
const previousRun402ProjectId = process.env.RUN402_PROJECT_ID;
const demoPortal = findDemoPortalByDeployKey(key);
process.env.KYCHON_PROJECT = config.kychonProject;
process.env.KYCHON_PUBLIC_URL = demoPortal?.portalUrl ?? config.liveUrl;
// @run402/astro reads RUN402_PROJECT_ID at astro:config:setup time (inside
// the buildAstro() invocation that patchDeploy calls below). Without this
// set per-demo, the integration would target the local active project and
// upload all 3 demos' images to whichever project happens to be active.
process.env.RUN402_PROJECT_ID = projectId;

try {
  // Regenerate reset-demo.js from the full seed SQL (same as local deploy).
  console.log("Generating seed.sql for reset-demo embed...");
  execSync("npx tsx scripts/generate-seed-sql.ts", { stdio: "inherit", cwd: ROOT });
  console.log(`Regenerating ${config.resetDemoFile}...`);
  execSync(`node scripts/generate-reset-function.js seed.sql "${config.resetSchedule}" > ${config.resetDemoFile}`, {
    stdio: "inherit",
    cwd: ROOT,
  });

  // OIDC credentials — GitHub's token exchange replaces the local allowance
  // wallet. No private keys or allowance JSON needed in CI.
  const r = run402({
    credentials: githubActionsCredentials({ projectId }),
    disablePaidFetch: true, // no x402 payment wallet in CI
  });

  const result = await patchDeploy(r, {
    projectId,
    anonKey,
    subdomain: config.subdomain,
    excludeFunctions: ["check-expirations"],
    extraFunction: config.resetDemoFile,
    // Mirror the deploy-demo.ts pattern: explicit opt-in to continue past
    // confirmation-required platform warnings (e.g. DESTRUCTIVE_SITE_BULK_REMOVAL
    // when the JS chunk-hash cascade renames >10% of site paths after a
    // shared-import change like adding kychon-image.ts to 40+ chunks).
    // Default false; CI workflow sets RUN402_ALLOW_WARNINGS=true to confirm.
    allowWarnings: process.env.RUN402_ALLOW_WARNINGS === "true",
  });

  const elapsed = ((result.elapsedMs ?? 0) / 1000).toFixed(1);
  console.log(`\n=== ${config.displayName} CI deploy complete (${elapsed}s) ===`);
  // siteFilesChanged is -1 under the @run402/astro slice (CAS dedupes unchanged
  // bytes server-side, so the client-side changed count is unknown).
  const siteChangedLabel = result.siteFilesChanged < 0 ? "(astro slice, CAS-deduped)" : `${result.siteFilesChanged} changed, ${result.siteFilesSkipped} skipped`;
  console.log(`  Site:      ${siteChangedLabel}`);
  console.log(`  Functions: ${result.functionsChanged} changed, ${result.functionsSkipped} skipped`);
  console.log(`  Live at:   ${config.liveUrl}`);
} finally {
  cleanupAssets();
  if (previousProject === undefined) delete process.env.KYCHON_PROJECT;
  else process.env.KYCHON_PROJECT = previousProject;
  if (previousPublicUrl === undefined) delete process.env.KYCHON_PUBLIC_URL;
  else process.env.KYCHON_PUBLIC_URL = previousPublicUrl;
  if (previousRun402ProjectId === undefined) delete process.env.RUN402_PROJECT_ID;
  else process.env.RUN402_PROJECT_ID = previousRun402ProjectId;
}
