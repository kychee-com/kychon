import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const css = readFileSync(join(root, 'src/styles/public.css'), 'utf8');
const navView = readFileSync(join(root, 'src/components/kychon/NavBlockView.tsx'), 'utf8');
const themeSheets = ['src/styles/theme.css', 'public/css/theme.css'].map((path) => ({
  path,
  css: readFileSync(join(root, path), 'utf8'),
}));

describe('nav active-state contrast', () => {
  it('the active menu item carries no brand-color utility (it shadowed the config rules and went invisible on dark bars)', () => {
    expect(navView).not.toContain('text-primary');
    expect(navView).not.toContain('bg-primary/10');
  });

  it('active link text defaults to the resting nav link color, never the brand --primary', () => {
    const rule = css.split('[data-nav-link][data-nav-active="true"]')[1]?.split('}')[0];
    expect(rule).toContain('--nav-link-active-color');
    expect(rule).toContain('--nav-link-color');
    expect(rule).not.toContain('--primary'); // brand color caused the dark-on-dark failure
  });

  it('active emphasis is a currentColor-derived tint (scheme/bar proof), plus weight', () => {
    const rule = css.split('[data-nav-link][data-nav-active="true"]')[1]?.split('}')[0];
    expect(rule).toContain('color-mix(in srgb, currentColor');
    expect(rule).toContain('--nav-link-active-weight');
    // the dropdown/mobile active item only adds bg + weight, keeping its
    // resting (config-driven) color
    expect(css).toContain('[data-nav-menuitem][data-nav-active="true"]');
  });

  // A theme-level default for the active vars always wins over the fallback
  // chain above, so a nav bar whose surface_bg is the primary color painted its
  // active item primary-on-primary (#236). Only an explicit nav presentation /
  // theme.nav value may set them.
  it.each(themeSheets)('$path leaves the active link color and background unset in both schemes', ({ css }) => {
    expect(css).not.toMatch(/--nav-link-active-color\s*:/);
    expect(css).not.toMatch(/--nav-link-active-bg\s*:/);
    expect(css).not.toContain('99, 102, 241');
  });
});
