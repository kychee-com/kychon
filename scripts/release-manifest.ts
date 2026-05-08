import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const ENGINE_RELEASE_CHANNELS = ["dev", "canary", "stable", "security"] as const;
export const ENGINE_RELEASE_PROMOTION_STATUSES = [
  "candidate",
  "promoted",
  "withdrawn",
  "deprecated",
] as const;

export type EngineReleaseChannel = (typeof ENGINE_RELEASE_CHANNELS)[number];
export type EngineReleasePromotionStatus = (typeof ENGINE_RELEASE_PROMOTION_STATUSES)[number];

export interface EngineReleaseManifest {
  schemaVersion: 1;
  app: "kychon";
  engineVersion: string;
  gitSha: string;
  builtAt: string;
  channel: EngineReleaseChannel;
  promotionStatus: EngineReleasePromotionStatus;
  schemaMigrationId: string;
  schemaChecksum: string;
  seedVariant: string;
  seedVersion: string;
  run402SdkVersion: string;
  releaseNotesUrl?: string;
}

export interface BuildEngineReleaseManifestOptions {
  migrationId: string;
  schemaSql: string;
  seedFile?: string;
  now?: Date;
  env?: NodeJS.ProcessEnv;
  root?: string;
}

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function assertSemver(value: string, field = "engineVersion"): string {
  if (!SEMVER_RE.test(value)) {
    throw new Error(`${field} must be a valid SemVer value, got "${value}"`);
  }
  return value;
}

export function assertEngineReleaseChannel(value: string): EngineReleaseChannel {
  if ((ENGINE_RELEASE_CHANNELS as readonly string[]).includes(value)) {
    return value as EngineReleaseChannel;
  }
  throw new Error(
    `release channel must be one of ${ENGINE_RELEASE_CHANNELS.join(", ")}, got "${value}"`,
  );
}

export function assertEngineReleasePromotionStatus(
  value: string,
): EngineReleasePromotionStatus {
  if ((ENGINE_RELEASE_PROMOTION_STATUSES as readonly string[]).includes(value)) {
    return value as EngineReleasePromotionStatus;
  }
  throw new Error(
    `promotion status must be one of ${ENGINE_RELEASE_PROMOTION_STATUSES.join(", ")}, got "${value}"`,
  );
}

export function buildEngineReleaseManifest(
  opts: BuildEngineReleaseManifestOptions,
): EngineReleaseManifest {
  const root = opts.root ?? DEFAULT_ROOT;
  const env = opts.env ?? process.env;
  const packageJson = readJson(join(root, "package.json"));
  const engineVersion = assertSemver(String(packageJson.version ?? ""));
  const channel = assertEngineReleaseChannel(env.KYCHON_RELEASE_CHANNEL || "dev");
  const promotionStatus = assertEngineReleasePromotionStatus(
    env.KYCHON_RELEASE_PROMOTION_STATUS || "candidate",
  );
  const builtAt = (opts.now ?? new Date()).toISOString();
  const seedSql = readSeedSql(root, opts.seedFile);
  const seedVariant =
    env.KYCHON_PROJECT || (opts.seedFile ? basename(opts.seedFile).replace(/\.sql$/i, "") : "kychon");

  const manifest: EngineReleaseManifest = {
    schemaVersion: 1,
    app: "kychon",
    engineVersion,
    gitSha: gitSha(root, env),
    builtAt,
    channel,
    promotionStatus,
    schemaMigrationId: opts.migrationId,
    schemaChecksum: sha256Hex(opts.schemaSql),
    seedVariant,
    seedVersion: sha256Hex(seedSql).slice(0, 16),
    run402SdkVersion: run402SdkVersion(root),
  };

  const releaseNotesUrl = env.KYCHON_RELEASE_NOTES_URL?.trim();
  if (releaseNotesUrl) manifest.releaseNotesUrl = releaseNotesUrl;

  return manifest;
}

export function writeEngineReleaseManifest(
  distDir: string,
  manifest: EngineReleaseManifest,
): string {
  const target = join(distDir, "kychon-release.json");
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  return target;
}

function readSeedSql(root: string, seedFile?: string): string {
  const path = join(root, seedFile ?? "seed.sql");
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function run402SdkVersion(root: string): string {
  const packageJson = readJson(join(root, "node_modules", "@run402", "sdk", "package.json"));
  return String(packageJson.version ?? "");
}

function gitSha(root: string, env: NodeJS.ProcessEnv): string {
  if (env.KYCHON_GIT_SHA) return env.KYCHON_GIT_SHA;
  if (env.GITHUB_SHA) return env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}
