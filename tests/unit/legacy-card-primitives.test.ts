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
    expect(seed).toContain('rounded-lg border border-border bg-card');
    expect(styles).not.toMatch(/\.card(?:[.{:#\s]|$)/);
    expect(styles).not.toContain('.card-header');
    expect(styles).not.toMatch(/\.form-(?:group|label|input|select|textarea)\b/);
    expect(styles).not.toMatch(/\.badge(?:[.{:#\s-]|$)/);
    expect(styles).not.toMatch(/\.member-(?:card|avatar|info|name|meta)\b/);
  });
});
