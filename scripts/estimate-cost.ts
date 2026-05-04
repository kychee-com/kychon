/**
 * Per-tenant AWS infra cost estimator for a Kychon site.
 *
 * Models the marginal cost of hosting one Kychon site on standard AWS
 * (us-east-1, on-demand): S3 + CloudFront for static assets and uploads,
 * Lambda for edge functions, RDS Postgres (shared, amortized) for the DB.
 *
 * Usage:
 *   tsx scripts/estimate-cost.ts                       # default sample site
 *   tsx scripts/estimate-cost.ts --members 500 \
 *     --pageviews 50000 --uploads-gb 2 --tenants 50    # custom
 *   tsx scripts/estimate-cost.ts --json                # machine-readable
 *
 * The dollar numbers are AWS list prices, not Run402 pricing. Run402 charges
 * a flat $5–20/mo to the customer; this script tells us what each tenant
 * actually costs us under the hood, so we can sanity-check the margin.
 */

// ──────────────────────────────────────────────────────────────────────────
// AWS list prices (us-east-1, on-demand, as of 2026-Q1).
// Sourced from aws.amazon.com/{s3,lambda,rds,cloudfront}/pricing — update
// these constants when AWS adjusts prices.
// ──────────────────────────────────────────────────────────────────────────

const AWS = {
  s3: {
    storageGBMo: 0.023,
    putPer1k: 0.005,
    getPer1k: 0.0004,
  },
  cloudfront: {
    egressGB: 0.085, // first 10 TB tier, North America
    requestsPer10k: 0.0075, // HTTPS
  },
  lambda: {
    requestsPer1M: 0.2,
    gbSecond: 0.0000166667,
  },
  rds: {
    // Shared multi-tenant Postgres. Defaults assume db.t4g.medium ($0.073/hr
    // on-demand ≈ $52.56/mo) holding ~20 tenants comfortably. Override with
    // --tenants and --rds-monthly to model your real fleet.
    instanceMonthly: 52.56,
    storageGBMo: 0.115, // gp3
    iopsPer1M: 0, // gp3 baseline IOPS included
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Per-tenant usage model
// ──────────────────────────────────────────────────────────────────────────

interface Inputs {
  /** Active members in the directory. */
  members: number;
  /** Total pageviews per month across all members + public visitors. */
  pageviewsPerMo: number;
  /** Member-uploaded files (resources, event images) in GB. */
  uploadsGB: number;
  /** How many tenants share one RDS instance (cost amortization). */
  tenantsPerRds: number;
  /** Override the assumed shared RDS monthly cost. */
  rdsMonthly: number;
}

const DEFAULTS: Inputs = {
  members: 250,
  pageviewsPerMo: 20_000,
  uploadsGB: 1,
  tenantsPerRds: 20,
  rdsMonthly: AWS.rds.instanceMonthly,
};

// Derived constants for the Kychon shape specifically. These come from the
// schema + block model in CLAUDE.md and the typical site we've measured:
//   - Static page payload: ~15 KB compressed (member view, gzipped HTML+JS).
//   - Avatar: ~50 KB JPEG after client-side resize.
//   - Per-page PostgREST hydrate: 1 cached + 1 fresh fetch ≈ 2 requests.
//   - Per-pageview Lambda: 0 in steady state (PostgREST is direct), ~0.1 avg
//     for occasional functions like upload-asset, on-signup, export-csv.
//   - Scheduled crons: moderate-content (*/15min), event-reminders (hourly),
//     check-expirations (daily), ai-content (weekly). Sum ≈ 3,634 runs/mo.
const SHAPE = {
  staticPageKB: 15,
  avatarKB: 50,
  postgrestCallsPerView: 2,
  lambdaInvokesPerView: 0.1,
  lambdaAvgMs: 200,
  lambdaMemoryMB: 512,
  cronRunsPerMo: 30 + 720 + 2880 + 4, // expirations + reminders + moderation + ai-content
  cronAvgMs: 1500,
  // DB row footprint per tenant (rough): site_config + chrome blocks +
  // members + activity_log entries. Members dominate at scale.
  dbBytesPerMember: 2_000,
  dbBytesBaseline: 500_000, // schema + config + sections + ~50 announcements
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Cost computation
// ──────────────────────────────────────────────────────────────────────────

interface Breakdown {
  storage: { s3GB: number; dbGB: number; cost: number };
  egress: { GB: number; requests: number; cost: number };
  compute: { invocations: number; gbSeconds: number; cost: number };
  database: { sharedMonthly: number; perTenant: number; cost: number };
  totalMonthly: number;
  marginVsRun402Tier: { tier5: number; tier20: number };
}

function estimate(inputs: Inputs): Breakdown {
  // Storage: avatars + member uploads on S3, plus a slice of shared RDS storage.
  const avatarGB = (inputs.members * SHAPE.avatarKB) / 1_000_000;
  const s3GB = avatarGB + inputs.uploadsGB;
  const dbGB =
    (SHAPE.dbBytesBaseline + inputs.members * SHAPE.dbBytesPerMember) /
    1_000_000_000;
  const storageCost = s3GB * AWS.s3.storageGBMo + dbGB * AWS.rds.storageGBMo;

  // Egress: every pageview pulls static HTML/JS/CSS through CloudFront, plus
  // PostgREST JSON responses (~3 KB each after gzip).
  const staticEgressGB =
    (inputs.pageviewsPerMo * SHAPE.staticPageKB) / 1_000_000;
  const apiEgressGB =
    (inputs.pageviewsPerMo * SHAPE.postgrestCallsPerView * 3) / 1_000_000;
  const egressGB = staticEgressGB + apiEgressGB;
  const cfRequests =
    inputs.pageviewsPerMo * (1 + SHAPE.postgrestCallsPerView);
  const egressCost =
    egressGB * AWS.cloudfront.egressGB +
    (cfRequests / 10_000) * AWS.cloudfront.requestsPer10k;

  // Compute: per-pageview Lambda fan-out + scheduled crons.
  const pageviewInvokes = inputs.pageviewsPerMo * SHAPE.lambdaInvokesPerView;
  const totalInvokes = pageviewInvokes + SHAPE.cronRunsPerMo;
  const memGB = SHAPE.lambdaMemoryMB / 1024;
  const pageviewGBSec = pageviewInvokes * (SHAPE.lambdaAvgMs / 1000) * memGB;
  const cronGBSec = SHAPE.cronRunsPerMo * (SHAPE.cronAvgMs / 1000) * memGB;
  const gbSeconds = pageviewGBSec + cronGBSec;
  const computeCost =
    (totalInvokes / 1_000_000) * AWS.lambda.requestsPer1M +
    gbSeconds * AWS.lambda.gbSecond;

  // Database: amortize one shared RDS instance across N tenants.
  const dbPerTenant = inputs.rdsMonthly / Math.max(1, inputs.tenantsPerRds);

  const totalMonthly = storageCost + egressCost + computeCost + dbPerTenant;

  return {
    storage: { s3GB, dbGB, cost: storageCost },
    egress: { GB: egressGB, requests: cfRequests, cost: egressCost },
    compute: {
      invocations: totalInvokes,
      gbSeconds,
      cost: computeCost,
    },
    database: {
      sharedMonthly: inputs.rdsMonthly,
      perTenant: dbPerTenant,
      cost: dbPerTenant,
    },
    totalMonthly,
    marginVsRun402Tier: {
      tier5: 5 - totalMonthly,
      tier20: 20 - totalMonthly,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { inputs: Inputs; json: boolean } {
  const inputs: Inputs = { ...DEFAULTS };
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--members":
        inputs.members = Number(next());
        break;
      case "--pageviews":
        inputs.pageviewsPerMo = Number(next());
        break;
      case "--uploads-gb":
        inputs.uploadsGB = Number(next());
        break;
      case "--tenants":
        inputs.tenantsPerRds = Number(next());
        break;
      case "--rds-monthly":
        inputs.rdsMonthly = Number(next());
        break;
      case "--json":
        json = true;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown arg: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }
  return { inputs, json };
}

function printHelp() {
  console.log(`Kychon per-tenant AWS cost estimator

Flags:
  --members <n>        Active members              (default ${DEFAULTS.members})
  --pageviews <n>      Pageviews per month         (default ${DEFAULTS.pageviewsPerMo})
  --uploads-gb <n>     Member upload storage GB    (default ${DEFAULTS.uploadsGB})
  --tenants <n>        Tenants per shared RDS      (default ${DEFAULTS.tenantsPerRds})
  --rds-monthly <n>    Shared RDS monthly USD      (default ${DEFAULTS.rdsMonthly})
  --json               Emit JSON instead of a table
`);
}

function fmtUSD(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return abs < 0.01 ? `${sign}$${abs.toFixed(4)}` : `${sign}$${abs.toFixed(2)}`;
}

function printReport(inputs: Inputs, b: Breakdown) {
  const tierFit =
    b.totalMonthly < 5
      ? "fits $5 tier"
      : b.totalMonthly < 20
        ? "fits $20 tier"
        : "EXCEEDS $20 tier — overage";
  console.log(`
Kychon site — AWS marginal cost estimate (monthly, us-east-1)
─────────────────────────────────────────────────────────────
Inputs
  members          ${inputs.members}
  pageviews/mo     ${inputs.pageviewsPerMo.toLocaleString()}
  uploads          ${inputs.uploadsGB} GB
  RDS share        1 of ${inputs.tenantsPerRds} tenants @ ${fmtUSD(inputs.rdsMonthly)}/mo

Storage          ${b.storage.s3GB.toFixed(3)} GB S3 + ${b.storage.dbGB.toFixed(4)} GB DB   → ${fmtUSD(b.storage.cost)}
Egress           ${b.egress.GB.toFixed(3)} GB / ${b.egress.requests.toLocaleString()} req      → ${fmtUSD(b.egress.cost)}
Compute          ${b.compute.invocations.toLocaleString()} invokes, ${b.compute.gbSeconds.toFixed(0)} GB-s → ${fmtUSD(b.compute.cost)}
Database (RDS)   ${fmtUSD(b.database.perTenant)}/tenant                       → ${fmtUSD(b.database.cost)}
─────────────────────────────────────────────────────────────
TOTAL            ${fmtUSD(b.totalMonthly)}/mo  (${tierFit})

vs Run402 $5 tier   margin: ${fmtUSD(b.marginVsRun402Tier.tier5)}
vs Run402 $20 tier  margin: ${fmtUSD(b.marginVsRun402Tier.tier20)}
`);
}

const { inputs, json } = parseArgs(process.argv.slice(2));
const breakdown = estimate(inputs);
if (json) {
  console.log(JSON.stringify({ inputs, breakdown }, null, 2));
} else {
  printReport(inputs, breakdown);
}
