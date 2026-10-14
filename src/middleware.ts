import { defineMiddleware } from 'astro:middleware';
import { ssrConfigLookup } from './lib/ssr-api';
import { resolvePathAlias } from './lib/path-aliases';

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
 *
 * `path_aliases` is fetched once per Lambda lifetime and cached: the map only
 * changes on redeploy, which restarts the function. Fail-open — a failed read
 * leaves aliases null and requests fall through to normal routing. A failure
 * is not cached: right after a deploy the API can be slow for a minute, and
 * caching that miss disabled aliases for the container's whole life
 * (kychon#226). The read is retried after ALIAS_RETRY_MS.
 *
 * Astro also runs middleware for every prerendered route at build time, where
 * request headers don't exist (reading them logs a warning per route), so the
 * build uses the URL's host instead.
 */
let cachedAliases: Record<string, unknown> | null | undefined;
let aliasRetryAt = 0;

/** Wait after a failed `path_aliases` read before trying again. */
export const ALIAS_RETRY_MS = 30_000;

export const onRequest = defineMiddleware(async (context, next) => {
  const host = context.isPrerendered
    ? context.url.host
    : (context.request.headers.get('host') ?? context.url.host);
  if (cachedAliases === undefined && Date.now() >= aliasRetryAt) {
    const result = await ssrConfigLookup<Record<string, unknown>>({ key: 'path_aliases', host });
    if (result.status === 'ok') cachedAliases = result.value;
    else aliasRetryAt = Date.now() + ALIAS_RETRY_MS;
  }
  const target = resolvePathAlias(cachedAliases ?? null, context.url.pathname);
  if (target) {
    return context.redirect(target, 301);
  }
  return next();
});
