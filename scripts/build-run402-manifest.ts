import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
};

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

interface ManifestFunctionSpec {
  runtime: string;
  source: { path: string };
  config?: {
    timeout_seconds?: number;
    memory_mb?: number;
  };
  class?: string;
  capabilities?: string[];
  require_auth?: boolean;
  require_role?: unknown;
}

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

function normalizeApiBase(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Run402 API base is not a valid URL: ${JSON.stringify(raw)}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Run402 API base must be http(s), got ${parsed.protocol}`);
  }
  return raw.replace(/\/+$/, "");
}

export function resolveRun402ConfigDir(
  env: NodeJS.ProcessEnv = process.env,
  homeDir = homedir(),
): string {
  const baseDir = env.RUN402_CONFIG_DIR || join(homeDir, ".config", "run402");
  const profile = firstString(env.RUN402_WALLET, env.RUN402_PROFILE) || "default";
  return profile === "default" ? baseDir : join(baseDir, "profiles", profile);
}

export function resolveCoreTargetConfig(
  opts: ResolveCoreTargetConfigOptions = {},
): CoreTargetConfig {
  const env = opts.env ?? process.env;
  const configDir = opts.configDir ?? resolveRun402ConfigDir(env);
  const targetJson = readJsonFile(join(configDir, "target.json"));
  const storeJson = readJsonFile(join(configDir, "projects.json"));

  const provisionFile =
    opts.provisionFile === undefined
      ? env.KYCHON_CORE_PROVISION_FILE || "core-provision.json"
      : opts.provisionFile;
  const provisionJson = provisionFile
    ? readJsonFile(resolve(ROOT, provisionFile))
    : null;

  const apiBase = normalizeApiBase(
    firstString(env.RUN402_API_BASE, env.RUN402_CORE_URL, targetJson?.api_base),
  );
  if (!apiBase) {
    throw new Error(
      "No Run402 Core API base found. Run `run402 init --api-base=http://<core>:4020`, " +
        "or set RUN402_API_BASE/RUN402_CORE_URL before building app.json.",
    );
  }
  if (apiBase === "https://api.run402.com") {
    throw new Error(
      "Refusing to build a Core manifest against the Run402 Cloud API base. " +
        "Run `run402 init --api-base=http://<core>:4020` first.",
    );
  }

  const storeProjects =
    storeJson?.projects && typeof storeJson.projects === "object" && !Array.isArray(storeJson.projects)
      ? (storeJson.projects as Record<string, Record<string, unknown>>)
      : {};
  const projectId = firstString(
    env.RUN402_PROJECT_ID,
    env.KYCHON_PROJECT_ID,
    storeJson?.active_project_id,
    provisionJson?.project_id,
  );
  const storedProject = projectId ? storeProjects[projectId] : undefined;
  const anonKey = firstString(
    env.ANON_KEY,
    env.KYCHON_ANON_KEY,
    storedProject?.anon_key,
    provisionJson?.anon_key,
  );
  if (!anonKey) {
    throw new Error(
      "No anon_key found. Run `run402 projects provision --name ... | tee core-provision.json`, " +
        "or set ANON_KEY/KYCHON_ANON_KEY before building app.json.",
    );
  }

  const serviceKey = firstString(
    env.SERVICE_KEY,
    env.RUN402_SERVICE_KEY,
    storedProject?.service_key,
    provisionJson?.service_key,
  );

  return {
    apiBase,
    ...(projectId ? { projectId } : {}),
    anonKey,
    ...(serviceKey ? { serviceKey } : {}),
    source: {
      apiBase: env.RUN402_API_BASE || env.RUN402_CORE_URL ? "env" : "run402 target profile",
      project: env.RUN402_PROJECT_ID || env.KYCHON_PROJECT_ID
        ? "env"
        : storeJson?.active_project_id
          ? "run402 project profile"
          : "core-provision.json",
      anonKey: env.ANON_KEY || env.KYCHON_ANON_KEY
        ? "env"
        : storedProject?.anon_key
          ? "run402 project profile"
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

function rootRelative(path: string): string {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function safeFunctionSourceFile(name: string): string {
  return `${name.replace(/[^a-zA-Z0-9_.-]/g, "_")}.js`;
}

export function materializeManifestFunctionSpec(
  name: string,
  spec: FunctionSpec,
  outDir: string,
): ManifestFunctionSpec {
  const fn = spec as CoreFunctionSpec;
  if (fn.schedule) {
    throw new Error(`Core manifest cannot include scheduled function ${name}`);
  }
  if (typeof fn.source !== "string") {
    throw new Error(`Core manifest function ${name} must have string source`);
  }

  mkdirSync(outDir, { recursive: true });
  const sourcePath = join(outDir, safeFunctionSourceFile(name));
  writeFileSync(sourcePath, fn.source, "utf-8");

  const out: ManifestFunctionSpec = {
    runtime: fn.runtime ?? "node22",
    source: { path: rootRelative(sourcePath) },
  };
  if (fn.config) {
    out.config = {
      ...(fn.config.timeoutSeconds !== undefined ? { timeout_seconds: fn.config.timeoutSeconds } : {}),
      ...(fn.config.memoryMb !== undefined ? { memory_mb: fn.config.memoryMb } : {}),
    };
  }
  if (fn.class) out.class = fn.class;
  if (fn.capabilities) out.capabilities = [...fn.capabilities];
  if (fn.requireAuth !== undefined) out.require_auth = fn.requireAuth;
  if (fn.requireRole !== undefined) out.require_role = fn.requireRole;
  return out;
}

function materializeFunctionManifestMap(
  functionsMap: Record<string, FunctionSpec>,
): Record<string, ManifestFunctionSpec> {
  const outDir = join(ROOT, "dist", "run402", "core-functions");
  const out: Record<string, ManifestFunctionSpec> = {};
  for (const [name, spec] of Object.entries(functionsMap).sort(([a], [b]) => a.localeCompare(b))) {
    out[name] = materializeManifestFunctionSpec(name, spec, outDir);
  }
  return out;
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

  const manifest = {
    "$schema": "https://run402.com/schemas/manifest.v1.json",
    database: {
      migrations: [{ id: migrationId, sql }],
      expose: { version: "1", tables: [...EXPOSE_TABLES] },
    },
    functions: { replace: functionManifest },
    site: {
      replace: {
        __source: "local-dir",
        path: rootRelative(clientDir),
      },
      public_paths: astroSlice.site.public_paths ?? { mode: "implicit" },
    },
    routes: { replace: routes },
  };

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
  console.log(`Wrote ${rootRelative(result.outPath)}`);
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

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
