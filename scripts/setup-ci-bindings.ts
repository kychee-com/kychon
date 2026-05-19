/**
 * One-shot OIDC setup: create Run402 CI bindings for all demo projects so
 * GitHub Actions can deploy without storing any private keys or allowance JSON.
 *
 * Run once locally (with your allowance wallet configured):
 *   npx tsx --env-file=.env scripts/setup-ci-bindings.ts
 *
 * After it completes, add the printed variables to:
 *   https://github.com/kychee-com/kychon/settings/variables/actions
 *
 * The binding links the GitHub OIDC subject for pushes to main on this repo
 * to a Run402 project. No secrets are needed in CI — GitHub's OIDC provider
 * issues short-lived tokens that the SDK exchanges for Run402 access tokens.
 */

import { randomBytes } from "node:crypto";

import { run402, signCiDelegation } from "@run402/sdk/node";
import { CI_GITHUB_ACTIONS_PROVIDER } from "@run402/sdk";

import { DEMOS } from "./deploy-demo.ts";
import { prettyPrintError } from "./_lib.ts";

// GitHub repository metadata — used to scope bindings to this repo only.
const GITHUB_REPO = "kychee-com/kychon";
const GITHUB_REPO_ID = "1194023187"; // numeric id; prevents spoofing on rename/transfer

// The OIDC subject claim GitHub issues for pushes and manual triggers on main.
const SUBJECT_MATCH = `repo:${GITHUB_REPO}:ref:refs/heads/main`;

async function main(): Promise<void> {
  const r = run402(); // uses the local allowance wallet to sign delegations

  console.log(`Setting up Run402 CI bindings for ${GITHUB_REPO}\n`);
  console.log(`Subject: ${SUBJECT_MATCH}`);
  console.log(`Repo ID: ${GITHUB_REPO_ID}\n`);

  const varLines: string[] = [];

  for (const [key, config] of Object.entries(DEMOS)) {
    const projectId = process.env[config.projectIdEnvVar];
    if (!projectId) {
      console.error(`Missing env var: ${config.projectIdEnvVar}`);
      process.exit(1);
    }

    console.log(`--- ${config.displayName} (${projectId}) ---`);

    // Each binding gets a fresh nonce to prevent replay.
    const nonce = randomBytes(16).toString("hex");

    const delegationValues = {
      project_id: projectId,
      subject_match: SUBJECT_MATCH,
      allowed_actions: ["deploy"] as const,
      allowed_events: ["push", "workflow_dispatch"] as const,
      github_repository_id: GITHUB_REPO_ID,
      nonce,
    };

    // Sign with the local allowance wallet — proves the project owner authorised
    // this binding. The signed delegation is verified by Run402 server-side.
    const signed_delegation = signCiDelegation(delegationValues);

    const binding = await r.ci.createBinding({
      project_id: projectId,
      provider: CI_GITHUB_ACTIONS_PROVIDER,
      subject_match: SUBJECT_MATCH,
      allowed_actions: ["deploy"],
      allowed_events: ["push", "workflow_dispatch"],
      github_repository_id: GITHUB_REPO_ID,
      nonce,
      signed_delegation,
    });

    console.log(`  Binding created: ${binding.id}`);
    console.log(`  Expires: ${binding.expires_at ?? "never"}`);

    // Fetch the anon key from the local keystore so we can print it as a
    // GitHub variable. The anon key is a public JWT — it's already embedded
    // in every deployed env.js and readable by anyone who visits the site.
    const keys = await r.projects.keys(projectId);

    varLines.push(`${config.projectIdEnvVar}=${projectId}`);
    varLines.push(`${config.anonKeyEnvVar}=${keys.anon_key}`);

    console.log(`  GitHub var: ${config.projectIdEnvVar}=${projectId}`);
    console.log(`  GitHub var: ${config.anonKeyEnvVar}=${keys.anon_key}\n`);
  }

  console.log("=".repeat(60));
  console.log("Next steps:");
  console.log("");
  console.log("1. Add these variables to GitHub Actions:");
  console.log(`   https://github.com/${GITHUB_REPO}/settings/variables/actions`);
  console.log("");
  for (const line of varLines) {
    console.log(`   ${line}`);
  }
  console.log("");
  console.log("2. The deploy-demos.yml workflow is already active —");
  console.log("   it will run automatically on every push to main.");
}

main().catch(async (err) => {
  console.error(await prettyPrintError(err));
  process.exit(1);
});
