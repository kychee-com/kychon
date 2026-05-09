import { runCapabilityConformance } from '../src/lib/capability-api/conformance.js';

const portalUrl = process.env.KYCHON_PORTAL_URL || process.argv[2];
if (!portalUrl) {
  console.error('Usage: KYCHON_PORTAL_URL=https://portal.example npx tsx scripts/kychon-conformance.ts');
  process.exit(1);
}

const report = await runCapabilityConformance({
  portalUrl,
  apiEndpoint: process.env.KYCHON_API_ENDPOINT,
  apiKey: process.env.KYCHON_API_KEY,
  authToken: process.env.KYCHON_AUTH_TOKEN,
});

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
