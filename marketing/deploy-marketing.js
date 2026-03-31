#!/usr/bin/env node

/**
 * Deploy the Wild Lychee marketing site to Run402.
 * Static files only — no database, no functions.
 *
 * Usage: node marketing/deploy-marketing.js
 *
 * Set MARKETING_PROJECT_ID env var to target a specific project,
 * or it will use the first project with "marketing" in its name
 * from `run402 projects list`, or prompt to provision a new one.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const ROOT = new URL('.', import.meta.url).pathname;

function collectFiles(dir, base = dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'deploy-marketing.js') continue; // skip self
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, base));
    } else {
      files.push({
        file: relative(base, full),
        data: readFileSync(full, 'utf-8'),
      });
    }
  }
  return files;
}

// Resolve project ID
let projectId = process.env.MARKETING_PROJECT_ID || '';
if (!projectId) {
  try {
    const out = execSync('run402 projects list', { encoding: 'utf-8' });
    const projects = JSON.parse(out);
    // Look for a project with "marketing" in its name or just use active
    const active = projects.find(p => p.active);
    if (active) {
      console.log(`Using active project: ${active.project_id}`);
      console.log('Set MARKETING_PROJECT_ID to override.');
      projectId = active.project_id;
    }
  } catch { /* fall through */ }
}

if (!projectId) {
  console.log('No project found. Provision one with:');
  console.log('  run402 projects provision --name wild-lychee-marketing');
  process.exit(1);
}

// Collect site files from marketing/
const siteFiles = collectFiles(ROOT, ROOT);

// Assemble manifest (static-only, no migrations, no functions, no RLS)
const manifest = {
  project_id: projectId,
  files: siteFiles,
  subdomain: 'wildlychee',
};

const manifestPath = join(ROOT, '.marketing-manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Deploying marketing site to ${projectId} (subdomain: wildlychee)...`);
console.log(`  ${siteFiles.length} files`);

try {
  const result = execSync(`run402 deploy --manifest "${manifestPath}"`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(result);
  console.log('Deploy successful!');
  console.log(JSON.stringify(parsed, null, 2));
} catch (err) {
  console.error('Deploy failed:', err.stderr || err.message);
  process.exit(1);
}
