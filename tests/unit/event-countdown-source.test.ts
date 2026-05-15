import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ISLAND = resolve(process.cwd(), 'src/components/kychon/EventCountdownIsland.tsx');
const BLOCKS = resolve(process.cwd(), 'src/lib/blocks.ts');
const STYLES = resolve(process.cwd(), 'src/styles/public.css');

describe('event countdown source', () => {
  it('uses a React shadcn island instead of legacy countdown DOM strings', async () => {
    const islandSource = await readFile(ISLAND, 'utf8');
    const blocksSource = await readFile(BLOCKS, 'utf8');
    const styles = await readFile(STYLES, 'utf8');

    expect(islandSource).toContain('@/components/kychon/ui');
    expect(islandSource).toContain('Card');
    expect(blocksSource).toContain('mountEventCountdownIsland');

    expect(islandSource).not.toContain('innerHTML');
    expect(islandSource).not.toContain('document.createElement');
    expect(blocksSource).not.toContain('data-countdown');
    expect(blocksSource).not.toContain('section-event-countdown');
    expect(styles).not.toContain('.section-event-countdown');
    expect(styles).not.toContain('.countdown-digits');
  });
});
