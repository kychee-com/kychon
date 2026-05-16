import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCES = ['src/lib/auth-gate.ts', 'src/components/kychon/AuthGateIsland.tsx', 'src/styles/public.css'].map(
  (file) => resolve(process.cwd(), file),
);

describe('auth gate source', () => {
  it('uses the React shadcn gate instead of string-built DOM', async () => {
    const combined = (await Promise.all(SOURCES.map((source) => readFile(source, 'utf8')))).join('\n');

    expect(combined).toContain('@/components/kychon/ui');
    expect(combined).toContain('data-auth-gate');
    expect(combined).not.toContain('../ui/button');
    expect(combined).not.toContain('../ui/card');
    expect(combined).toContain('Card');
    expect(combined).toContain('Button');
    expect(combined).not.toContain('data-auth-gate-action');
    expect(combined).not.toContain('document.createElement');
    expect(combined).not.toContain('innerHTML');
    expect(combined).not.toContain('class="btn');
    expect(combined).not.toContain('.auth-gate');
  });
});
