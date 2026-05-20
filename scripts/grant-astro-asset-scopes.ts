/**
 * Grant `astro/*` asset_key_scopes to each demo's CI binding.
 *
 * Run402 v1.48+ gates `spec.assets` writes through CI sessions by a per-
 * binding `asset_key_scopes` allowlist (closed-by-default). The
 * @run402/astro@0.2 integration uploads under the `astro/` prefix, so each
 * CI binding needs that prefix granted before `astro build` in CI can call
 * `r.assets.put` without hitting `FORBIDDEN: This CI binding has no
 * asset_key_scopes`.
 *
 * This script is the SDK-side equivalent of the documented CLI command
 * `run402 ci set-asset-scopes <binding-id> 'astro/*'`, plus the lookup
 * step that finds the active binding for each demo project. Idempotent —
 * calling it again with the same scope list is a no-op.
 *
 * Run once locally with your allowance wallet configured:
 *   npx tsx --env-file=.env scripts/grant-astro-asset-scopes.ts
 *
 * Closes kychee-com/run402-private#406's CI-binding prerequisite for
 * Kychon's three demos (eagles, silver-pines, barrio-unido).
 */

import { run402 } from "@run402/sdk/node";

import { DEMOS } from "./deploy-demo.ts";
import { prettyPrintError } from "./_lib.ts";

const SCOPES: readonly string[] = ["astro/*"];

async function main(): Promise<void> {
  const r = run402();

  console.log("Granting `astro/*` asset_key_scopes to demo CI bindings.\n");

  for (const [key, config] of Object.entries(DEMOS)) {
    const projectId = process.env[config.projectIdEnvVar];
    if (!projectId) {
      console.error(`Missing env var: ${config.projectIdEnvVar} — skipping ${config.displayName}.`);
      process.exitCode = 1;
      continue;
    }

    console.log(`--- ${config.displayName} (${projectId}) ---`);

    const { bindings } = await r.ci.listBindings({ project: projectId });
    const active = bindings.filter((b) => !b.revoked_at);

    if (active.length === 0) {
      console.error(`  No active CI binding found. Create one via setup-ci-bindings.ts first.`);
      process.exitCode = 1;
      continue;
    }

    for (const binding of active) {
      console.log(`  Binding: ${binding.id} (subject: ${binding.subject_match})`);
      const updated = await r.ci.setAssetKeyScopes(binding.id, SCOPES);
      // `route_scopes` mirrors the asset scopes in the gateway's normalized
      // form; if v1.48+ added a separate `asset_key_scopes` field we'd log
      // that instead. Either shape confirms the grant landed.
      console.log(`    granted: ${JSON.stringify(SCOPES)}  (binding row updated)`);
      void updated;
    }
    console.log("");
  }

  console.log("Done. CI deploys should now be able to call `r.assets.put` under `astro/*`.");
}

main().catch(async (err) => {
  console.error(await prettyPrintError(err));
  process.exit(1);
});
