import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCES = [
  'src/lib/block-hydrators.ts',
  'src/lib/blocks.ts',
  'src/lib/config.ts',
  'src/components/AdminEditor.astro',
].map((file) => resolve(process.cwd(), file));

describe('api/auth imports', () => {
  it('keeps api/auth imports static to avoid Vite mixed-import warnings', async () => {
    const combined = (await Promise.all(SOURCES.map((source) => readFile(source, 'utf8')))).join('\n');

    expect(combined).not.toMatch(/import\(['"][^'"]*(api|auth)(?:\.js)?['"]\)/);
  });
});
