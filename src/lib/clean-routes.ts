export const CLEAN_STATIC_ROUTE_METHODS = ['GET', 'HEAD'] as const;

export type CleanStaticRouteMethod = (typeof CLEAN_STATIC_ROUTE_METHODS)[number];

export interface StaticRouteAlias {
  pattern: `/${string}`;
  file: `${string}.html`;
}

export interface CleanStaticRouteSpec {
  pattern: `/${string}`;
  methods: readonly CleanStaticRouteMethod[];
  target: {
    type: 'static';
    file: `${string}.html`;
  };
}

export type StaticCacheClass = 'html' | 'immutable_versioned' | 'revalidating_asset';

export interface PublicStaticPathSpec {
  asset: string;
  cache_class?: StaticCacheClass;
}

interface PageLike {
  slug: string;
  published?: boolean;
}

export const STANDARD_STATIC_ROUTE_ALIASES = [
  { pattern: '/admin', file: 'admin.html' },
  { pattern: '/admin-members', file: 'admin-members.html' },
  { pattern: '/admin-settings', file: 'admin-settings.html' },
  { pattern: '/calendar', file: 'calendar.html' },
  { pattern: '/committees', file: 'committees.html' },
  { pattern: '/directory', file: 'directory.html' },
  { pattern: '/event', file: 'event.html' },
  { pattern: '/events', file: 'events.html' },
  { pattern: '/forum', file: 'forum.html' },
  { pattern: '/join', file: 'join.html' },
  { pattern: '/polls', file: 'polls.html' },
  { pattern: '/profile', file: 'profile.html' },
  { pattern: '/resources', file: 'resources.html' },
  { pattern: '/search', file: 'search.html' },
  { pattern: '/ui-tokens', file: 'ui-tokens.html' },
] as const satisfies readonly StaticRouteAlias[];

const STANDARD_FILE_TO_PATTERN: ReadonlyMap<string, StaticRouteAlias['pattern']> = new Map(
  STANDARD_STATIC_ROUTE_ALIASES.map((alias) => [`/${alias.file}`, alias.pattern] as const),
);

const STANDARD_ROUTE_SLUGS = STANDARD_STATIC_ROUTE_ALIASES.map((alias) => alias.pattern.slice(1));

export const RESERVED_CLEAN_ROUTE_SLUGS: ReadonlySet<string> = new Set([
  '',
  'index',
  'page',
  ...STANDARD_ROUTE_SLUGS,
]);

const SAFE_CUSTOM_PAGE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROUTE_KEY_BASE = 'https://kychon.local';
const LINK_FIELD_KEYS = new Set(['href', 'cta_href', 'admin_contact_href', 'destination', 'action']);

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function normalizeSearch(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return '';
  const params = new URLSearchParams(raw);
  const entries = [...params.entries()].sort(([aKey, aVal], [bKey, bVal]) => {
    if (aKey === bKey) return aVal.localeCompare(bVal);
    return aKey.localeCompare(bKey);
  });
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

function stringifyParams(params: URLSearchParams): string {
  const raw = params.toString();
  return raw ? `?${raw}` : '';
}

export function isSafeCustomPageSlug(slug: unknown): slug is string {
  const raw = typeof slug === 'string' ? slug : '';
  return SAFE_CUSTOM_PAGE_SLUG_RE.test(raw) && !RESERVED_CLEAN_ROUTE_SLUGS.has(raw);
}

export function customPageStaticFile(slug: string): `${string}.html` | null {
  return isSafeCustomPageSlug(slug) ? `${slug}.html` : null;
}

export function customPageCleanPath(slug: string): `/${string}` | null {
  return isSafeCustomPageSlug(slug) ? `/${slug}` : null;
}

export function safeCustomPageSlugs(pages: readonly PageLike[] | undefined): string[] {
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const page of pages || []) {
    if (page.published === false || !isSafeCustomPageSlug(page.slug) || seen.has(page.slug)) continue;
    seen.add(page.slug);
    slugs.push(page.slug);
  }
  return slugs;
}

export function isValidStaticRouteTargetFile(file: string): file is `${string}.html` {
  return isValidReleaseAssetPath(file) && file.endsWith('.html');
}

export function isValidReleaseAssetPath(file: string): boolean {
  if (!file || file !== file.trim()) return false;
  if (file.startsWith('/') || file.startsWith('./') || file.endsWith('/')) return false;
  if (/[?#*\\]/.test(file)) return false;
  const segments = file.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return false;
  return true;
}

export function isValidPublicStaticPath(path: string): path is `/${string}` {
  if (!path || path !== path.trim() || !path.startsWith('/')) return false;
  if (/[?#*\\]/.test(path)) return false;
  if (path === '/') return true;
  if (path.endsWith('/')) return false;
  const segments = path.slice(1).split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return false;
  return true;
}

export function staticRouteSpec(alias: StaticRouteAlias): CleanStaticRouteSpec {
  if (!isValidStaticRouteTargetFile(alias.file)) {
    throw new Error(`Invalid static route target file: ${alias.file}`);
  }
  return {
    pattern: alias.pattern,
    methods: CLEAN_STATIC_ROUTE_METHODS,
    target: { type: 'static', file: alias.file },
  };
}

export function buildCleanStaticRouteSpecs(opts: {
  files: Iterable<string>;
  pageSlugs?: readonly string[];
}): CleanStaticRouteSpec[] {
  const files = new Set(opts.files);
  const aliases: StaticRouteAlias[] = [];

  for (const alias of STANDARD_STATIC_ROUTE_ALIASES) {
    if (files.has(alias.file)) aliases.push(alias);
  }

  for (const slug of opts.pageSlugs || []) {
    const file = customPageStaticFile(slug);
    const pattern = customPageCleanPath(slug);
    if (!file || !pattern || !files.has(file)) continue;
    aliases.push({ pattern, file });
  }

  const seen = new Set<string>();
  return aliases
    .filter((alias) => {
      if (seen.has(alias.pattern)) return false;
      seen.add(alias.pattern);
      return true;
    })
    .map(staticRouteSpec);
}

export function buildExplicitPublicPathSpecs(opts: {
  files: Iterable<string>;
  pageSlugs?: readonly string[];
}): Record<string, PublicStaticPathSpec> {
  const files = new Set(opts.files);
  const entries = new Map<`/${string}`, PublicStaticPathSpec>();

  const addPublicPath = (path: `/${string}`, asset: string) => {
    if (!files.has(asset)) return;
    if (!isValidPublicStaticPath(path)) {
      throw new Error(`Invalid public static path: ${path}`);
    }
    if (!isValidReleaseAssetPath(asset)) {
      throw new Error(`Invalid public static asset path: ${asset}`);
    }
    const next = { asset, cache_class: cacheClassForAsset(asset) };
    const existing = entries.get(path);
    if (existing && existing.asset !== asset) {
      throw new Error(`Conflicting public static path ${path}: ${existing.asset} vs ${asset}`);
    }
    entries.set(path, next);
  };

  addPublicPath('/', 'index.html');

  for (const alias of STANDARD_STATIC_ROUTE_ALIASES) {
    addPublicPath(alias.pattern, alias.file);
  }

  for (const slug of opts.pageSlugs || []) {
    const file = customPageStaticFile(slug);
    const path = customPageCleanPath(slug);
    if (file && path) addPublicPath(path, file);
  }

  for (const file of files) {
    if (isPublicSupportAsset(file)) {
      addPublicPath(`/${file}`, file);
    }
  }

  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Overlay caller-supplied public-path overrides onto a generated public-path
 * map, applying the same validation that generated entries pass through. Used by
 * adapter (SSR) deploys of copied-site ports that must publish source aliases
 * the engine can't otherwise reach (e.g. capitalized Wild Apricot paths like
 * `/Tournament-Standings`). Overrides win on key collision. Throws when an
 * override has a malformed path or asset, or points at an asset that is not
 * present in the build output — so a typo fails the deploy instead of 404ing at
 * runtime.
 */
export function mergePublicPathOverrides(opts: {
  generated: Record<string, PublicStaticPathSpec>;
  overrides: Record<string, PublicStaticPathSpec>;
  buildAssets: Iterable<string>;
}): Record<string, PublicStaticPathSpec> {
  const assets = new Set(opts.buildAssets);
  const merged: Record<string, PublicStaticPathSpec> = { ...opts.generated };
  for (const [path, spec] of Object.entries(opts.overrides)) {
    if (!isValidPublicStaticPath(path)) {
      throw new Error(`Invalid public static path override: ${path}`);
    }
    if (!isValidReleaseAssetPath(spec.asset)) {
      throw new Error(`Invalid asset in public static path override ${path}: ${spec.asset}`);
    }
    if (!assets.has(spec.asset)) {
      throw new Error(
        `Public static path override ${path} -> ${spec.asset} references an asset not present in the build output`,
      );
    }
    merged[path] = spec;
  }
  return merged;
}

function isPublicSupportAsset(file: string): boolean {
  if (!isValidReleaseAssetPath(file)) return false;
  if (file === '_headers') return false;
  return !file.endsWith('.html');
}

function cacheClassForAsset(asset: string): StaticCacheClass {
  if (asset.endsWith('.html')) return 'html';
  if (asset.startsWith('_astro/')) return 'immutable_versioned';
  return 'revalidating_asset';
}

export function canonicalizeKychonHref(href: string): string {
  const raw = String(href ?? '');
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('//')) return raw;
  if (!trimmed.startsWith('/')) return raw;
  if (trimmed.startsWith('/.well-known/')) return raw;

  let url: URL;
  try {
    url = new URL(trimmed, ROUTE_KEY_BASE);
  } catch {
    return raw;
  }

  if (url.pathname === '/index.html') {
    return `/${url.search}${url.hash}`;
  }

  if (url.pathname === '/page.html') {
    const slug = url.searchParams.get('slug') || '';
    if (!isSafeCustomPageSlug(slug)) return raw;
    url.searchParams.delete('slug');
    return `/${slug}${stringifyParams(url.searchParams)}${url.hash}`;
  }

  const standardPattern = STANDARD_FILE_TO_PATTERN.get(url.pathname);
  if (standardPattern) {
    return `${standardPattern}${url.search}${url.hash}`;
  }

  return raw;
}

export function canonicalizeKychonOwnedHrefFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalizeKychonOwnedHrefFields(item));
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] =
      LINK_FIELD_KEYS.has(key) && typeof child === 'string'
        ? canonicalizeKychonHref(child)
        : canonicalizeKychonOwnedHrefFields(child);
  }
  return out;
}

export function canonicalRouteKey(
  urlLike: string,
  base = ROUTE_KEY_BASE,
): string {
  const url = new URL(urlLike, base);
  const canonical = canonicalizeKychonHref(`${url.pathname}${url.search}`);
  const canonicalUrl = new URL(canonical, base);
  return `${normalizePathname(canonicalUrl.pathname)}${normalizeSearch(canonicalUrl.search)}`;
}

export function resolveCustomPageSlugFromLocation(pathname: string, search = ''): string | null {
  const path = normalizePathname(pathname);
  if (path === '/page.html') {
    const slug = new URLSearchParams(search).get('slug');
    return slug || null;
  }

  const cleanMatch = path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (cleanMatch?.[1] && isSafeCustomPageSlug(cleanMatch[1])) return cleanMatch[1];

  const fileMatch = path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/);
  if (fileMatch?.[1] && isSafeCustomPageSlug(fileMatch[1])) return fileMatch[1];

  return null;
}

export function currentPageSlugFromLocation(pathname: string, search = ''): string {
  const path = normalizePathname(pathname);
  if (path === '/' || path === '/index.html') return 'index';
  if (path === '/page.html') {
    return new URLSearchParams(search).get('slug') || 'index';
  }
  const match = path.match(/^\/(.+?)(?:\.html)?$/);
  return match?.[1] || 'index';
}
