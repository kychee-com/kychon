import type { APIContext, MiddlewareNext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { fillPageAssetManifest, getBakeAssetManifest, PAGE_MANIFEST_PLACEHOLDER } from './lib/bake-asset-manifest';
import { ssrConfigLookup } from './lib/ssr-api';
import { resolveRequestAlias } from './lib/path-aliases';

/**
 * Copied-site path-alias resolver.
 *
 * `[...alias].astro` resolves `path_aliases` (source path → port path) and
 * 301s, but as a rest-param route it has the LOWEST Astro precedence — so a
 * single-segment inbound path like `/Classified-Ads` is claimed by the
 * higher-precedence `[customPage].astro` (a named `[param]` route). That route
 * is `prerender=true` with a `getStaticPaths` allow-list, so an unknown slug
 * never runs its body — Astro just serves the built-in 404 and `[...alias]`
 * never sees the request. Relying on `[...alias].astro` alone would 404
 * single-segment aliases (the common case — capitalized source slugs mapping
 * to lowercase port slugs) even though nested-path aliases work.
 *
 * Middleware runs BEFORE route matching, so resolving aliases here sidesteps
 * route precedence entirely and covers single- and multi-segment alike. Real
 * pages are prerendered static files served by the gateway without invoking
 * this function; only SSR requests (unmatched paths, `prerender=false` routes)
 * reach here, and `resolvePathAlias` returns null for anything that isn't a
 * seeded alias key (and for self-redirects), so normal routing is untouched.
 * `resolveRequestAlias` also keeps aliases off the sign-in flow: `/join` with
 * a query and the signed-in-only routes always reach the engine (kychon#144).
 *
 * `path_aliases` is fetched once per Lambda lifetime and cached: the map only
 * changes on redeploy, which restarts the function. Fail-open — a failed read
 * leaves aliases null and requests fall through to normal routing. A failure
 * is not cached: right after a deploy the API can be slow for a minute, and
 * caching that miss disabled aliases for the container's whole life
 * (kychon#226). The read is retried after ALIAS_RETRY_MS.
 *
 * A request that matched a concrete route (`/calendar`, `/search`, `/event`,
 * `/.well-known/kychon.json`: no `[param]` in its pattern) is that route, not a
 * source path, so it skips the lookup. On a cold container that read was the
 * first upstream call on every such page, ahead of the page's own reads
 * (kychon#226 follow-up: cold /calendar).
 *
 * Astro also runs middleware for every prerendered route at build time, where
 * request headers don't exist (reading them logs a warning per route), so the
 * build uses the URL's host instead.
 */
let cachedAliases: Record<string, unknown> | null | undefined;
let aliasRetryAt = 0;

/** Wait after a failed `path_aliases` read before trying again. */
export const ALIAS_RETRY_MS = 30_000;

/** Whether a matched route can be a copied site's source path. */
export function mayBeAliasSource(routePattern: string | undefined): boolean {
  if (!routePattern) return true;
  return routePattern.includes('[') || routePattern === '/404' || routePattern === '/500';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await resolveAliasOrNext(context, next);
  return context.isPrerendered ? withPageAssetManifest(response) : response;
});

async function resolveAliasOrNext(context: APIContext, next: MiddlewareNext): Promise<Response> {
  if (!mayBeAliasSource(context.routePattern)) return next();
  const host = context.isPrerendered
    ? context.url.host
    : (context.request.headers.get('host') ?? context.url.host);
  if (cachedAliases === undefined && Date.now() >= aliasRetryAt) {
    const result = await ssrConfigLookup<Record<string, unknown>>({ key: 'path_aliases', host });
    if (result.status === 'ok') cachedAliases = result.value;
    else aliasRetryAt = Date.now() + ALIAS_RETRY_MS;
  }
  const target = resolveRequestAlias(cachedAliases ?? null, context.url);
  if (target) {
    return context.redirect(target, 301);
  }
  return next();
}

/**
 * Fill a built page's asset-manifest placeholder (Portal.astro) with the
 * manifest entries that page references. Only the build has the whole page
 * and the manifest at hand; SSR responses keep the inert placeholder.
 */
async function withPageAssetManifest(response: Response): Promise<Response> {
  if (!response.headers.get('content-type')?.includes('text/html')) return response;
  const html = await response.text();
  const filled = html.includes(PAGE_MANIFEST_PLACEHOLDER) ? fillPageAssetManifest(html, getBakeAssetManifest()) : html;
  return new Response(filled, { status: response.status, statusText: response.statusText, headers: response.headers });
}
