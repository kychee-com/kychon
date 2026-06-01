/**
 * Build-time announcements loader. Same shape as `build-events.ts`:
 * fetches once per build via `@kychon/sdk`'s `announcements.list`
 * capability so `blocks.ts:ANNOUNCEMENTS_FEED.render` can emit real
 * announcement cards into the SSR HTML instead of the empty
 * `data-block-hydrate` shell that today only fills in post-hydration.
 *
 * **Build-time only.** Same env vars as `build-events.ts`:
 *   - `KYCHON_ANON_KEY`
 *   - `KYCHON_PROJECT_ID`
 *   - `KYCHON_PUBLIC_URL`
 *
 * Anon-key RLS-gates the fetch to publicly-readable rows. If your
 * announcements RLS lets anon read all rows (typical for community
 * portals), you get full SSR coverage. If some announcements are
 * member-gated, those land via the runtime hydrate path once the
 * visitor's session is in scope.
 *
 * Polls + per-user vote state are NOT fetched at build time — they're
 * per-user and would leak the building agent's identity. The React
 * island still attaches polls in its post-hydrate refresh.
 */

import { createKychonClient } from '@kychon/sdk';

import type { Announcement } from '@/schemas/content';

const ANNOUNCEMENTS_LIMIT = 50;

interface CapabilityListResult {
  rows?: Announcement[];
}

let loaderPromise: Promise<Announcement[]> | null = null;
let cache: Announcement[] | null = null;

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function fetchAllAnnouncements(): Promise<Announcement[]> {
  const anonKey = readEnv('KYCHON_ANON_KEY');
  const projectId = readEnv('KYCHON_PROJECT_ID');
  const portalUrl = readEnv('KYCHON_PUBLIC_URL');
  if (!anonKey || !projectId || !portalUrl) {
    console.log(
      `[build-announcements] skipped — missing ${[
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
    // Mirror the runtime island's query: pinned first, then newest.
    // `getAnnouncements('order=is_pinned.desc,created_at.desc&limit=20')`
    // in `AnnouncementsFeedIsland.tsx:390` becomes:
    const result = await client.request<CapabilityListResult>(
      'announcements.list',
      'query',
      {
        order: [
          { field: 'is_pinned', direction: 'desc' },
          { field: 'created_at', direction: 'desc' },
        ],
        limit: ANNOUNCEMENTS_LIMIT,
      },
    );
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    console.log(`[build-announcements] fetched ${rows.length} row(s) for ${projectId}`);
    return rows;
  } catch (error) {
    // Same fallback as build-events: don't fail the build on transient
    // gateway errors; the runtime hydrate path still populates cards.
    console.warn(
      `[build-announcements] fetch failed for ${projectId} (${portalUrl}):`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Trigger the build-time announcements fetch. Call from `.astro`
 * frontmatter BEFORE `renderMainZone` (alongside
 * `ensureBuildEventsLoaded`). Idempotent.
 */
export async function ensureBuildAnnouncementsLoaded(): Promise<void> {
  if (loaderPromise) {
    await loaderPromise;
    return;
  }
  loaderPromise = fetchAllAnnouncements();
  cache = await loaderPromise;
}

/**
 * Return the unfiltered build-time announcements cache. Used by
 * `.astro` frontmatter to stamp `ctx.buildAnnouncements` once per
 * page render; `blocks.ts:ANNOUNCEMENTS_FEED.render` slices it
 * (`limit` from the block's config) synchronously. Returns a shallow copy so
 * callers (mutable `BlockRenderContext.buildAnnouncements`) can't mutate the
 * shared cache.
 */
export function getAllBuildAnnouncements(): Announcement[] | null {
  return cache ? cache.slice() : null;
}

/** Test-only: clear the cache between test runs. */
export function _clearBuildAnnouncementsCacheForTests(): void {
  loaderPromise = null;
  cache = null;
}
