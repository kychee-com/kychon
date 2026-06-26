import { defineMiddleware } from 'astro:middleware';
import { ssrConfigValue } from './lib/ssr-api';
import { resolvePathAlias } from './lib/path-aliases';

/**
 * Copied-site path-alias resolver (kychon#128 / #532 follow-up).
 *
 * `[...alias].astro` resolves `path_aliases` (source path → port path) and
 * 301s, but as a rest-param route it has the LOWEST Astro precedence — so a
 * single-segment inbound path like `/Classified-Ads` is claimed by the
 * higher-precedence `[customPage].astro` (a named `[param]` route). That route
 * is `prerender=true` with a `getStaticPaths` allow-list, so an unknown slug
 * never runs its body — Astro just serves the built-in 404 and `[...alias]`
 * never sees the request. Net effect: nested-path aliases worked but
 * single-segment ones (the common case — capitalized source slugs mapping to
 * lowercase port slugs) silently 404'd.
 *
 * Middleware runs BEFORE route matching, so resolving aliases here sidesteps
 * route precedence entirely and covers single- and multi-segment alike. Real
 * pages are prerendered static files served by the gateway without invoking
 * this function; only SSR requests (unmatched paths, `prerender=false` routes)
 * reach here, and `resolvePathAlias` returns null for anything that isn't a
 * seeded alias key (and for self-redirects), so normal routing is untouched.
 *
 * `path_aliases` is fetched once per Lambda lifetime and cached: the map only
 * changes on redeploy, which restarts the function. Fail-open — a config read
 * miss leaves aliases null and requests fall through to normal routing.
 */
let cachedAliases: Record<string, unknown> | null | undefined;

export const onRequest = defineMiddleware(async (context, next) => {
  const host = context.request.headers.get('host') ?? context.url.host;
  if (cachedAliases === undefined) {
    cachedAliases = await ssrConfigValue<Record<string, unknown>>({ key: 'path_aliases', host });
  }
  const target = resolvePathAlias(cachedAliases ?? null, context.url.pathname);
  if (target) {
    return context.redirect(target, 301);
  }
  return next();
});
