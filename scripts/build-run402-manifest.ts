import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPortableAppManifest,
  databaseMigrationsSlice,
  inlineSqlMigration,
  manifestRelativePath,
  materializeFunctionManifestMap as materializeAppKitFunctionManifestMap,
  materializeFunctionSource,
  siteReplaceFromLocalDir,
  type AppKitFunctionInput,
  type AppKitManifestFunctionSpec,
} from "@run402/release/app-kit";
import { resolveRun402TargetProfile } from "@run402/sdk/node";

import {
  collectFunctionsMap,
  EXPOSE_TABLES,
  readMigrations,
  ROOT,
  sha256Hex,
  writeAdapterAwareArtifacts,
  type FunctionSpec,
} from "./_lib.ts";
import { buildEngineReleaseManifest } from "./release-manifest.ts";

const ASTRO_SSR_CAPABILITY = "astro.ssr.v1";

export const CORE_INCLUDED_FUNCTIONS = [
  "kychon-api",
  "site-search",
  "export-csv",
  "upload-asset",
  "upload-resource",
] as const;

type CoreFunctionSpec = FunctionSpec & {
  class?: string;
  capabilities?: string[];
  requireAuth?: boolean;
  requireRole?: unknown;
} & AppKitFunctionInput;

interface CoreTargetConfig {
  apiBase: string;
  projectId?: string;
  anonKey: string;
  serviceKey?: string;
  source: {
    apiBase: string;
    project: string;
    anonKey: string;
  };
}

interface ResolveCoreTargetConfigOptions {
  env?: NodeJS.ProcessEnv;
  configDir?: string;
  provisionFile?: string | null;
}

type ManifestFunctionSpec = AppKitManifestFunctionSpec;

interface CoreManifestBuildResult {
  manifest: Record<string, unknown>;
  target: CoreTargetConfig;
  migrationId: string;
  functionNames: string[];
  omittedFunctionNames: string[];
  outPath: string;
}

function readJsonFile(path: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function resolveCoreTargetConfig(
  opts: ResolveCoreTargetConfigOptions = {},
): CoreTargetConfig {
  const env = opts.env ?? process.env;
  const configDir = opts.configDir;

  const provisionFile =
    opts.provisionFile === undefined
      ? env.KYCHON_CORE_PROVISION_FILE || "core-provision.json"
      : opts.provisionFile;
  const provisionJson = provisionFile
    ? readJsonFile(resolve(ROOT, provisionFile))
    : null;

  const target = withTemporaryRun402Env(env, configDir, () => {
    try {
      return resolveRun402TargetProfile({
        requiredTarget: "core",
        env,
        envAliases: {
          projectId: ["KYCHON_PROJECT_ID"],
          anonKey: ["ANON_KEY", "KYCHON_ANON_KEY"],
          serviceKey: ["SERVICE_KEY"],
        },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "RUN402_TARGET_MISMATCH") {
        throw new Error(
          "Refusing to build a Core manifest against the Run402 Cloud API base. " +
            "Run `run402 init --api-base=http://<core>:4020` first.",
        );
      }
      throw error;
    }
  });

  const apiBase = target.apiBase;
  if (apiBase === "https://api.run402.com") {
    throw new Error(
      "Refusing to build a Core manifest against the Run402 Cloud API base. " +
        "Run `run402 init --api-base=http://<core>:4020` first.",
    );
  }

  const projectId = firstString(
    target.projectId,
    provisionJson?.project_id,
  );
  const anonKey = firstString(
    target.anonKey,
    provisionJson?.anon_key,
  );
  if (!anonKey) {
    throw new Error(
      "No anon_key found. Run `run402 projects provision --name ... | tee core-provision.json`, " +
        "or set ANON_KEY/KYCHON_ANON_KEY before building app.json.",
    );
  }

  const serviceKey = firstString(
    target.serviceKey,
    provisionJson?.service_key,
  );

  return {
    apiBase,
    ...(projectId ? { projectId } : {}),
    anonKey,
    ...(serviceKey ? { serviceKey } : {}),
    source: {
      apiBase: target.sources.apiBase === "env" ? "env" : "run402 target profile",
      project: target.projectId
        ? sourceLabel(target.sources.project, "run402 project profile")
        : "core-provision.json",
      anonKey: target.anonKey
        ? sourceLabel(target.sources.anonKey, "run402 project profile")
        : "core-provision.json",
    },
  };
}

async function listFunctionNames(functionsDir: string): Promise<string[]> {
  const entries = await readdir(functionsDir);
  return entries
    .filter((entry) => entry.endsWith(".js"))
    .map((entry) => entry.replace(/\.js$/, ""))
    .sort();
}

async function collectCoreFunctionMap(): Promise<{
  functionsMap: Record<string, FunctionSpec>;
  omittedFunctionNames: string[];
}> {
  const functionsDir = join(ROOT, "functions");
  const allNames = await listFunctionNames(functionsDir);
  const included = new Set<string>(CORE_INCLUDED_FUNCTIONS);
  const omittedFunctionNames = allNames.filter((name) => !included.has(name));
  const functionsMap = await collectFunctionsMap(functionsDir, {
    exclude: omittedFunctionNames,
  });

  for (const [name, spec] of Object.entries(functionsMap)) {
    if (spec.schedule) {
      throw new Error(
        `Core manifest includes scheduled function ${name}. ` +
          "Remove it from CORE_INCLUDED_FUNCTIONS or add Core schedule support first.",
      );
    }
  }

  return { functionsMap, omittedFunctionNames };
}

function withAstroSsrCapability(
  functionsMap: Record<string, FunctionSpec>,
): Record<string, FunctionSpec> {
  const out: Record<string, FunctionSpec> = {};
  for (const [name, spec] of Object.entries(functionsMap)) {
    const fn = spec as CoreFunctionSpec;
    if (fn.class !== "ssr") {
      out[name] = spec;
      continue;
    }
    const capabilities = new Set([...(fn.capabilities ?? []), ASTRO_SSR_CAPABILITY]);
    out[name] = {
      ...spec,
      capabilities: [...capabilities],
    } as FunctionSpec;
  }
  return out;
}

export function materializeManifestFunctionSpec(
  name: string,
  spec: FunctionSpec,
  outDir: string,
): ManifestFunctionSpec {
  return materializeFunctionSource(name, spec as CoreFunctionSpec, {
    rootDir: ROOT,
    outDir,
    targetPolicy: "core-developer-preview",
  }).spec;
}

function materializeFunctionManifestMap(
  functionsMap: Record<string, FunctionSpec>,
): Record<string, ManifestFunctionSpec> {
  const outDir = join(ROOT, "dist", "run402", "core-functions");
  return materializeAppKitFunctionManifestMap(functionsMap as Record<string, CoreFunctionSpec>, {
    rootDir: ROOT,
    outDir,
    targetPolicy: "core-developer-preview",
  }).functions;
}

function parseArgs(argv: string[]): { outPath: string } {
  let outPath = "app.json";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") {
      const value = argv[i + 1];
      if (!value) throw new Error("--out requires a path");
      outPath = value;
      i++;
    } else if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: KYCHON_DEPLOY_TARGET=core npm run build:run402-manifest -- [--out app.json]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { outPath };
}

export async function buildCoreManifest(
  outPath = "app.json",
): Promise<CoreManifestBuildResult> {
  const target = resolveCoreTargetConfig();
  const distDir = join(ROOT, "dist");
  const adapterManifestPath = join(distDir, "run402", "adapter.json");
  const clientDir = join(distDir, "run402", "client");
  if (!existsSync(adapterManifestPath) || !existsSync(clientDir)) {
    throw new Error(
      "Run402 Astro adapter output was not found. Run `KYCHON_PROJECT=kychon npm run build` first.",
    );
  }

  const sql = readMigrations(ROOT);
  const migrationId = `kychon_${sha256Hex(sql).slice(0, 16)}`;
  const releaseManifest = buildEngineReleaseManifest({
    migrationId,
    schemaSql: sql,
  });

  const astroSlice = await writeAdapterAwareArtifacts({
    distDir,
    clientDir,
    adapterActive: true,
    anonKey: target.anonKey,
    apiBase: target.apiBase,
    releaseManifest,
  });
  if (!astroSlice) {
    throw new Error("Expected @run402/astro to emit a Core-compatible release slice.");
  }

  const { functionsMap, omittedFunctionNames } = await collectCoreFunctionMap();
  const finalFunctionsMap = withAstroSsrCapability({
    ...functionsMap,
    ...astroSlice.functions.replace,
  });
  const functionManifest = materializeFunctionManifestMap(finalFunctionsMap);
  const sameOriginApiRoute = {
    pattern: "/api/kychon",
    methods: ["POST"],
    target: { type: "function", name: "kychon-api" },
  };
  const routes = [
    sameOriginApiRoute,
    ...(astroSlice.routes?.replace ?? []),
  ];

  const manifest = buildPortableAppManifest({
    schema: "https://run402.com/schemas/manifest.v1.json",
    database: databaseMigrationsSlice([
      inlineSqlMigration({ id: migrationId, sql }),
    ], {
      expose: { version: "1", tables: [...EXPOSE_TABLES] },
    }),
    functions: { replace: functionManifest },
    site: siteReplaceFromLocalDir(clientDir, {
      rootDir: ROOT,
      publicPaths: astroSlice.site.public_paths ?? { mode: "implicit" },
    }),
    routes: { replace: routes },
    omittedFeatures: omittedFunctionNames.map((name) => ({
      resource: `functions.${name}`,
      capability: "cloud-only-or-scheduled-function",
      reason: "Kychon intentionally omits this function from the Core Developer Preview build.",
    })),
  });

  const absoluteOutPath = resolve(ROOT, outPath);
  writeFileSync(absoluteOutPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  return {
    manifest,
    target,
    migrationId,
    functionNames: Object.keys(functionManifest).sort(),
    omittedFunctionNames,
    outPath: absoluteOutPath,
  };
}

async function main(): Promise<void> {
  const { outPath } = parseArgs(process.argv.slice(2));
  const result = await buildCoreManifest(outPath);
  console.log(`Wrote ${manifestRelativePath(result.outPath, ROOT)}`);
  console.log(`  api_base: ${result.target.apiBase} (${result.target.source.apiBase})`);
  if (result.target.projectId) {
    console.log(`  active project: ${result.target.projectId} (${result.target.source.project})`);
  }
  console.log(`  anon_key: ${result.target.source.anonKey}`);
  console.log(`  migration: ${result.migrationId}`);
  console.log(`  functions: ${result.functionNames.join(", ")}`);
  console.log(`  omitted Core-incompatible functions: ${result.omittedFunctionNames.join(", ") || "(none)"}`);
  console.log(`  site: ${basename(join(ROOT, "dist", "run402", "client"))} via local-dir manifest entry`);
}

function sourceLabel(source: string | undefined, profileLabel: string): string {
  if (!source) return profileLabel;
  return source.startsWith("env:") ? "env" : profileLabel;
}

function withTemporaryRun402Env<T>(
  env: NodeJS.ProcessEnv,
  configDir: string | undefined,
  fn: () => T,
): T {
  const keys = [
    "RUN402_API_BASE",
    "RUN402_CORE_URL",
    "RUN402_CONFIG_DIR",
    "RUN402_PROJECT_ID",
    "RUN402_ANON_KEY",
    "RUN402_SERVICE_KEY",
    "RUN402_WALLET",
    "RUN402_PROFILE",
    "KYCHON_PROJECT_ID",
    "ANON_KEY",
    "KYCHON_ANON_KEY",
    "SERVICE_KEY",
  ];
  const previous: Record<string, string | undefined> = {};
  for (const key of keys) {
    previous[key] = process.env[key];
    const next = key === "RUN402_CONFIG_DIR" && configDir ? configDir : env[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  if (env.RUN402_CORE_URL && !env.RUN402_API_BASE) {
    process.env.RUN402_API_BASE = env.RUN402_CORE_URL;
  }
  try {
    return fn();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
