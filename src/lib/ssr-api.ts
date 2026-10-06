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

import { createKychonClient, KYCHON_CAPABILITY_FUNCTION_PATH } from '@kychon/sdk';
import { parseAssetManifest } from './bake-asset-manifest';
import type { Section } from './blocks';
import type { AssetManifest } from './kychon-image';

type KychonClient = ReturnType<typeof createKychonClient>;

const API_BASE_URL = 'https://api.run402.com';

// The endpoint is fixed rather than discovered: without `apiEndpoint` the SDK
// first fetches the portal's own `/.well-known/kychon.json`, which is itself
// an SSR route. `middleware.ts` makes an API call on every cold invocation,
// so each discovery fetch cold-started another invocation that discovered
// again, until requests piled up into the function's 60s timeout.
const API_ENDPOINT = `${API_BASE_URL}${KYCHON_CAPABILITY_FUNCTION_PATH}`;

/**
 * Every server-side API call is bounded. All callers already treat a failed
 * read as "render the shell and let the island fetch", so a slow API costs a
 * few seconds of TTFB instead of holding the request to the SSR function's
 * 60s timeout (a gateway 500).
 */
export const SSR_API_TIMEOUT_MS = 5000;

function boundedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(SSR_API_TIMEOUT_MS) });
}

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
    apiEndpoint: API_ENDPOINT,
    fetch: boundedFetch,
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
 * aliases.
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

export interface SsrEventParams {
  /** Raw `?id=` value from the request URL. */
  id: string;
  /** Request host (`Astro.request.headers.get('host')`). */
  host: string;
}

/**
 * Outcome of a per-request event read. `missing` covers both nonexistent and
 * members-only events: the anonymous read can't tell them apart, and must
 * not reveal which one it is. `error` means the read itself failed, so the
 * route renders the shell and lets the island retry instead of claiming 404.
 */
export type SsrEventResult<T> =
  | { status: 'found'; event: T }
  | { status: 'missing' }
  | { status: 'error' };

/**
 * Server-side `events.get` for `/event?id=N`. Anonymous-min with
 * `visibleMembersOnly`, so members-only events come back null and only
 * surface through the island's post-hydrate refetch with the visitor's
 * session. Non-integer ids are `missing` without a call (the capability
 * would reject them as a validation error).
 */
export async function ssrEventGet<T = unknown>(params: SsrEventParams): Promise<SsrEventResult<T>> {
  const id = params.id.trim();
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) return { status: 'missing' };
  try {
    const event = await client(params.host).request<T | null>('events.get', 'query', { id: Number(id) });
    return event ? { status: 'found', event } : { status: 'missing' };
  } catch (error) {
    console.warn('[ssr-api] events.get failed:', error instanceof Error ? error.message : error);
    return { status: 'error' };
  }
}


export interface SsrPageHeaderSectionsParams {
  /** Page slug the route hydrates as (`currentPageSlugFromLocation`). */
  slug: string;
  /** Request host (`Astro.request.headers.get('host')`). */
  host: string;
}

/**
 * Server-side `sections.list` for a route's own page-scoped header sections
 * (page_banner etc.), so `prerender = false` routes bake them into the served
 * HTML like prerendered pages do from `build-sections` (kychon#219). The
 * anonymous read applies `visibleSection`; we re-filter and sort by position
 * because the gateway ignores order. Any failure resolves to `[]` and the
 * runtime hydrate paints the banner as before.
 */
export async function ssrPageHeaderSections(params: SsrPageHeaderSectionsParams): Promise<Section[]> {
  try {
    const result = await client(params.host).request<{ rows?: Section[] }>('sections.list', 'query', {
      page_slug: params.slug,
      zone: 'header',
      scope: 'page',
    });
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    return rows
      .filter(
        (s) => s.zone === 'header' && s.scope === 'page' && s.page_slug === params.slug && s.visible !== false,
      )
      .sort((a, b) => a.position - b.position);
  } catch (error) {
    console.warn('[ssr-api] sections.list failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Public origin of an SSR request. Deployed portals are always https; the
 * Lambda's internal request URL may not say so. Only local dev keeps its own
 * scheme.
 */
export function ssrRequestOrigin(requestUrl: URL, host: string): string {
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  return `${isLocalHost ? requestUrl.protocol : 'https:'}//${host}`;
}

const ASSET_MANIFEST_TTL_MS = 5 * 60 * 1000;
const ASSET_MANIFEST_TIMEOUT_MS = 2000;
const assetManifestCache = new Map<string, { at: number; manifest: Promise<AssetManifest | null> }>();

/**
 * The site's uploaded-asset manifest, read from its own
 * `/_assets-manifest.json` at request time. The build-time accessors
 * (`getBakeAssetManifest`) return null inside the SSR Lambda, and a port's
 * `/assets/<name>` paths are not served, so without this an SSR route bakes
 * unresolvable image URLs. Cached per origin across warm invocations; any
 * failure resolves to null and the island resolves images after hydration.
 */
export function ssrAssetManifest(origin: string, now: number = Date.now()): Promise<AssetManifest | null> {
  const cached = assetManifestCache.get(origin);
  if (cached && now - cached.at < ASSET_MANIFEST_TTL_MS) return cached.manifest;
  const manifest = fetch(`${origin}/_assets-manifest.json`, { signal: AbortSignal.timeout(ASSET_MANIFEST_TIMEOUT_MS) })
    .then(async (res) => (res.ok ? parseAssetManifest(await res.text()) : null))
    .catch((error: unknown) => {
      console.warn('[ssr-api] asset manifest fetch failed:', error instanceof Error ? error.message : error);
      return null;
    });
  assetManifestCache.set(origin, { at: now, manifest });
  return manifest;
}

/** Test hook: forget cached manifests. */
export function resetSsrAssetManifestCache(): void {
  assetManifestCache.clear();
}
