// Source-path alias resolution for copied websites. The porter seeds a
// `path_aliases` site_config map (source path -> port route); the
// `[...alias].astro` catch-all resolves it per request and 301s.
//
// Inbound links and the concierge parity harness hit source paths in their
// ORIGINAL casing (e.g. `/event-6730883/JoinWaitlist`, `/Tournament-Standings`)
// while the seeded keys are often lowercased slug routes. A case-sensitive
// exact lookup would 404 those paths even though an alias exists. Resolve
// case-insensitively after an exact try, and keep the same-site
// relative-target guard so a mis-seeded map can never become an open redirect.

/** Trailing-slash-normalized request path; empty collapses to root. */
export function normalizeAliasPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Resolve `pathname` against the seeded `path_aliases` map. Returns a validated
 * same-site relative redirect target, or null when there is no safe match.
 */
export function resolvePathAlias(aliases: unknown, pathname: string): string | null {
  if (!aliases || typeof aliases !== 'object') return null;
  const map = aliases as Record<string, unknown>;
  const path = normalizeAliasPath(pathname);

  let target = map[path];
  if (target === undefined) {
    const lower = path.toLowerCase();
    for (const [key, value] of Object.entries(map)) {
      if (key.toLowerCase() === lower) {
        target = value;
        break;
      }
    }
  }

  // Same-site relative targets only: a leading single slash, never `//host`,
  // so a mis-seeded map cannot become an open redirect.
  if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')) {
    // Never self-redirect. A case-insensitive match can resolve a request to a
    // target equal to the request path — e.g. the lowercase slug
    // `/tournament-standings` falling through to here matches the seeded cased
    // alias `/Tournament-Standings` → `/tournament-standings` — which 301-loops
    // when that slug's own route is missing. Treat self-targets as no-match.
    if (normalizeAliasPath(target) === path) {
      return null;
    }
    return target;
  }
  return null;
}

/**
 * The portal's sign-in page: Run402's `site.sign_in_path` and the target of
 * every signed-out redirect (`/join?returnTo=…`).
 */
export const SIGN_IN_PATH = '/join';

/**
 * Engine routes that only work for a signed-in person. They redirect a
 * signed-out visitor to the sign-in page and expect to be the `returnTo`, so a
 * seeded source alias must never shadow them.
 */
const SIGNED_IN_ROUTES: ReadonlySet<string> = new Set([
  '/admin',
  '/admin-members',
  '/admin-settings',
  '/profile',
  '/media-upload',
]);

/**
 * Resolve an incoming request against `path_aliases` without letting a copied
 * site's source paths take over the engine's sign-in flow (kychon#144).
 *
 * Wild Apricot sites have their own `/join` page, so ports seed
 * `/join` → `/join-us` and the bare source URL keeps showing the club's
 * copied membership page. But `/join` is also Kychon's sign-in page: the
 * signed-out redirects (`/join?returnTo=/admin`) and Run402's OAuth hand-off
 * (`returnTo` appended to `site.sign_in_path`) must reach the form, or nobody
 * can sign in to the portal at all. So the sign-in path follows its alias only
 * when the request has no query string; any query (`returnTo`, the hosted
 * form's error round-trips) gets the sign-in form. The signed-in-only routes
 * are never aliased.
 */
export function resolveRequestAlias(
  aliases: unknown,
  url: { pathname: string; search: string },
): string | null {
  const path = normalizeAliasPath(url.pathname);
  if (SIGNED_IN_ROUTES.has(path)) return null;
  if (path === SIGN_IN_PATH && url.search !== '') return null;
  return resolvePathAlias(aliases, url.pathname);
}
