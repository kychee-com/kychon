import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('React page shells', () => {
  it.each([
    'src/pages/admin.astro',
    'src/pages/admin-members.astro',
    'src/pages/admin-settings.astro',
    'src/pages/calendar.astro',
    'src/pages/directory.astro',
    'src/pages/index.astro',
    'src/pages/join.astro',
    'src/pages/search.astro',
    'src/pages/ui-tokens.astro',
  ])('%s uses utility layout wrappers instead of legacy page primitives', (relativePath) => {
    const source = read(relativePath);
    expect(source).not.toContain('ky-container');
    expect(source).not.toContain('class="card');
    expect(source).not.toContain('class="btn');
    expect(source).not.toContain('class="form-');
    expect(source).not.toContain('style=');
    expect(source).not.toContain('<script>');
  });

  it('keeps the admin access shell selector without legacy card/container classes', () => {
    const source = read('src/components/AdminAccessShell.astro');
    expect(source).toContain('data-admin-access-checking');
    expect(source).not.toContain('ky-container');
    expect(source).not.toContain('class="card');
    expect(source).not.toContain('admin-access-check__');
  });
});
