import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Astro serializes its server manifest into the server bundle with an
// `"assets":[...]` list it collects via an unsorted async glob of the client
// dir, so the order (and the bundle's bytes) varies from build to build. The
// runtime turns the list into a Set, so order is meaningless — but the SSR
// function's code hash isn't, and a reordered list redeploys `ssr` on a
// no-change deploy. Sorting it after the build makes the bundle stable.
// scripts/check-build-determinism.ts guards the whole build output.
// Whitespace-tolerant: Astro writes the list compact, esbuild (the SSR
// bundler) reprints it as `"assets": ["/a", "/b"]`.
const SERIALIZED_ASSETS = /"assets":\s*\[((?:\s*"(?:[^"\\]|\\.)*"\s*,?)*)\s*\]/g;

function isSorted(list) {
  return list.every((value, i) => i === 0 || list[i - 1] <= value);
}

/** `code` with every serialized-manifest `"assets"` string list sorted. */
export function sortSerializedManifestAssets(code) {
  return code.replace(SERIALIZED_ASSETS, (match, inner) => {
    const assets = JSON.parse(`[${inner}]`);
    if (isSorted(assets)) return match;
    assets.sort();
    return `"assets":${JSON.stringify(assets)}`;
  });
}

/** How many serialized-manifest `"assets"` lists `code` has, and how many are unsorted. */
export function countManifestAssetLists(code) {
  let total = 0;
  let unsorted = 0;
  for (const [, inner] of code.matchAll(SERIALIZED_ASSETS)) {
    total++;
    if (!isSorted(JSON.parse(`[${inner}]`))) unsorted++;
  }
  return { total, unsorted };
}

function serverModules(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.m?js$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

export function deterministicServerManifest() {
  let serverDir = null;
  return {
    name: 'kychon-deterministic-server-manifest',
    hooks: {
      'astro:config:done': ({ config }) => {
        serverDir = fileURLToPath(config.build.server);
      },
      'astro:build:done': ({ logger }) => {
        if (!serverDir) return;
        let sorted = 0;
        for (const file of serverModules(serverDir)) {
          const code = readFileSync(file, 'utf8');
          const next = sortSerializedManifestAssets(code);
          if (next !== code) {
            writeFileSync(file, next);
            sorted++;
          }
        }
        logger.info(`sorted the server manifest asset list in ${sorted} module(s)`);
      },
    },
  };
}
