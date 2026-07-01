/**
 * Production deploy entry point.
 *
 * Reads target from env (RUN402_PROJECT_ID / ANON_KEY / SUBDOMAIN) and
 * delegates to `runDeploy()` in `_lib.ts`. Demo deploys go through
 * `deploy-demo.ts` instead.
 *
 * Usage:
 *   npx tsx scripts/deploy.ts                                 # production deploy
 *   npx tsx scripts/deploy.ts --check                         # assemble + log, no API call
 *   npx tsx scripts/deploy.ts --print-spec                    # print ReleaseSpec JSON, no API call
 *   npx tsx scripts/deploy.ts --plan                          # gateway-reviewed plan, no deploy
 *   npx tsx scripts/deploy.ts --require-plan plan_...         # exact reviewed apply
 */

import { run402 } from "@run402/sdk/node";

import {
  isDryRun,
  deployModeFromArgv,
  prettyPrintError,
  reviewedPlanRequirementFromArgv,
  resolveDeployTarget,
  runDeploy,
  type RunDeployOptions,
} from "./_lib.ts";

async function main(): Promise<void> {
  const r = run402();
  const target = await resolveDeployTarget(r);
  const deployMode = deployModeFromArgv(process.argv);
  const requiredPlan = reviewedPlanRequirementFromArgv(process.argv);

  const opts: RunDeployOptions = {
    projectId: target.projectId,
    anonKey: target.anonKey,
    subdomain: target.subdomain,
    dryRun: isDryRun(process.argv),
    allowWarnings: process.env["RUN402_ALLOW_WARNINGS"] === "true",
  };
  if (deployMode) opts.deployMode = deployMode;
  if (requiredPlan) opts.requiredPlan = requiredPlan;
  const seedFile = process.env["SEED_FILE"];
  if (seedFile) opts.seedFile = seedFile;
  const exclude = process.env["EXCLUDE_FUNCTIONS"];
  if (exclude) opts.excludeFunctions = exclude.split(",").map((s) => s.trim());
  const extra = process.env["EXTRA_FUNCTION"];
  if (extra) opts.extraFunction = extra;
  // Force EXPLICIT public_paths: enumerates every prerendered route into the
  // release's static manifest so it serves on a bound subdomain (not just the
  // deployment URL). Implicit mode only manifests `/` + hashed assets, so copied
  // sites' content slugs 404/fall through to SSR on the canonical (kychon-concierge#82).
  if (process.env["RUN402_EXPLICIT_PUBLIC_PATHS"] === "true") opts.publicPathOverrides = {};

  await runDeploy(r, opts);
}

try {
  await main();
} catch (err) {
  console.error(await prettyPrintError(err));
  process.exit(1);
}
