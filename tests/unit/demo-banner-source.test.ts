import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ASTRO_BANNER = resolve(process.cwd(), 'src/components/DemoBanner.astro');
const REACT_BANNER = resolve(process.cwd(), 'src/components/kychon/DemoBannerIsland.tsx');

describe('demo banner source', () => {
  it('uses the React shadcn island instead of hand-rolled DOM wiring', async () => {
    const astroSource = await readFile(ASTRO_BANNER, 'utf8');
    const reactSource = await readFile(REACT_BANNER, 'utf8');

    expect(astroSource).toContain('DemoBannerIsland');
    expect(reactSource).toContain('@/components/kychon/ui');
    expect(reactSource).toContain('Button');
    expect(reactSource).toContain('Badge');

    const combined = `${astroSource}\n${reactSource}`;
    expect(combined).not.toContain('getElementById');
    expect(combined).not.toContain('querySelector');
    expect(combined).not.toContain('document.createElement');
    expect(combined).not.toContain('innerHTML');
    expect(combined).not.toContain('demo-btn');
    expect(combined).not.toContain('<style>');
    expect(combined).not.toContain('<script>');
  });
});
