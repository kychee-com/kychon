import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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
const SSR_PATHS = ['/calendar', '/search?q=boat', '/event?id=1'];

// Representative prerendered pages. admin*, profile, and join are SSR
// (prerender = false): they read auth.user() server-side for redirect
// guards / hosted <SignIn> returnTo, so they never appear as static HTML
// and are covered by the SSR entry's render path. calendar / search /
// event / ssr-probe are likewise SSR-only.
const REPRESENTATIVE_PAGES = [
  'index.html',
  'page.html',
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
});
