/**
 * Bounded service-key reads for `prerender = false` routes (admin gates,
 * `/.well-known/kychon.json`).
 *
 * `adminDb()` from `@run402/functions` takes no AbortSignal, and it retries
 * PostgREST 404/503/PGRST204/205 for up to 20s to ride out a schema-cache
 * reload, which is exactly what a migration-bearing deploy triggers. Unbounded,
 * a stalled read holds the request until the SSR function's 60s limit and the
 * gateway answers 500 (kychon#226). Here every read races a timer instead, so a
 * slow database costs a few seconds and a clear fallback.
 */

import { adminDb } from '@run402/functions';

/** Same budget as the capability-API calls in `ssr-api.ts` (SSR_API_TIMEOUT_MS). */
export const SSR_DB_TIMEOUT_MS = 5000;

export class SsrTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'SsrTimeoutError';
  }
}

/** `adminDb()` query builders are thenables whose `then` returns void. */
export interface Thenable<T> {
  then(resolve: (value: T) => void, reject: (reason: Error) => void): unknown;
}

/**
 * Resolve `work` or reject with `SsrTimeoutError` after `ms`. The underlying
 * request is abandoned, not aborted (the DB client has no signal); the route
 * returns its response and the Lambda freezes it.
 */
export function withSsrTimeout<T>(work: Thenable<T>, label: string, ms = SSR_DB_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new SsrTimeoutError(label, ms)), ms);
    work.then(resolve, reject);
  }).finally(() => clearTimeout(timer));
}

/** Seconds a client should wait before retrying a gate that could not be decided. */
export const SSR_RETRY_AFTER_SECONDS = 5;

export type AdminGateResult = 'allowed' | 'forbidden' | 'unavailable';

/**
 * Admin page gate: an active member whose role is `admin` or `owner`.
 * `unavailable` means the lookup failed or timed out, so the page answers 503
 * (fail closed, retryable) instead of hanging or claiming 403.
 */
export async function ssrAdminGate(userId: string): Promise<AdminGateResult> {
  try {
    // run402-allow-user-filter: adminDb() bypasses RLS for the admin role lookup
    const query = adminDb().from('members').select('role,status').eq('user_id', userId).limit(1);
    const rows = await withSsrTimeout(query, 'admin gate');
    const member = rows?.[0] as { role?: unknown; status?: unknown } | undefined;
    const isAdmin = member?.role === 'admin' || member?.role === 'owner';
    return isAdmin && member?.status === 'active' ? 'allowed' : 'forbidden';
  } catch (error) {
    console.warn('[ssr-db] admin gate failed:', error instanceof Error ? error.message : error);
    return 'unavailable';
  }
}

/** The 503 an admin page returns when `ssrAdminGate` is `unavailable`. */
export function adminGateUnavailableResponse(): Response {
  return new Response('Temporarily unavailable, please retry in a few seconds.', {
    status: 503,
    headers: { 'Retry-After': String(SSR_RETRY_AFTER_SECONDS), 'Cache-Control': 'no-store' },
  });
}

/**
 * `site_config.feature_ai_connector` for the discovery document. Fails open
 * (`true`, the default) when the read fails or times out.
 */
export async function ssrConnectorEnabled(): Promise<boolean> {
  try {
    const query = adminDb().from('site_config').select('value').eq('key', 'feature_ai_connector').limit(1);
    const rows = await withSsrTimeout(query, 'feature_ai_connector read');
    const value = rows?.[0]?.value;
    return value !== false && value !== 'false';
  } catch (error) {
    console.warn('[ssr-db] connector flag read failed:', error instanceof Error ? error.message : error);
    return true;
  }
}
