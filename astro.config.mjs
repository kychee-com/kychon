import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { run402 } from '@run402/astro';
import tailwindcss from '@tailwindcss/vite';

const rootDir = new URL('.', import.meta.url).pathname;
const demoAssetDirs = {
  eagles: 'demo/eagles/assets',
  'silver-pines': 'demo/silver-pines/assets',
  'barrio-unido': 'demo/barrio-unido/assets',
  barrio: 'demo/barrio-unido/assets',
};

// Resolve which demo's asset directory the @run402/astro integration walks at
// build time. Same lookup the local-dev middleware uses below, kept in one
// place so dev/preview/build/CI all pick the same images.
//
// Pre-deploy the deploy-ci.ts and deploy-demo.ts scripts set both
// KYCHON_PROJECT and RUN402_PROJECT_ID before invoking the Astro build. The
// integration uploads every image under assetsDir via r.assets.put and emits
// dist/_assets-manifest.json that page-render.ts fetches at runtime; see
// src/lib/blocks.ts and src/lib/page-render.ts for the consumer side.
//
// Closes kychee-com/run402-private#406. v0.1.x only scanned .astro templates
// for <Image src="literal"> — Kychon's images live in JSONB section configs,
// so we use the data-driven assetsDir path introduced in v0.2.
const integrationAssetsDir = (() => {
  const project = process.env.KYCHON_PROJECT;
  if (project && demoAssetDirs[project]) return demoAssetDirs[project];
  return null;
})();

function inferLocalAssetsProject() {
  const explicit = process.env.KYCHON_ASSETS_PROJECT || process.env.KYCHON_PROJECT;
  if (explicit && demoAssetDirs[explicit]) return explicit;

  try {
    const envJs = readFileSync(join(rootDir, 'public/js/env.js'), 'utf8');
    if (/local\s+Eagles\s+backend/i.test(envJs)) return 'eagles';
    if (/local\s+Silver\s+Pines\s+backend/i.test(envJs)) return 'silver-pines';
    if (/local\s+Barrio\s+Unido\s+backend/i.test(envJs)) return 'barrio-unido';
  } catch {
    return null;
  }

  return null;
}

function contentTypeFor(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case '.avif':
      return 'image/avif';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}

function copyDir(src, dst) {
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else if (entry.isFile()) {
      copyFileSync(srcPath, dstPath);
    }
  }
}

function safeAssetPath(assetDir, url = '') {
  const pathname = url.split('?')[0]?.split('#')[0] || '';
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = resolve(assetDir, relative);
  if (filePath !== assetDir && !filePath.startsWith(`${assetDir}${sep}`)) return null;
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;
  return filePath;
}

// Provide `virtual:run402-assetmap` as a null-manifest stub when the
// `@run402/astro` integration isn't active (no KYCHON_PROJECT / RUN402_PROJECT_ID).
// The integration registers this virtual module itself; chrome-bake.ts's
// transitive import of `@run402/astro/build-manifest` would otherwise fail
// Rollup's static-import resolution in plain-Astro builds (e.g. the
// portal-first-byte-build integration test, neutral fallback builds). Returning
// `manifest = null` hits the documented `getBuildTimeManifest()` null path —
// emitters fall back to plain `<img>`, identical to today's first paint.
function virtualAssetMapStubPlugin() {
  const id = 'virtual:run402-assetmap';
  const resolved = '\0virtual:run402-assetmap';
  return {
    name: 'kychon-virtual-assetmap-stub',
    enforce: 'pre',
    resolveId(source) {
      if (source === id) return resolved;
      return null;
    },
    load(loadedId) {
      if (loadedId === resolved) {
        return 'export const manifest = null;\nexport default new Map();\n';
      }
      return null;
    },
  };
}

function localDemoAssetsPlugin() {
  const project = inferLocalAssetsProject();
  const assetDir = project ? resolve(rootDir, demoAssetDirs[project]) : null;
  const hasAssets = Boolean(assetDir && existsSync(assetDir));

  function serve(req, res, next) {
    if (!assetDir) {
      next();
      return;
    }
    const filePath = safeAssetPath(assetDir, req.url);
    if (!filePath) {
      next();
      return;
    }
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, max-age=0');
    res.setHeader('Content-Type', contentTypeFor(filePath));
    createReadStream(filePath).pipe(res);
  }

  return {
    name: 'kychon-local-demo-assets',
    configureServer(server) {
      if (hasAssets) server.middlewares.use('/assets', serve);
    },
    configurePreviewServer(server) {
      if (hasAssets) server.middlewares.use('/assets', serve);
    },
    closeBundle() {
      if (hasAssets) copyDir(assetDir, join(rootDir, 'dist/assets'));
    },
  };
}

// `@run402/astro@0.2.1` is active. When KYCHON_PROJECT selects a demo and
// RUN402_PROJECT_ID is set (both true during deploy via deploy-{ci,demo}.ts),
// every image under that demo's assetsDir gets uploaded once to the project's
// `astro/` asset prefix (CAS-deduped at the gateway) and a JSON manifest is
// written to dist/_assets-manifest.json. Consumer side: blocks.ts consults
// the manifest via `kychonImageHtml`, page-render.ts fetches
// `/_assets-manifest.json` at runtime, react helpers use `<KychonImage>`.
// 0.2.1 ships fixes for kychee-com/run402-private#407 (buildStart no longer
// early-returns on empty <Image> discovery) and #408 (BASE_RELEASE_CONFLICT
// added to RETRYABLE_CODES; concurrent puts converge).
const useRun402Integration = Boolean(integrationAssetsDir && process.env.RUN402_PROJECT_ID);

export default defineConfig({
  output: 'static',
  devToolbar: {
    enabled: false,
  },
  integrations: [
    ...(useRun402Integration ? [run402({ assetsDir: integrationAssetsDir })] : []),
    react(),
  ],
  vite: {
    plugins: [
      tailwindcss(),
      localDemoAssetsPlugin(),
      // Only register the stub when the real integration is NOT active —
      // otherwise both would try to claim the virtual module.
      ...(useRun402Integration ? [] : [virtualAssetMapStubPlugin()]),
    ],
  },
  build: {
    format: 'file',
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
