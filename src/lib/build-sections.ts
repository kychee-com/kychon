/**
 * Build-time page-section loader. Fetches a page's page-scoped main-zone
 * `sections` rows from the deployed gateway during `astro build` (NOT at
 * runtime) so `chrome-bake.ts:renderMainZone` can SSR-bake the page's
 * hero/custom/events_list/slideshow blocks into the prerendered HTML.
 *
 * Motivating case — copy-website ports (mirrors build-events.ts / build-pages.ts):
 * `resolveActiveProjectSeed()` returns the chrome SNAPSHOT for a port, which
 * carries global chrome only (zone='header'/'footer', scope='global'). A
 * port's page-scoped main-zone sections (zone='main', scope='page') live ONLY
 * in the deployed database (applied via seed.sql), so `renderMainZone` finds
 * none in the seed and bakes nothing — the body only appears after the runtime
 * hydrate. This loader closes that gap so no-JS readers, link previews, and
 * crawlers see the real sections at first paint.
 *
 * **Build-time only.** Reads the same env vars `scripts/_lib.ts:runDeploy` sets
 * before invoking `astro build` (see build-events.ts for the full contract):
 * `KYCHON_ANON_KEY`, `KYCHON_PROJECT_ID`, `KYCHON_PUBLIC_URL`. The anon key
 * means the gateway's `visibleSection` filter applies — only publicly-visible,
 * non-admin-scoped rows come back, so nothing gated bakes into public HTML.
 * When any var is missing (local `astro dev`, CI without env plumbing) the
 * loader resolves to an empty cache and the caller falls back to whatever the
 * snapshot seed already had — same graceful skip as build-events/build-pages.
 *
 * NOTE: the capability gateway's `listResult` does NOT honor `order`/`limit`
 * (only equality filters via `matchesInput`), exactly like `events.list` —
 * build-events re-sorts client-side and so do we (by `position`). Do not rely
 * on a server-side order param.
 */

import { createKychonClient } from '@kychon/sdk';

import type { Section } from '@/lib/blocks';

interface CapabilityListResult {
  rows?: Section[];
}

// Per-slug cache + in-flight promise dedupe; lasts the lifetime of the Astro
// build process (pages render serially in one Node process).
const cache = new Map<string, Section[]>();
const loaders = new Map<string, Promise<Section[]>>();

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function fetchPageSections(pageSlug: string): Promise<Section[]> {
  const anonKey = readEnv('KYCHON_ANON_KEY');
  const projectId = readEnv('KYCHON_PROJECT_ID');
  const portalUrl = readEnv('KYCHON_PUBLIC_URL');
  if (!anonKey || !projectId || !portalUrl) {
    console.log(
      `[build-sections] skipped — missing ${[
        !anonKey && 'KYCHON_ANON_KEY',
        !projectId && 'KYCHON_PROJECT_ID',
        !portalUrl && 'KYCHON_PUBLIC_URL',
      ].filter(Boolean).join(', ')}`,
    );
    return [];
  }

  const client = createKychonClient({
    portalUrl,
    apiKey: anonKey,
    apiBaseUrl: 'https://api.run402.com',
  });

  try {
    // Equality filters (page_slug/zone/scope) ARE applied server-side by the
    // gateway's `matchesInput`; the anon key adds `visibleSection` (drops
    // visible=false + admin-scoped). We re-filter + re-sort below because the
    // gateway ignores order/limit and because baked HTML is public forever.
    const result = await client.request<CapabilityListResult>(
      'sections.list',
      'query',
      { page_slug: pageSlug, zone: 'main', scope: 'page' },
    );
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const baked = rows
      .filter(
        (s) =>
          s.zone === 'main' &&
          s.scope === 'page' &&
          s.page_slug === pageSlug &&
          s.visible !== false,
      )
      .sort((a, b) => a.position - b.position);
    console.log(
      `[build-sections] fetched ${baked.length} main-zone section(s) for ${projectId} (slug="${pageSlug}")`,
    );
    return baked;
  } catch (error) {
    // Never fail the build on a transient gateway error — the runtime hydrate
    // path still populates sections. Noisy log so a regression is visible.
    console.warn(
      `[build-sections] fetch failed for ${projectId} (${portalUrl}, slug="${pageSlug}"):`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Trigger the build-time fetch of a page's main-zone sections. Call from
 * `.astro` frontmatter BEFORE `renderMainZone`. Idempotent per slug.
 */
export async function ensureBuildSectionsLoaded(pageSlug: string): Promise<void> {
  if (loaders.has(pageSlug)) {
    await loaders.get(pageSlug);
    return;
  }
  const promise = fetchPageSections(pageSlug);
  loaders.set(pageSlug, promise);
  cache.set(pageSlug, await promise);
}

/**
 * Synchronous accessor for the build-time page-section cache. Returns the
 * filtered + sorted main-zone sections for a slug, or `[]` when the loader
 * skipped/failed/hasn't run. Callers MERGE these into the seed sections passed
 * to `renderMainZone` — empty means "fall back to whatever the snapshot had".
 */
export function getBuildSections(pageSlug: string): Section[] {
  return cache.get(pageSlug)?.slice() ?? [];
}

/** Test-only: clear the cache between test runs. */
export function _clearBuildSectionsCacheForTests(): void {
  cache.clear();
  loaders.clear();
}
