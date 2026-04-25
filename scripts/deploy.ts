/**
 * Single-project deploy entry point.
 *
 * Replaces the legacy `deploy.js` (CLI shell-out via execSync) with typed
 * @run402/sdk/node calls. Tracked in openspec/changes/deploy-sdk-migration/.
 *
 * Usage:
 *   npx tsx scripts/deploy.ts                      # full deploy
 *   npx tsx scripts/deploy.ts --dry-run            # assemble + log, no API call
 *   RUN402_PROJECT_ID=prj_xxx npx tsx scripts/deploy.ts
 *   SUBDOMAIN=eagles npx tsx scripts/deploy.ts
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { run402 } from "@run402/sdk/node";

import {
  buildAstro,
  collectFiles,
  collectFunctions,
  injectEnvJs,
  isDryRun,
  prettyPrintError,
  readMigrations,
  resolveDeployTarget,
  RLS_CONFIG,
  type BundleDeployOptions,
} from "./_lib.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = isDryRun(process.argv);

async function main(): Promise<void> {
  const r = run402();
  const target = await resolveDeployTarget(r);

  buildAstro();

  const distDir = join(ROOT, "dist");
  injectEnvJs(distDir, target.anonKey);

  const migrations = readMigrations(ROOT);
  const files = await collectFiles(distDir);
  const functions = await collectFunctions(join(ROOT, "functions"));

  const opts: BundleDeployOptions = {
    migrations,
    rls: RLS_CONFIG,
    files,
    subdomain: target.subdomain,
    inherit: true,
  };
  if (functions.length > 0) opts.functions = functions;

  console.log(
    `Deploying to project ${target.projectId} (subdomain: ${target.subdomain})...\n` +
      `  ${files.length} site files\n` +
      `  ${functions.length} functions`,
  );

  if (dryRun) {
    console.log("[dry-run] Would call apps.bundleDeploy with:");
    const summary = {
      projectId: target.projectId,
      filesCount: files.length,
      functionsCount: functions.length,
      functionsWithSchedule: functions.filter((f) => f.schedule).map((f) => `${f.name}=${f.schedule}`),
      migrationsBytes: migrations.length,
      rlsTables: opts.rls?.tables.length ?? 0,
      subdomain: opts.subdomain,
      inherit: opts.inherit,
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const result = await r.apps.bundleDeploy(target.projectId, opts);
  console.log("Deploy successful!");
  if (result.subdomain_url) console.log("Live at:", result.subdomain_url);
  if (result.deployment_id) console.log("Deployment id:", result.deployment_id);
  if (result.functions && result.functions.length > 0) {
    for (const fn of result.functions) {
      const sched = fn.schedule ? ` [schedule: ${fn.schedule}]` : "";
      console.log(`  fn ${fn.name}${sched} → ${fn.url}`);
    }
  }
}

try {
  await main();
} catch (err) {
  console.error(await prettyPrintError(err));
  process.exit(1);
}
