import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': new URL('./src/', import.meta.url).pathname,
  '../lib/': new URL('./src/lib/', import.meta.url).pathname,
  '../schemas/': new URL('./src/schemas/', import.meta.url).pathname,
};

// Stub for `virtual:run402-assetmap`, provided by `@run402/astro` only when the
// integration's Vite plugin runs. Vitest doesn't load Astro integrations, so
// chrome-bake.ts's transitive import of `@run402/astro/build-manifest` (which
// imports the virtual module) would fail to resolve. Returning a null manifest
// hits the documented `getBuildTimeManifest()` null-fallback path; emitters
// fall back to plain `<img>`, matching production behavior for builds without
// `assetsDir`.
const virtualAssetMapStub = {
  name: 'kychon-virtual-assetmap-stub',
  resolveId(source) {
    if (source === 'virtual:run402-assetmap') return '\0virtual:run402-assetmap';
    return null;
  },
  load(id) {
    if (id === '\0virtual:run402-assetmap') {
      return 'export const manifest = null;\nexport default new Map();\n';
    }
    return null;
  },
};

// `@run402/astro@0.2.4` ships `.js.map` sourcemaps that reference the original
// `.ts` sources, but the published tarball doesn't include the `src/` directory.
// When Vite loads `build-manifest.js` (inlined below) it reads the map and
// warns about the missing TS source on every test run. Override `load` so the
// module content is returned without the `//# sourceMappingURL=` trailer —
// Vite then skips the sourcemap lookup entirely.
const stripRun402SourcemapTrailer = {
  name: 'kychon-strip-run402-sourcemap-trailer',
  enforce: 'pre',
  load(id) {
    const path = id.split('?')[0];
    if (!path.includes('/@run402/astro/dist/build-manifest')) return null;
    const code = readFileSync(path, 'utf8');
    return code.replace(/\n?\/\/# sourceMappingURL=[^\n]+/g, '');
  },
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

// `@run402/astro/build-manifest` must run through Vite (not Node's native ESM
// loader) so the stub plugin above can intercept its `virtual:run402-assetmap`
// import. Vitest externalizes node_modules by default; the narrow regex keeps
// only `build-manifest.js` (and its sibling resolver, which it pulls in) inside
// Vite. The other `@run402/astro` entrypoints (`manifest`, `picture-builder`,
// `blurhash-decoder`) stay external — keeping them external avoids spurious
// sourcemap-missing-source warnings from the package's published `.js.map`
// files, which reference TypeScript sources not included in the tarball.
const serverDeps = { inline: [/@run402\/astro\/dist\/build-manifest/] };

export default defineConfig({
  resolve: {
    alias,
  },
  plugins: [virtualAssetMapStub],
  test: {
    server: { deps: serverDeps },
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
        plugins: [virtualAssetMapStub, stripRun402SourcemapTrailer],
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.{js,ts}'],
          server: { deps: serverDeps },
        },
      },
      {
        resolve: { alias },
        plugins: [virtualAssetMapStub, stripRun402SourcemapTrailer],
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.{js,ts}'],
          environment: 'happy-dom',
          server: { deps: serverDeps },
        },
      },
    ],
  },
});
