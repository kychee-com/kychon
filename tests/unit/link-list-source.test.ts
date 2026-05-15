import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ISLAND = resolve(process.cwd(), 'src/components/kychon/LinkListIsland.tsx');
const HYDRATORS = resolve(process.cwd(), 'src/lib/block-hydrators.ts');
const BLOCKS = resolve(process.cwd(), 'src/lib/blocks.ts');
const STYLES = resolve(process.cwd(), 'src/styles/public.css');

describe('link list source', () => {
  it('uses a React shadcn island instead of legacy list DOM strings', async () => {
    const islandSource = await readFile(ISLAND, 'utf8');
    const hydratorSource = await readFile(HYDRATORS, 'utf8');
    const blocksSource = await readFile(BLOCKS, 'utf8');
    const styles = await readFile(STYLES, 'utf8');

    expect(islandSource).toContain('@/components/kychon/ui');
    expect(islandSource).toContain('Badge');
    expect(islandSource).toContain('Button');
    expect(islandSource).toContain('Card');
    expect(hydratorSource).toContain('mountLinkListIsland');

    expect(islandSource).not.toContain('innerHTML');
    expect(islandSource).not.toContain('document.createElement');
    expect(hydratorSource).not.toContain('block-link-list__');
    expect(blocksSource).not.toContain('block-link-list__');
    expect(styles).not.toContain('.block-link-list__');
    expect(styles).not.toContain('.section-link-list');
  });
});
