import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const css = readFileSync(join(root, 'src/styles/public.css'), 'utf8');
const blocks = readFileSync(join(root, 'src/lib/blocks.ts'), 'utf8');
const navView = readFileSync(join(root, 'src/components/kychon/NavBlockView.tsx'), 'utf8');
const globals = readFileSync(join(root, 'src/styles/globals.css'), 'utf8');

describe('mobile submenu contrast', () => {
  it('menu items carry no base text-color utility (it would shadow the config rules via @layer)', () => {
    // public.css is in @layer components; Tailwind utilities are in the later
    // @layer utilities, which wins regardless of specificity. A
    // `text-muted-foreground` on the item therefore overrode the dropdown/
    // mobile color rules — dead config. The resting color must come from
    // public.css, not a utility.
    expect(globals).toContain('@import "./public.css" layer(components)');
    const navMenuItemClass = navView.split('const navMenuItemClass =')[1].split(';')[0];
    expect(navMenuItemClass).not.toContain('text-muted-foreground');
    // no resting text-color utility (font-size text-sm is fine; state-scoped
    // hover:/focus: colors are intentional)
    expect(navMenuItemClass).not.toMatch(/(?:^|\s)text-(?:foreground|primary|secondary|accent|muted)/);
  });

  it('mobile/overflow submenu items use the bar link color, not the desktop popover color', () => {
    for (const ctx of ['[data-nav-links][data-nav-mobile-open="true"]', '[data-nav-overflow-menu]']) {
      expect(css).toContain(`${ctx} [data-nav-menu] [data-nav-menuitem][data-nav-menuitem]`);
    }
    const mobileRule = css
      .split('[data-nav-links][data-nav-mobile-open="true"] [data-nav-menu] [data-nav-menuitem][data-nav-menuitem]')[1]
      ?.split('}')[0];
    expect(mobileRule).toContain('--nav-mobile-menu-color');
    expect(mobileRule).toContain('--nav-link-color');
    expect(mobileRule).not.toContain('--nav-dropdown-color');
  });

  it('the mobile_menu_color lever is wired (not dead config)', () => {
    expect(blocks).toContain('mobile_menu_color?: string');
    expect(blocks).toContain("setNavStyle(style, '--nav-mobile-menu-color', p.mobile_menu_color)");
  });
});
