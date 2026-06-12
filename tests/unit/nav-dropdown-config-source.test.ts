import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const css = readFileSync(join(root, 'src/styles/public.css'), 'utf8');
const blocks = readFileSync(join(root, 'src/lib/blocks.ts'), 'utf8');

describe('nav dropdown config consumption', () => {
  it('every dropdown var the nav block sets is consumed by the stylesheet', () => {
    // Dead config is how the wsmta port ended up styling the bar with
    // subtree-wide !important rules that bled onto the light popover.
    for (const v of [
      '--nav-dropdown-bg',
      '--nav-dropdown-color',
      '--nav-dropdown-hover-bg',
      '--nav-dropdown-hover-color',
    ]) {
      expect(blocks, `${v} set`).toContain(`setNavStyle(style, '${v}'`);
      expect(css, `${v} consumed`).toContain(`var(${v}`);
    }
  });

  it('dropdown rules outrank single-class utilities via doubled attributes', () => {
    expect(css).toContain('[data-nav-menu][data-nav-menu]');
    expect(css).toContain('[data-nav-menuitem][data-nav-menuitem]');
  });
});
