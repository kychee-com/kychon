import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': new URL('./src/', import.meta.url).pathname,
  '../lib/': new URL('./src/lib/', import.meta.url).pathname,
  '../schemas/': new URL('./src/schemas/', import.meta.url).pathname,
};

const nodeLocalStorageFile = new URL('./tmp/vitest-node-localstorage', import.meta.url).pathname;

if (
  process.allowedNodeEnvironmentFlags?.has('--localstorage-file') &&
  !process.env.NODE_OPTIONS?.includes('--localstorage-file')
) {
  mkdirSync(dirname(nodeLocalStorageFile), { recursive: true });
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--localstorage-file=${nodeLocalStorageFile}`]
    .filter(Boolean)
    .join(' ');
}

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/schemas/**'],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.{js,ts}'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.{js,ts}'],
          environment: 'happy-dom',
        },
      },
    ],
  },
});
