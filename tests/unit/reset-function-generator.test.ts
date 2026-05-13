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
});
