import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');

const ROUTES = [
  { id: 'home', kind: 'public', route: '/', file: 'index.html' },
  { id: 'events', kind: 'public', route: '/events', file: 'events.html' },
  { id: 'resources', kind: 'public', route: '/resources', file: 'resources.html' },
  { id: 'forum', kind: 'public', route: '/forum', file: 'forum.html' },
  { id: 'admin-settings', kind: 'admin', route: '/admin-settings', file: 'admin-settings.html' },
  { id: 'baked-chrome-page', kind: 'public', route: '/page.html?slug=showcase', file: 'page.html' },
] as const;

interface AssetReport {
  path: string;
  bytes: number;
}

interface RouteReport {
  id: string;
  kind: string;
  route: string;
  file: string;
  htmlBytes: number;
  inlineScriptBytes: number;
  inlineStyleBytes: number;
  localJsBytes: number;
  localCssBytes: number;
  localJs: AssetReport[];
  localCss: AssetReport[];
}

function parseArgs(): { out: string | null } {
  const outIndex = process.argv.indexOf('--out');
  return { out: outIndex >= 0 ? process.argv[outIndex + 1] ?? null : null };
}

function normalizeLocalPath(raw: string): string | null {
  if (/^https?:\/\//.test(raw) || raw.startsWith('data:')) return null;
  const withoutQuery = raw.split('?')[0] ?? raw;
  return withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery;
}

function localAssets(html: string, tag: 'script' | 'link'): AssetReport[] {
  const attr = tag === 'script' ? 'src' : 'href';
  const re = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["'][^>]*>`, 'g');
  const paths = new Set<string>();
  for (const match of html.matchAll(re)) {
    const path = normalizeLocalPath(match[1] ?? '');
    if (path) paths.add(path);
  }
  return [...paths].sort().map((path) => {
    const fullPath = join(DIST, path);
    return {
      path: `/${path}`,
      bytes: existsSync(fullPath) ? statSync(fullPath).size : 0,
    };
  });
}

function sumBytes(assets: AssetReport[]): number {
  return assets.reduce((total, asset) => total + asset.bytes, 0);
}

function inlineBytes(html: string, tag: 'script' | 'style'): number {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g');
  let total = 0;
  for (const match of html.matchAll(re)) {
    total += Buffer.byteLength(match[1] ?? '', 'utf-8');
  }
  return total;
}

function routeReport(route: (typeof ROUTES)[number]): RouteReport {
  const htmlPath = join(DIST, route.file);
  if (!existsSync(htmlPath)) throw new Error(`Build output missing ${route.file}; run npm run build first.`);
  const html = readFileSync(htmlPath, 'utf-8');
  const localJs = localAssets(html, 'script').filter((asset) => asset.path.endsWith('.js'));
  const localCss = localAssets(html, 'link').filter((asset) => asset.path.endsWith('.css'));
  return {
    ...route,
    htmlBytes: Buffer.byteLength(html, 'utf-8'),
    inlineScriptBytes: inlineBytes(html, 'script'),
    inlineStyleBytes: inlineBytes(html, 'style'),
    localJsBytes: sumBytes(localJs),
    localCssBytes: sumBytes(localCss),
    localJs,
    localCss,
  };
}

function main(): void {
  const { out } = parseArgs();
  const routes = ROUTES.map(routeReport);
  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    dist: DIST,
    note: 'Local asset byte counts are uncompressed and include assets referenced directly by each HTML file.',
    routes,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (out) {
    writeFileSync(join(ROOT, out), json, 'utf-8');
    process.stdout.write(`wrote ${out}\n`);
    return;
  }
  process.stdout.write(json);
}

main();
