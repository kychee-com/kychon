/**
 * Production deploy entry point.
 *
 * Reads target from env (RUN402_PROJECT_ID / ANON_KEY / SUBDOMAIN) and
 * delegates to `runDeploy()` in `_lib.ts`. Demo deploys go through
 * `deploy-demo.ts` instead.
 *
 * Usage:
 *   npx tsx scripts/deploy.ts                                 # production deploy
 *   npx tsx scripts/deploy.ts --dry-run                       # assemble + log, no API call
 */

import { run402 } from "@run402/sdk/node";

import {
  isDryRun,
  prettyPrintError,
  resolveDeployTarget,
  runDeploy,
  type RunDeployOptions,
} from "./_lib.ts";

async function main(): Promise<void> {
  const r = run402();
  const target = await resolveDeployTarget(r);

  const opts: RunDeployOptions = {
    projectId: target.projectId,
    anonKey: target.anonKey,
    subdomain: target.subdomain,
    dryRun: isDryRun(process.argv),
  };
  const seedFile = process.env["SEED_FILE"];
  if (seedFile) opts.seedFile = seedFile;
  const exclude = process.env["EXCLUDE_FUNCTIONS"];
  if (exclude) opts.excludeFunctions = exclude.split(",").map((s) => s.trim());
  const extra = process.env["EXTRA_FUNCTION"];
  if (extra) opts.extraFunction = extra;

  await runDeploy(r, opts);
}

try {
  await main();
} catch (err) {
  console.error(await prettyPrintError(err));
  process.exit(1);
}
