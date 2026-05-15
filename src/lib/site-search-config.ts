import { canonicalizeKychonHref } from './clean-routes.js';
import { SEARCH_TYPES, type SearchType } from './search.js';

export type SiteSearchMode = 'form' | 'header_icon';

export interface SiteSearchPresentation {
  max_width?: string;
  form_gap?: string;
  form_border?: string;
  form_radius?: string;
  form_overflow?: string;
  form_bg?: string;
  input_height?: string;
  input_border?: string;
  input_radius?: string;
  input_padding?: string;
  submit_height?: string;
  submit_border?: string;
  submit_radius?: string;
  submit_padding?: string;
  submit_bg?: string;
  submit_color?: string;
}

export interface SiteSearchConfig {
  placeholder: string;
  submitLabel: string;
  destination: string;
  compact: boolean;
  defaultType: SearchType;
  minChars: number;
  mode: SiteSearchMode;
  presentation: SiteSearchPresentation;
}

const SAFE_CSS_VALUE_RE = /^[#%(),./"'`\-\w\s]+$/;
const PRESENTATION_KEYS = [
  'max_width',
  'form_gap',
  'form_border',
  'form_radius',
  'form_overflow',
  'form_bg',
  'input_height',
  'input_border',
  'input_radius',
  'input_padding',
  'submit_height',
  'submit_border',
  'submit_radius',
  'submit_padding',
  'submit_bg',
  'submit_color',
] as const;

function safeCssValue(value: unknown, maxLength = 180): string {
  const s = String(value ?? '').trim();
  if (!s || s.length > maxLength) return '';
  return SAFE_CSS_VALUE_RE.test(s) ? s : '';
}

function normalizeSearchType(value: unknown): SearchType {
  return SEARCH_TYPES.includes(value as SearchType) ? (value as SearchType) : 'all';
}

function normalizePresentation(value: unknown): SiteSearchPresentation {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const presentation: SiteSearchPresentation = {};
  for (const key of PRESENTATION_KEYS) {
    const safe = safeCssValue(source[key]);
    if (safe) presentation[key] = safe;
  }
  return presentation;
}

export function normalizeSiteSearchConfig(config: Record<string, unknown> | null | undefined): SiteSearchConfig {
  const source = config || {};
  const minChars = Math.max(1, Math.min(10, Number(source.min_chars) || 2));
  return {
    placeholder: String(source.placeholder || 'Search this site'),
    submitLabel: String(source.submit_label || 'Search'),
    destination: canonicalizeKychonHref(String(source.destination || '/search')),
    compact: source.compact !== false,
    defaultType: normalizeSearchType(source.default_type),
    minChars,
    mode: source.mode === 'header_icon' ? 'header_icon' : 'form',
    presentation: normalizePresentation(source.presentation),
  };
}
