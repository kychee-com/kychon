/**
 * Browser smoke test for deployed Kychon chrome.
 *
 * Requires Playwright at runtime. This is intentionally optional so the normal
 * Kychon install stays light:
 *
 *   npm exec --package=playwright -- tsx scripts/smoke-chrome-browser.ts \
 *     --base https://odbc-port.run402.com \
 *     --brand "Old Dominion Boat Club" \
 *     --forbid "Kychon Community"
 */

interface Options {
  base: string;
  brand: string;
  forbid: string;
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
  if (!base || !brand) {
    throw new Error('Usage: tsx scripts/smoke-chrome-browser.ts --base <url> --brand <text> [--forbid <text>]');
  }
  return { base: base.replace(/\/+$/, ''), brand, forbid };
}

async function importPlaywright(): Promise<any> {
  try {
    const load = new Function('return import("playwright")') as () => Promise<any>;
    return await load();
  } catch {
    throw new Error(
      'Playwright is required for this smoke test. Run with: npm exec --package=playwright -- tsx scripts/smoke-chrome-browser.ts ...',
    );
  }
}

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.goto(`${opts.base}/calendar`, { waitUntil: 'networkidle' });
    const html = await page.content();
    if (!html.includes(opts.brand)) throw new Error(`hydrated page missing ${opts.brand}`);
    if (opts.forbid && html.includes(opts.forbid)) throw new Error(`hydrated page contains ${opts.forbid}`);

    const brandText = await page.locator('[data-nav-brand]').first().textContent();
    if (!brandText?.includes(opts.brand)) {
      throw new Error(`visible nav brand mismatch: ${brandText ?? '<empty>'}`);
    }

    const dropdownTrigger = page.locator('[data-nav-item-wrap]').first();
    if (await dropdownTrigger.count()) {
      await dropdownTrigger.hover();
      await page.waitForTimeout(250);
    }

    if (consoleErrors.length > 0) {
      throw new Error(`browser console errors:\n${consoleErrors.join('\n')}`);
    }

    process.stdout.write('ok browser chrome smoke\n');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
