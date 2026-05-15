import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WRAPPERS = [
  'src/components/AuthModal.astro',
  'src/components/AuthProvider.astro',
  'src/components/ConfigProvider.astro',
  'src/components/Toast.astro',
].map((file) => resolve(process.cwd(), file));

const ISLANDS = [
  'src/components/AuthModalIsland.tsx',
  'src/components/kychon/AuthProviderIsland.tsx',
  'src/components/kychon/ConfigProviderIsland.tsx',
  'src/components/kychon/ToastIsland.tsx',
].map((file) => resolve(process.cwd(), file));

describe('provider islands source', () => {
  it('keeps Astro provider wrappers free of inline DOM launcher scripts', async () => {
    const sources = await Promise.all(WRAPPERS.map((file) => readFile(file, 'utf8')));

    for (const source of sources) {
      expect(source).toContain('client:load');
      expect(source).not.toContain('<script>');
      expect(source).not.toContain('getElementById');
      expect(source).not.toContain('querySelector');
      expect(source).not.toContain('document.createElement');
      expect(source).not.toContain('innerHTML');
    }
  });

  it('keeps provider behavior in React islands', async () => {
    const combined = (await Promise.all(ISLANDS.map((file) => readFile(file, 'utf8')))).join('\n');

    expect(combined).toContain('AuthModalLauncher');
    expect(combined).toContain('AuthProviderIsland');
    expect(combined).toContain('ConfigProviderIsland');
    expect(combined).toContain('ToastIsland');
    expect(combined).toContain('Toaster');
    expect(combined).toContain('AUTH_OPEN_EVENT');
    expect(combined).toContain('KYCHON_TOAST_EVENT');
  });
});
