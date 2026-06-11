import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { bakeChrome } from '../../src/lib/chrome-bake';
import type { ProjectSeed } from '../../src/seeds/types';

const root = join(import.meta.dirname, '../..');
const portal = readFileSync(join(root, 'src/layouts/Portal.astro'), 'utf8');

function seedWithTheme(theme: Record<string, unknown>): ProjectSeed {
  return {
    site_config: { theme },
    sections: [],
    pages: [],
  } as unknown as ProjectSeed;
}

describe('theme color-scheme pin', () => {
  it('bakes light/dark pins and defaults to auto', () => {
    expect(bakeChrome(seedWithTheme({ color_scheme: 'light' }), 'T').colorScheme).toBe('light');
    expect(bakeChrome(seedWithTheme({ color_scheme: 'dark' }), 'T').colorScheme).toBe('dark');
    expect(bakeChrome(seedWithTheme({}), 'T').colorScheme).toBe('auto');
    expect(bakeChrome(seedWithTheme({ color_scheme: 'mauve' }), 'T').colorScheme).toBe('auto');
  });

  it('Portal honors the pin before OS preference and localStorage', () => {
    expect(portal).toContain('pinnedColorScheme');
    expect(portal).toContain("pinnedColorScheme === 'light' || pinnedColorScheme === 'dark'");
    expect(portal).toContain('astro:after-swap');
  });
});
