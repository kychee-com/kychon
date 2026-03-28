#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { writeFileSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const ROOT = new URL('.', import.meta.url).pathname;

function readText(path) {
  return readFileSync(join(ROOT, path), 'utf-8');
}

function collectFiles(dir, base = dir) {
  const files = [];
  if (!existsSync(join(ROOT, dir))) return files;
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, base));
    } else {
      files.push({
        file: relative(base, full),
        data: readText(full),
      });
    }
  }
  return files;
}

function collectFunctions(dir) {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir))
    .filter(f => f.endsWith('.js'))
    .map(f => {
      const name = f.replace('.js', '');
      const code = readText(join(dir, f));
      const scheduleMatch = code.match(/\/\/\s*schedule:\s*"([^"]+)"/);
      const fn = { name, code };
      if (scheduleMatch) fn.schedule = scheduleMatch[1];
      return fn;
    });
}

// Resolve project ID
const projectId = process.env.RUN402_PROJECT_ID || (() => {
  try {
    const out = execSync('run402 projects list', { encoding: 'utf-8' });
    const projects = JSON.parse(out);
    const active = projects.find(p => p.active);
    if (active) return active.project_id;
    if (projects.length > 0) return projects[0].project_id;
  } catch { /* fall through */ }
  console.error('No RUN402_PROJECT_ID set and no active run402 project found.');
  process.exit(1);
})();

const subdomain = process.env.SUBDOMAIN || 'wildlychee';

// Read schema + seed as combined migrations
const schema = readText('schema.sql');
const seed = readText('seed.sql');
const migrations = schema + '\n\n' + seed;

// Write migrations to temp file (migrations_file approach avoids JSON escaping)
const migrationsPath = join(ROOT, '.migrations.sql');
writeFileSync(migrationsPath, migrations);

// Collect site files
const siteFiles = collectFiles('site', 'site');

// Collect functions
const functions = collectFunctions('functions');

// RLS configuration
const rls = {
  template: 'public_read',
  tables: [
    { table: 'site_config' },
    { table: 'pages' },
    { table: 'sections' },
    { table: 'membership_tiers' },
    { table: 'member_custom_fields' },
    { table: 'announcements' },
    { table: 'activity_log' },
    { table: 'members', owner_column: 'user_id' },
  ],
};

// Assemble manifest
const manifest = {
  project_id: projectId,
  migrations_file: '.migrations.sql',
  rls,
  files: siteFiles,
  subdomain,
};

if (functions.length > 0) {
  manifest.functions = functions;
}

const manifestPath = join(ROOT, 'app.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Deploying to project ${projectId} (subdomain: ${subdomain})...`);
console.log(`  ${siteFiles.length} site files`);
console.log(`  ${functions.length} functions`);

try {
  const result = execSync(`run402 deploy --manifest "${manifestPath}"`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(result);
  console.log('Deploy successful!');
  if (parsed.subdomain_urls) {
    console.log('Live at:', parsed.subdomain_urls.join(', '));
  }
  console.log(JSON.stringify(parsed, null, 2));
} catch (err) {
  console.error('Deploy failed:', err.stderr || err.message);
  process.exit(1);
}
