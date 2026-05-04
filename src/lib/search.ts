export const SEARCH_TYPES = ['all', 'pages', 'resources', 'events'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export type SearchSourceType = 'page' | 'resource' | 'event';

export interface SearchResult {
  id: string;
  type: SearchSourceType;
  title: string;
  url: string;
  snippet: string;
}

export interface SearchFacets {
  all: number;
  pages: number;
  resources: number;
  events: number;
}

export interface SearchResponse {
  query: string;
  type: SearchType;
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
  facets: SearchFacets;
  results: SearchResult[];
}

const TYPE_TO_SOURCE: Record<Exclude<SearchType, 'all'>, SearchSourceType> = {
  pages: 'page',
  resources: 'resource',
  events: 'event',
};

const SOURCE_TO_TYPE: Record<SearchSourceType, Exclude<SearchType, 'all'>> = {
  page: 'pages',
  resource: 'resources',
  event: 'events',
};

const BLOCK_TEXT_KEYS = new Set([
  'heading',
  'subheading',
  'text',
  'title',
  'desc',
  'description',
  'q',
  'a',
  'quote',
  'name',
  'role',
  'label',
  'caption',
  'caption_html',
  'html',
  'body',
  'cta_text',
]);

const BLOCK_SKIP_KEYS = /(^|_)(href|url|src|image|icon|color|class|style|target|rel|provider|acknowledged|id)$/i;

export function normalizeSearchType(input: unknown): SearchType {
  return SEARCH_TYPES.includes(input as SearchType) ? (input as SearchType) : 'all';
}

export function searchTypeToSource(type: SearchType): SearchSourceType | null {
  if (type === 'all') return null;
  return TYPE_TO_SOURCE[type];
}

export function sourceToSearchType(type: SearchSourceType): Exclude<SearchType, 'all'> {
  return SOURCE_TO_TYPE[type];
}

export function clampPageSize(input: unknown, fallback = 10, max = 50): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

export function normalizePage(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function stripHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeResourceFileLabel(fileUrl: unknown): string {
  const raw = String(fileUrl ?? '');
  const withoutQuery = raw.replace(/[?#].*$/, '');
  const segment = withoutQuery.split('/').filter(Boolean).pop() || '';
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment.replace(/%20/g, ' ');
  }
  return decoded.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function collectText(value: unknown, keyHint = ''): string[] {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return [];
  if (typeof value === 'string') {
    if (!keyHint || BLOCK_TEXT_KEYS.has(keyHint) || keyHint.endsWith('_text')) {
      const text = stripHtml(value);
      return text ? [text] : [];
    }
    return [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => collectText(item, keyHint));
  if (typeof value === 'object') {
    const out: string[] = [];
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCK_SKIP_KEYS.test(key)) continue;
      out.push(...collectText(child, key));
    }
    return out;
  }
  return [];
}

export function extractSearchableTextFromBlockConfig(
  sectionType: string,
  config: Record<string, unknown> | null | undefined,
): string {
  if (!config) return '';
  if (sectionType === 'site_search' || sectionType === 'nav' || sectionType === 'sign_in_bar') return '';
  return collectText(config).join(' ').replace(/\s+/g, ' ').trim();
}

export function buildPageResultUrl(slug: string): string {
  return slug === 'index' ? '/' : `/page.html?slug=${encodeURIComponent(slug)}`;
}

export function buildResourceResultUrl(id: string | number): string {
  return `/resources.html#resource-${encodeURIComponent(String(id))}`;
}

export function buildEventResultUrl(id: string | number): string {
  return `/event.html?id=${encodeURIComponent(String(id))}`;
}

function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}

export function makeSafeSnippet(input: unknown, query: string, maxLength = 180): string {
  const text = stripHtml(input);
  if (!text) return '';
  const terms = queryTerms(query);
  const lower = text.toLowerCase();
  const firstHit = terms.reduce((best, term) => {
    const idx = lower.indexOf(term);
    return idx >= 0 && idx < best ? idx : best;
  }, Number.POSITIVE_INFINITY);
  const start = Number.isFinite(firstHit) ? Math.max(0, firstHit - Math.floor(maxLength / 3)) : 0;
  const slice = text.slice(start, start + maxLength);
  const prefix = start > 0 ? '...' : '';
  const suffix = start + maxLength < text.length ? '...' : '';
  let escaped = escapeHtml(`${prefix}${slice}${suffix}`);
  for (const term of terms) {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    escaped = escaped.replace(re, '<mark>$1</mark>');
  }
  return escaped;
}

export function emptySearchResponse(query: string, type: SearchType, page = 1, pageSize = 10): SearchResponse {
  return {
    query,
    type,
    page,
    page_size: pageSize,
    total: 0,
    has_next: false,
    facets: { all: 0, pages: 0, resources: 0, events: 0 },
    results: [],
  };
}
