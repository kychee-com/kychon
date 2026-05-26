/**
 * Build-time events loader. Fetches events from the deployed gateway
 * during `astro build` (NOT at runtime) so the `events_list` block can
 * emit real `<EventCard>` HTML into the SSR document instead of the
 * empty `<div data-block-hydrate>` shell that today only fills in
 * post-hydration.
 *
 * **Build-time only.** Reads three env vars set by `scripts/_lib.ts:runDeploy`
 * before invoking `astro build`:
 *
 *   - `KYCHON_ANON_KEY` — the project's anon JWT (same key the runtime
 *     reads from `window.__KYCHON_ANON_KEY`). RLS-gated; only public
 *     rows are returned, so member-only events still surface via the
 *     runtime hydrate path after sign-in.
 *   - `KYCHON_PROJECT_ID` — the run402 project (e.g. `prj_…_0031`). Used
 *     for telemetry and ensuring the SDK client targets the right project.
 *   - `KYCHON_PUBLIC_URL` — the deployed portal URL (e.g.
 *     `https://silver-pines.kychon.com`). The SDK reads
 *     `${portalUrl}/.well-known/kychon.json` + `${portalUrl}/js/env.js`
 *     when transport isn't fully specified; we pass `apiKey` + `apiBaseUrl`
 *     directly so neither lookup actually runs, but the field is required.
 *
 * When any var is missing (local `astro dev`, CI builds without env
 * plumbing, etc.) the loader resolves to an empty array and the block
 * render falls back to the existing skeleton + client-fetch path. Same
 * behavior as before this module shipped.
 *
 * The cache is module-scoped and lasts the lifetime of the Astro build
 * process — Astro renders pages serially in one Node process, so a
 * single fetch covers every `events_list` block across every page.
 */

import { createKychonClient } from '@kychon/sdk';

import type { Event } from '@/schemas/event';

const EVENTS_LIMIT = 100;

interface CapabilityListResult {
  rows?: Event[];
}

let loaderPromise: Promise<Event[]> | null = null;
let cache: Event[] | null = null;

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function fetchAllEvents(): Promise<Event[]> {
  const anonKey = readEnv('KYCHON_ANON_KEY');
  const projectId = readEnv('KYCHON_PROJECT_ID');
  const portalUrl = readEnv('KYCHON_PUBLIC_URL');
  if (!anonKey || !projectId || !portalUrl) {
    console.log(
      `[build-events] skipped — missing ${[
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
    // Pull a single batch covering ALL `events_list` blocks on every page.
    // `events.list` is the same operation `EventsListIsland`'s runtime
    // fetch hits — the runtime applies per-block filters client-side,
    // so does the build-time `getBuildEvents` (see below).
    const result = await client.request<CapabilityListResult>(
      'events.list',
      'query',
      {
        order: [{ field: 'starts_at', direction: 'asc' }],
        limit: EVENTS_LIMIT,
      },
    );
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    console.log(`[build-events] fetched ${rows.length} event(s) for ${projectId}`);
    return rows;
  } catch (error) {
    // Don't fail the build on a transient gateway error — the runtime
    // hydrate path will still populate cards. Worth a noisy log line so
    // a regression in build-time SSR is visible in deploy output.
    console.warn(
      `[build-events] fetch failed for ${projectId} (${portalUrl}):`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Trigger the build-time events fetch. Call this from `.astro`
 * frontmatter BEFORE `renderMainZone` (or any other consumer of
 * `getBuildEvents`) so the cache is populated. Idempotent — subsequent
 * calls return the same promise.
 */
export async function ensureBuildEventsLoaded(): Promise<void> {
  if (loaderPromise) {
    await loaderPromise;
    return;
  }
  loaderPromise = fetchAllEvents();
  cache = await loaderPromise;
}

/** Filter modes match `EventsListIsland`'s runtime config. */
export type BuildEventsFilter = 'past' | 'this_week' | 'upcoming';

const WEEK_MS = 7 * 86400 * 1000;

/**
 * Synchronous accessor for the build-time events cache. Returns the
 * filtered + sorted + sliced subset matching a single `events_list`
 * block's config. Returns `null` when the cache hasn't been populated
 * (loader hasn't run, or no env vars) — callers should fall back to
 * the empty `data-block-hydrate` shell so the runtime client-fetch
 * path still populates the section.
 */
export function getBuildEvents(filter: BuildEventsFilter, count: number): Event[] | null {
  if (cache === null) return null;
  if (cache.length === 0) return [];
  const now = Date.now();
  const horizon = now + WEEK_MS;

  // Mirror `eventsQuery` in `EventsListIsland.tsx`: upcoming = starts_at >= now,
  // this_week = upcoming AND < now + 7d, past = starts_at < now (descending).
  let filtered: Event[];
  if (filter === 'past') {
    filtered = cache
      .filter((e) => e.starts_at && Date.parse(e.starts_at) < now)
      .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  } else if (filter === 'this_week') {
    filtered = cache
      .filter((e) => {
        if (!e.starts_at) return false;
        const ts = Date.parse(e.starts_at);
        return ts >= now && ts < horizon;
      })
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  } else {
    filtered = cache
      .filter((e) => e.starts_at && Date.parse(e.starts_at) >= now)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  }
  const safeCount = Math.max(1, Math.min(50, Math.floor(count)) || 4);
  return filtered.slice(0, safeCount);
}

/**
 * Return the full unfiltered build-time events cache, or `null` if the
 * loader hasn't run (or had nothing to fetch). Used by `index.astro` to
 * stamp `ctx.buildEvents` once per page render so each `events_list`
 * block can apply its own filter+count synchronously. Prefer
 * `getBuildEvents(filter, count)` when you want a single block's
 * sliced view — this is the raw cache.
 */
export function getAllBuildEvents(): readonly Event[] | null {
  return cache;
}

/** Test-only: clear the cache between test runs. */
export function _clearBuildEventsCacheForTests(): void {
  loaderPromise = null;
  cache = null;
}
