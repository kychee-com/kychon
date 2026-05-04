import type { ColumnSpan, Section } from './blocks.js';

export interface WildApricotSearchMapping {
  default_type: 'all' | 'pages' | 'resources' | 'events';
  warning?: string;
}

export interface WildApricotSearchConfig {
  placeholder: string;
  submit_label: string;
  default_type: WildApricotSearchMapping['default_type'];
  compact: boolean;
  warning?: string;
}

const SYS_SEARCH_RE = /(?:https?:\/\/[^"'\s>]+)?\/Sys\/Search(?:\/DoSearch)?/i;

export function hasWildApricotSearch(html: string): boolean {
  return SYS_SEARCH_RE.test(html);
}

export function mapWildApricotSearchTypes(types: unknown): WildApricotSearchMapping {
  const raw = String(types ?? '').trim();
  if (!raw) return { default_type: 'all' };
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return { default_type: 'all', warning: `Unknown Wild Apricot search types '${raw}' mapped to all.` };
  }
  if (n === 1) return { default_type: 'pages' };
  if (n === 2) return { default_type: 'resources' };
  if (n === 4) return { default_type: 'events' };
  if (n === 7) return { default_type: 'all' };
  return { default_type: 'all', warning: `Unsupported Wild Apricot search types '${raw}' mapped to all.` };
}

export function extractWildApricotSearchConfig(html: string): WildApricotSearchConfig | null {
  if (!hasWildApricotSearch(html)) return null;
  const placeholder = firstMatch(html, /\bplaceholder\s*=\s*["']([^"']+)["']/i) || 'Search this site';
  const button = firstMatch(html, /<button\b[^>]*>([\s\S]*?)<\/button>/i);
  const valueSubmit = firstMatch(html, /<input\b[^>]*type\s*=\s*["']submit["'][^>]*value\s*=\s*["']([^"']+)["'][^>]*>/i);
  const types = firstMatch(html, /\bname\s*=\s*["']types["'][^>]*\bvalue\s*=\s*["']([^"']+)["']/i);
  const mapped = mapWildApricotSearchTypes(types);
  return {
    placeholder: stripTags(placeholder),
    submit_label: stripTags(button || valueSubmit || 'Search'),
    default_type: mapped.default_type,
    compact: true,
    warning: mapped.warning,
  };
}

export function buildSiteSearchSectionFromWildApricot(
  html: string,
  opts: {
    page_slug?: string;
    zone?: Section['zone'];
    scope?: Section['scope'];
    position?: number;
    column_span?: ColumnSpan;
  } = {},
): Section | null {
  const cfg = extractWildApricotSearchConfig(html);
  if (!cfg) return null;
  return {
    page_slug: opts.page_slug || '*',
    zone: opts.zone || 'header',
    scope: opts.scope || 'global',
    section_type: 'site_search',
    config: {
      placeholder: cfg.placeholder,
      submit_label: cfg.submit_label,
      destination: '/search.html',
      compact: cfg.compact,
      default_type: cfg.default_type,
    },
    position: opts.position ?? 1,
    visible: true,
    column_span: opts.column_span || '1',
  };
}

export function rewriteWildApricotSearchHtml(html: string): string {
  return html
    .replace(SYS_SEARCH_RE, '/search.html')
    .replace(/\s+target\s*=\s*["']_blank["']/gi, '')
    .replace(/<input\b[^>]*\bname\s*=\s*["']types["'][^>]*>/gi, '')
    .replace(/\s+method\s*=\s*["']post["']/gi, ' method="get"');
}

function firstMatch(input: string, re: RegExp): string | null {
  const match = input.match(re);
  return match?.[1]?.trim() || null;
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
