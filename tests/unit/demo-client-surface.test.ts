import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PUBLIC_RUNTIME_ROOTS = ['src/pages', 'src/lib', 'src/components', 'public', 'demo'];
const TEXT_EXTENSIONS = new Set(['.astro', '.css', '.html', '.js', '.jsx', '.json', '.md', '.ts', '.tsx']);

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(path);
      if (!entry.isFile()) return [];
      const info = await stat(path);
      if (info.size > 1_000_000) return [];
      const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
      return TEXT_EXTENSIONS.has(ext) ? [path] : [];
    }),
  );
  return files.flat();
}

async function readRuntimeSources(): Promise<Array<{ path: string; source: string }>> {
  const files = (await Promise.all(PUBLIC_RUNTIME_ROOTS.map((root) => collectFiles(resolve(ROOT, root))))).flat();
  return Promise.all(
    files.map(async (path) => ({
      path: relative(ROOT, path),
      source: await readFile(path, 'utf8'),
    })),
  );
}

function matchingFiles(sources: Array<{ path: string; source: string }>, pattern: RegExp): string[] {
  return sources
    .filter(({ source }) => pattern.test(source))
    .map(({ path }) => path)
    .sort();
}

describe('demo public runtime surface', () => {
  it('does not ship blocking browser alert calls in shared demo pages', async () => {
    const sources = await readRuntimeSources();
    expect(matchingFiles(sources, /\balert\s*\(/)).toEqual([]);
  });

  it('does not ship direct legacy table REST endpoints in demo browser code or demo assets', async () => {
    const sources = await readRuntimeSources();
    expect(matchingFiles(sources, /\/admin\/v1\/rest\b|\/rest\/v1\b|supabase/i)).toEqual([]);
  });
});
