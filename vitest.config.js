import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['site/js/**'],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          environment: 'happy-dom',
        },
      },
    ],
  },
});
