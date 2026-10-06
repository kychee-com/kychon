// Issue #176: the runtime theme path (applyTheme → themeCssVars) must emit the
// same quoted font-family stack as the build-time bake. A bare
// `--font-body: Source Sans 3` is invalid CSS (`3` is not an identifier), so
// every `font-family: var(--font-body)` falls back to Times.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bakeChrome, themeFromSeed } from '../../src/lib/chrome-bake';
import { themeCssVars } from '../../src/lib/config';
import { buildFontVarValue } from '../../src/lib/theme/fonts';
import type { ProjectSeed } from '../../src/seeds/types';

const root = join(import.meta.dirname, '../..');

describe('themeCssVars font families', () => {
  it('quotes a font family whose name contains a digit', () => {
    const vars = themeCssVars({ font_body: 'Source Sans 3' });
    expect(vars['--font-body']).toBe(buildFontVarValue('Source Sans 3', 'sans-serif'));
    expect(vars['--font-body']).toMatch(/^"Source Sans 3", /);
  });

  it('uses the serif generic for the heading font, like the bake', () => {
    const vars = themeCssVars({ font_heading: 'Playfair Display' });
    expect(vars['--font-heading']).toBe(buildFontVarValue('Playfair Display', 'serif'));
  });

  it('matches the build-time baked font vars for the same theme', () => {
    const seed = JSON.parse(
      readFileSync(join(root, 'fixtures/chrome/sample-boat-club.chrome-snapshot.json'), 'utf-8'),
    ) as ProjectSeed;
    const baked = bakeChrome(seed, 'Home').themeFontVarsCss;
    const vars = themeCssVars(themeFromSeed(seed));
    const runtime = [`--font-heading: ${vars['--font-heading']};`, `--font-body: ${vars['--font-body']};`].join(' ');
    expect(baked).toContain('Source Sans 3');
    expect(runtime).toBe(baked);
  });

  it('keeps system fonts the bake leaves to the stylesheet default as a plain family', () => {
    expect(themeCssVars({ font_body: 'Arial' })['--font-body']).toBe('Arial');
  });
});
