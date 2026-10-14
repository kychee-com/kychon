/**
 * Post-activation SSR probe (kychon#226).
 *
 * The error watch only sees errors that traffic triggers, and a hard 60s
 * `Sandbox.Timedout` flushes no logs. A deploy that left the SSR function
 * hanging on cold requests passed the in-deploy watch and failed later. So
 * right after `apply()` activates a release that ships the SSR function, ask
 * its server-rendered routes once each, one at a time, while every container is
 * still cold. All three are read-only GETs. A 5xx, a network error or an answer
 * slower than the budget fails the deploy, like the error watch does.
 */

/** Read-only SSR routes every engine build serves. */
export const SSR_PROBE_PATHS = ['/.well-known/kychon.json', '/calendar', '/search?q=meeting'] as const;
/** A cold SSR answer slower than this fails the gate. */
export const SSR_PROBE_BUDGET_MS = 10_000;
/** Give up on one request here (well past the budget, well short of the 60s sandbox limit). */
export const SSR_PROBE_ABORT_MS = 30_000;

export interface SsrProbeResult {
  path: string;
  status: number | null;
  ms: number;
  error?: string;
}

/** Pure verdict for one probe: ok, or why it failed. */
export function classifySsrProbe(result: SsrProbeResult, budgetMs = SSR_PROBE_BUDGET_MS): 'ok' | 'slow' | 'error' {
  if (result.status === null || result.status >= 500) return 'error';
  if (result.ms > budgetMs) return 'slow';
  return 'ok';
}

export function renderSsrProbeLine(result: SsrProbeResult, budgetMs = SSR_PROBE_BUDGET_MS): string {
  const verdict = classifySsrProbe(result, budgetMs);
  const status = result.status ?? result.error ?? 'no response';
  return `  ${verdict === 'ok' ? 'ok  ' : 'FAIL'} ${result.path} -> ${status} in ${(result.ms / 1000).toFixed(1)}s${verdict === 'slow' ? ` (budget ${budgetMs / 1000}s)` : ''}`;
}

export async function probeSsrRoutes(
  siteUrl: string,
  fetchImpl: typeof fetch = fetch,
  paths: readonly string[] = SSR_PROBE_PATHS,
): Promise<SsrProbeResult[]> {
  const base = siteUrl.replace(/\/+$/, '');
  const results: SsrProbeResult[] = [];
  for (const path of paths) {
    const started = Date.now();
    try {
      const res = await fetchImpl(`${base}${path}`, {
        redirect: 'manual',
        headers: { 'user-agent': 'kychon-deploy-ssr-probe' },
        signal: AbortSignal.timeout(SSR_PROBE_ABORT_MS),
      });
      await res.arrayBuffer().catch(() => undefined);
      results.push({ path, status: res.status, ms: Date.now() - started });
    } catch (error) {
      results.push({
        path,
        status: null,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

/**
 * Deploy gate: probe the release's SSR routes and `process.exit(1)` on any
 * failure. Skipped with `RUN402_SKIP_SSR_PROBE=1`, when the release ships no
 * SSR function, or when the apply returned no site URL.
 */
export async function gateSsrProbe(opts: { siteUrl: string | undefined; hasSsr: boolean }): Promise<void> {
  if (process.env.RUN402_SKIP_SSR_PROBE === '1') {
    console.log('[ssr-probe] skipped (RUN402_SKIP_SSR_PROBE=1)');
    return;
  }
  if (!opts.hasSsr) return;
  if (!opts.siteUrl) {
    console.log('[ssr-probe] skipped (apply returned no site URL)');
    return;
  }
  console.log(`\n[ssr-probe] cold SSR requests against ${opts.siteUrl} (budget ${SSR_PROBE_BUDGET_MS / 1000}s each):`);
  const results = await probeSsrRoutes(opts.siteUrl);
  for (const result of results) console.log(renderSsrProbeLine(result));
  if (results.some((result) => classifySsrProbe(result) !== 'ok')) {
    console.error('[ssr-probe] deploy gate FAILED: the new release does not answer cold SSR requests in time (kychon#226).');
    process.exit(1);
  }
}
