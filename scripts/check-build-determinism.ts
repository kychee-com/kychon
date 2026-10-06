/**
 * Build-determinism gate: two builds of the same source must produce the same
 * deploy artifact, byte for byte.
 *
 * Runs the deploy pipeline's build half twice (astro build, the
 * adapter-aware artifact pass, the @run402/astro release slice, the functions
 * map and the migration SQL) from a clean `dist/` each time, with a different
 * commit SHA and wall clock, then compares every output: site files (HTML,
 * JS, CSS, images, JSON), every function spec (ssr, kychon-api, reset-demo,
 * ...), the routes and public paths, and the migration. Any difference means
 * a no-change deploy would re-upload files or redeploy a function.
 *
 * Also fails when the checkout's absolute path leaks into an output (other
 * than the ssr bundle, see PATH_LEAK_EXEMPT), since that makes a laptop build
 * and a CI build of one commit differ.
 *
 * `kychon-release.json` is the one intentional exception: it records the
 * commit SHA and build time by design.
 *
 * Usage: npx tsx scripts/check-build-determinism.ts
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { ROOT, buildAstro, collectFunctionsMap, readMigrations, writeAdapterAwareArtifacts } from "./_lib.ts";
import { countManifestAssetLists } from "../src/integrations/deterministic-server-manifest.mjs";
import { buildEngineReleaseManifest } from "./release-manifest.ts";

/** Outputs allowed to differ between builds of one commit. */
const INTENTIONALLY_VARIABLE = new Set(["site:kychon-release.json"]);

const DIST_DIR = join(ROOT, "dist");
const CLIENT_DIR = join(DIST_DIR, "run402", "client");
/** Build caches cleared between builds so the second build can't just reuse the first. */
const CACHE_DIRS = [DIST_DIR, join(ROOT, ".astro"), join(ROOT, "node_modules", ".vite")];

/** Output name → its exact bytes (as a string; site files hashed below). */
type BuildOutputs = Map<string, string>;

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split("\\").join("/"))
    .sort();
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Outputs exempt from the checkout-path check. Astro's compiler bakes every
 * component's absolute file path (and its config dirs) into the server
 * bundle; that can't be turned off, and the CI checkout path is fixed, so it
 * doesn't churn CI deploys. It does mean a laptop deploy redeploys `ssr`.
 */
const PATH_LEAK_EXEMPT = new Set(["function:ssr"]);

async function buildOnce(run: number, scratch: string): Promise<BuildOutputs> {
  for (const dir of CACHE_DIRS) rmSync(dir, { recursive: true, force: true });

  // Inputs that legitimately differ between two builds of one commit.
  process.env.GITHUB_SHA = String(run).repeat(40);
  console.log(`\n[determinism] build ${run} (GITHUB_SHA=${process.env.GITHUB_SHA.slice(0, 8)}…)`);
  buildAstro();

  const releaseManifest = buildEngineReleaseManifest({ migrationId: "determinism-check", schemaSql: "" });
  const slice = await writeAdapterAwareArtifacts({
    distDir: DIST_DIR,
    clientDir: CLIENT_DIR,
    adapterActive: true,
    anonKey: "determinism-check-anon-key",
    releaseManifest,
  });
  if (!slice) throw new Error("@run402/astro adapter did not produce a release slice");

  // reset-demo is generated from the seed on every deploy, so build it the same way.
  // The file name is the function name, so each build gets its own dir.
  const resetDemoDir = join(scratch, `build-${run}`);
  mkdirSync(resetDemoDir, { recursive: true });
  const resetDemo = join(resetDemoDir, "reset-demo.js");
  writeFileSync(
    resetDemo,
    execFileSync("node", ["scripts/generate-reset-function.js", "seed.sql", "0 * * * *"], { cwd: ROOT, encoding: "utf-8" }),
  );
  const functionsMap = await collectFunctionsMap(join(ROOT, "functions"), { extraFunction: resetDemo });

  const outputs: BuildOutputs = new Map();
  for (const file of listFiles(CLIENT_DIR)) {
    const bytes = readFileSync(join(CLIENT_DIR, file));
    // Keep text verbatim so a mismatch can show where it differs.
    outputs.set(`site:${file}`, /\.(html|js|mjs|css|json|txt|xml|svg|webmanifest)$/.test(file) ? bytes.toString("utf-8") : sha256(bytes));
  }
  for (const [name, spec] of Object.entries({ ...functionsMap, ...slice.functions.replace })) {
    outputs.set(`function:${name}`, json(spec));
  }
  outputs.set("routes", json(slice.routes ?? null));
  // The site spec is a LocalDirRef to this checkout's client dir: compare it
  // without the checkout path.
  outputs.set("site-spec", json(slice.site).replaceAll(ROOT, "<root>"));
  outputs.set("migration", readMigrations(ROOT));
  return outputs;
}

/** A short window around the first differing character. */
function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 60);
  const show = (s: string) => JSON.stringify(s.slice(from, i + 60));
  return `at char ${i}:\n      build 1: ${show(a)}\n      build 2: ${show(b)}`;
}

async function main(): Promise<void> {
  // A stable Astro encryption key is a deploy input (the ASTRO_KEY CI secret);
  // without one Astro mints a random key per build and the ssr bundle drifts.
  process.env.ASTRO_KEY ||= Buffer.alloc(32, 7).toString("base64");
  const scratch = mkdtempSync(join(tmpdir(), "kychon-determinism-"));
  try {
    const first = await buildOnce(1, scratch);
    const second = await buildOnce(2, scratch);

    const problems: string[] = [];
    for (const name of [...new Set([...first.keys(), ...second.keys()])].sort()) {
      if (INTENTIONALLY_VARIABLE.has(name)) continue;
      const a = first.get(name);
      const b = second.get(name);
      if (a === undefined || b === undefined) {
        problems.push(`${name}: only in build ${a === undefined ? 2 : 1}`);
      } else if (a !== b) {
        problems.push(`${name}: differs ${firstDifference(a, b)}`);
      }
    }
    // Astro's asset-list order is a glob race that doesn't fire on every
    // build, so check the invariant directly rather than relying on two
    // builds happening to disagree.
    const ssrSource = String((JSON.parse(second.get("function:ssr") ?? "{}") as { source?: string }).source ?? "");
    const assetLists = countManifestAssetLists(ssrSource);
    if (assetLists.total === 0) {
      problems.push('function:ssr: no serialized manifest "assets" list found (Astro changed its format? update kychon-deterministic-server-manifest)');
    } else if (assetLists.unsorted > 0) {
      problems.push("function:ssr: server manifest asset list is not sorted (kychon-deterministic-server-manifest did not run?)");
    }
    for (const [name, content] of second) {
      if (!PATH_LEAK_EXEMPT.has(name) && content.includes(ROOT)) problems.push(`${name}: contains the checkout path ${ROOT}`);
    }

    if (problems.length > 0) {
      console.error(`\n[determinism] FAIL: ${problems.length} build output problem(s):`);
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }
    console.log(`\n[determinism] OK: ${first.size} outputs byte-identical across two builds (${INTENTIONALLY_VARIABLE.size} intentionally variable)`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

await main();
