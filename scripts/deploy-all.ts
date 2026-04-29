/**
 * Deploy all Kychon DEMO sites to their Run402 projects.
 *
 * Replaces `deploy-all.sh`. Project IDs come from env vars (typically
 * loaded from `.env` via Node's `--env-file` flag in `deploy-all.sh`).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/deploy-all.ts                   # all 3
 *   npx tsx --env-file=.env scripts/deploy-all.ts eagles            # one
 *   npx tsx --env-file=.env scripts/deploy-all.ts silver-pines      # one
 *   npx tsx --env-file=.env scripts/deploy-all.ts barrio            # one
 *
 * The marketing site (kychon.com) lives in the private operator repo
 * `kychee-com/kychon-private`; deploy that separately.
 */

import { run402 } from "@run402/sdk/node";

import { DEMOS, deployOneDemo } from "./deploy-demo.ts";
import { prettyPrintError } from "./_lib.ts";

const TARGETS = Object.keys(DEMOS);

async function main(): Promise<void> {
  const arg = process.argv[2];
  let targets: string[];
  if (!arg || arg === "all") {
    targets = TARGETS;
  } else if (TARGETS.includes(arg)) {
    targets = [arg];
  } else {
    throw new Error(
      `Unknown target "${arg}". Valid: all, ${TARGETS.join(", ")}`,
    );
  }

  // Validate all required env vars upfront so we fail fast before doing any
  // expensive work (like an asset copy or astro build).
  for (const t of targets) {
    const v = DEMOS[t]?.projectIdEnvVar;
    if (!v) continue;
    if (!process.env[v]) {
      throw new Error(`Set ${v} env var (in .env or shell) — needed for "${t}".`);
    }
  }

  console.log("============================================");
  console.log("  Kychon — Deploy Demo Sites");
  console.log("============================================\n");
  for (const t of TARGETS) {
    const c = DEMOS[t];
    if (!c) continue;
    const id = process.env[c.projectIdEnvVar] ?? "<unset>";
    console.log(`  ${c.displayName.padEnd(13)} ${id} → ${c.liveUrl}`);
  }
  console.log(`\n  Target: ${arg ?? "all"}\n`);
  console.log(
    "  Marketing site (kychon.com) lives in kychee-com/kychon-private;",
  );
  console.log("  deploy it separately from that repo.");
  console.log("============================================\n");

  const r = run402();
  const failed: string[] = [];
  for (const [i, t] of targets.entries()) {
    const c = DEMOS[t];
    if (!c) continue;
    console.log(`\n>>> [${i + 1}/${targets.length}] Deploying ${c.displayName} demo...`);
    console.log("--------------------------------------------");
    try {
      await deployOneDemo(r, t);
      console.log(`>>> ${c.displayName}: OK`);
    } catch (err) {
      console.error(await prettyPrintError(err));
      console.error(`>>> ${c.displayName}: FAILED`);
      failed.push(c.displayName);
    }
  }

  console.log("\n============================================");
  console.log("  Deploy Summary");
  console.log("============================================");
  if (failed.length === 0) {
    console.log("  All demo sites deployed successfully!");
    for (const t of targets) {
      const c = DEMOS[t];
      if (c) console.log(`  ${c.displayName.padEnd(13)} ${c.liveUrl}`);
    }
    console.log("============================================");
    return;
  }
  console.log(`  FAILURES: ${failed.join(", ")}`);
  console.log("============================================");
  process.exit(1);
}

try {
  await main();
} catch (err) {
  console.error(await prettyPrintError(err));
  process.exit(1);
}
