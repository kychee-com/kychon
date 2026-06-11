/**
 * Per-request SSR API helpers — for `prerender = false` Astro routes
 * running inside the run402 Astro SSR Lambda.
 *
 * Distinct from `src/lib/build-events.ts` etc. (build-time fetch + cache
 * for static SSR generation) and from `src/lib/api.ts` (browser-side
 * client reading `window.__KYCHON_ANON_KEY`). Server runtime has neither
 * a build-time cache nor a `window` — every request calls fresh.
 *
 * For now only calls capabilities that are `anonymous` minimum
 * (`search.query`, `search.suggest`). An empty `apiKey` is fine — the
 * SDK omits the `apikey` header. When a future SSR route needs an
 * authenticated call (member-only event detail, admin dashboards), wire
 * the anon key in via Vite `define` so it's baked into the SSR bundle
 * at build time, mirroring how `KYCHON_PROJECT` is baked in
 * `astro.config.mjs`.
 */

import { createKychonClient } from '@kychon/sdk';

type KychonClient = ReturnType<typeof createKychonClient>;

const API_BASE_URL = 'https://api.run402.com';

// Anon-key JWT baked in at build time via `astro.config.mjs:vite.define`.
// Browser reads it from `window.__KYCHON_ANON_KEY` (env.js); the SSR
// Lambda has neither, so we substitute the literal at compile time.
// Empty when `KYCHON_ANON_KEY` isn't set during the build (e.g. local
// `astro dev`) — the SDK then makes the call without an `apikey`
// header, which works for truly-anonymous capabilities but may fail
// on gateway configurations that require any role-stamped JWT.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ANON_KEY: string = (import.meta as any).env?.KYCHON_ANON_KEY || '';

let cachedClient: KychonClient | null = null;

function client(host: string): KychonClient {
  if (cachedClient) return cachedClient;
  cachedClient = createKychonClient({
    portalUrl: `https://${host}`,
    apiKey: ANON_KEY || (() => null),
    apiBaseUrl: API_BASE_URL,
  });
  return cachedClient;
}

export interface SsrSearchParams {
  q: string;
  type?: string;
  page?: number;
  page_size?: number;
  /** Request host (`Astro.request.headers.get('host')`). */
  host: string;
}

export async function ssrSearchQuery<T = unknown>(params: SsrSearchParams): Promise<T | null> {
  if (!params.q?.trim()) return null;
  try {
    type JsonValue = string | number | boolean | null;
    const input: Record<string, JsonValue> = { q: params.q };
    if (params.type) input.type = params.type;
    if (params.page != null) input.page = params.page;
    if (params.page_size != null) input.page_size = params.page_size;
    return await client(params.host).request<T>('search.query', 'query', input);
  } catch (error) {
    console.warn('[ssr-api] search.query failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export interface SsrEventsListParams {
  /** Request host (`Astro.request.headers.get('host')`). */
  host: string;
  /** PostgREST-style order — e.g. `'starts_at.asc'`. Defaults to ASC. */
  order?: string;
  /** Optional row cap. The capability defaults are usually high enough for
   *  community-portal scale; this exists for safety on bigger tenants. */
  limit?: number;
}

/**
 * Server-side `events.list` call for routes that need the full events
 * roster per-request (`/calendar` currently; future month-aware
 * navigation). `events.list` is anonymous-min so member-only events
 * are RLS-gated out — those still surface only via the runtime
 * hydrate path once the visitor's session is in scope.
 */
export async function ssrEventsList<T = unknown>(params: SsrEventsListParams): Promise<T | null> {
  try {
    type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
    const order: JsonValue = params.order
      ? params.order.split(',').map((entry) => {
          const [field, dir] = entry.trim().split('.');
          return { field, direction: dir === 'desc' ? 'desc' : 'asc' };
        })
      : [{ field: 'starts_at', direction: 'asc' }];
    const input: Record<string, JsonValue> = { order };
    if (params.limit != null) input.limit = params.limit;
    // The capability returns `{ rows: Event[], count }`; type-erased
    // here so consumers can constrain to their schema.
    return await client(params.host).request<T>('events.list', 'query', input);
  } catch (error) {
    console.warn('[ssr-api] events.list failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export interface SsrConfigParams {
  /** site_config key to read (must be in a publicly visible category). */
  key: string;
  /** Request host (`Astro.request.headers.get('host')`). */
  host: string;
}

/**
 * Read one public `site_config` value per request. Returns the raw JSONB
 * value or `null` when the key is absent, non-public, or the gateway call
 * fails. Used by `[...alias].astro` to resolve copied-site source-path
 * aliases (kychon#128).
 */
export async function ssrConfigValue<T = unknown>(params: SsrConfigParams): Promise<T | null> {
  try {
    const row = await client(params.host).request<{ key: string; value: T } | null>(
      'config.get',
      'query',
      { key: params.key },
    );
    if (row && typeof row === 'object' && 'value' in row) return row.value;
    return null;
  } catch (error) {
    console.warn('[ssr-api] config.get failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
