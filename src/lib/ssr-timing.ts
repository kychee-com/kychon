/**
 * `Server-Timing` for SSR responses, so the cold path is measurable from the
 * outside (curl -I, the deploy's cold SSR probe) without reading function
 * logs. Times are in ms on the function's own clock:
 *
 * - `boot` (first request in a container only): process start to the request
 *   reaching the app, i.e. function init plus loading the route's modules.
 * - `upstream` (first request only): request reaching the app to the first
 *   upstream call leaving (capability API or the site asset manifest).
 * - `app`: request reaching the app to the response being ready.
 *
 * No secrets or identifiers; `cold` marks a container's first request.
 */

let requestsServed = 0;
let firstUpstreamAt: number | null = null;

/** Record that an upstream call is leaving now (first call per container wins). */
export function markUpstreamStart(): void {
  if (firstUpstreamAt === null) firstUpstreamAt = performance.now();
}

export interface SsrTimingMark {
  cold: boolean;
  entryAt: number;
}

/** Call when a request reaches the app. */
export function startSsrTiming(): SsrTimingMark {
  const cold = requestsServed === 0;
  requestsServed += 1;
  return { cold, entryAt: performance.now() };
}

export function ssrTimingHeader(mark: SsrTimingMark, doneAt: number = performance.now()): string {
  const ms = (value: number) => Math.max(0, Math.round(value));
  const parts: string[] = [];
  if (mark.cold) {
    parts.push(`boot;dur=${ms(mark.entryAt)}`);
    if (firstUpstreamAt !== null && firstUpstreamAt >= mark.entryAt) {
      parts.push(`upstream;dur=${ms(firstUpstreamAt - mark.entryAt)}`);
    }
  }
  parts.push(`app;dur=${ms(doneAt - mark.entryAt)}`);
  if (mark.cold) parts.push('cold');
  return parts.join(', ');
}

/** Test hook. */
export function resetSsrTiming(): void {
  requestsServed = 0;
  firstUpstreamAt = null;
}
