import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ISLAND = resolve(process.cwd(), 'src/components/kychon/SignInBarIsland.tsx');
const HYDRATORS = resolve(process.cwd(), 'src/lib/block-hydrators.ts');

describe('sign-in bar source', () => {
  it('uses a React shadcn island instead of string-built DOM controls', async () => {
    const islandSource = await readFile(ISLAND, 'utf8');
    const hydratorSource = await readFile(HYDRATORS, 'utf8');

    expect(islandSource).toContain('@/components/kychon/ui');
    expect(islandSource).toContain('Button');
    expect(islandSource).toContain('DropdownMenu');
    expect(hydratorSource).toContain('mountSignInBarIsland');

    expect(islandSource).not.toContain('querySelector');
    expect(islandSource).not.toContain('document.createElement');
    expect(islandSource).not.toContain('innerHTML');
    expect(hydratorSource).not.toContain('nav-sign-in');
    expect(hydratorSource).not.toContain('nav-account');
    expect(hydratorSource).not.toContain('nav-utility-button');
  });
});
