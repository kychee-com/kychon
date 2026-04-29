/**
 * Per-demo deploy orchestrator.
 *
 * Replaces the per-demo `bash demo/<name>/deploy.sh` wrappers. For one
 * demo it: copies demo assets into `public/assets/` (with try/finally
 * cleanup), calls `runDeploy()` with the demo's seed/exclude/extra
 * config, then bootstraps the demo accounts via the SDK and REST.
 *
 * Usage (rarely invoked directly — `deploy-all.ts` is the entry point):
 *   npx tsx scripts/deploy-demo.ts <name>
 *   <name> ∈ { eagles, silver-pines, barrio }
 */

import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { run402 } from "@run402/sdk/node";

import { bootstrapDemoAccounts } from "./bootstrap-demo.ts";
import { prettyPrintError, ROOT, runDeploy, type Run402Instance } from "./_lib.ts";

export interface DemoConfig {
  /** Display name for log headers ("Eagles", "Silver Pines", "Barrio Unido"). */
  displayName: string;
  /** Env var holding the project id (e.g. EAGLES_PROJECT_ID). */
  projectIdEnvVar: string;
  /** Run402 subdomain (e.g. "eagles", "silver-pines", "barrio-unido"). */
  subdomain: string;
  /** Public hostname for the "Live at:" footer. */
  liveUrl: string;
  /** Demo-specific assets dir, copied into public/assets/ before the build. */
  assetsDir: string;
  /** Path to the demo's seed.sql (relative to repo root). */
  seedFile: string;
  /** Path to the demo's reset-demo.js (relative to repo root). */
  resetDemoFile: string;
}

export const DEMOS: Record<string, DemoConfig> = {
  eagles: {
    displayName: "Eagles",
    projectIdEnvVar: "EAGLES_PROJECT_ID",
    subdomain: "eagles",
    liveUrl: "https://eagles.kychon.com",
    assetsDir: "demo/eagles/assets",
    seedFile: "demo/eagles/seed.sql",
    resetDemoFile: "demo/eagles/reset-demo.js",
  },
  "silver-pines": {
    displayName: "Silver Pines",
    projectIdEnvVar: "SILVER_PINES_PROJECT_ID",
    subdomain: "silver-pines",
    liveUrl: "https://silver-pines.kychon.com",
    assetsDir: "demo/silver-pines/assets",
    seedFile: "demo/silver-pines/seed.sql",
    resetDemoFile: "demo/silver-pines/reset-demo.js",
  },
  barrio: {
    displayName: "Barrio Unido",
    projectIdEnvVar: "BARRIO_PROJECT_ID",
    subdomain: "barrio-unido",
    liveUrl: "https://barrio.kychon.com",
    assetsDir: "demo/barrio-unido/assets",
    seedFile: "demo/barrio-unido/seed.sql",
    resetDemoFile: "demo/barrio-unido/reset-demo.js",
  },
};

/**
 * Copy `<src>/*` (top-level files only, no recursion — matches `cp src/* dst/`)
 * into `<dst>/`. Returns a cleanup function that removes `<dst>` if it was
 * created here. Caller must run cleanup in a try/finally.
 */
function copyAssets(src: string, dst: string): () => void {
  if (!existsSync(src)) return () => undefined;
  console.log("Copying demo assets into public/assets...");
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    copyFileSync(join(src, name), join(dst, name));
  }
  return () => {
    if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  };
}

export async function deployOneDemo(r: Run402Instance, key: string): Promise<void> {
  const config = DEMOS[key];
  if (!config) {
    throw new Error(
      `Unknown demo "${key}". Valid: ${Object.keys(DEMOS).join(", ")}`,
    );
  }

  const projectId = process.env[config.projectIdEnvVar];
  if (!projectId) {
    throw new Error(`Set ${config.projectIdEnvVar} env var (in .env or shell).`);
  }

  console.log(`=== ${config.displayName} Deploy ===`);
  console.log(`Project: ${projectId}`);

  const cleanupAssets = copyAssets(
    join(ROOT, config.assetsDir),
    join(ROOT, "public/assets"),
  );

  try {
    const keys = await r.projects.keys(projectId);
    const anonKey = keys.anon_key;
    if (!anonKey) throw new Error(`No anon_key for project ${projectId}`);

    await runDeploy(r, {
      projectId,
      anonKey,
      subdomain: config.subdomain,
      seedFile: config.seedFile,
      excludeFunctions: ["check-expirations"],
      extraFunction: config.resetDemoFile,
    });

    console.log("");
    await bootstrapDemoAccounts(r, projectId);

    console.log(`\n=== ${config.displayName} deploy complete ===`);
    console.log(`Live at: ${config.liveUrl}`);
  } finally {
    cleanupAssets();
  }
}

// CLI entry — only when invoked directly.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const arg = process.argv[2];
  if (!arg) {
    console.error(`Usage: tsx scripts/deploy-demo.ts <${Object.keys(DEMOS).join("|")}>`);
    process.exit(2);
  }
  try {
    const r = run402();
    await deployOneDemo(r, arg);
  } catch (err) {
    console.error(await prettyPrintError(err));
    process.exit(1);
  }
}
