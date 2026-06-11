import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('reset-demo generator', () => {
  it('clears poll tables before deleting members', () => {
    const source = execFileSync('node', ['scripts/generate-reset-function.js', 'demo/eagles/seed.sql'], {
      cwd: root,
      encoding: 'utf8',
    });

    const pollVotesIndex = source.indexOf("'poll_votes'");
    const pollOptionsIndex = source.indexOf("'poll_options'");
    const pollsIndex = source.indexOf("'polls'");
    const membersDeleteIndex = source.indexOf('DELETE FROM members');

    expect(pollVotesIndex).toBeGreaterThanOrEqual(0);
    expect(pollOptionsIndex).toBeGreaterThanOrEqual(0);
    expect(pollsIndex).toBeGreaterThanOrEqual(0);
    expect(membersDeleteIndex).toBeGreaterThanOrEqual(0);
    expect(pollVotesIndex).toBeLessThan(membersDeleteIndex);
    expect(pollOptionsIndex).toBeLessThan(membersDeleteIndex);
    expect(pollsIndex).toBeLessThan(membersDeleteIndex);
  });

  it('keeps the committed Eagles reset artifact on the Eagles seed', () => {
    const source = readFileSync(join(root, 'demo/eagles/reset-demo.js'), 'utf8');

    expect(source).toContain('The Eagles');
    expect(source).toContain('Annual Spring Food Drive');
    expect(source).not.toContain('Barrio Unido');
  });

  it('wipes mutable tables in one multi-table TRUNCATE, not a per-table loop', () => {
    // Each per-table TRUNCATE was its own admin-SQL round-trip; 18 x 3 demos
    // firing at :00 piled concurrent reset work on the shared 2-ACU writer
    // (run402-private#494). One multi-table statement is a single round-trip.
    // (TRUNCATE itself triggers no PostgREST reload — it doesn't fire
    // ddl_command_end.)
    const source = execFileSync('node', ['scripts/generate-reset-function.js', 'demo/eagles/seed.sql'], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(source).toMatch(/TRUNCATE \$\{MUTABLE_TABLES\.join\(', '\)\} CASCADE/);
    expect(source).not.toMatch(/for \(const table of MUTABLE_TABLES\)/);
  });

  it('emits the cron schedule from argv, defaulting to top-of-hour', () => {
    const staggered = execFileSync(
      'node',
      ['scripts/generate-reset-function.js', 'demo/eagles/seed.sql', '20 * * * *'],
      { cwd: root, encoding: 'utf8' },
    );
    expect(staggered.startsWith('// schedule: "20 * * * *"')).toBe(true);

    const defaulted = execFileSync('node', ['scripts/generate-reset-function.js', 'demo/eagles/seed.sql'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(defaulted.startsWith('// schedule: "0 * * * *"')).toBe(true);
  });

  it('staggers the three committed demo reset schedules across the hour', () => {
    const schedOf = (p: string) => readFileSync(join(root, p), 'utf8').match(/^\/\/ schedule: "([^"]+)"/)?.[1];
    const schedules = [
      schedOf('demo/eagles/reset-demo.js'),
      schedOf('demo/silver-pines/reset-demo.js'),
      schedOf('demo/barrio-unido/reset-demo.js'),
    ];

    expect(schedules).toEqual(['0 * * * *', '20 * * * *', '40 * * * *']);
    // Distinct minute offsets — the whole point is that they don't stack at :00.
    const minutes = schedules.map((s) => s?.split(' ')[0]);
    expect(new Set(minutes).size).toBe(3);
  });
});
