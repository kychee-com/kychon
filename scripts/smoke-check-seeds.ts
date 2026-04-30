/**
 * CI smoke check: every project's typed seed compiles and generates valid SQL.
 *
 * Run with: `tsx scripts/smoke-check-seeds.ts`
 * Wired into `npm run check` and CI to fail builds on broken seeds.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PROJECTS = ['kychon', 'eagles', 'silver-pines', 'barrio-unido'] as const;

let failures = 0;
for (const project of PROJECTS) {
  process.stdout.write(`Checking seed: ${project}... `);
  const res = spawnSync(
    'npx',
    ['tsx', 'scripts/generate-seed-sql.ts', '--dry-run'],
    {
      cwd: ROOT,
      env: { ...process.env, KYCHON_PROJECT: project },
      encoding: 'utf-8',
    },
  );
  if (res.status !== 0) {
    process.stdout.write('FAIL\n');
    process.stderr.write(res.stderr || res.stdout || '(no output)\n');
    failures++;
    continue;
  }
  process.stdout.write('ok\n');
}

if (failures > 0) {
  process.stderr.write(`\n${failures} seed${failures === 1 ? '' : 's'} failed.\n`);
  process.exit(1);
}

process.stdout.write(`\nAll ${PROJECTS.length} seeds OK.\n`);
