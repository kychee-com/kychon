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
