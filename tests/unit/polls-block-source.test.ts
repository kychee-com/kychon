import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ISLAND = resolve(process.cwd(), 'src/components/kychon/PollsBlockIsland.tsx');
const BLOCKS = resolve(process.cwd(), 'src/lib/blocks.ts');

describe('polls block source', () => {
  it('uses a React shadcn island instead of the legacy poll DOM helpers', async () => {
    const islandSource = await readFile(ISLAND, 'utf8');
    const blocksSource = await readFile(BLOCKS, 'utf8');

    expect(islandSource).toContain('@/components/kychon/ui');
    expect(islandSource).toContain('Card');
    expect(islandSource).toContain('Button');
    expect(islandSource).toContain('Badge');
    expect(blocksSource).toContain('mountPollsBlockIsland');

    expect(islandSource).not.toContain('innerHTML');
    expect(islandSource).not.toContain('document.createElement');
    expect(blocksSource).not.toContain('fetchAndRenderPoll');
    expect(blocksSource).not.toContain('bindPollVoteListeners');
    expect(blocksSource).not.toContain('polls-skeleton');
    expect(blocksSource).not.toContain('section-polls');
    expect(blocksSource).not.toContain('data-countdown');
  });
});
