/**
 * Build-time pages loader. Fetches the published, public `pages` rows from
 * the deployed gateway during `astro build` (NOT at runtime) so
 * `[customPage].astro` can SSR the page body — title + rich-text content —
 * into the document instead of the skeleton shell that previously only
 * filled in post-hydration.
 *
 * Ported sites are the motivating case (kychon#126): their page bodies live
 * exclusively in the `pages` table, so without this loader every ported
 * custom page served a ~900-character raw-HTML shell and failed no-JS
 * content parity.
 *
 * **Build-time only.** Reads the same env vars `scripts/_lib.ts:runDeploy`
 * sets before invoking `astro build` (see build-events.ts for the full
 * contract): `KYCHON_ANON_KEY`, `KYCHON_PROJECT_ID`, `KYCHON_PUBLIC_URL`.
 * The anon key means the gateway's `visiblePage` filter applies — only
 * `published` pages without `requires_auth` come back, so nothing
 * member-gated can ever be baked into public HTML.
 *
 * When any var is missing (local `astro dev`, CI builds without env
 * plumbing) the loader resolves to an empty cache and `[customPage].astro`
 * falls back to the existing skeleton + client-fetch path.
 */

import { createKychonClient } from '@kychon/sdk';

import type { Page } from '@/schemas/content';

interface CapabilityListResult {
  rows?: Page[];
}

let loaderPromise: Promise<Page[]> | null = null;
let cache: Page[] | null = null;

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function fetchAllPages(): Promise<Page[]> {
  const anonKey = readEnv('KYCHON_ANON_KEY');
  const projectId = readEnv('KYCHON_PROJECT_ID');
  const portalUrl = readEnv('KYCHON_PUBLIC_URL');
  if (!anonKey || !projectId || !portalUrl) {
    console.log(
      `[build-pages] skipped — missing ${[
        !anonKey && 'KYCHON_ANON_KEY',
        !projectId && 'KYCHON_PROJECT_ID',
        !portalUrl && 'KYCHON_PUBLIC_URL',
      ]
        .filter(Boolean)
        .join(', ')}`,
    );
    return [];
  }

  const client = createKychonClient({
    portalUrl,
    apiKey: anonKey,
    apiBaseUrl: 'https://api.run402.com',
  });

  try {
    // The list mode returns every row passing the gateway's `visiblePage`
    // filter — under the anon key that is exactly the bake-safe set
    // (published, not requires_auth). Ports carry 100+ pages; the gateway
    // does not paginate table queries.
    const result = await client.request<CapabilityListResult>('pages.list', 'query', {});
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    // Defense in depth: never bake a gated or unpublished row even if the
    // gateway filter regresses — baked HTML is public forever.
    const bakeSafe = rows.filter((row) => row.published !== false && row.requires_auth !== true);
    console.log(`[build-pages] fetched ${bakeSafe.length} page(s) for ${projectId}`);
    return bakeSafe;
  } catch (error) {
    // Don't fail the build on a transient gateway error — the runtime
    // hydrate path still populates pages. Noisy log so a regression in
    // build-time SSR is visible in deploy output.
    console.warn(
      `[build-pages] fetch failed for ${projectId} (${portalUrl}):`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Trigger the build-time pages fetch. Call from `.astro` frontmatter (or
 * `getStaticPaths`) before reading the cache. Idempotent — subsequent calls
 * await the same promise.
 */
export async function ensureBuildPagesLoaded(): Promise<void> {
  if (loaderPromise) {
    await loaderPromise;
    return;
  }
  loaderPromise = fetchAllPages();
  cache = await loaderPromise;
}

/**
 * Synchronous accessor for one baked page by slug. Returns `null` when the
 * cache is unpopulated (loader skipped/failed) or the slug is unknown —
 * callers fall back to the runtime hydrate path.
 */
export function getBuildPageBySlug(slug: string): Page | null {
  if (!cache) return null;
  return cache.find((page) => page.slug === slug) ?? null;
}

/**
 * Full bake-safe page list, or `null` when the loader hasn't produced a
 * cache. `[customPage].astro#getStaticPaths` unions these slugs with the
 * seed's pages so DB-backed ports get per-slug static HTML.
 */
export function getAllBuildPages(): Page[] | null {
  return cache ? cache.slice() : null;
}

/** Test-only: clear the cache between test runs. */
export function _clearBuildPagesCacheForTests(): void {
  loaderPromise = null;
  cache = null;
}

/** Test-only: inject a cache without network. */
export function _setBuildPagesCacheForTests(pages: Page[]): void {
  loaderPromise = Promise.resolve(pages);
  cache = pages;
}
