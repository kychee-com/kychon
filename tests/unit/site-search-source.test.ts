import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ISLAND = resolve(process.cwd(), 'src/components/kychon/SiteSearchIsland.tsx');
const HYDRATORS = resolve(process.cwd(), 'src/lib/block-hydrators.ts');
const STYLES = resolve(process.cwd(), 'src/styles/public.css');

describe('site search source', () => {
  it('uses a React shadcn island instead of legacy listbox DOM strings', async () => {
    const islandSource = await readFile(ISLAND, 'utf8');
    const hydratorSource = await readFile(HYDRATORS, 'utf8');
    const styles = await readFile(STYLES, 'utf8');

    expect(islandSource).toContain('@/components/kychon/ui');
    expect(islandSource).toContain('Button');
    expect(islandSource).toContain('Input');
    expect(islandSource).toContain('Card');
    expect(hydratorSource).toContain('mountSiteSearchIsland');

    expect(islandSource).not.toContain('querySelector');
    expect(islandSource).not.toContain('document.createElement');
    expect(islandSource).not.toContain('innerHTML');
    expect(hydratorSource).not.toContain('site-search__option');
    expect(hydratorSource).not.toContain('role="option"');
    expect(styles).not.toContain('.site-search__');
    expect(styles).not.toContain('.section-site-search');
  });
});
