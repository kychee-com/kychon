/**
 * Raw HTTP first-byte chrome verification for deployed Kychon ports.
 *
 * Example:
 *   npx tsx scripts/verify-first-byte-chrome.ts \
 *     --base https://odbc-port.run402.com \
 *     --brand "Old Dominion Boat Club" \
 *     --forbid "Kychon Community"
 */

const DEFAULT_PATHS = [
  '/',
  '/page.html?slug=membership',
  '/events.html',
  '/calendar.html',
  '/directory.html',
  '/committees.html',
  '/forum.html',
  '/resources.html',
  '/polls.html',
  '/profile.html',
  '/join.html',
  '/event.html',
  '/admin.html',
  '/admin-members.html',
  '/admin-settings.html',
];

interface Options {
  base: string;
  brand: string;
  forbid: string;
  paths: string[];
}

function readFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  return args[idx + 1] ?? null;
}

function parseOptions(args: string[]): Options {
  const base = readFlag(args, '--base');
  const brand = readFlag(args, '--brand');
  const forbid = readFlag(args, '--forbid') ?? 'Kychon Community';
  const pathsArg = readFlag(args, '--paths');
  if (!base || !brand) {
    throw new Error(
      'Usage: tsx scripts/verify-first-byte-chrome.ts --base <url> --brand <text> [--forbid <text>] [--paths /,/events.html]',
    );
  }
  return {
    base: base.replace(/\/+$/, ''),
    brand,
    forbid,
    paths: pathsArg ? pathsArg.split(',').map((p) => p.trim()).filter(Boolean) : DEFAULT_PATHS,
  };
}

function urlFor(base: string, path: string): string {
  if (path === '/') return `${base}/`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function assertFreshAssetUrls(html: string, path: string): void {
  const expected = [
    '/css/theme.css?b=',
    '/css/nav-dropdown.css?b=',
    '/css/zone-grid.css?b=',
    '/css/a11y.css?b=',
    '/js/env.js?b=',
  ];
  for (const marker of expected) {
    if (!html.includes(marker)) {
      throw new Error(`${path}: missing deploy-fresh asset marker ${marker}`);
    }
  }
  if (!/\/_astro\/[^"']+\.css/.test(html)) {
    throw new Error(`${path}: missing hashed Astro CSS bundle`);
  }
}

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
  const failures: string[] = [];

  for (const path of opts.paths) {
    const url = urlFor(opts.base, path);
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const html = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!html.includes(opts.brand)) throw new Error(`missing expected brand "${opts.brand}"`);
      if (opts.forbid && html.includes(opts.forbid)) {
        throw new Error(`contains forbidden brand "${opts.forbid}"`);
      }
      assertFreshAssetUrls(html, path);
      process.stdout.write(`ok ${path}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${path}: ${message}`);
      process.stdout.write(`fail ${path}: ${message}\n`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`First-byte chrome verification failed:\n${failures.join('\n')}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
