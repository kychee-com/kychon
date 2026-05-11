import { join } from 'node:path';

import { materializeCustomPageStaticFiles, ROOT } from './_lib.ts';
import { describeSeedSource, resolveActiveProjectSeed } from '../src/seeds/index.ts';

async function main(): Promise<void> {
  const { seed, source } = await resolveActiveProjectSeed();
  const distDir = join(ROOT, 'dist');
  const materialized = materializeCustomPageStaticFiles(distDir, seed);
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
