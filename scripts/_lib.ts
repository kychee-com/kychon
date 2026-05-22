/**
 * Shared utilities for the deploy scripts.
 *
 * All Run402 interactions go through `@run402/sdk/node` — no execSync calls.
 * Per the deploy spec policy, new tooling targeting Run402 must use the SDK.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { dir, fileSetFromDir, run402 } from "@run402/sdk/node";

import { LOCALE_POOL } from "../src/lib/locale-pool.js";
import type {
  ActiveReleaseInventory,
  ApplyOptions,
  FileSet,
  FsFileSource,
  FunctionSpec,
  I18nSpec,
  LocalDirRef,
  ReleaseInventoryI18n,
  ReleaseSpec,
} from "@run402/sdk/node";

import {
  buildExplicitPublicPathSpecs,
  customPageStaticFile,
  safeCustomPageSlugs,
} from "../src/lib/clean-routes.ts";
import { generateHeadersContent, validateCsp } from "../src/lib/csp.ts";
import { resolveActiveProjectSeed } from "../src/seeds/index.ts";
import type { ProjectSeed } from "../src/seeds/types.ts";
import {
  buildEngineReleaseManifest,
  writeEngineReleaseManifest,
  type EngineReleaseManifest,
} from "./release-manifest.ts";
import type { PublicStaticPathSpec } from "../src/lib/clean-routes.ts";

type Run402Instance = ReturnType<typeof run402>;
export type { FileSet, FunctionSpec, ReleaseSpec, Run402Instance };
export { fileSetFromDir, run402 };

/** Repo root, derived from this file's location. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Product data is intentionally not published through Run402's low-level
 * `/rest/v1/*` table API. Demo sites and agents talk to the Kychon Capability
 * API (`POST /functions/v1/kychon-api`) through @kychon/sdk instead.
 */
export const EXPOSE_TABLES: ReadonlyArray<Record<string, unknown>> = [];

export interface CollectFunctionsOptions {
  /** Function names to skip (e.g. `["check-expirations"]` for demos). */
  exclude?: readonly string[];
  /** Path to an additional `.js` function to append (e.g. demo reset-demo). */
  extraFunction?: string;
}

/**
 * Read functions from a directory of `.js` files. Each file becomes one
 * `FunctionSpec` in the `replace` map; cron schedules are parsed from
 * `// schedule: "..."` comments.
 */
export async function collectFunctionsMap(
  dir: string,
  opts: CollectFunctionsOptions = {},
): Promise<Record<string, FunctionSpec>> {
  const out: Record<string, FunctionSpec> = {};
  if (existsSync(dir)) {
    const entries = await readdir(dir);
    for (const f of entries.filter((e) => e.endsWith(".js"))) {
      const code = injectFunctionBuildConstants(await readFile(join(dir, f), "utf-8"));
      out[f.replace(/\.js$/, "")] = makeFunctionSpec(code);
    }
  }

  if (opts.exclude) {
    for (const name of opts.exclude) delete out[name];
  }

  if (opts.extraFunction) {
    const code = injectFunctionBuildConstants(await readFile(opts.extraFunction, "utf-8"));
    const name = (opts.extraFunction.split("/").pop() ?? opts.extraFunction).replace(/\.js$/, "");
    // Demo reset-demo takes ~8s in practice (DELETE+seed against ~14 sections
    // and ~150 demo rows). The 10s default leaves no headroom. Also acts as
    // the non-source field change required by kychee-com/run402#168 to force
    // activation on functions that got stuck before gateway 1.0.4 — bumping
    // timeout from the default 10s to 15s changes the function digest, so
    // the gateway's noop short-circuit no longer skips activation for these
    // already-deployed functions.
    out[name] = makeFunctionSpec(code, { timeoutSeconds: 15 });
  }

  return out;
}

function injectFunctionBuildConstants(code: string): string {
  return code.replaceAll("__KYCHON_ENGINE_VERSION__", resolveKychonEngineVersion());
}

function resolveKychonEngineVersion(): string {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  return process.env.KYCHON_ENGINE_VERSION || String(packageJson.version);
}

function makeFunctionSpec(
  code: string,
  config?: { timeoutSeconds?: number; memoryMb?: number },
): FunctionSpec {
  const spec: FunctionSpec = { runtime: "node22", source: code };
  if (config) spec.config = config;
  const scheduleMatch = code.match(/\/\/\s*schedule:\s*"([^"]+)"/);
  if (scheduleMatch && scheduleMatch[1]) {
    spec.schedule = scheduleMatch[1];
  }
  return spec;
}

/**
 * Generate `seed.sql` from the active project's TS seed module, then run
 * `npx astro build`. The generator is required because `seed.sql` is gitignored
 * and the bake in `Portal.astro` and the migration reader both expect a
 * project-matched `seed.sql` to exist.
 */
export interface BuildAstroOptions {
  chromeSnapshot?: string | ProjectSeed;
}

function resolveChromeSnapshotForBuild(input: string | ProjectSeed | undefined): string | undefined {
  if (!input) return undefined;
  if (typeof input === "string") {
    return input.startsWith("/") ? input : join(ROOT, input);
  }

  const tmpDir = join(ROOT, "tmp");
  mkdirSync(tmpDir, { recursive: true });
  const target = join(tmpDir, "kychon-chrome-snapshot.build.json");
  writeFileSync(target, JSON.stringify(input, null, 2), "utf-8");
  return target;
}

export function buildAstro(opts: BuildAstroOptions = {}): void {
  const chromeSnapshot = resolveChromeSnapshotForBuild(opts.chromeSnapshot);
  const env = { ...process.env };
  if (chromeSnapshot) {
    env.KYCHON_CHROME_SNAPSHOT = chromeSnapshot;
    console.log(`First-byte chrome source: external snapshot (${chromeSnapshot})`);
  } else {
    delete env.KYCHON_CHROME_SNAPSHOT;
    console.log("First-byte chrome source: typed seed or neutral fallback");
  }

  console.log("Generating seed.sql from active project's TS seed...");
  execSync("npx tsx scripts/generate-seed-sql.ts", {
    stdio: "inherit",
    cwd: ROOT,
    env,
  });
  console.log("Building Astro project...");
  execSync("npx astro build", { stdio: "inherit", cwd: ROOT, env });
}

function parseProjectSeedSnapshot(path: string): ProjectSeed {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Chrome snapshot ${path} must be a JSON object`);
  }
  return parsed as ProjectSeed;
}

async function resolveDeployOutputSeed(
  chromeSnapshot: string | ProjectSeed | undefined,
): Promise<ProjectSeed> {
  if (chromeSnapshot && typeof chromeSnapshot !== "string") return chromeSnapshot;
  if (typeof chromeSnapshot === "string") {
    const path = chromeSnapshot.startsWith("/") ? chromeSnapshot : join(ROOT, chromeSnapshot);
    return parseProjectSeedSnapshot(path);
  }
  return (await resolveActiveProjectSeed()).seed;
}

/**
 * Extract the Run402 ReleaseSpec.i18n slice from the active project seed.
 *
 * Reads `site_config.languages` (string[]) and `site_config.default_language`
 * (string), both of which the typed seeds declare under
 * `category: 'i18n'` (see e.g. `src/seeds/barrio-unido.ts:120-121`). Falls
 * back to `['en']` / `'en'` when the seed declares neither — matches the
 * single-language posture of the kychon/eagles/silver-pines seeds.
 *
 * The platform enforces a byte-identical match between `defaultLocale` and
 * one entry of `locales[]` ("EN" vs ["en"] is rejected at apply time). The
 * fallback path returns the same string for both so the invariant always
 * holds when the seed is silent. When the seed declares both, callers are
 * responsible for keeping them consistent (lowercase BCP-47 is the existing
 * convention everywhere: `brand.json`, `barrio-unido.ts`, `content_translations`,
 * `section_translations`).
 *
 * `detect: ['cookie:wl_locale', 'accept-language']` — cookie wins when set,
 * which matches `src/lib/i18n.ts:setLanguage()` (writes `wl_locale` cookie on
 * every language switch). When neither cookie nor Accept-Language matches a
 * declared locale, the gateway falls back to `defaultLocale`.
 */
export function buildI18nSpec(seed: ProjectSeed): I18nSpec {
  // admin-content-management (Decision 9 — kitchen-sink locale pool):
  // `spec.i18n.locales` is the fixed 50-entry LOCALE_POOL. The per-portal
  // active set lives in `site_config.languages_enabled` at runtime, so
  // admins can add/remove languages via the AdminBar without redeploying.
  //
  // `defaultLocale` is still per-project — read from the seed's
  // `default_language`. It MUST be in LOCALE_POOL; we fail loud at build
  // time if a seed picks a default outside the pool (better than a silent
  // gateway 400 at deploy time).
  const defaultEntry = seed.site_config?.default_language;
  const defaultLocale =
    defaultEntry && typeof defaultEntry === "object" && "value" in defaultEntry && typeof (defaultEntry as { value: unknown }).value === "string"
      ? (defaultEntry as { value: string }).value
      : "en";

  if (!LOCALE_POOL.includes(defaultLocale)) {
    throw new Error(
      `default_language "${defaultLocale}" is not in the LOCALE_POOL. ` +
      `Add it to src/lib/locale-pool.ts (subject to the Run402 50-entry cap) ` +
      `or change the seed's default_language to a pool entry. ` +
      `Pool members: ${LOCALE_POOL.join(", ")}`,
    );
  }

  // admin-content-management (Decision 9):
  // The kitchen-sink LOCALE_POOL is the load-bearing pattern — admins can
  // add/remove any of these 50 locales via the AdminBar without redeploying
  // (the per-portal active set is `site_config.languages_enabled`, runtime
  // mutable). For locales OUTSIDE the pool, the gateway currently falls
  // back to `defaultLocale`. The follow-up plan is `unknownLocalePolicy:
  // 'pass-through'` once the apply-v1 validator accepts the field —
  // deploy validation rejected it as `Unknown ReleaseSpec field` on the
  // 2026-05-21 deploy, so the opt-in is held until the gateway/validator
  // catches up. See run402-private#413 for the platform thread.
  return {
    defaultLocale,
    locales: [...LOCALE_POOL],
    detect: ["cookie:wl_locale", "accept-language"],
  };
}

/**
 * Compact one-line representation of an i18n slice for deploy logs.
 * Examples:
 *   `es/[es,en]/detect=[cookie:wl_locale,accept-language]`
 *   `en/[en]/detect=[cookie:wl_locale,accept-language]`
 *
 * Accepts both the deploy-time `I18nSpec` (what we send) and the
 * gateway-materialized `ReleaseInventoryI18n` (what we read back). The
 * two have the same shape on the wire — the type split exists in the SDK
 * because they have different lifecycles (input vs. observed state),
 * not because the data differs.
 */
export function formatI18nSlice(slice: I18nSpec | ReleaseInventoryI18n): string {
  const detect = (slice.detect ?? []).join(",");
  return `${slice.defaultLocale}/[${slice.locales.join(",")}]/detect=[${detect}]`;
}

/**
 * Compare an applied `I18nSpec` to a gateway `ReleaseInventoryI18n`
 * readback, field-by-field. Returns true iff `defaultLocale`, `locales[]`
 * (order-sensitive — order is meaningful for fallback in some platform
 * implementations), and `detect[]` (also order-sensitive — first match
 * wins per the gateway's negotiation contract) all match byte-for-byte.
 *
 * Used by the post-apply readback in `runDeploy` to confirm the gateway
 * stored the slice we sent without coercion. apply() success is
 * necessary but not sufficient — the readback is the positive proof.
 */
export function i18nSpecMatchesReadback(
  applied: I18nSpec,
  readback: ReleaseInventoryI18n,
): boolean {
  if (applied.defaultLocale !== readback.defaultLocale) return false;
  if (applied.locales.length !== readback.locales.length) return false;
  for (let i = 0; i < applied.locales.length; i++) {
    if (applied.locales[i] !== readback.locales[i]) return false;
  }
  const appliedDetect = applied.detect ?? [];
  const readbackDetect = readback.detect ?? [];
  if (appliedDetect.length !== readbackDetect.length) return false;
  for (let i = 0; i < appliedDetect.length; i++) {
    if (appliedDetect[i] !== readbackDetect[i]) return false;
  }
  return true;
}

export interface MaterializedCustomPageFile {
  slug: string;
  file: `${string}.html`;
}

export function materializeCustomPageStaticFiles(
  distDir: string,
  seed: ProjectSeed,
): MaterializedCustomPageFile[] {
  const slugs = safeCustomPageSlugs(seed.pages);
  if (slugs.length === 0) return [];

  const pageShell = join(distDir, "page.html");
  if (!existsSync(pageShell)) {
    throw new Error(
      `Cannot materialize clean custom page files because ${pageShell} does not exist.`,
    );
  }

  const materialized: MaterializedCustomPageFile[] = [];
  for (const slug of slugs) {
    const file = customPageStaticFile(slug);
    if (!file) continue;
    copyFileSync(pageShell, join(distDir, file));
    materialized.push({ slug, file });
  }
  return materialized;
}

/**
 * Inject the Run402 anon_key into `dist/js/env.js` after `astro build`.
 * Mirrors the runtime config the public site reads at boot.
 */
export function injectEnvJs(distDir: string, anonKey: string): void {
  const jsDir = join(distDir, "js");
  mkdirSync(jsDir, { recursive: true });
  const content =
    "// env.js — Runtime config (auto-generated by deploy)\n" +
    "window.__KYCHON_API = 'https://api.run402.com';\n" +
    `window.__KYCHON_ANON_KEY = '${anonKey}';\n`;
  writeFileSync(join(jsDir, "env.js"), content);
}

/**
 * Substitute `{PROVIDER_HOSTS}` in `dist/_headers` and validate the CSP.
 * Aborts the deploy with a clear error if the headers are malformed or a
 * registered embed provider is missing from `frame-src`. Run402 v1.50 doesn't
 * yet honor `_headers`, but we still bundle the file so it's ready when
 * platform support lands; the CSP value baked into Portal.astro at build
 * time uses the same source registry, so divergence is impossible.
 */
export function generateAndValidateHeaders(distDir: string): void {
  const content = generateHeadersContent(ROOT);
  validateCsp(content);
  writeFileSync(join(distDir, "_headers"), content);
}

export interface ResolvedDeployTarget {
  projectId: string;
  anonKey: string;
  subdomain: string;
}

/**
 * Resolve target from env vars (RUN402_PROJECT_ID / ANON_KEY / SUBDOMAIN),
 * falling back to the SDK's active project + keystore for project/key lookup.
 * Used by `deploy.ts` (production deploy entry point).
 */
export async function resolveDeployTarget(r: Run402Instance): Promise<ResolvedDeployTarget> {
  const fromEnv = process.env["RUN402_PROJECT_ID"];
  let projectId: string;
  if (fromEnv && fromEnv.length > 0) {
    projectId = fromEnv;
  } else {
    const active = await r.projects.active();
    if (!active) {
      throw new Error(
        "No project id resolved.\n" +
          "  Set RUN402_PROJECT_ID, or run `run402 projects use <id>` to set the active project.",
      );
    }
    projectId = active;
  }

  const fromEnvAnon = process.env["ANON_KEY"];
  let anonKey: string;
  if (fromEnvAnon && fromEnvAnon.length > 0) {
    anonKey = fromEnvAnon;
  } else {
    const keys = await r.projects.keys(projectId);
    anonKey = keys.anon_key;
  }
  if (!anonKey) {
    throw new Error(
      `Could not resolve anon_key for project ${projectId}.\n` +
        "  Set ANON_KEY, or ensure the project exists in the local keystore.",
    );
  }

  const subdomain = process.env["SUBDOMAIN"]?.trim();
  if (!subdomain) {
    throw new Error(
      "No subdomain resolved.\n" +
        "  Set SUBDOMAIN explicitly, e.g. `SUBDOMAIN=my-portal npx tsx scripts/deploy.ts`.\n" +
        "  Do not rely on the active project for subdomain selection.",
    );
  }
  return { projectId, anonKey, subdomain };
}

/** Read schema.sql + seed.sql (or override) and concatenate. Returns inline SQL. */
export function readMigrations(root: string, seedFile?: string): string {
  const schemaPath = join(root, "schema.sql");
  const seedPath = join(root, seedFile ?? "seed.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  const seed = existsSync(seedPath) ? readFileSync(seedPath, "utf-8") : "";
  return `${schema}\n\n${seed}`;
}

/** Lowercase hex SHA-256 of a string. Used to derive stable migration ids. */
export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** SHA-256 of raw file bytes. Used to diff site files against a live release. */
async function hashFileBytes(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Compare a new functions map against the code hashes from the active release
 * and return either a full `replace` spec (when functions were removed or
 * the hash algorithm doesn't match) or a surgical `patch` spec (when only a
 * subset changed). The exclude list drives `patch.delete` for functions that
 * should be removed from the live release.
 */
function diffFunctionsMap(
  functionsMap: Record<string, FunctionSpec>,
  liveCodeHashes: Map<string, string>,
  excludeFunctions: readonly string[] = [],
): { spec: NonNullable<ReleaseSpec["functions"]>; changed: number; skipped: number } {
  const newNames = new Set(Object.keys(functionsMap));
  const excludeSet = new Set(excludeFunctions);

  // Any live function not in the new map and not in the exclude list would be
  // silently orphaned by a patch — fall back to replace so the release stays clean.
  const orphaned = [...liveCodeHashes.keys()].filter(n => !newNames.has(n) && !excludeSet.has(n));
  if (orphaned.length > 0) {
    return { spec: { replace: functionsMap }, changed: newNames.size, skipped: 0 };
  }

  const toSet: Record<string, FunctionSpec> = {};
  const toDelete: string[] = [];
  let skipped = 0;

  for (const name of excludeFunctions) {
    if (liveCodeHashes.has(name)) toDelete.push(name);
  }

  for (const [name, spec] of Object.entries(functionsMap)) {
    const source = typeof spec.source === "string" ? spec.source : null;
    const liveHash = liveCodeHashes.get(name);
    if (source && liveHash && sha256Hex(source) === liveHash) {
      skipped++;
    } else {
      toSet[name] = spec;
    }
  }

  return {
    spec: { patch: { set: toSet, delete: toDelete } },
    changed: Object.keys(toSet).length,
    skipped,
  };
}

export interface RunDeployOptions {
  projectId: string;
  anonKey: string;
  subdomain: string;
  /** Path to a seed SQL file relative to repo root. Defaults to `seed.sql`. */
  seedFile?: string;
  /** Function names to skip. */
  excludeFunctions?: readonly string[];
  /** Path to an extra function file to add. */
  extraFunction?: string;
  /** Optional first-byte chrome snapshot for ports without a typed seed module. */
  chromeSnapshot?: string | ProjectSeed;
  /** Continue past confirmation-required deploy warnings after explicit review. */
  allowWarnings?: boolean;
  /** When true, prints the assembled spec and returns without calling the API. */
  dryRun?: boolean;
  /**
   * When true, fetch the active release before deploying and use
   * `functions.patch` to only upload functions whose source hash changed.
   * Functions that need to be removed (via excludeFunctions) are explicitly
   * deleted. Falls back to `replace` when orphaned live functions are detected
   * or when the active-release fetch fails.
   */
  patchFunctions?: boolean;
}

export interface RunDeployResult {
  /** True for both real and dry-run successes. */
  ok: true;
  releaseManifest: EngineReleaseManifest;
  schemaMigrationId: string;
  schemaChecksum: string;
  /** Present on real deploys; absent on dry-run. */
  releaseId?: string;
  operationId?: string;
  urls?: Record<string, string>;
  elapsedMs?: number;
}

export interface BuildKychonReleaseSpecOptions {
  database?: NonNullable<ReleaseSpec["database"]>;
  /** Full FileSet from `fileSetFromDir`, or a lazy `LocalDirRef` from `dir()`. */
  fileSet: FileSet | LocalDirRef;
  publicPaths: Record<string, PublicStaticPathSpec>;
  subdomain: string;
  /**
   * Pre-computed functions spec (replace or patch). When provided, takes
   * precedence over `functionsMap`. Use `diffFunctionsMap` to build this
   * when you want surgical `patch` updates rather than a full `replace`.
   */
  functionsSpec?: NonNullable<ReleaseSpec["functions"]>;
  /** Used when `functionsSpec` is absent — emits `{ replace: functionsMap }`. */
  functionsMap?: Record<string, FunctionSpec>;
  routes?: NonNullable<Exclude<ReleaseSpec["routes"], null>>["replace"];
  /**
   * Routed-locale-context slice (v2.5+). When set, the gateway negotiates
   * per-request locale and surfaces it via `x-run402-locale` headers. Today's
   * SSG pages don't read those headers, but setting up the slice now means
   * a future routed HTTP render path inherits negotiation for free. Build
   * the slice with `buildI18nSpec(seed)`. Omitting carries the slice forward
   * from the previous release (`null` clears it).
   */
  i18n?: I18nSpec;
}

/**
 * Project-scoped release spec. The `project` field is bound by `r.project(id)`
 * at apply time, so the assembled spec describes the release without
 * restating the target. See openspec/changes/upgrade-run402-sdk-v2 Decision 3.
 */
export type KychonReleaseSpec = Omit<ReleaseSpec, "project">;

export function buildKychonReleaseSpec(opts: BuildKychonReleaseSpecOptions): KychonReleaseSpec {
  const spec: KychonReleaseSpec = {
    site: {
      // LocalDirRef is handled by the SDK normalizer at apply time.
      replace: opts.fileSet as FileSet,
      public_paths: {
        mode: "explicit",
        replace: opts.publicPaths,
      },
    },
    subdomains: { set: [opts.subdomain] },
    routes: { replace: opts.routes ?? [] },
  };
  if (opts.database) {
    spec.database = opts.database;
  }
  if (opts.functionsSpec) {
    spec.functions = opts.functionsSpec;
  } else if (opts.functionsMap && Object.keys(opts.functionsMap).length > 0) {
    spec.functions = { replace: opts.functionsMap };
  }
  if (opts.i18n) {
    spec.i18n = opts.i18n;
  }
  return spec;
}

/**
 * High-level deploy: build Astro, assemble the v2 ReleaseSpec, and call
 * `r.project(id).apply()` (the v2.0 "Unified Apply" hero). Used by both
 * `deploy.ts` (production) and `deploy-demo.ts` (per-demo orchestration).
 *
 * For asset writes (member photos, resources, admin uploads) use
 * `r.project(id).assets.put(key, source, opts)` (single key) or
 * `r.project(id).assets.uploadDir(path, opts)` (Node batches) — both route
 * through the apply substrate as of `@run402/sdk@2.1.0`. The legacy
 * `initUploadSession` / `getUploadSession` / `completeUploadSession`
 * methods throw `LocalError` since 2.1.0; don't call them.
 */
export async function runDeploy(
  r: Run402Instance,
  opts: RunDeployOptions,
): Promise<RunDeployResult> {
  const buildOptions: BuildAstroOptions = {};
  if (opts.chromeSnapshot !== undefined) {
    buildOptions.chromeSnapshot = opts.chromeSnapshot;
  }
  buildAstro(buildOptions);

  const project = await r.project(opts.projectId);

  const distDir = join(ROOT, "dist");
  injectEnvJs(distDir, opts.anonKey);
  generateAndValidateHeaders(distDir);
  const deploySeed = await resolveDeployOutputSeed(opts.chromeSnapshot);
  const materializedCustomPages = materializeCustomPageStaticFiles(distDir, deploySeed);

  const sql = readMigrations(ROOT, opts.seedFile);
  const migrationId = `kychon_${sha256Hex(sql).slice(0, 16)}`;
  const releaseManifestOptions: Parameters<typeof buildEngineReleaseManifest>[0] = {
    migrationId,
    schemaSql: sql,
  };
  if (opts.seedFile !== undefined) releaseManifestOptions.seedFile = opts.seedFile;
  const releaseManifest = buildEngineReleaseManifest(releaseManifestOptions);
  writeEngineReleaseManifest(distDir, releaseManifest);

  // dir() registers distDir as a lazy LocalDirRef — the SDK walks and hashes
  // each file at apply time rather than upfront. readdir gives us the flat
  // file list we need for public-path registration and for the count log,
  // without creating per-file FsFileSource objects in the JS heap.
  const siteDir = dir(distDir);
  const dirents = await readdir(distDir, { recursive: true, withFileTypes: true });
  const distFiles = dirents
    .filter(d => d.isFile())
    .map(d => join(d.parentPath, d.name).slice(distDir.length + 1).replaceAll("\\", "/"));
  const fileCount = distFiles.length;
  const publicPaths = buildExplicitPublicPathSpecs({
    files: distFiles,
    pageSlugs: materializedCustomPages.map((page) => page.slug),
  });
  const publicPathEntries = Object.entries(publicPaths);

  const collectOpts: CollectFunctionsOptions = {};
  if (opts.excludeFunctions) collectOpts.exclude = opts.excludeFunctions;
  if (opts.extraFunction) collectOpts.extraFunction = opts.extraFunction;

  // Fetch the active release in parallel with the local function-source reads
  // when patch mode is requested. siteLimit:0 skips the (potentially large)
  // site-paths list since we only need the functions inventory here.
  const [functionsMap, liveRelease] = await Promise.all([
    collectFunctionsMap(join(ROOT, "functions"), collectOpts),
    opts.patchFunctions
      ? project.deploy.getActiveRelease({ siteLimit: 0 }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const fnNames = Object.keys(functionsMap);
  const scheduledFns = fnNames.filter((n) => functionsMap[n]?.schedule);

  const liveCodeHashes = liveRelease
    ? new Map(liveRelease.functions.map(f => [f.name, f.code_hash]))
    : null;
  const fnDiff = liveCodeHashes
    ? diffFunctionsMap(functionsMap, liveCodeHashes, opts.excludeFunctions ?? [])
    : null;

  const database: ReleaseSpec["database"] = {
    migrations: [{ id: migrationId, sql }],
    expose: { version: "1", tables: [...EXPOSE_TABLES] },
  };

  const i18nSpec = buildI18nSpec(deploySeed);

  const spec = buildKychonReleaseSpec({
    database,
    fileSet: siteDir,
    publicPaths,
    subdomain: opts.subdomain,
    functionsSpec: fnDiff?.spec,
    functionsMap,
    i18n: i18nSpec,
  });

  const fnSummary = fnDiff
    ? `${fnDiff.changed} changed, ${fnDiff.skipped} skipped (patch)`
    : `${fnNames.length} (replace)`;

  console.log(
      `Deploying to ${opts.projectId} (subdomain: ${opts.subdomain})\n` +
      `  ${fileCount} site files (dir() — walked + hashed by SDK at apply time)\n` +
      `  ${publicPathEntries.length} explicit public paths\n` +
      `  0 static route aliases (clears v1.66 route aliases)\n` +
      `  functions: ${fnSummary} (${scheduledFns.length} scheduled)\n` +
      `  i18n: defaultLocale=${i18nSpec.defaultLocale}, locales=[${i18nSpec.locales.join(", ")}], detect=[${(i18nSpec.detect ?? []).join(", ")}]\n` +
      `  ${sql.length} migration bytes (id: ${migrationId})`,
  );
  if (publicPathEntries.length > 0) {
    const preview = publicPathEntries
      .slice(0, 8)
      .map(([path, spec]) => `${path}->${spec.asset}`)
      .join(", ");
    const suffix = publicPathEntries.length > 8 ? ", ..." : "";
    console.log(`  Public paths: ${preview}${suffix}`);
    console.log("  Hidden implementation paths: /events.html, /search.html, /page.html?slug=...");
    console.log(
      `  Diagnose after deploy: run402 deploy diagnose --project ${opts.projectId} https://${opts.subdomain}.kychon.com/search?q=hello&type=all --method GET`,
    );
  }

  if (opts.dryRun) {
    console.log("\n[dry-run] Would call r.project(id).apply with:");
    console.log(
      JSON.stringify(
        {
          projectId: opts.projectId,
          subdomain: opts.subdomain,
          filesCount: fileCount,
          functionsCount: fnNames.length,
          functionsPatchMode: fnDiff != null,
          functionsChanged: fnDiff?.changed ?? fnNames.length,
          functionsSkipped: fnDiff?.skipped ?? 0,
          functionsWithSchedule: scheduledFns.map(
            (n) => `${n}=${functionsMap[n]?.schedule}`,
          ),
          publicPathsCount: publicPathEntries.length,
          publicPaths,
          routesCount: 0,
          routes: [],
          materializedCustomPages,
          migrationsBytes: sql.length,
          migrationId,
          schemaChecksum: releaseManifest.schemaChecksum,
          releaseManifest,
          exposeTables: EXPOSE_TABLES.length,
          i18n: i18nSpec,
        },
        null,
        2,
      ),
    );
    return {
      ok: true,
      releaseManifest,
      schemaMigrationId: migrationId,
      schemaChecksum: releaseManifest.schemaChecksum,
    };
  }

  const applyOptions: ApplyOptions = {
    onEvent(event) {
      if (event.type !== "plan.warnings") return;
      console.warn("\nDeploy plan warnings:");
      for (const warning of event.warnings) {
        console.warn(
          `  [${warning.severity ?? "warning"}] ${warning.code}: ${warning.message}`,
        );
      }
    },
  };
  if (opts.allowWarnings) {
    applyOptions.allowWarnings = true;
    console.warn(
      "\nContinuing past confirmation-required deploy warnings because allowWarnings is enabled.",
    );
  }

  const startedAt = Date.now();
  const result = await project.apply(spec, applyOptions);
  const elapsedMs = Date.now() - startedAt;

  console.log(`\nDeploy successful in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`  Release id: ${result.release_id}`);
  console.log(`  Operation id: ${result.operation_id}`);
  for (const [k, v] of Object.entries(result.urls)) {
    console.log(`  ${k}: ${v}`);
  }
  const firstPublicUrl = Object.values(result.urls)[0]?.replace(/\/+$/, "");
  const diagnoseBase = firstPublicUrl || `https://${opts.subdomain}.kychon.com`;
  console.log(
    `  Diagnose clean route: run402 deploy diagnose --project ${opts.projectId} ${diagnoseBase}/search?q=hello&type=all --method GET`,
  );

  // Positive readback for the i18n slice — apply() success means both
  // validateI18nSpec (client) and the gateway validator accepted the
  // input, but only the inventory readback proves the slice landed with
  // the values we sent (no silent coercion, no carry-forward surprise).
  // Implements the "verification readback rule" from
  // kychee-com/run402#395-c4505724756; the inventory `i18n` field shipped
  // in @run402/sdk@2.8.1.
  //
  // Best-effort. Three failure modes worth distinguishing:
  //   1. Inventory fetch throws → log a `<fetch failed>` note, don't
  //      block the deploy. Whatever caused the fetch to fail (transient
  //      network, gateway hiccup) isn't a deploy-level problem because
  //      apply() already succeeded.
  //   2. `readback === undefined` → pre-2.8.1 gateway. Surface that the
  //      readback isn't supported on this gateway version rather than
  //      silently passing.
  //   3. `readback === null` → gateway has no slice, but we just sent
  //      one. Genuine bug; warn loud.
  //   4. Field-by-field mismatch → gateway coerced/dropped something.
  //      Warn loud with both values so the diff is obvious in the log.
  try {
    const inv = await project.deploy.getActiveRelease({ siteLimit: 1 });
    const readback = inv?.i18n;
    if (readback === undefined) {
      console.log(
        `  i18n: applied=${formatI18nSlice(i18nSpec)} / readback=<gateway too old to surface, requires v2.8.1+>`,
      );
    } else if (readback === null) {
      console.warn(
        `  i18n: applied=${formatI18nSlice(i18nSpec)} / readback=null  ⚠ slice not on live release`,
      );
    } else if (i18nSpecMatchesReadback(i18nSpec, readback)) {
      console.log(
        `  i18n: applied=${formatI18nSlice(i18nSpec)} / readback=${formatI18nSlice(readback)} ✓`,
      );
    } else {
      console.warn(
        `  i18n: applied=${formatI18nSlice(i18nSpec)} / readback=${formatI18nSlice(readback)}  ⚠ MISMATCH`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(
      `  i18n: applied=${formatI18nSlice(i18nSpec)} / readback=<fetch failed: ${msg}>`,
    );
  }

  return {
    ok: true,
    releaseManifest,
    schemaMigrationId: migrationId,
    schemaChecksum: releaseManifest.schemaChecksum,
    releaseId: result.release_id,
    operationId: result.operation_id,
    urls: result.urls,
    elapsedMs,
  };
}

export interface PatchDeployResult extends RunDeployResult {
  /** Site files uploaded (new + changed). */
  siteFilesChanged: number;
  /** Site files identical to the live release — skipped from upload. */
  siteFilesSkipped: number;
  /** Function specs uploaded (new + changed). */
  functionsChanged: number;
  /** Functions identical to the live release — skipped from upload. */
  functionsSkipped: number;
}

/**
 * Surgical patch deploy: runs `astro build`, diffs the new dist against the
 * active release's `content_sha256` values, and calls `site.patch` + optional
 * `functions.patch` so only changed blobs are sent to the gateway.
 *
 * Never includes subdomains or routes — it is content-only, which keeps it
 * compatible with CI OIDC sessions (which have deploy scope but no
 * infrastructure scope). When no active release is available (first deploy or
 * CI credentials that cannot read release inventory), falls back to a full
 * site.replace + functions.replace — still without subdomains/routes.
 */
export async function patchDeploy(
  r: Run402Instance,
  opts: RunDeployOptions,
): Promise<PatchDeployResult> {
  const buildOptions: BuildAstroOptions = {};
  if (opts.chromeSnapshot !== undefined) buildOptions.chromeSnapshot = opts.chromeSnapshot;
  buildAstro(buildOptions);

  const project = await r.project(opts.projectId);
  const distDir = join(ROOT, "dist");

  injectEnvJs(distDir, opts.anonKey);
  generateAndValidateHeaders(distDir);
  const deploySeed = await resolveDeployOutputSeed(opts.chromeSnapshot);
  const materializedCustomPages = materializeCustomPageStaticFiles(distDir, deploySeed);

  const sql = readMigrations(ROOT, opts.seedFile);
  const migrationId = `kychon_${sha256Hex(sql).slice(0, 16)}`;
  const releaseManifestOptions: Parameters<typeof buildEngineReleaseManifest>[0] = {
    migrationId,
    schemaSql: sql,
  };
  if (opts.seedFile !== undefined) releaseManifestOptions.seedFile = opts.seedFile;
  const releaseManifest = buildEngineReleaseManifest(releaseManifestOptions);
  writeEngineReleaseManifest(distDir, releaseManifest);

  // Collect all local content first so both the patch and the fallback paths
  // can use it without duplicating work.
  const collectOpts: CollectFunctionsOptions = {};
  if (opts.excludeFunctions) collectOpts.exclude = opts.excludeFunctions;
  if (opts.extraFunction) collectOpts.extraFunction = opts.extraFunction;

  const [newFileSet, functionsMap] = await Promise.all([
    fileSetFromDir(distDir),
    collectFunctionsMap(join(ROOT, "functions"), collectOpts),
  ]);

  const publicPaths = buildExplicitPublicPathSpecs({
    files: Object.keys(newFileSet),
    pageSlugs: materializedCustomPages.map(p => p.slug),
  });

  const database: ReleaseSpec["database"] = {
    migrations: [{ id: migrationId, sql }],
    expose: { version: "1", tables: [...EXPOSE_TABLES] },
  };

  const fnNames = Object.keys(functionsMap);
  const scheduledFns = fnNames.filter(n => functionsMap[n]?.schedule);

  // Try to fetch the active release for diffing. CI sessions (deploy-only
  // scope) cannot read release inventory, so this will throw in CI — that's
  // expected and handled below.
  let liveRelease: ActiveReleaseInventory | null = null;
  try {
    liveRelease = await project.deploy.getActiveRelease({ siteLimit: 25000 });
  } catch {
    liveRelease = null;
  }

  // Build site and functions specs — smart patch when a baseline is
  // available, full replace when it isn't. Either way: no subdomains,
  // no routes (content-only, CI-compatible).
  let siteSpec: KychonReleaseSpec["site"];
  let siteChanged: number;
  let siteSkipped = 0;
  let patchDeleteCount = 0;

  if (liveRelease) {
    const livePaths = new Map(liveRelease.site.paths.map(p => [p.path, p.content_sha256]));
    const patchPut: FileSet = {};
    const patchDelete: string[] = [];

    await Promise.all(
      Object.entries(newFileSet).map(async ([path, source]) => {
        const liveSha = livePaths.get(path);
        if (!liveSha) {
          patchPut[path] = source;
        } else {
          const localSha = await hashFileBytes((source as FsFileSource).path);
          if (localSha !== liveSha) {
            patchPut[path] = source;
          } else {
            siteSkipped++;
          }
        }
      }),
    );
    for (const path of livePaths.keys()) {
      if (!newFileSet[path]) patchDelete.push(path);
    }
    patchDeleteCount = patchDelete.length;
    siteChanged = Object.keys(patchPut).length;
    siteSpec = {
      patch: { put: patchPut, delete: patchDelete },
      public_paths: { mode: "explicit", replace: publicPaths },
    };
  } else {
    console.warn("  No active release available — using site.replace.");
    siteChanged = Object.keys(newFileSet).length;
    siteSpec = { replace: newFileSet, public_paths: { mode: "explicit", replace: publicPaths } };
  }

  const fnDiff = liveRelease
    ? diffFunctionsMap(functionsMap, new Map(liveRelease.functions.map(f => [f.name, f.code_hash])), opts.excludeFunctions ?? [])
    : null;

  // The i18n slice is INTENTIONALLY omitted in patchDeploy. The Run402 SDK's
  // `assertCiDeployableSpec` (CI OIDC sessions) rejects spec.i18n the same way
  // it rejects subdomains/routes — `forbidden_spec_field` / `resource: 'i18n'`
  // (kychee-com/run402#395 follow-up). Matches the existing patchDeploy
  // contract: "content-only, no infrastructure scope." Carry-forward semantics
  // (omit → inherit from base release) mean that once a local runDeploy sets
  // the slice via `bash deploy-all.sh`, every subsequent CI patchDeploy
  // preserves it unchanged.
  const spec: KychonReleaseSpec = {
    site: siteSpec,
    database,
    functions: fnDiff?.spec ?? { replace: functionsMap },
  };

  const modeSuffix = liveRelease ? "patch" : "replace (no baseline)";
  console.log(
    `Patch deploy to ${opts.projectId} (subdomain: ${opts.subdomain}) [${modeSuffix}]\n` +
    `  Site: ${siteChanged} changed + ${patchDeleteCount} removed, ${siteSkipped} skipped (of ${Object.keys(newFileSet).length} total)\n` +
    `  Functions: ${fnDiff ? `${fnDiff.changed} changed, ${fnDiff.skipped} skipped` : `${fnNames.length} (replace)`} (of ${fnNames.length} total, ${scheduledFns.length} scheduled)\n` +
    `  i18n: (omitted — CI OIDC forbids; carries forward from base release)\n` +
    `  ${sql.length} migration bytes (id: ${migrationId})`,
  );

  if (opts.dryRun) {
    console.log("\n[dry-run] Would call r.project(id).apply with site.patch + functions.patch");
    return {
      ok: true,
      releaseManifest,
      schemaMigrationId: migrationId,
      schemaChecksum: releaseManifest.schemaChecksum,
      siteFilesChanged: siteChanged,
      siteFilesSkipped: siteSkipped,
      functionsChanged: fnDiff?.changed ?? fnNames.length,
      functionsSkipped: fnDiff?.skipped ?? 0,
    };
  }

  const applyOptions: ApplyOptions = {
    onEvent(event) {
      if (event.type !== "plan.warnings") return;
      console.warn("\nDeploy plan warnings:");
      for (const warning of event.warnings) {
        console.warn(`  [${warning.severity ?? "warning"}] ${warning.code}: ${warning.message}`);
      }
    },
  };
  if (opts.allowWarnings) {
    applyOptions.allowWarnings = true;
    console.warn("\nContinuing past confirmation-required deploy warnings because allowWarnings is enabled.");
  }

  const startedAt = Date.now();
  const result = await project.apply(spec, applyOptions);
  const elapsedMs = Date.now() - startedAt;

  console.log(`\nPatch deploy successful in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`  Release id: ${result.release_id}`);
  console.log(`  Operation id: ${result.operation_id}`);
  for (const [k, v] of Object.entries(result.urls)) {
    console.log(`  ${k}: ${v}`);
  }

  return {
    ok: true,
    releaseManifest,
    schemaMigrationId: migrationId,
    schemaChecksum: releaseManifest.schemaChecksum,
    releaseId: result.release_id,
    operationId: result.operation_id,
    urls: result.urls,
    elapsedMs,
    siteFilesChanged: siteChanged,
    siteFilesSkipped: siteSkipped,
    functionsChanged: fnDiff?.changed ?? fnNames.length,
    functionsSkipped: fnDiff?.skipped ?? 0,
  };
}

/**
 * Format an SDK error for human-readable console output. Distinguishes
 * Run402DeployError / PaymentRequired / Unauthorized / ApiError /
 * NetworkError / LocalError so the next-action message points at the
 * right fix.
 */
export async function prettyPrintError(err: unknown): Promise<string> {
  const sdk = await import("@run402/sdk");
  if (err instanceof sdk.Run402DeployError) {
    const fixHint = err.fix
      ? `\n  Suggested fix: ${err.fix.action}${err.fix.path ? ` @ ${err.fix.path}` : ""}`
      : "";
    return (
      `Deploy error [${err.code}] in phase "${err.phase}" (resource: ${err.resource}): ${err.message}${fixHint}`
    );
  }
  if (err instanceof sdk.PaymentRequired) {
    return (
      `Payment required (HTTP ${err.status ?? "?"}) while ${err.context}: ${err.message}\n` +
      "  Fix: run `run402 tier set <name>` to renew (prototype $0.10 / hobby $5 / team $20),\n" +
      "       or run `run402 billing` to top up the allowance balance first."
    );
  }
  if (err instanceof sdk.Unauthorized) {
    return (
      `Unauthorized (HTTP ${err.status ?? "?"}) while ${err.context}: ${err.message}\n` +
      "  Fix: ensure the project is in your keystore and the allowance is configured."
    );
  }
  if (err instanceof sdk.ApiError) {
    const bodyStr = err.body ? `\n  Server body: ${JSON.stringify(err.body)}` : "";
    return `API error (HTTP ${err.status ?? "?"}) while ${err.context}: ${err.message}${bodyStr}`;
  }
  if (err instanceof sdk.NetworkError) {
    return `Network error while ${err.context}: ${err.message}`;
  }
  if (err instanceof sdk.LocalError) {
    return (
      `Local error while ${err.context}: ${err.message}\n` +
      "  No HTTP request was made. Likely an input/filesystem issue (missing file, unreadable dir)."
    );
  }
  if (err instanceof sdk.Run402Error) {
    const httpHint = err.status ? ` (HTTP ${err.status})` : "";
    return `Run402 error${httpHint} while ${err.context}: ${err.message}`;
  }
  if (err instanceof Error) return `Unexpected error: ${err.message}`;
  return `Unexpected non-error throw: ${String(err)}`;
}

/** Tiny argv check for the --dry-run flag. */
export function isDryRun(argv: readonly string[]): boolean {
  return argv.includes("--dry-run");
}

/** Format a byte count as a short human-readable string ("1.4MB", "812KB", "402B"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
