import { run402 } from "@run402/sdk/node";

import { runDeploy } from "./scripts/_lib.ts";

const PROJECT_ID = "prj_1777894176600_1224";
const SUBDOMAIN = "aage-port";
const SEED_FILE = "_aage-port.seed.sql";
const CHROME_SNAPSHOT = "fixtures/chrome/aage.chrome-snapshot.json";

async function main() {
  const r = run402();
  const keys = await r.projects.keys(PROJECT_ID);
  if (!keys.anon_key) throw new Error(`No anon_key for ${PROJECT_ID}`);

  const result = await runDeploy(r, {
    projectId: PROJECT_ID,
    anonKey: keys.anon_key,
    subdomain: SUBDOMAIN,
    seedFile: SEED_FILE,
    chromeSnapshot: CHROME_SNAPSHOT,
    excludeFunctions: ["check-expirations"],
  });

  console.log(JSON.stringify(result, null, 2));
  console.log(`Live at: https://${SUBDOMAIN}.run402.com`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
