import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { materializeCustomPageStaticFiles, ROOT } from './_lib.ts';
import { customPageStaticFile, safeCustomPageSlugs } from '../src/lib/clean-routes.ts';
import { describeSeedSource, resolveActiveProjectSeed } from '../src/seeds/index.ts';

async function main(): Promise<void> {
  const { seed, source } = await resolveActiveProjectSeed();
  const distDir = join(ROOT, 'dist');
  // Adapter-aware: when @run402/astro's SSR adapter ran, `[customPage].astro`'s
  // getStaticPaths already emitted per-slug HTML under `dist/run402/client/`,
  // and `dist/page.html` doesn't exist — so the legacy copy step would throw.
  // Mirror `runDeploy`'s detection (scripts/_lib.ts:634) and just enumerate
  // slugs for the log line.
  const adapterActive = existsSync(join(distDir, 'run402', 'adapter.json'));
  const materialized = adapterActive
    ? safeCustomPageSlugs(seed.pages)
        .map((slug) => {
          const file = customPageStaticFile(slug);
          return file ? { slug, file } : null;
        })
        .filter((entry): entry is { slug: string; file: `${string}.html` } => entry !== null)
    : materializeCustomPageStaticFiles(distDir, seed);
  if (materialized.length === 0) {
    process.stdout.write(`No clean custom page aliases generated for ${describeSeedSource(source)}.\n`);
    return;
  }
  process.stdout.write(
    `Generated ${materialized.length} clean custom page aliases for ${describeSeedSource(source)}: ` +
      `${materialized.map((page) => `/${page.slug}->${page.file}`).join(', ')}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
