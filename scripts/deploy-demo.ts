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

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import { run402 } from "@run402/sdk/node";

import { findDemoPortalByDeployKey } from "../src/lib/demo-portals.ts";
import { bootstrapDemoAccounts } from "./bootstrap-demo.ts";
import { prettyPrintError, ROOT, runDeploy, type Run402Instance, type RunDeployResult } from "./_lib.ts";

export interface DemoConfig {
  /** Display name for log headers ("Eagles", "Silver Pines", "Barrio Unido"). */
  displayName: string;
  /** Env var holding the project id (e.g. EAGLES_PROJECT_ID). */
  projectIdEnvVar: string;
  /**
   * Env var holding the Run402 anon key. The anon key is a public JWT
   * already embedded in every deployed env.js — safe to store as a GitHub
   * Actions variable (not a secret). Used by CI deploys in place of the
   * local keystore lookup that the allowance-wallet path uses.
   */
  anonKeyEnvVar: string;
  /** Run402 subdomain (e.g. "eagles", "silver-pines", "barrio-unido"). */
  subdomain: string;
  /** Public hostname for the "Live at:" footer. */
  liveUrl: string;
  /** Demo-specific assets dir, copied into public/assets/ before the build. */
  assetsDir: string;
  /**
   * KYCHON_PROJECT value — picks the typed seed module under
   * `src/seeds/{project}.ts`. The bake + the seed-SQL generator both read
   * this. Maps 1:1 with the demo's TS seed.
   */
  kychonProject: string;
  /** Path to the demo's reset-demo.js (relative to repo root). */
  resetDemoFile: string;
}

export interface DeployOneDemoOptions {
  /** Assemble and validate the deploy without mutating Run402. */
  dryRun?: boolean;
  /** Continue past confirmation-required Run402 deploy warnings. */
  allowWarnings?: boolean;
}

export const DEMOS: Record<string, DemoConfig> = {
  eagles: {
    displayName: "Eagles",
    projectIdEnvVar: "EAGLES_PROJECT_ID",
    anonKeyEnvVar: "EAGLES_ANON_KEY",
    subdomain: "eagles",
    liveUrl: "https://eagles.kychon.com",
    assetsDir: "demo/eagles/assets",
    kychonProject: "eagles",
    resetDemoFile: "demo/eagles/reset-demo.js",
  },
  "silver-pines": {
    displayName: "Silver Pines",
    projectIdEnvVar: "SILVER_PINES_PROJECT_ID",
    anonKeyEnvVar: "SILVER_PINES_ANON_KEY",
    subdomain: "silver-pines",
    liveUrl: "https://silver-pines.kychon.com",
    assetsDir: "demo/silver-pines/assets",
    kychonProject: "silver-pines",
    resetDemoFile: "demo/silver-pines/reset-demo.js",
  },
  barrio: {
    displayName: "Barrio Unido",
    projectIdEnvVar: "BARRIO_PROJECT_ID",
    anonKeyEnvVar: "BARRIO_ANON_KEY",
    subdomain: "barrio-unido",
    liveUrl: "https://barrio.kychon.com",
    assetsDir: "demo/barrio-unido/assets",
    kychonProject: "barrio-unido",
    resetDemoFile: "demo/barrio-unido/reset-demo.js",
  },
};

const ASSET_REF_RE = /["'`]\/assets\/([^"'`?#]+)(?:[?#][^"'`]*)?["'`]/g;

export function findMissingDemoStaticAssets(config: DemoConfig): string[] {
  const assetRoot = join(ROOT, config.assetsDir);
  const sourceFiles = [
    join(ROOT, "src/seeds", `${config.kychonProject}.ts`),
    join(ROOT, dirname(config.assetsDir), "seed.sql"),
  ].filter((path) => existsSync(path));
  const refs = new Map<string, Set<string>>();

  for (const sourceFile of sourceFiles) {
    const source = readFileSync(sourceFile, "utf8");
    for (const match of source.matchAll(ASSET_REF_RE)) {
      const assetName = match[1];
      if (!assetName) continue;
      const sources = refs.get(assetName) || new Set<string>();
      sources.add(sourceFile.replace(`${ROOT}/`, ""));
      refs.set(assetName, sources);
    }
  }

  return Array.from(refs.entries())
    .filter(([assetName]) => !existsSync(join(assetRoot, assetName)))
    .map(
      ([assetName, sources]) =>
        `/assets/${assetName} referenced by ${Array.from(sources).join(", ")} is missing from ${config.assetsDir}/${assetName}`,
    )
    .sort();
}

export function assertDemoStaticAssets(config: DemoConfig): void {
  const missing = findMissingDemoStaticAssets(config);
  if (missing.length === 0) return;

  throw new Error(
    `Demo static asset references are missing for ${config.displayName}:\n` +
      missing.map((asset) => `  - ${asset}`).join("\n"),
  );
}

/**
 * Copy `<src>/*` (top-level files only, no recursion — matches `cp src/* dst/`)
 * into `<dst>/`. Returns a cleanup function that removes `<dst>` if it was
 * created here. Caller must run cleanup in a try/finally.
 *
 * `demo/<name>/assets/` is gitignored and machine-local (`generate-images.sh`
 * produces it from OPENAI_API_KEY). Fail loud if it's missing for a demo
 * deploy — silently skipping ships demo sites with broken /assets/ refs.
 */
export function copyAssets(src: string, dst: string): () => void {
  if (!existsSync(src)) {
    throw new Error(
      `Demo assets dir not found: ${src}\n` +
        "  Generate it via the demo's `bash demo/<name>/generate-images.sh` (needs OPENAI_API_KEY),\n" +
        "  or symlink it from another checkout that already has the images.",
    );
  }
  const entries = readdirSync(src);
  if (entries.length === 0) {
    throw new Error(
      `Demo assets dir is empty: ${src}\n` +
        "  Did `generate-images.sh` complete? Check for a partial run.",
    );
  }
  console.log(`Copying ${entries.length} demo asset(s) into public/assets...`);
  if (existsSync(dst) && realpathSync(dst) === realpathSync(src)) {
    console.log("public/assets already points at the demo asset directory; preserving existing path.");
    return () => {};
  }
  if (existsSync(dst)) {
    throw new Error(
      `Refusing to overwrite existing demo asset destination: ${dst}\n` +
        "  Remove or move it first, or point it at the demo asset directory.",
    );
  }
  mkdirSync(dst, { recursive: true });
  for (const name of entries) {
    copyFileSync(join(src, name), join(dst, name));
  }
  return () => {
    if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  };
}

export async function deployOneDemo(
  r: Run402Instance,
  key: string,
  opts: DeployOneDemoOptions = {},
): Promise<RunDeployResult> {
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

  assertDemoStaticAssets(config);
  const cleanupAssets = copyAssets(
    join(ROOT, config.assetsDir),
    join(ROOT, "public/assets"),
  );

  // composable-layout: pick the matching TS seed module so that:
  //   1) the pre-build generator (`tsx scripts/generate-seed-sql.ts` chained
  //      into `npm run build`) emits the demo's chrome+structural seed;
  //   2) Portal.astro's bake reads the same module via `getActiveProjectSeed()`.
  const previousProject = process.env.KYCHON_PROJECT;
  const previousPublicUrl = process.env.KYCHON_PUBLIC_URL;
  const demoPortal = findDemoPortalByDeployKey(key);
  process.env.KYCHON_PROJECT = config.kychonProject;
  process.env.KYCHON_PUBLIC_URL = demoPortal?.portalUrl || config.liveUrl;

  try {
    const keys = await r.projects.keys(projectId);
    const anonKey = keys.anon_key;
    if (!anonKey) throw new Error(`No anon_key for project ${projectId}`);

    // Regenerate reset-demo.js from the full combined seed.sql (which has
    // chrome rows + page-specific main + demo extras). The hourly reset
    // function wipes `sections` and re-runs this embedded seed; without this
    // step it re-runs a stale embedded SQL that lacks chrome, leaving the
    // header zone empty after the next reset tick. generate-seed-sql.ts is
    // run by buildAstro inside runDeploy, but we need seed.sql ON DISK first
    // so we can embed it — invoke the generator here too. Re-invoking it
    // inside runDeploy is a no-op (same KYCHON_PROJECT, same content).
    console.log("Generating seed.sql for reset-demo embed...");
    execSync("npx tsx scripts/generate-seed-sql.ts", {
      stdio: "inherit",
      cwd: ROOT,
    });
    console.log(`Regenerating ${config.resetDemoFile} from full seed.sql...`);
    execSync(
      `node scripts/generate-reset-function.js seed.sql > ${config.resetDemoFile}`,
      { stdio: "inherit", cwd: ROOT },
    );

    const result = await runDeploy(r, {
      projectId,
      anonKey,
      subdomain: config.subdomain,
      // No seedFile — runDeploy reads the generated `./seed.sql` which now
      // contains the chrome blocks + the demo's `extraSqlFile` content.
      excludeFunctions: ["check-expirations"],
      extraFunction: config.resetDemoFile,
      allowWarnings: opts.allowWarnings ?? process.env.RUN402_ALLOW_WARNINGS === "true",
      dryRun: opts.dryRun === true,
      // Demos re-generate reset-demo.js on every run; the other 11 functions
      // only change when the engine version bumps. Patch mode skips unchanged
      // function uploads and only sends reset-demo (and any engine-bumped fns).
      patchFunctions: true,
    });

    if (opts.dryRun !== true) {
      console.log("");
      await bootstrapDemoAccounts(r, projectId);
    }

    console.log(`\n=== ${config.displayName} deploy complete ===`);
    console.log(`Live at: ${config.liveUrl}`);
    return result;
  } finally {
    cleanupAssets();
    if (previousProject === undefined) delete process.env.KYCHON_PROJECT;
    else process.env.KYCHON_PROJECT = previousProject;
    if (previousPublicUrl === undefined) delete process.env.KYCHON_PUBLIC_URL;
    else process.env.KYCHON_PUBLIC_URL = previousPublicUrl;
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
