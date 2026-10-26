import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, 'fixtures/chrome/sample-boat-club.chrome-snapshot.json');
const BRAND = 'Harbor Point Boat Club';
const FORBIDDEN_BRAND = 'Kychon Community';
// The @run402/astro adapter relocates prerendered HTML from `dist/` to
// `dist/run402/client/`. The adapter is unconditional in astro.config.mjs
// because calendar / search / ssr-probe export `prerender = false` — without
// the adapter `astro build` throws NoAdapterInstalled. Static pages still
// prerender, just under the client dir.
const CLIENT_DIR = join(ROOT, 'dist', 'run402', 'client');
const SERVER_ENTRY = join(ROOT, 'dist', 'run402', 'server', 'entry.mjs');
// Request-time routes: the SSR Lambda has no KYCHON_CHROME_SNAPSHOT env var or
// file, so these must bake the copy built into the bundle (kychon#228).
const SSR_PATHS = ['/calendar', '/search?q=boat', '/event?id=1', '/page?slug=about'];

// Representative prerendered pages. admin*, profile, and join are SSR
// (prerender = false): they read auth.user() server-side for redirect
// guards / hosted <SignIn> returnTo, so they never appear as static HTML
// and are covered by the SSR entry's render path. calendar / search /
// event / page / ssr-probe are likewise SSR-only.
const REPRESENTATIVE_PAGES = [
  'index.html',
  'events.html',
  'directory.html',
  'committees.html',
  'forum.html',
  'resources.html',
  'polls.html',
];

function buildPortal(): void {
  execFileSync('npm', ['run', 'build'], {
    cwd: ROOT,
    env: {
      ...process.env,
      KYCHON_CHROME_SNAPSHOT: SNAPSHOT,
    },
    stdio: 'pipe',
  });
}

/**
 * Render SSR routes through the built server entry the way the Lambda does,
 * in a child process without KYCHON_CHROME_SNAPSHOT and with the network
 * stubbed out (every per-request API read fails, as on a cold miss).
 */
function renderSsrRoutes(paths: string[]): Record<string, string> {
  const script = `
    globalThis.fetch = async () => { throw new Error('offline'); };
    console.warn = () => {};
    const { handler } = await import(${JSON.stringify(pathToFileURL(SERVER_ENTRY).href)});
    const out = {};
    for (const path of ${JSON.stringify(paths)}) {
      const res = await handler(new Request('https://boat.example.test' + path, { headers: { host: 'boat.example.test' } }));
      out[path] = await res.text();
    }
    process.stdout.write(JSON.stringify(out));
  `;
  const env = { ...process.env };
  delete env.KYCHON_CHROME_SNAPSHOT;
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
  });
  return JSON.parse(stdout) as Record<string, string>;
}

// Every `prerender = false` route, plus a seeded alias and an unmatched path
// (both answered by the middleware / `[...alias]` inside the ssr function).
const ALL_SSR_PATHS = [
  '/calendar',
  '/search?q=boat',
  '/event?id=1',
  '/page?slug=about',
  '/.well-known/kychon.json',
  '/robots.txt',
  '/llms.txt',
  '/join',
  '/profile',
  '/admin',
  '/admin-members',
  '/admin-settings',
  '/media-upload',
  '/ssr-probe',
  '/Old-Page-17',
  '/old/nested/page',
];
// A cold render here takes ~0.3-1.5s (module load + render); the budget only
// has to catch a route that waits on something, far below the 60s limit.
const COLD_SSR_BUDGET_MS = 10_000;
// Static files the gateway serves itself, without invoking the ssr function.
const STATIC_SAME_HOST_PATHS = ['/assets-manifest.client.json', '/_assets-manifest.json'];

interface ColdSsrResult {
  status: number | 'hung';
  ms: number;
  location: string | null;
  sameHostFetches: string[];
}

/**
 * kychon#226: render every SSR route through the built server entry the way a
 * cold ssr container does, against a portal the size of the largest port (349
 * events, 367 path aliases). As on Run402, a request to the portal's own host
 * never completes while the function is busy serving the request that made it,
 * so any same-host call from SSR code pins the invocation to the 60s timeout.
 * Each path runs in its own process, so every path is a cold start.
 */
async function renderColdSsrRoute(path: string): Promise<ColdSsrResult> {
  const script = `
    const HOST = 'club.example.test';
    const entry = ${JSON.stringify(pathToFileURL(SERVER_ENTRY).href)};
    const STATIC_PATHS = ${JSON.stringify(STATIC_SAME_HOST_PATHS)};
    const events = Array.from({ length: 349 }, (_, i) => ({
      id: i + 1,
      title: 'Program meeting ' + (i + 1),
      description: 'Speaker and research notes. '.repeat(40),
      starts_at: new Date(Date.UTC(2020, 0, 6) + i * 7 * 864e5).toISOString(),
      ends_at: null,
      location: 'Public library',
      is_members_only: false,
    }));
    const aliases = Object.fromEntries(Array.from({ length: 367 }, (_, i) => ['/Old-Page-' + i, '/page-' + i]));
    const ok = (data) => new Response(JSON.stringify({ ok: true, correlationId: 'c', data }), {
      headers: { 'content-type': 'application/json' },
    });
    const sameHost = [];
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      const signal = init.signal ?? (input instanceof Request ? input.signal : undefined);
      if (url.host === HOST) {
        sameHost.push(url.pathname);
        if (STATIC_PATHS.includes(url.pathname)) return new Response('{}', { headers: { 'content-type': 'application/json' } });
        return new Promise((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason)));
      }
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      switch (body?.operation) {
        case 'config.get':
          return ok(body.input.key === 'path_aliases' ? { key: 'path_aliases', value: aliases } : null);
        case 'events.list':
          return ok({ rows: events, count: events.length });
        case 'events.get':
          return ok(events[0]);
        case 'search.query':
          return ok({ results: [], total: 0, page: 1, page_size: 10 });
        case 'sections.list':
          return ok({ rows: [] });
      }
      throw new Error('offline');
    };
    console.warn = () => {};
    console.error = () => {};
    const path = ${JSON.stringify(path)};
    const { handler } = await import(entry);
    const started = performance.now();
    const res = await Promise.race([
      handler(new Request('https://' + HOST + path, { headers: { host: HOST } })),
      new Promise((resolve) => setTimeout(() => resolve(null), ${COLD_SSR_BUDGET_MS} + 1000)),
    ]);
    if (res) await res.text();
    process.stdout.write(JSON.stringify({
      status: res ? res.status : 'hung',
      ms: Math.round(performance.now() - started),
      location: res ? res.headers.get('location') : null,
      sameHostFetches: sameHost,
    }));
    process.exit(0);
  `;
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(stdout) as ColdSsrResult;
}

function readRepresentativeHtml(): Map<string, string> {
  return new Map(REPRESENTATIVE_PAGES.map((page) => [page, readFileSync(join(CLIENT_DIR, page), 'utf8')]));
}

function requireSnapshotHtml(snapshot: Map<string, string>, page: string): string {
  const html = snapshot.get(page);
  if (typeof html !== 'string') throw new Error(`Missing build snapshot for ${page}`);
  return html;
}

function normalizeAstroAssetUrls(html: string): string {
  return html.replace(/\/_astro\/[^"')\s]+\.([cm]?js|css)/g, '/_astro/[asset].$1');
}

describe('Portal first-byte build output', () => {
  it('renders project chrome before runtime hydration and keeps unchanged HTML stable across rebuilds', () => {
    buildPortal();
    const firstBuildHtml = readRepresentativeHtml();

    for (const page of REPRESENTATIVE_PAGES) {
      const html = requireSnapshotHtml(firstBuildHtml, page);
      expect(html, page).toContain(BRAND);
      expect(html, page).not.toContain(FORBIDDEN_BRAND);
      expect(html, page).not.toContain('?b=');
      expect(html, page).not.toContain('/css/theme.css');
      expect(html, page).not.toContain('/css/styles.css?b=');
      expect(html, page).toMatch(/\/_astro\/[^"']+\.css/);
      expect(html, page).not.toContain('/css/nav-dropdown.css');
      expect(html, page).not.toContain('/css/zone-grid.css');
      expect(html, page).not.toContain('/css/a11y.css');
      expect(html, page).toContain('/js/env.js');
      expect(html, page).not.toContain('/js/env.js?');
    }

    for (const [path, html] of Object.entries(renderSsrRoutes(SSR_PATHS))) {
      const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? '';
      expect(title, path).toMatch(new RegExp(` — ${BRAND}$`));
      expect(title, path).not.toContain('Member Portal');
      expect(html, path).not.toContain(FORBIDDEN_BRAND);
      const footer = html.match(/id="zone-footer"[\s\S]*?<\/footer>/)?.[0] ?? '';
      expect(footer, path).toContain(BRAND);
    }

    buildPortal();

    for (const [page, html] of firstBuildHtml) {
      expect(normalizeAstroAssetUrls(readFileSync(join(CLIENT_DIR, page), 'utf8')), page).toBe(
        normalizeAstroAssetUrls(html),
      );
    }
  }, 80_000);

  // Reuses the build from the test above (vitest runs a file's tests in order);
  // builds only when run on its own.
  it('answers every SSR route on a cold start without calling its own host (kychon#226)', async () => {
    if (!existsSync(SERVER_ENTRY)) buildPortal();

    // A new request-time route has to be added to ALL_SSR_PATHS.
    const pagesDir = join(ROOT, 'src', 'pages');
    const ssrRoutes = readdirSync(pagesDir, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.(astro|ts)$/.test(file))
      .filter((file) => readFileSync(join(pagesDir, file), 'utf8').includes('export const prerender = false'))
      .map((file) => `/${relative('.', file).replace(/\.(astro|ts)$/, '')}`)
      .filter((route) => route !== '/[...alias]');
    const coveredRoutes = new Set(ALL_SSR_PATHS.map((path) => path.split('?')[0]));
    expect(ssrRoutes.filter((route) => !coveredRoutes.has(route))).toEqual([]);

    const results = Object.fromEntries(
      await Promise.all(ALL_SSR_PATHS.map(async (path) => [path, await renderColdSsrRoute(path)] as const)),
    );

    for (const path of ALL_SSR_PATHS) {
      const result = results[path];
      expect(result.status, path).not.toBe('hung');
      expect(
        result.sameHostFetches.filter((p) => !STATIC_SAME_HOST_PATHS.includes(p)),
        path,
      ).toEqual([]);
      expect(result.ms, path).toBeLessThan(COLD_SSR_BUDGET_MS);
    }
    expect(results['/calendar'].status).toBe(200);
    expect(results['/.well-known/kychon.json'].status).toBe(200);
    expect(results['/Old-Page-17']).toMatchObject({ status: 301, location: '/page-17' });
    expect(results['/old/nested/page'].status).toBe(404);
  }, 120_000);
});
