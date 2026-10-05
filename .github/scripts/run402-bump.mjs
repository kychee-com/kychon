#!/usr/bin/env node
// Bump every run402 package in package.json to its latest published version.
// Shared verbatim by kychee-com/kychon and kychee-com/kychon-concierge so both
// move in lockstep (.github/workflows/run402-bump.yml runs it on the same
// schedule in each repo).
//
// - Packages: every dependency/devDependency named `run402` or `@run402/*`.
// - Peers: when `@run402/sdk` moves, its peerDependencies that this repo
//   already declares (e.g. @x402/*, viem) move to the SDK's required version
//   so the install resolves.
// - Specifier style is preserved: exact pins stay exact, caret ranges stay caret.
//
// Usage: node .github/scripts/run402-bump.mjs [--dry-run]
// Writes `changed` and `summary` to $GITHUB_OUTPUT when set.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const declared = { ...pkg.dependencies, ...pkg.devDependencies };
const isRun402 = (name) => name === "run402" || name.startsWith("@run402/");

function npmView(spec, field) {
  const out = execFileSync("npm", ["view", spec, field, "--json"], { encoding: "utf8" }).trim();
  return out ? JSON.parse(out) : undefined;
}

const stripRange = (spec) => spec.replace(/^[\^~=]/, "");
const exact = (spec) => /^\d/.test(spec);

const targets = new Map(); // name -> { from, to, exact }
for (const [name, spec] of Object.entries(declared)) {
  if (!isRun402(name)) continue;
  const latest = npmView(name, "version");
  if (latest && stripRange(spec) !== latest) targets.set(name, { from: spec, to: latest, exact: exact(spec) });
}

const sdkSpec = declared["@run402/sdk"];
if (sdkSpec) {
  const sdkVersion = targets.get("@run402/sdk")?.to ?? stripRange(sdkSpec);
  const peers = npmView(`@run402/sdk@${sdkVersion}`, "peerDependencies") ?? {};
  for (const [name, range] of Object.entries(peers)) {
    const spec = declared[name];
    if (!spec) continue;
    // Exact peer pins are installed as-is; ranges resolve to their newest match.
    const to = exact(range) ? range : npmView(`${name}@${range}`, "version");
    const resolved = Array.isArray(to) ? to.at(-1) : to;
    if (resolved && stripRange(spec) !== resolved) targets.set(name, { from: spec, to: resolved, exact: exact(spec) });
  }
}

const summary = [...targets].map(([name, t]) => `${name} ${t.from} -> ${t.to}`).join(", ");
console.log(targets.size ? `run402 bump: ${summary}` : "run402 packages are already at latest.");

if (targets.size && !dryRun) {
  for (const exactGroup of [true, false]) {
    const specs = [...targets].filter(([, t]) => t.exact === exactGroup).map(([name, t]) => `${name}@${t.to}`);
    if (!specs.length) continue;
    const args = ["install", "--no-audit", "--no-fund", ...(exactGroup ? ["--save-exact"] : []), ...specs];
    execFileSync("npm", args, { stdio: "inherit" });
  }
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${targets.size > 0}\nsummary=${summary}\n`);
}
