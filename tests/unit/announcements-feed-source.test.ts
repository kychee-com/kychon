import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ISLAND = resolve(process.cwd(), 'src/components/kychon/AnnouncementsFeedIsland.tsx');
const HYDRATORS = resolve(process.cwd(), 'src/lib/block-hydrators.ts');
const BLOCKS = resolve(process.cwd(), 'src/lib/blocks.ts');

describe('announcements feed source', () => {
  it('uses a React shadcn island instead of injected legacy announcement DOM', async () => {
    const islandSource = await readFile(ISLAND, 'utf8');
    const hydratorSource = await readFile(HYDRATORS, 'utf8');
    const blocksSource = await readFile(BLOCKS, 'utf8');

    expect(islandSource).toContain('@/components/kychon/ui');
    expect(islandSource).toContain('Card');
    expect(islandSource).toContain('Button');
    expect(islandSource).toContain('Input');
    expect(islandSource).toContain('sanitizeRichHtml');
    expect(hydratorSource).toContain('mountAnnouncementsFeedIsland');

    expect(islandSource).not.toContain('document.createElement');
    expect(islandSource).not.toContain('querySelector');
    expect(hydratorSource).not.toContain('poll-ui');
    expect(hydratorSource).not.toContain('createPollForm');
    expect(hydratorSource).not.toContain('feed.innerHTML');
    expect(blocksSource).not.toContain('announcement-create');
    expect(blocksSource).not.toContain('announcements-feed');
    expect(blocksSource).not.toContain('ann-post');
  });
});
