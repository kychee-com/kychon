import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = new URL('.', import.meta.url).pathname;
const demoAssetDirs = {
  eagles: 'demo/eagles/assets',
  'silver-pines': 'demo/silver-pines/assets',
  'barrio-unido': 'demo/barrio-unido/assets',
  barrio: 'demo/barrio-unido/assets',
};

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

export default defineConfig({
  output: 'static',
  devToolbar: {
    enabled: false,
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), localDemoAssetsPlugin()],
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
