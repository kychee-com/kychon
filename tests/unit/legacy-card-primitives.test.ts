import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SILVER_PINES_SEED = resolve(process.cwd(), 'src/seeds/silver-pines.ts');
const STYLES = resolve(process.cwd(), 'src/styles/public.css');

describe('legacy card primitive', () => {
  it('keeps seeded content and public CSS off old global card and form classes', async () => {
    const seed = await readFile(SILVER_PINES_SEED, 'utf8');
    const styles = await readFile(STYLES, 'utf8');

    expect(seed).not.toContain('class="card');
    expect(seed).not.toContain("class='card");
    expect(seed).not.toContain('rounded-lg border border-border bg-card');
    expect(seed).toContain('Open map and directions');
    expect(styles).not.toMatch(/\.card(?:[.{:#\s]|$)/);
    expect(styles).not.toContain('.card-header');
    expect(styles).not.toMatch(/\.form-(?:group|label|input|select|textarea)\b/);
    expect(styles).not.toMatch(/\.badge(?:[.{:#\s-]|$)/);
    expect(styles).not.toMatch(/\.member-(?:card|avatar|info|name|meta)\b/);
    expect(styles).not.toMatch(/\.reaction-(?:bar|badge|picker|picker-btn|picker-dropdown|float-emoji)\b/);
    expect(seed).not.toContain('table-wrap');
    expect(seed).not.toContain('overflow-x-auto');
    expect(seed).toContain('<table><thead>');
    expect(styles).not.toMatch(/\.table-wrap\b/);
  });
});
