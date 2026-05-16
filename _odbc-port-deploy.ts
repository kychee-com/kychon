/**
 * One-shot ODBC port re-deploy shim.
 *
 * Reuses the existing pinned project prj_1777563179844_1095 and writes the
 * upgraded seed.sql (with composable-layout blocks) directly. No reset-demo
 * (this is a real port, not a demo), no bootstrap-demo accounts.
 *
 * Run from kychon repo root:
 *   npx tsx _odbc-port-deploy.ts
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { run402 } from "@run402/sdk/node";

import { sanitizeRichHtmlServer } from "./src/lib/sanitize-html.ts";
import { ROOT, runDeploy } from "./scripts/_lib.ts";

const PROJECT_ID = "prj_1777563179844_1095";
const SUBDOMAIN = "odbc-port";
const PORT_SEED = "/tmp/odbc-port-rerun/seed.sql";
const KYCHON_SEED = join(ROOT, "_odbc-port.seed.sql");

async function main() {
  if (!existsSync(PORT_SEED)) {
    throw new Error(`Port seed not found at ${PORT_SEED}`);
  }
  // Stage the seed inside ROOT so runDeploy's relative resolution finds it.
  copyFileSync(PORT_SEED, KYCHON_SEED);
  const rawSeed = readFileSync(KYCHON_SEED, "utf-8");
  const sanitizedSeed = sanitizeRichHtmlServer(rawSeed);
  if (sanitizedSeed !== rawSeed) {
    writeFileSync(KYCHON_SEED, sanitizedSeed);
  }
  const seedSize = sanitizedSeed.length;
  console.log(`Staged seed: ${KYCHON_SEED} (${seedSize} bytes)`);

  const r = run402();

  const keys = await r.projects.keys(PROJECT_ID);
  const anonKey = keys.anon_key;
  if (!anonKey) throw new Error(`No anon_key for ${PROJECT_ID}`);

  console.log(`Deploying ODBC port to ${PROJECT_ID} (subdomain: ${SUBDOMAIN})`);
  const result = await runDeploy(r, {
    projectId: PROJECT_ID,
    anonKey,
    subdomain: SUBDOMAIN,
    seedFile: "_odbc-port.seed.sql",
    chromeSnapshot: "fixtures/chrome/odbc.chrome-snapshot.json",
    excludeFunctions: ["check-expirations"],
  });

  console.log(`\nDeploy result:`);
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nLive at: https://${SUBDOMAIN}.run402.com`);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
