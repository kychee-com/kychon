import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ISLAND = resolve(process.cwd(), 'src/components/kychon/ActivityFeedIsland.tsx');
const HYDRATORS = resolve(process.cwd(), 'src/lib/block-hydrators.ts');
const STYLES = resolve(process.cwd(), 'src/styles/public.css');

describe('activity feed source', () => {
  it('uses a React shadcn island instead of legacy activity DOM strings', async () => {
    const islandSource = await readFile(ISLAND, 'utf8');
    const hydratorSource = await readFile(HYDRATORS, 'utf8');
    const styles = await readFile(STYLES, 'utf8');

    expect(islandSource).toContain('@/components/kychon/ui');
    expect(islandSource).toContain('Avatar');
    expect(islandSource).toContain('Card');
    expect(hydratorSource).toContain('mountActivityFeedIsland');

    expect(islandSource).not.toContain('querySelector');
    expect(islandSource).not.toContain('document.createElement');
    expect(islandSource).not.toContain('innerHTML');
    expect(hydratorSource).not.toContain('activity-entry');
    expect(hydratorSource).not.toContain('activity-avatar');
    expect(styles).not.toContain('.activity-entry');
    expect(styles).not.toContain('.activity-avatar');
  });
});
