// Source-path alias resolution for copied websites (kychon#128). The porter
// seeds a `path_aliases` site_config map (source path -> port route); the
// `[...alias].astro` catch-all resolves it per request and 301s.
//
// Inbound links and the concierge parity harness hit source paths in their
// ORIGINAL casing (e.g. `/event-6730883/JoinWaitlist`, `/Tournament-Standings`)
// while the seeded keys are often lowercased slug routes. A case-sensitive exact
// lookup therefore 404'd those paths even though an alias existed (kychon#152).
// Resolve case-insensitively after an exact try, and keep the same-site
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
    return target;
  }
  return null;
}
