import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, 'fixtures/chrome/odbc.chrome-snapshot.json');
const BRAND = 'Old Dominion Boat Club';
const FORBIDDEN_BRAND = 'Kychon Community';
// The @run402/astro adapter relocates prerendered HTML from `dist/` to
// `dist/run402/client/`. The adapter is unconditional in astro.config.mjs
// because calendar / search / ssr-probe export `prerender = false` — without
// the adapter `astro build` throws NoAdapterInstalled. Static pages still
// prerender, just under the client dir.
const CLIENT_DIR = join(ROOT, 'dist', 'run402', 'client');

// Representative prerendered pages. The cookie-auth cutover made admin*,
// profile, and join SSR (prerender = false): they read auth.user() server-side
// for redirect guards / hosted <SignIn> returnTo, so they never appear as
// static HTML and are covered by the SSR entry's render path. calendar /
// search / ssr-probe are likewise SSR-only.
const REPRESENTATIVE_PAGES = [
  'index.html',
  'page.html',
  'events.html',
  'directory.html',
  'committees.html',
  'forum.html',
  'resources.html',
  'polls.html',
  'event.html',
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

    buildPortal();

    for (const [page, html] of firstBuildHtml) {
      expect(normalizeAstroAssetUrls(readFileSync(join(CLIENT_DIR, page), 'utf8')), page).toBe(
        normalizeAstroAssetUrls(html),
      );
    }
  }, 80_000);
});
