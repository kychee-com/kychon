import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { run402, createRun402Adapter } from '@run402/astro';
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

function run402Astro7SignInCompatPlugin() {
  const invalidAstro7Comment =
    /\n\s*<!-- Extra method chrome\. is:global because the method markup is spliced via\n\s*set:html and therefore carries no scoped-style attribute; these rules\n\s*target the \.r402-\* method classes the same way the consumer would\. -->/;

  return {
    name: 'kychon-run402-sign-in-astro7-compat',
    enforce: 'pre',
    load(id) {
      const filePath = id.split('?')[0].replace(/\\/g, '/');
      if (!filePath.endsWith('/node_modules/@run402/astro/dist/components/SignIn.astro')) return null;

      const source = readFileSync(filePath, 'utf8');
      const patched = source.replace(invalidAstro7Comment, '');
      return patched === source ? null : patched;
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

// `@run402/astro@1.0.2` is active. When KYCHON_PROJECT selects a demo and
// RUN402_PROJECT_ID is set (both true during deploy via deploy-{ci,demo}.ts),
// every image under that demo's assetsDir gets uploaded once to the project's
// `astro/` asset prefix (CAS-deduped at the gateway) and a JSON manifest is
// written to dist/_assets-manifest.json. Consumer side: blocks.ts consults
// the manifest via `kychonImageHtml`, page-render.ts fetches
// `/_assets-manifest.json` at runtime, react helpers use `<Run402Image>` via
// `lookupAssetRef` (and a normalizer to harmonize v1.49-era casing).
//
// `imageDefaults.strict: { onSchema: '>=v1.49' }` is the schema-filtered form
// (Recipe B from the run402-image-component-adoption migration guide). Behavior:
// every AssetRef carrying `asset_schema` >= `"v1.49"` is strict-checked at
// render — degraded fields (missing variants, missing intrinsic dimensions,
// missing pre-decoded blurhash with explicit `placeholder="blurhash"`) fail
// the build with `R402_ASTRO_IMAGE_STRICT_DEGRADED`. AssetRefs lacking
// `asset_schema` (legacy uploads from before v1.51, or partial-shape rows
// the gateway deliberately left unstamped) bypass strict-mode entirely.
//
// Safe to enable now because: (1) all three demo tenants are post-backfill,
// stamping `asset_schema = "v1.54"` on every full-shape AssetRef; (2) the
// only unstamped row across the fleet is `barrio/logo.png` (sub-threshold
// PNG with no variants, correctly null per spec); (3) Phase 2 + Phase 3
// adoption verified live. Catches future broken admin uploads at build time
// instead of letting them silently render degraded.
const useRun402Integration = Boolean(integrationAssetsDir && process.env.RUN402_PROJECT_ID);

// Hybrid mode: `output: 'static'` + the run402 SSR adapter on the
// top-level `adapter:` field. Routes default to prerendered; individual
// routes opt into per-request SSR via `export const prerender = false`
// in their frontmatter. Build produces a two-slice layout
// (`dist/run402/client/` static + `dist/run402/server/` SSR entry,
// esbuild-bundled to a single `source` string by the helper);
// `scripts/_lib.ts:runDeploy` consumes it via
// `buildAstroReleaseSlice` from `@run402/astro/release-slice`.
//
// Requires `@run402/astro@>=1.2.2` (SSR handler now accepts Web
// Request and lets the gateway's `buildEntryWrapper` own ALS +
// envelope translation; pre-1.2.2 the adapter expected the raw
// envelope and crashed on every invocation) and `@run402/sdk@>=2.18.0`
// (local validator knows the `class` field). Pairs with gateway's
// implicit-mode `<path>.html` resolver shipped same day — clean URLs
// `/events` resolve to `events.html` before falling through to the
// SSR catchall, so Astro's `format: 'file'` builds work without
// switching to `format: 'directory'`.
//
// First deploy after the switch emits a
// `PUBLIC_PATH_MODE_WIDENS_TO_IMPLICIT` warning — covered by
// `RUN402_ALLOW_WARNINGS=true`.
//
// The adapter is unconditional: several routes (admin*, profile,
// calendar, search, ssr-probe) export `prerender = false`, so any
// `astro build` without an adapter throws NoAdapterInstalled. The
// adapter itself has no auth requirements — it just emits
// `dist/run402/{client,server,adapter.json}` locally — so it's safe
// to register in test / neutral-fallback builds. The image-upload
// integration stays gated on `useRun402Integration` so non-deploy
// builds don't reach for Run402 gateway credentials.
export default defineConfig({
  output: 'static',
  adapter: createRun402Adapter(),
  devToolbar: {
    enabled: false,
  },
  integrations: [
    ...(useRun402Integration
      ? [
          run402({
            assetsDir: integrationAssetsDir,
            imageDefaults: {
              strict: { onSchema: '>=v1.49' },
            },
          }),
        ]
      : []),
    react(),
  ],
  vite: {
    // Bake build-time env vars into the SSR Lambda bundle. `astro build`
    // runs in a process with `KYCHON_PROJECT=silver-pines` (set by
    // `runDeploy`); the SSR Lambda runtime has neither that var nor
    // any way to recover it from the deploy spec. Vite's `define`
    // substitutes the literal at compile time, so request-time renders
    // (e.g. `seeds/index.ts:requestedProjectName`) can read
    // `import.meta.env.KYCHON_PROJECT` and get the right project's
    // typed seed without falling back to neutral chrome.
    define: {
      'import.meta.env.KYCHON_PROJECT': JSON.stringify(process.env.KYCHON_PROJECT ?? ''),
      // Anon-key JWT for SSR-time API calls. The browser reads this
      // from `window.__KYCHON_ANON_KEY` (injected via `dist/js/env.js`
      // by `runDeploy`), but the SSR Lambda has neither `window` nor
      // that file in its bundle. Bake the literal at compile time so
      // `src/lib/ssr-api.ts` can hand it to the SDK at request time.
      // Same value the browser uses — role:anon JWT, safe to embed.
      'import.meta.env.KYCHON_ANON_KEY': JSON.stringify(process.env.KYCHON_ANON_KEY ?? ''),
    },
    server: {
      watch: {
        ignored: ['**/packages/sdk/dist/**', '**/node_modules/@kychon/sdk/dist/**'],
      },
    },
    plugins: [
      tailwindcss(),
      run402Astro7SignInCompatPlugin(),
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
