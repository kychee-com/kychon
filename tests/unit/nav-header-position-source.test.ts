import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const css = readFileSync(join(root, 'src/styles/public.css'), 'utf8');
const blocks = readFileSync(join(root, 'src/lib/blocks.ts'), 'utf8');

describe('nav header position config', () => {
  it('the shell position is variable-driven with a sticky default', () => {
    expect(css).toContain('position: var(--nav-header-position, sticky)');
  });

  it('the nav block pipes header_position into the variable', () => {
    expect(blocks).toContain('header_position?: string');
    expect(blocks).toContain("setNavStyle(style, '--nav-header-position', p.header_position)");
  });
});
