/**
 * Single-shot deploy entry point.
 *
 * Assembles the bundle (migrations + RLS + functions + files + subdomain) and
 * ships it via `apps.bundleDeploy()` in one HTTP call. With @run402/sdk@1.44.0
 * the gateway accepts ~50MB+ payloads, so the previous batched flow
 * (deploy-batched.ts) is gone — a single call covers the production site and
 * every demo (eagles ~68MB, silver-pines, barrio-unido).
 *
 * Usage:
 *   npx tsx scripts/deploy.ts                                # production deploy
 *   npx tsx scripts/deploy.ts --dry-run                      # assemble + log, no API call
 *   RUN402_PROJECT_ID=prj_xxx SUBDOMAIN=eagles \
 *     SEED_FILE=demo/eagles/seed.sql \
 *     EXCLUDE_FUNCTIONS=check-expirations,reset-demo \
 *     npx tsx scripts/deploy.ts                              # demo deploy
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { run402 } from "@run402/sdk/node";

import {
  buildAstro,
  collectFiles,
  collectFunctions,
  formatBytes,
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

  const payloadBytes = files.reduce((sum, f) => sum + f.data.length, 0);
  const scheduledFns = functions.filter((f) => f.schedule);

  console.log(
    `Deploying to ${target.projectId} (subdomain: ${target.subdomain})\n` +
      `  ${files.length} site files (~${formatBytes(payloadBytes)} encoded)\n` +
      `  ${functions.length} functions (${scheduledFns.length} scheduled)\n` +
      `  ${migrations.length} migration bytes`,
  );

  if (dryRun) {
    console.log("\n[dry-run] Would call apps.bundleDeploy with:");
    const summary = {
      projectId: target.projectId,
      subdomain: opts.subdomain,
      inherit: opts.inherit,
      filesCount: files.length,
      filesEncodedBytes: payloadBytes,
      functionsCount: functions.length,
      functionsWithSchedule: scheduledFns.map((f) => `${f.name}=${f.schedule}`),
      migrationsBytes: migrations.length,
      rlsTemplate: opts.rls?.template,
      rlsTables: opts.rls?.tables.length ?? 0,
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const startedAt = Date.now();
  const result = await r.apps.bundleDeploy(target.projectId, opts);
  const elapsedMs = Date.now() - startedAt;

  console.log(`\nDeploy successful in ${(elapsedMs / 1000).toFixed(1)}s`);
  if (result.subdomain_url) console.log(`  Live at: ${result.subdomain_url}`);
  else if (result.site_url) console.log(`  Live at: ${result.site_url}`);
  if (result.deployment_id) console.log(`  Deployment id: ${result.deployment_id}`);

  const mig = result.migrations_result;
  if (mig && (mig.tables_created.length > 0 || mig.columns_added.length > 0)) {
    console.log(`  Migrations: ${mig.status}`);
    if (mig.tables_created.length > 0) {
      console.log(`    + tables: ${mig.tables_created.join(", ")}`);
    }
    if (mig.columns_added.length > 0) {
      console.log(`    + columns: ${mig.columns_added.join(", ")}`);
    }
  }

  if (result.functions && result.functions.length > 0) {
    console.log("  Functions:");
    for (const fn of result.functions) {
      const sched = fn.schedule ? ` [schedule: ${fn.schedule}]` : "";
      console.log(`    ${fn.name}${sched} → ${fn.url}`);
    }
  }
}

try {
  await main();
} catch (err) {
  console.error(await prettyPrintError(err));
  process.exit(1);
}
