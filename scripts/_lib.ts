/**
 * Shared utilities for scripts/deploy.ts and scripts/deploy-batched.ts.
 *
 * All Run402 interactions go through @run402/sdk/node — no execSync calls.
 * Per the deploy spec policy, new tooling targeting Run402 must use the SDK.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import type { run402 } from "@run402/sdk/node";

// Type extraction from the SDK's call sites — avoids deep-importing internal modules.
// If the SDK reshapes its public method signatures, these break at compile time and
// we know to update the script. That's the contract we want.
type Run402Instance = ReturnType<typeof run402>;
export type BundleDeployOptions = Parameters<Run402Instance["apps"]["bundleDeploy"]>[1];
export type BundleFunctionSpec = NonNullable<NonNullable<BundleDeployOptions>["functions"]>[number];
export type SiteFile = NonNullable<NonNullable<BundleDeployOptions>["files"]>[number];
export type BundleRls = NonNullable<NonNullable<BundleDeployOptions>["rls"]>;

/** File extensions we treat as UTF-8 text. Everything else is base64-encoded as binary. */
const TEXT_EXTS = new Set([
  ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".json", ".txt",
  ".xml", ".svg", ".webmanifest", ".map", ".md", ".csv", ".yaml", ".yml",
]);

/** Image extensions used by the batching loop in deploy-batched.ts to slice large payloads. */
export const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg|ico|avif)$/i;

function isTextFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return TEXT_EXTS.has(name.slice(dot).toLowerCase());
}

async function readAsSiteFile(absPath: string, relPath: string): Promise<SiteFile> {
  const buf = await readFile(absPath);
  if (isTextFile(relPath)) {
    return { file: relPath, data: buf.toString("utf-8"), encoding: "utf-8" };
  }
  return { file: relPath, data: buf.toString("base64"), encoding: "base64" };
}

/**
 * Walk `root` and return SiteFile[] with POSIX-style relative paths.
 * Text files use utf-8 encoding; everything else is base64.
 */
export async function collectFiles(root: string): Promise<SiteFile[]> {
  if (!existsSync(root)) return [];
  const out: SiteFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        const rel = relative(root, full).split(/[\\/]/).join("/");
        out.push(await readAsSiteFile(full, rel));
      }
    }
  };
  await walk(root);
  return out;
}

/**
 * Like {@link collectFiles}, but also returns the on-disk byte size of each file
 * (before base64 expansion). Used by the batching loop to slice payloads.
 */
export interface SizedSiteFile {
  file: SiteFile;
  bytes: number;
}

export async function collectFilesWithSize(root: string): Promise<SizedSiteFile[]> {
  if (!existsSync(root)) return [];
  const out: SizedSiteFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        const rel = relative(root, full).split(/[\\/]/).join("/");
        const bytes = statSync(full).size;
        out.push({ file: await readAsSiteFile(full, rel), bytes });
      }
    }
  };
  await walk(root);
  return out;
}

/**
 * Read functions from a directory of `.js` files. Each file becomes one
 * BundleFunctionSpec; cron schedules are parsed from `// schedule: "..."` comments.
 *
 * Honors two env-var overrides used by the demo deploys:
 *   - `EXCLUDE_FUNCTIONS=name1,name2` — skip these names
 *   - `EXTRA_FUNCTION=path/to/file.js` — append this single file as an extra function
 */
export async function collectFunctions(dir: string): Promise<BundleFunctionSpec[]> {
  const fns: BundleFunctionSpec[] = [];
  if (existsSync(dir)) {
    const entries = await readdir(dir);
    for (const f of entries.filter((e) => e.endsWith(".js"))) {
      const code = await readFile(join(dir, f), "utf-8");
      const fn = makeFunction(f.replace(/\.js$/, ""), code);
      fns.push(fn);
    }
  }

  const exclude = process.env["EXCLUDE_FUNCTIONS"];
  let result = fns;
  if (exclude) {
    const skip = new Set(exclude.split(",").map((s) => s.trim()));
    result = result.filter((fn) => !skip.has(fn.name));
  }

  const extra = process.env["EXTRA_FUNCTION"];
  if (extra) {
    const code = await readFile(extra, "utf-8");
    const name = (extra.split("/").pop() ?? extra).replace(/\.js$/, "");
    result = [...result, makeFunction(name, code)];
  }

  return result;
}

function makeFunction(name: string, code: string): BundleFunctionSpec {
  const scheduleMatch = code.match(/\/\/\s*schedule:\s*"([^"]+)"/);
  if (scheduleMatch && scheduleMatch[1]) {
    return { name, code, schedule: scheduleMatch[1] };
  }
  return { name, code };
}

/**
 * Shared RLS configuration. Both deploy.ts and deploy-batched.ts use the same
 * template + table list. If a new table needs RLS, add it here.
 *
 * Template `public_read_authenticated_write` was renamed server-side from
 * `public_read` (see commit de160d2 + GH issue kychee-com/run402#108 history).
 */
export const RLS_CONFIG: BundleRls = {
  template: "public_read_authenticated_write",
  tables: [
    { table: "site_config" },
    { table: "pages" },
    { table: "sections" },
    { table: "membership_tiers" },
    { table: "member_custom_fields" },
    { table: "announcements" },
    { table: "activity_log" },
    { table: "members" },
    { table: "events" },
    { table: "event_rsvps" },
    { table: "resources" },
    { table: "forum_categories" },
    { table: "forum_topics" },
    { table: "forum_replies" },
    { table: "committees" },
    { table: "committee_members" },
    { table: "content_translations" },
    { table: "moderation_log" },
    { table: "member_insights" },
    { table: "newsletter_drafts" },
    { table: "reactions" },
  ],
};

/** Run `npx astro build` from the repo root, streaming output. */
export function buildAstro(): void {
  console.log("Building Astro project...");
  execSync("npx astro build", { stdio: "inherit" });
}

/**
 * Inject the Run402 anon_key into `dist/js/env.js` after `astro build`.
 * Mirrors the runtime config the public site reads at boot.
 */
export function injectEnvJs(distDir: string, anonKey: string): void {
  const envJsPath = join(distDir, "js", "env.js");
  const content =
    "// env.js — Runtime config (auto-generated by deploy)\n" +
    "window.__KYCHON_API = 'https://api.run402.com';\n" +
    `window.__KYCHON_ANON_KEY = '${anonKey}';\n`;
  writeFileSync(envJsPath, content);
}

export interface ResolvedDeployTarget {
  projectId: string;
  anonKey: string;
  subdomain: string;
}

/**
 * Resolve the project id (env var → SDK active project), then fetch the
 * anon_key from the local keystore. Errors out with an actionable message
 * if either step fails.
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

  const subdomain = process.env["SUBDOMAIN"] ?? "kychon";
  return { projectId, anonKey, subdomain };
}

/** Read schema.sql + seed.sql (or override) and concatenate. Returns inline migrations. */
export function readMigrations(root: string): string {
  const schemaPath = join(root, "schema.sql");
  const seedPath = join(root, process.env["SEED_FILE"] ?? "seed.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  const seed = existsSync(seedPath) ? readFileSync(seedPath, "utf-8") : "";
  return `${schema}\n\n${seed}`;
}

/**
 * Format an SDK error for human-readable console output. Distinguishes
 * PaymentRequired / Unauthorized / ApiError / NetworkError so the next-action
 * message points at the right CLI fix. Other Run402Error subclasses (e.g.
 * LocalError, ProjectNotFound) fall through to the generic abstract-base handler.
 *
 * NOTE: as of @run402/sdk@1.43.0, `LocalError` is defined in dist/errors.d.ts
 * but not re-exported from `@run402/sdk` or `@run402/sdk/node`'s public surface.
 * Once that re-export lands, add a specific branch here. The Run402Error base
 * class is exported, so instanceof on it still catches LocalError correctly.
 */
export async function prettyPrintError(err: unknown): Promise<string> {
  const sdk = await import("@run402/sdk");
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
  if (err instanceof sdk.Run402Error) {
    const httpHint = err.status ? ` (HTTP ${err.status})` : "";
    return `Run402 error${httpHint} while ${err.context}: ${err.message}`;
  }
  if (err instanceof Error) return `Unexpected error: ${err.message}`;
  return `Unexpected non-error throw: ${String(err)}`;
}

/** Tiny argv check for the --dry-run flag used by both entry scripts. */
export function isDryRun(argv: readonly string[]): boolean {
  return argv.includes("--dry-run");
}
