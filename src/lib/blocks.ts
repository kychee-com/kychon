// blocks.ts — Block-type registry. The single isomorphic renderer that runs
// at Astro build time (Node) and at runtime (browser). Renderers return HTML
// strings. Dynamic blocks emit a skeleton at bake time and a per-type
// `hydrate(el, ctx)` is called at runtime to fetch data and replace the body.

import { canonicalRouteKey, canonicalizeKychonHref } from './clean-routes.js';

/** column-span-rows: legal fractions of a 6-col zone grid. */
export type ColumnSpan = '1' | '1/2' | '1/3' | '2/3';

export interface Section {
  id?: number;
  page_slug: string;
  zone: 'header' | 'main' | 'footer';
  scope: 'page' | 'global';
  section_type: string;
  config: Record<string, any>;
  position: number;
  visible?: boolean;
  /** column-span-rows: width inside the 6-col zone grid (default `'1'`). */
  column_span?: ColumnSpan;
}

export interface BlockRenderContext {
  admin: boolean;
  locale: string;
  authenticated?: boolean;
  role?: 'admin' | 'moderator' | 'member' | null;
  isFeatureEnabled?: (flag: string) => boolean;
  currentPath?: string;
  session?: any;
  siteName?: string;
  /**
   * Brand identity fields drawn from `site_config`. Read by `brand_header`
   * via the picker rules: icon → wordmark → text. `brandText` is the
   * source-of-truth string (alt text / aria label / final fallback).
   */
  brandText?: string;
  brandTextShort?: string;
  brandIconUrl?: string;
  brandWordmarkUrl?: string;
}

export interface BlockType {
  render: (section: Section, ctx: BlockRenderContext) => string;
  hydrate?: (el: HTMLElement, section: Section, ctx: BlockRenderContext) => Promise<void> | void;
  defaultConfig: Record<string, any>;
  label: string;
  icon: string;
  dynamic: boolean;
  zoneHints?: ('header' | 'main' | 'footer')[];
  /** column-span-rows: spans this block accepts; omit for "all four". */
  supportedSpans?: ColumnSpan[];
  /**
   * When true, the block opts out of the zone's `.ky-container` (max-width
   * constrained) wrapper and renders as a full-bleed sibling below it.
   * Used for blocks like `page_banner` that need 100% viewport width and
   * their own intrinsic vertical space — putting them inside `.ky-container`
   * forces the chrome row (brand / nav / sign-in) to absorb the banner's
   * height, which is exactly the wrong layout.
   */
  fullBleed?: boolean;
}

export interface InteractionStateConfig {
  background?: string;
  text?: string;
  icon?: string;
  border?: string;
  shadow?: string;
  transform?: string;
  duration?: string;
  easing?: string;
}

export interface InteractionConfig {
  default?: InteractionStateConfig;
  hover?: InteractionStateConfig;
  focus?: InteractionStateConfig;
}

export interface NavPresentationConfig {
  link_color?: string;
  link_hover_bg?: string;
  link_hover_color?: string;
  link_active_bg?: string;
  link_active_color?: string;
  link_padding?: string;
  link_radius?: string;
  link_gap?: string;
  font_family?: string;
  font_size?: string;
  font_weight?: string;
  surface_bg?: string;
  surface_padding?: string;
  surface_radius?: string;
  surface_shadow?: string;
  full_row?: boolean;
  wrap?: string;
  dropdown_bg?: string;
  dropdown_color?: string;
  dropdown_hover_bg?: string;
  dropdown_hover_color?: string;
  dropdown_border?: string;
  dropdown_shadow?: string;
  dropdown_width?: string;
  dropdown_offset_x?: string;
  dropdown_offset_y?: string;
  chevron_color?: string;
  transition?: string;
  mobile_menu_bg?: string;
  mobile_menu_padding?: string;
}

export interface NavBehaviorConfig {
  desktop_open?: 'hover' | 'click' | 'focus';
  mobile_breakpoint?: number | string;
  mobile_closed_layout?: 'hidden' | 'overlay';
  mobile_open_layout?: 'dropdown' | 'drawer' | 'inline';
}

export interface ImageAccordionPanelConfig {
  image_url?: string;
  image_alt?: string;
  href?: string;
  title?: string;
  description?: string;
  cta_label?: string;
  fit?: 'cover' | 'contain';
  object_position?: string;
  interactions?: InteractionConfig;
}

export interface ImageAccordionConfig {
  heading?: string;
  panels?: ImageAccordionPanelConfig[];
  active_ratio?: number | string;
  idle_ratio?: number | string;
  overlay_color?: string;
  overlay_opacity?: number | string;
  reveal_duration?: string;
  mobile_fallback?: 'stack' | 'cards';
  interactions?: InteractionConfig;
}

export interface ShapeDividerLayerConfig {
  path?: string;
  fill?: string;
  opacity?: number | string;
  translate_y?: number | string;
}

export interface ShapeDividerConfig {
  preset?: 'wave' | 'tilt' | 'curve';
  path?: string;
  view_box?: string;
  layers?: ShapeDividerLayerConfig[];
  top_color?: string;
  bottom_color?: string;
  placement?: 'between' | 'top' | 'bottom';
  flip_x?: boolean;
  flip_y?: boolean;
  height?: string;
}

export interface SlideshowItemConfig {
  src?: string;
  alt?: string;
  caption?: string;
  href?: string;
  fit?: 'cover' | 'contain';
  object_position?: string;
}

// --- Helpers ---

const FEATURE_ICONS: Record<string, string> = {
  users: '\u{1F465}',
  calendar: '\u{1F4C5}',
  'book-open': '\u{1F4D6}',
  'message-circle': '\u{1F4AC}',
  home: '\u{1F3E0}',
  settings: '⚙️',
  'bar-chart-2': '\u{1F4CA}',
  'bar-chart': '\u{1F4CA}',
  shield: '\u{1F6E1}',
  heart: '❤️',
  info: 'ℹ️',
  briefcase: '\u{1F4BC}',
  star: '⭐',
  award: '\u{1F3C5}',
  zap: '⚡',
};

export function escHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escAttr(s: any): string {
  return escHtml(s);
}

function cleanHref(value: any, fallback = ''): string {
  const href = String(value ?? '').trim() || fallback;
  return canonicalizeKychonHref(href);
}

const SAFE_CSS_VALUE_RE = /^[#%(),./"'`\-\w\s]+$/;
const SAFE_SVG_PATH_RE = /^[MmZzLlHhVvCcSsQqTtAa0-9,.\-\s+]+$/;

export function safeCssValue(value: any, maxLength = 180): string {
  const s = String(value ?? '').trim();
  if (!s || s.length > maxLength) return '';
  return SAFE_CSS_VALUE_RE.test(s) ? s : '';
}

// Safe interpolation for `background-image:url(...)` and similar CSS url()
// sinks. `escAttr` is HTML-quote-safe but does not escape `(`, `)`, `;`, or
// `'`, so an attacker-controlled URL like `x);background:red url(y` survives
// it and parses as two CSS declarations. (#29)
//
// We accept http(s) URLs and same-origin relative paths only, reject control
// characters, then percent-encode the CSS-dangerous characters so the value
// is safe inside single-quoted `url('…')`.
export function safeCssUrl(value: any, maxLength = 2048): string {
  const s = String(value ?? '').trim();
  if (!s || s.length > maxLength) return '';
  if (/[\r\n\t\x00-\x1f]/.test(s)) return '';
  if (!/^(https?:\/\/[^\s]+|\/[^\s]*|\.[./][^\s]*)$/i.test(s)) return '';
  return s.replace(/[()'"\\;*<>]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

function cssVar(name: string, value: any): string {
  const safe = safeCssValue(value);
  return safe ? `${name}:${safe};` : '';
}

function styleAttr(vars: string[]): string {
  const style = vars.filter(Boolean).join('');
  return style ? ` style="${escAttr(style)}"` : '';
}

function numberCssVar(name: string, value: any): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${name}:${n};` : '';
}

export function sanitizeSvgPathData(path: any): string {
  const s = String(path ?? '').trim();
  if (!s || s.length > 4000) return '';
  return SAFE_SVG_PATH_RE.test(s) ? s : '';
}

function jsonAttr(value: any): string {
  // Used inside data-editable-config="..." — escape quotes and markup-like
  // characters so rich config strings cannot break the containing attribute.
  return JSON.stringify(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function adminScopeControls(section: Section, ctx: BlockRenderContext): string {
  if (!ctx.admin || section.id == null) return '';
  const sid = section.id;
  const isGlobal = section.scope === 'global';
  const pill = isGlobal ? `<span class="admin-scope-pill">Global</span>` : '';
  const toggleLabel = isGlobal ? 'Make page-only' : 'Make global';
  const toggleNext = isGlobal ? 'page' : 'global';
  return `${pill}<button class="admin-scope-toggle" data-scope-toggle="${sid}" data-scope-next="${toggleNext}" title="${toggleLabel}">${toggleLabel}</button>`;
}

// column-span-rows: cog button that opens the per-block edit popover (span
// radio + scope toggle + remove). Rendered alongside the existing inline
// scope toggle / remove for back-compat — the popover is the primary
// surface but the inline buttons keep working.
function adminEditButton(section: Section, ctx: BlockRenderContext): string {
  if (!ctx.admin || section.id == null) return '';
  return `<button class="admin-section-edit-btn" data-section-edit="${section.id}" title="Edit block">⚙</button>`;
}

function adminWrap(section: Section, ctx: BlockRenderContext, inner: string, classes = 'section'): string {
  const sid = section.id;
  const sortable = sid != null
    ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"`
    : '';
  const zoneAttr = ` data-section-zone="${section.zone}"`;
  const scopeAttr = ` data-section-scope="${section.scope}"`;
  const cfgAttr = sid != null && ctx.admin
    ? ` data-editable-config="${jsonAttr(section.config || {})}"`
    : '';
  const adminCtrls = sid != null && ctx.admin
    ? `<div class="admin-section-actions">${adminEditButton(section, ctx)}${adminScopeControls(section, ctx)}<button class="admin-section-btn danger" data-section-remove="${sid}" title="Remove section">&times;</button></div>`
    : '';
  return `<section class="${classes}"${sortable}${zoneAttr}${scopeAttr}${cfgAttr}>${adminCtrls}${inner}</section>`;
}

function editableAttr(section: Section, path: string, ctx: BlockRenderContext): string {
  if (!ctx.admin || section.id == null) return '';
  return ` data-editable="sections.${section.id}.config.${path}"`;
}

function richEditableAttr(section: Section, path: string, ctx: BlockRenderContext): string {
  if (!ctx.admin || section.id == null) return '';
  return ` data-editable-rich="sections.${section.id}.config.${path}"`;
}

function featureIcon(name: string): string {
  return FEATURE_ICONS[name] || '✦';
}

export function isPageActive(href: string, current?: string): boolean {
  if (!current) return false;
  try {
    const a = new URL(href, 'https://kychon.local');
    const b = new URL(current, 'https://kychon.local');
    if (a.origin !== b.origin) return false;
    const aKey = canonicalRouteKey(`${a.pathname}${a.search}`);
    const bKey = canonicalRouteKey(`${b.pathname}${b.search}`);
    const [aPath, aSearch = ''] = aKey.split('?');
    const [bPath] = bKey.split('?');
    if (aPath !== bPath) return false;
    if (aSearch && aKey !== bKey) return false;
    // Hash-aware: when the current URL has a hash, only the matching hash link
    // is active. This prevents "/" and "/#announcements" lighting up together.
    if (b.hash && !a.hash) return false;
    if (a.hash && a.hash !== b.hash) return false;
    return true;
  } catch {}
  return false;
}

// Markdown link parser used by footer_attribution.
// Converts "[label](href)" segments into <a> elements; everything else is
// escaped as plain text.
function renderMarkdownLine(text: string): string {
  if (!text) return '';
  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('[', i);
    if (open === -1) {
      parts.push(escHtml(text.slice(i)));
      break;
    }
    const close = text.indexOf(']', open);
    const lparen = close >= 0 ? text.indexOf('(', close) : -1;
    const rparen = lparen >= 0 ? text.indexOf(')', lparen) : -1;
    const valid = close > open && lparen === close + 1 && rparen > lparen;
    if (!valid) {
      parts.push(escHtml(text.slice(i, open + 1)));
      i = open + 1;
      continue;
    }
    parts.push(escHtml(text.slice(i, open)));
    const label = text.slice(open + 1, close);
    const href = text.slice(lparen + 1, rparen);
    parts.push(`<a href="${escAttr(href)}">${escHtml(label)}</a>`);
    i = rparen + 1;
  }
  return parts.join('');
}

// --- Main-zone renderers ---

// Hero block config — both modes share heading/subheading/cta_*, with mode-specific keys layered on top.
export type HeroMode = 'background' | 'foreground';
export type HeroAspect = 'auto' | '16/9' | '4/3' | '21/9';
export type HeroLogoPosition = 'left' | 'center' | 'right';
export type HeroCaptionPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'right-middle'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'left-middle';
export type HeroTextPosition = 'over_image' | 'below_image';

export interface HeroConfig {
  // Common
  heading?: string;
  subheading?: string;
  cta_text?: string;
  cta_href?: string;
  // Mode selector
  mode?: HeroMode;
  // Background mode
  bg_image?: string;
  // Foreground mode
  image_url?: string;
  image_alt?: string;
  image_aspect?: HeroAspect;
  logo_overlay_url?: string;
  logo_position?: HeroLogoPosition;
  logo_max_height?: string;
  caption_html?: string;
  caption_position?: HeroCaptionPosition;
  text_position?: HeroTextPosition;
}

const VALID_CAPTION_POSITIONS: HeroCaptionPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'right-middle',
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'left-middle',
];

const VALID_ASPECTS: HeroAspect[] = ['auto', '16/9', '4/3', '21/9'];

// Caption HTML sanitizer — allowlist permits <br>, <strong>, <em>, <a href>.
// Strips all other tags; strips all attributes except href on <a>; restricts
// href to http(s):, mailto:, and relative paths (rejects scheme-relative
// `//host`). For dangerous container tags (script/style/iframe/etc.) the tag
// AND its contents are dropped. No HTML parser dependency — the input is
// admin-supplied and the allowlist is narrow.
const SANITIZER_DROP_BLOCK_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'noscript', 'template', 'xml',
]);

export function sanitizeCaptionHtml(html: string): string {
  if (!html) return '';
  const allowedTags = new Set(['br', 'strong', 'em', 'a', '/strong', '/em', '/a']);
  const out: string[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out.push(html.slice(i));
      break;
    }
    // Plain text up to the tag
    out.push(html.slice(i, lt));
    const gt = html.indexOf('>', lt);
    if (gt === -1) {
      // Unclosed tag — drop everything after
      break;
    }
    const tagContent = html.slice(lt + 1, gt).trim();
    // Self-closing form: "br/" or "br /"
    const selfClose = /\/$/.test(tagContent);
    const cleaned = tagContent.replace(/\/$/, '').trim();
    // Tag name is first whitespace-delimited token; preserve a leading slash
    // for closing tags.
    const tagMatch = cleaned.match(/^(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([\s\S]*)$/);
    if (!tagMatch) {
      i = gt + 1;
      continue;
    }
    const closingSlash = tagMatch[1] || '';
    const tagName = (tagMatch[2] || '').toLowerCase();
    const rest = tagMatch[3] || '';
    // Dangerous container tags — skip the tag AND its contents up to the
    // matching closer. Case-insensitive search.
    if (!closingSlash && SANITIZER_DROP_BLOCK_TAGS.has(tagName)) {
      const closerPattern = new RegExp(`</\\s*${tagName}\\s*>`, 'i');
      const remainder = html.slice(gt + 1);
      const match = remainder.match(closerPattern);
      if (match && match.index != null) {
        i = gt + 1 + match.index + match[0].length;
      } else {
        // No closer — drop everything after.
        break;
      }
      continue;
    }
    const tagKey = closingSlash + tagName;
    if (!allowedTags.has(tagKey) && tagName !== 'br') {
      // Unknown tag — strip entirely (keep inner text via subsequent passes).
      i = gt + 1;
      continue;
    }
    if (tagName === 'br') {
      out.push('<br>');
      i = gt + 1;
      continue;
    }
    if (closingSlash) {
      out.push(`</${tagName}>`);
      i = gt + 1;
      continue;
    }
    // Opening tag — emit allowed attributes only.
    if (tagName === 'a') {
      const hrefMatch = rest.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const rawHref = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '') : '';
      const href = sanitizeHref(rawHref);
      out.push(`<a href="${escAttr(href)}">`);
    } else {
      out.push(`<${tagName}>`);
    }
    if (selfClose) {
      // Treat as self-closing for allowed inline tags — emit closer immediately
      // (rare case, e.g. '<em/>').
      out.push(`</${tagName}>`);
    }
    i = gt + 1;
  }
  return out.join('');
}

function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return '';
  // Scheme-relative URLs (//evil.com) inherit the current scheme — reject.
  if (trimmed.startsWith('//')) return '';
  // Relative paths and anchors are allowed.
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return canonicalizeKychonHref(trimmed);
  }
  // Allow http(s) and mailto schemes only.
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:')) {
    return trimmed;
  }
  // Anything else (javascript:, data:, vbscript:, file:, etc.) → empty href.
  return '';
}

function renderBackgroundHero(section: Section, ctx: BlockRenderContext): string {
  const cfg = section.config || {};
  const sid = section.id;
  const heading = `<h1${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h1>`;
  const sub = `<p${editableAttr(section, 'subheading', ctx)}>${escHtml(cfg.subheading)}</p>`;
  const cta = cfg.cta_text
    ? `<a href="${escAttr(cleanHref(cfg.cta_href, '#'))}" class="btn btn-primary btn-lg"${editableAttr(section, 'cta_text', ctx)}>${escHtml(cfg.cta_text)}</a>`
    : '';
  const inner = `<div class="ky-container">${heading}${sub}${cta}</div>`;
  const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
  const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
  const imgAttr = sid != null && ctx.admin ? ` data-editable-image="sections.${sid}.config.bg_image"` : '';
  const safeBgImage = cfg.bg_image ? safeCssUrl(cfg.bg_image) : '';
  const styleAttr = safeBgImage ? ` style="background-image:url('${safeBgImage}')"` : '';
  const adminCtrls = sid != null && ctx.admin
    ? `<div class="admin-section-actions">${adminEditButton(section, ctx)}<button class="admin-section-btn danger" data-section-remove="${sid}" title="Remove section">&times;</button></div>`
    : '';
  return `<section class="section section-hero"${sortable}${cfgAttr}${imgAttr}${styleAttr}>${adminCtrls}${inner}</section>`;
}

function renderForegroundHero(section: Section, ctx: BlockRenderContext): string {
  const cfg = (section.config || {}) as HeroConfig;
  const sid = section.id;

  const aspect = (cfg.image_aspect && (VALID_ASPECTS as string[]).includes(cfg.image_aspect))
    ? cfg.image_aspect
    : 'auto';
  const textPosition: HeroTextPosition = cfg.text_position === 'below_image' ? 'below_image' : 'over_image';
  const captionPosition: HeroCaptionPosition = (cfg.caption_position && (VALID_CAPTION_POSITIONS as string[]).includes(cfg.caption_position))
    ? cfg.caption_position
    : 'bottom-right';
  const logoPosition: HeroLogoPosition = (['left', 'center', 'right'] as HeroLogoPosition[]).includes(cfg.logo_position as HeroLogoPosition)
    ? (cfg.logo_position as HeroLogoPosition)
    : 'left';
  const logoMaxHeight = cfg.logo_max_height || '120px';

  // Image alt — required in foreground mode. Empty alt is allowed at runtime
  // (still emits valid HTML, decorative semantics) but warn.
  const imageUrl = cfg.image_url || '';
  const imageAlt = cfg.image_alt ?? '';
  if (!imageAlt && imageUrl && typeof console !== 'undefined') {
    console.warn(`Hero block ${sid ?? '(unsaved)'} is in foreground mode without image_alt — provide alt text for accessibility.`);
  }

  const imgAttr = sid != null && ctx.admin
    ? ` data-editable-image="sections.${sid}.config.image_url"`
    : '';
  const pictureMarkup = imageUrl
    ? `<picture class="hero-picture" data-aspect="${escAttr(aspect)}"${imgAttr}><img src="${escAttr(imageUrl)}" alt="${escAttr(imageAlt)}" loading="eager" decoding="async" /></picture>`
    : `<picture class="hero-picture" data-aspect="${escAttr(aspect)}"${imgAttr}></picture>`;

  const logoMarkup = cfg.logo_overlay_url
    ? `<div class="hero-logo-overlay" data-position="${escAttr(logoPosition)}"><img src="${escAttr(cfg.logo_overlay_url)}" alt="" style="max-height:${escAttr(logoMaxHeight)}" /></div>`
    : '';

  const safeCaption = cfg.caption_html ? sanitizeCaptionHtml(cfg.caption_html) : '';
  const captionMarkup = safeCaption
    ? `<div class="hero-caption" data-position="${escAttr(captionPosition)}">${safeCaption}</div>`
    : '';

  const heading = cfg.heading
    ? `<h1${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h1>`
    : '';
  const sub = cfg.subheading
    ? `<p${editableAttr(section, 'subheading', ctx)}>${escHtml(cfg.subheading)}</p>`
    : '';
  const cta = cfg.cta_text
    ? `<a href="${escAttr(cleanHref(cfg.cta_href, '#'))}" class="btn btn-primary btn-lg"${editableAttr(section, 'cta_text', ctx)}>${escHtml(cfg.cta_text)}</a>`
    : '';
  const headingGroup = heading || sub || cta
    ? `<div class="hero-text"><div class="ky-container">${heading}${sub}${cta}</div></div>`
    : '';

  const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
  const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
  const adminCtrls = sid != null && ctx.admin
    ? `<div class="admin-section-actions">${adminEditButton(section, ctx)}<button class="admin-section-btn danger" data-section-remove="${sid}" title="Remove section">&times;</button></div>`
    : '';

  // Body order: picture first, then overlays/captions, then heading group.
  // For below_image, headingGroup falls below the picture in document order.
  const body = `${pictureMarkup}${logoMarkup}${captionMarkup}${headingGroup}`;

  return `<section class="section section-hero hero-foreground" data-text-position="${escAttr(textPosition)}"${sortable}${cfgAttr}>${adminCtrls}${body}</section>`;
}

const HERO: BlockType = {
  label: 'Hero Banner',
  icon: '\u{1F3DE}',
  dynamic: false,
  zoneHints: ['main'],
  supportedSpans: ['1'],
  defaultConfig: {
    heading: 'New Hero',
    subheading: 'Add your subheading here',
    bg_image: '',
    cta_text: '',
    cta_href: '',
  },
  render(section, ctx) {
    const mode: HeroMode = (section.config || {}).mode === 'foreground' ? 'foreground' : 'background';
    return mode === 'foreground'
      ? renderForegroundHero(section, ctx)
      : renderBackgroundHero(section, ctx);
  },
};

const FEATURES: BlockType = {
  label: 'Features',
  icon: '✨',
  dynamic: false,
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2', '1/3', '2/3'],
  defaultConfig: {
    columns: 3,
    items: [{ icon: 'home', title: 'Feature 1', desc: 'Description' }],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const cols = cfg.columns || 3;
    const items = (cfg.items || [])
      .map(
        (item: any, i: number) => {
          const icon = item.icon
            ? `<div class="feature-icon">${escHtml(featureIcon(item.icon))}</div>`
            : '';
          const cta = item.cta_text && item.cta_href
            ? `<a class="btn btn-primary" href="${escAttr(cleanHref(item.cta_href))}"${editableAttr(section, `items.${i}.cta_text`, ctx)}>${escHtml(item.cta_text)}</a>`
            : '';
          return `<div class="feature-card">${icon}<h3${editableAttr(section, `items.${i}.title`, ctx)}>${escHtml(item.title)}</h3><p${editableAttr(section, `items.${i}.desc`, ctx)}>${escHtml(item.desc)}</p>${cta}</div>`;
        },
      )
      .join('');
    return adminWrap(
      section,
      ctx,
      `<div class="ky-container"><div class="features-grid" style="--cols:${cols}">${items}</div></div>`,
      'section section-features',
    );
  },
};

const CTA: BlockType = {
  label: 'Call to Action',
  icon: '\u{1F4E2}',
  dynamic: false,
  zoneHints: ['main'],
  supportedSpans: ['1'],
  defaultConfig: {
    heading: 'Ready to join?',
    text: 'Get started today.',
    cta_text: 'Join Now',
    cta_href: '/join',
  },
  render(section, ctx) {
    const cfg = section.config || {};
  const cta = cfg.cta_text
      ? `<a href="${escAttr(cleanHref(cfg.cta_href, '#'))}" class="btn btn-primary btn-lg mt-2"${editableAttr(section, 'cta_text', ctx)}>${escHtml(cfg.cta_text)}</a>`
      : '';
    return adminWrap(
      section,
      ctx,
      `<div class="ky-container"><h2${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2><p class="ky-text-muted mt-1"${editableAttr(section, 'text', ctx)}>${escHtml(cfg.text)}</p>${cta}</div>`,
      'section section-cta',
    );
  },
};

const STATS: BlockType = {
  label: 'Stats',
  icon: '\u{1F4CA}',
  dynamic: false,
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2', '1/3', '2/3'],
  defaultConfig: {
    items: [
      { value: '0', label: 'Stat 1' },
      { value: '0', label: 'Stat 2' },
      { value: '0', label: 'Stat 3' },
    ],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const items = (cfg.items || [])
      .map((s: any, i: number) => {
        const inner = `<div class="stat-value"${editableAttr(section, `items.${i}.value`, ctx)}>${escHtml(s.value)}</div><div class="stat-label"${editableAttr(section, `items.${i}.label`, ctx)}>${escHtml(s.label)}</div>`;
        return s.href
          ? `<a href="${escAttr(cleanHref(s.href))}" class="stat-card" style="text-decoration:none;color:inherit">${inner}</a>`
          : `<div class="stat-card">${inner}</div>`;
      })
      .join('');
    return adminWrap(
      section,
      ctx,
      `<div class="ky-container"><div class="stats-grid">${items}</div></div>`,
      'section section-stats',
    );
  },
};

const TESTIMONIALS: BlockType = {
  label: 'Testimonials',
  icon: '\u{1F4AC}',
  dynamic: false,
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2', '1/3', '2/3'],
  defaultConfig: {
    items: [{ quote: 'Great community!', name: 'Member', role: '' }],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const items = (cfg.items || [])
      .map(
        (t: any, i: number) =>
          `<figure class="card testimonial-card"><blockquote class="testimonial-quote"${editableAttr(section, `items.${i}.quote`, ctx)}>&ldquo;${escHtml(t.quote)}&rdquo;</blockquote><figcaption class="testimonial-author"${editableAttr(section, `items.${i}.name`, ctx)}>— ${escHtml(t.name)}${t.role ? `, ${escHtml(t.role)}` : ''}</figcaption></figure>`,
      )
      .join('');
    return adminWrap(section, ctx, `<div class="ky-container"><div class="card-grid">${items}</div></div>`);
  },
};

const FAQ: BlockType = {
  label: 'FAQ',
  icon: '❓',
  dynamic: false,
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2'],
  defaultConfig: {
    items: [{ q: 'Question?', a: 'Answer here.' }],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const items = (cfg.items || [])
      .map(
        (f: any, i: number) =>
          `<details class="card mb-1" style="cursor:pointer"><summary style="font-weight:600"${editableAttr(section, `items.${i}.q`, ctx)}>${escHtml(f.q)}</summary><p class="ky-text-muted mt-1"${editableAttr(section, `items.${i}.a`, ctx)}>${escHtml(f.a)}</p></details>`,
      )
      .join('');
    return adminWrap(section, ctx, `<div class="ky-container"><h2 class="mb-2">FAQ</h2>${items}</div>`);
  },
};

const POLLS: BlockType = {
  label: 'Polls',
  icon: '\u{1F4CA}',
  dynamic: true,
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2'],
  defaultConfig: { heading: '', poll_ids: [] },
  render(section, ctx) {
    const cfg = section.config || {};
    const heading = cfg.heading ? `<h2 class="mb-2">${escHtml(cfg.heading)}</h2>` : '';
    return adminWrap(
      section,
      ctx,
      `<div class="ky-container" data-block-hydrate="polls">${heading}<div class="polls-skeleton"><div class="skeleton skeleton-card mb-1"></div></div></div>`,
      'section section-polls',
    );
  },
  async hydrate(el, section, ctx) {
    if (!ctx.isFeatureEnabled?.('feature_polls')) {
      el.style.display = 'none';
      return;
    }
    const cfg = section.config || {};
    const pollIds: number[] = cfg.poll_ids || [];
    const container = el.querySelector('[data-block-hydrate="polls"]') as HTMLElement | null;
    if (!container) return;
    const skeleton = container.querySelector('.polls-skeleton');
    if (skeleton) skeleton.remove();
    const [{ fetchAndRenderPoll, bindPollVoteListeners }, { getSession }] = await Promise.all([
      import('./poll-ui.js'),
      import('./auth.js'),
    ]);
    const session = getSession();
    const memberId = session?.user?.member?.id ?? null;
    for (const pid of pollIds) {
      try {
        const result = await fetchAndRenderPoll(pid, session);
        const wrap = document.createElement('div');
        wrap.className = 'card mb-1';
        wrap.dataset.sectionPoll = String(pid);
        wrap.innerHTML = result.html;
        container.appendChild(wrap);
        bindPollVoteListeners(wrap, result.poll, result.votes, memberId, () => {
          const ev = new CustomEvent('wl-content-rendered');
          document.dispatchEvent(ev);
        });
      } catch (e) {
        console.warn(`Failed to fetch poll ${pid}:`, e);
      }
    }
    if (!container.querySelector('[data-section-poll]')) {
      container.innerHTML += '<p class="ky-text-muted">No polls to display.</p>';
    }
  },
};

const EVENT_COUNTDOWN: BlockType = {
  label: 'Event Countdown',
  icon: '⏱️',
  dynamic: true,
  zoneHints: ['main'],
  supportedSpans: ['1', '1/3', '1/2'],
  defaultConfig: { heading: 'Next Event' },
  render(section, ctx) {
    const cfg = section.config || {};
    const heading = cfg.heading ? `<h2 class="mb-2">${escHtml(cfg.heading)}</h2>` : '';
    return adminWrap(
      section,
      ctx,
      `<div class="ky-container" data-block-hydrate="event_countdown">${heading}<div class="skeleton skeleton-card"></div></div>`,
      'section section-event-countdown',
    );
  },
  async hydrate(el, _section, ctx) {
    if (!ctx.isFeatureEnabled?.('feature_events')) {
      el.style.display = 'none';
      return;
    }
    const container = el.querySelector('[data-block-hydrate="event_countdown"]') as HTMLElement | null;
    if (!container) return;
    const { get } = await import('./api.js');
    try {
      const events = await get('events?starts_at=gte.now()&order=starts_at.asc&limit=1');
      const skeleton = container.querySelector('.skeleton');
      if (skeleton) skeleton.remove();
      if (!events.length) {
        container.innerHTML += '<p class="ky-text-muted">No upcoming events.</p>';
        return;
      }
      const evt = events[0];
      const startsAt = new Date(evt.starts_at).getTime();
      const update = () => {
        const now = Date.now();
        const diff = Math.max(0, startsAt - now);
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        container.querySelector('[data-countdown]')!.textContent = `${days}d ${hours}h ${mins}m`;
      };
      container.innerHTML += `<div class="card"><h3>${escHtml(evt.title)}</h3><p data-countdown></p></div>`;
      update();
      setInterval(update, 60000);
    } catch (e) {
      console.warn('event_countdown hydrate failed:', e);
    }
  },
};

const ANNOUNCEMENTS_FEED: BlockType = {
  label: 'Announcements',
  icon: '\u{1F4E3}',
  dynamic: true,
  zoneHints: ['main'],
  supportedSpans: ['1', '2/3'],
  defaultConfig: { heading: 'Announcements', limit: 20 },
  render(section, ctx) {
    const cfg = section.config || {};
    const heading = cfg.heading
      ? `<h2 id="announcements-title"${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2>`
      : '<h2 id="announcements-title">Announcements</h2>';
    return adminWrap(
      section,
      ctx,
      `<div class="ky-container" data-block-hydrate="announcements_feed"><div class="block-content"><div id="announcement-create" class="hidden mb-2"></div>${heading}<div id="announcements-feed"><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></div><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div></div></div></div></div>`,
      'section section-visible',
    );
  },
  async hydrate(el, section, ctx) {
    const { hydrateAnnouncementsFeed } = await import('./block-hydrators.js');
    await hydrateAnnouncementsFeed(el, section, ctx);
  },
};

const ACTIVITY_FEED: BlockType = {
  label: 'Activity Feed',
  icon: '\u{1F4DD}',
  dynamic: true,
  zoneHints: ['main'],
  supportedSpans: ['1', '1/3', '2/3'],
  defaultConfig: { heading: 'Recent Activity', limit: 15 },
  render(section, ctx) {
    const cfg = section.config || {};
    const heading = cfg.heading
      ? `<h2${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2>`
      : '';
    return adminWrap(
      section,
      ctx,
      `<div class="ky-container" data-block-hydrate="activity_feed">${heading}<div id="activity-feed"><div class="skeleton skeleton-card"></div></div></div>`,
      'section section-activity',
    );
  },
  async hydrate(el, section, ctx) {
    if (!ctx.isFeatureEnabled?.('feature_activity_feed')) {
      el.style.display = 'none';
      return;
    }
    const { hydrateActivityFeed } = await import('./block-hydrators.js');
    await hydrateActivityFeed(el, section, ctx);
  },
};

// --- Header chrome renderers ---

export interface NavItem {
  label: string;
  href?: string;
  icon?: string;
  public?: boolean;
  auth?: boolean;
  feature?: string;
  admin?: boolean;
  children?: NavItem[];
}

export interface NavConfig {
  items?: NavItem[];
  presentation?: NavPresentationConfig;
  behavior?: NavBehaviorConfig;
  interactions?: InteractionConfig;
}

const NAV_LABEL_KEYS: Record<string, string> = {
  Home: 'nav.home',
  Inicio: 'nav.home',
  Members: 'nav.members',
  Miembros: 'nav.members',
  Residents: 'nav.members',
  Events: 'nav.events',
  Eventos: 'nav.events',
  Resources: 'nav.resources',
  Recursos: 'nav.resources',
  Sermons: 'nav.resources',
  Documents: 'nav.resources',
  Forum: 'nav.forum',
  Foro: 'nav.forum',
  Dashboard: 'nav.dashboard',
  Panel: 'nav.dashboard',
  Settings: 'nav.settings',
  'Configuración': 'nav.settings',
  Profile: 'nav.profile',
  Perfil: 'nav.profile',
  'About Us': 'nav.about',
  Nosotros: 'nav.about',
  Committees: 'nav.committees',
  Programas: 'nav.committees',
  Ministries: 'nav.committees',
};

export { NAV_LABEL_KEYS };

function navItemVisible(item: NavItem, ctx: BlockRenderContext): boolean {
  if (item.feature && ctx.isFeatureEnabled && !ctx.isFeatureEnabled(item.feature)) return false;
  if (item.auth && !ctx.authenticated) return false;
  if (item.admin && ctx.role !== 'admin') return false;
  return true;
}

function navItemActive(item: NavItem, ctx: BlockRenderContext): boolean {
  const href = typeof item.href === 'string' ? item.href.trim() : '';
  if (href && isPageActive(cleanHref(href, ''), ctx.currentPath)) return true;
  const children = Array.isArray(item.children) ? item.children : [];
  return children.some((child) => navItemVisible(child, ctx) && navItemActive(child, ctx));
}

function navMenuId(item: NavItem, path: string): string {
  const slug = String(item.label || 'menu')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'menu';
  return `nav-menu-${slug}-${path}`;
}

function renderNavChildren(children: NavItem[], ctx: BlockRenderContext, parentPath: string, depth: number): string {
  const visible = children.filter((c) => navItemVisible(c, ctx));
  if (visible.length === 0) return '';
  const items = visible
    .map((child, i) => renderNavChild(child, ctx, `${parentPath}-${i}`, depth))
    .join('');
  return items;
}

function renderNavChild(item: NavItem, ctx: BlockRenderContext, path: string, depth: number): string {
  const hasKids = Array.isArray(item.children) && item.children.length > 0
    && item.children.some((c) => navItemVisible(c, ctx));
  const href = cleanHref(item.href, '#');
  const active = navItemActive(item, ctx) ? ' active' : '';
  if (!hasKids) {
    return `<li role="none"><a role="menuitem" class="nav-menuitem${active}" href="${escAttr(href)}">${escHtml(item.label)}</a></li>`;
  }
  const menuId = navMenuId(item, path);
  const childrenHtml = renderNavChildren(item.children!, ctx, path, depth + 1);
  const linkPart = item.href
    ? `<a role="menuitem" class="nav-menuitem${active}" href="${escAttr(href)}">${escHtml(item.label)}</a>`
    : `<span class="nav-menuitem nav-menuitem-parent">${escHtml(item.label)}</span>`;
  return `<li role="none" class="nav-dropdown-parent">${linkPart}<button class="nav-chevron-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="${menuId}" aria-label="Open ${escAttr(item.label)} submenu"><span class="nav-chevron" aria-hidden="true">▾</span></button><ul class="nav-dropdown nav-dropdown-nested" role="menu" id="${menuId}" hidden>${childrenHtml}</ul></li>`;
}

function renderNavTopItem(item: NavItem, ctx: BlockRenderContext, idx: number): string {
  const hasKids = Array.isArray(item.children) && item.children.length > 0
    && item.children.some((c) => navItemVisible(c, ctx));
  const href = cleanHref(item.href, '');
  const active = navItemActive(item, ctx) ? ' active' : '';
  if (!hasKids) {
    return `<a class="nav-link${active}" href="${escAttr(href)}">${escHtml(item.label)}</a>`;
  }
  const menuId = navMenuId(item, `top-${idx}`);
  const childrenHtml = renderNavChildren(item.children!, ctx, `top-${idx}`, 1);
  const trigger = item.href
    ? `<a class="nav-link nav-parent${active}" href="${escAttr(href)}">${escHtml(item.label)}</a><button class="nav-chevron-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="${menuId}" aria-label="Open ${escAttr(item.label)} submenu"><span class="nav-chevron" aria-hidden="true">▾</span></button>`
    : `<button class="nav-link nav-parent nav-parent-button${active}" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="${menuId}">${escHtml(item.label)}<span class="nav-chevron" aria-hidden="true">▾</span></button>`;
  return `<div class="nav-item-wrap">${trigger}<ul class="nav-dropdown" role="menu" id="${menuId}" hidden>${childrenHtml}</ul></div>`;
}

function renderNavPresentationAttrs(cfg: NavConfig): string {
  const p = cfg.presentation || {};
  const b = cfg.behavior || {};
  const i = cfg.interactions || {};
  const hover = i.hover || {};
  const focus = i.focus || {};
  const style = styleAttr([
    cssVar('--nav-link-color', p.link_color),
    cssVar('--nav-link-hover-bg', p.link_hover_bg || hover.background),
    cssVar('--nav-link-hover-color', p.link_hover_color || hover.text),
    cssVar('--nav-link-active-bg', p.link_active_bg),
    cssVar('--nav-link-active-color', p.link_active_color),
    cssVar('--nav-link-padding', p.link_padding),
    cssVar('--nav-link-radius', p.link_radius),
    cssVar('--nav-link-gap', p.link_gap),
    cssVar('--nav-link-font-family', p.font_family),
    cssVar('--nav-link-font-size', p.font_size),
    cssVar('--nav-link-font-weight', p.font_weight),
    cssVar('--nav-links-bg', p.surface_bg),
    cssVar('--nav-links-padding', p.surface_padding),
    cssVar('--nav-links-radius', p.surface_radius),
    cssVar('--nav-links-shadow', p.surface_shadow),
    cssVar('--nav-links-wrap', p.wrap),
    cssVar('--nav-dropdown-bg', p.dropdown_bg),
    cssVar('--nav-dropdown-color', p.dropdown_color),
    cssVar('--nav-dropdown-hover-bg', p.dropdown_hover_bg || hover.background),
    cssVar('--nav-dropdown-hover-color', p.dropdown_hover_color || hover.text),
    cssVar('--nav-dropdown-border', p.dropdown_border),
    cssVar('--nav-dropdown-shadow', p.dropdown_shadow),
    cssVar('--nav-dropdown-width', p.dropdown_width),
    cssVar('--nav-dropdown-offset-x', p.dropdown_offset_x),
    cssVar('--nav-dropdown-offset-y', p.dropdown_offset_y),
    cssVar('--nav-chevron-color', p.chevron_color || hover.icon),
    cssVar('--nav-focus-color', focus.border || focus.text),
    cssVar('--nav-transition', p.transition || hover.duration),
    cssVar('--nav-mobile-menu-bg', p.mobile_menu_bg),
    cssVar('--nav-mobile-menu-padding', p.mobile_menu_padding),
  ]);
  const attrs: string[] = [];
  if (style) attrs.push(style);
  if (p.full_row === true) attrs.push(' data-nav-full-row="true"');
  if (b.mobile_breakpoint != null) {
    const n = Number(b.mobile_breakpoint);
    if (Number.isFinite(n) && n > 0) attrs.push(` data-mobile-breakpoint="${Math.round(n)}"`);
  }
  if (b.mobile_closed_layout) attrs.push(` data-mobile-closed-layout="${escAttr(b.mobile_closed_layout)}"`);
  if (b.mobile_open_layout) attrs.push(` data-mobile-open-layout="${escAttr(b.mobile_open_layout)}"`);
  if (b.desktop_open) attrs.push(` data-desktop-open="${escAttr(b.desktop_open)}"`);
  return attrs.join('');
}

const NAV: BlockType = {
  label: 'Navigation',
  icon: '\u{1F9ED}',
  dynamic: false,
  zoneHints: ['header'],
  supportedSpans: ['1'],
  defaultConfig: {
    items: [
      { label: 'Home', href: '/', icon: 'home', public: true },
    ],
  },
  render(section, ctx) {
    const cfg: NavConfig = section.config || {};
    const items: NavItem[] = cfg.items || [];
    const visible = items.filter((item) => navItemVisible(item, ctx));
    const links = visible.map((item, i) => renderNavTopItem(item, ctx, i)).join('');
    const sid = section.id;
    const editAttrs = sid != null && ctx.admin
      ? ` data-block-id="${sid}" data-block-type="nav"`
      : '';
    const adminEditBtn = sid != null && ctx.admin
      ? `<button class="admin-nav-edit-btn" data-nav-edit="${sid}" title="Edit navigation">&#9998;</button>`
      : '';
    const presentationAttrs = renderNavPresentationAttrs(cfg);
    return `<button class="nav-toggle" id="nav-toggle" aria-label="Menu" aria-controls="nav-links" aria-expanded="false">&#9776;</button><div class="nav-links" id="nav-links" data-block-nav${editAttrs}${presentationAttrs}>${links}</div>${adminEditBtn}`;
  },
};

// brand_header renderer applies the brand picker rules (priority order):
//   1. brand_icon_url set → icon + brand_text (text_short swapped via CSS)
//   2. else brand_wordmark_url set → wordmark alone (no separate text)
//   3. else → brand_text plain
// All three fields read from site_config via BlockRenderContext.brand*
// (Portal.astro / page-render.ts populate the context). The block config row
// itself only carries the link href today — brand identity is project-wide.
// Inline editing routes to site_config keys (data-editable target uses
// `site_config.{key}.value` paths handled by AdminEditor).
const BRAND_HEADER: BlockType = {
  label: 'Brand / Logo',
  icon: '\u{1F3F7}️',
  dynamic: false,
  zoneHints: ['header'],
  supportedSpans: ['1'],
  defaultConfig: {
    href: '/',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const href = cleanHref(cfg.href, '/');
    const configuredTitle = typeof cfg.title === 'string' ? cfg.title.trim() : '';
    const configuredShortTitle = typeof cfg.short_title === 'string' ? cfg.short_title.trim() : '';
    const brandText = configuredTitle || ctx.brandText || ctx.siteName || 'Kychon';
    const brandTextShort = configuredShortTitle || ctx.brandTextShort || '';
    const brandSubtitle = typeof cfg.subtitle === 'string' ? cfg.subtitle.trim() : '';
    const iconUrl = ctx.brandIconUrl || '';
    const wordmarkUrl = ctx.brandWordmarkUrl || '';

    // Admin inline-editing hooks for the three brand fields. The site_config
    // table is keyed on `key` not `id`, so saveField()'s site_config branch
    // (target.table === 'site_config') uses target.id as the key.
    const editableIcon = ctx.admin
      ? ` data-editable-image="site_config.brand_icon_url.value"`
      : '';
    const editableWordmark = ctx.admin
      ? ` data-editable-image="site_config.brand_wordmark_url.value"`
      : '';
    const editableText = ctx.admin
      ? ` data-editable="site_config.brand_text.value"`
      : '';
    const editableTextShort = ctx.admin
      ? ` data-editable="site_config.brand_text_short.value"`
      : '';

    if (iconUrl) {
      // Mode 1: icon + text. Short text swaps in via CSS at narrow viewports.
      const shortSpan = brandTextShort
        ? `<span class="brand-text--short"${editableTextShort}>${escHtml(brandTextShort)}</span>`
        : '';
      const subtitleSpan = brandSubtitle
        ? `<span class="brand-subtitle">${escHtml(brandSubtitle)}</span>`
        : '';
      return `<a href="${escAttr(href)}" class="brand-header brand-header--icon nav-brand" aria-label="${escAttr(brandText)}"><img class="brand-icon" src="${escAttr(iconUrl)}" alt=""${editableIcon}><span class="brand-copy"><span class="brand-text"><span class="brand-text--full"${editableText}>${escHtml(brandText)}</span>${shortSpan}</span>${subtitleSpan}</span></a>`;
    }
    if (wordmarkUrl) {
      // Mode 2: wordmark alone — the image already contains the org name, so
      // no separate text element is rendered.
      return `<a href="${escAttr(href)}" class="brand-header brand-header--wordmark nav-brand" aria-label="${escAttr(brandText)}"><img class="brand-wordmark" src="${escAttr(wordmarkUrl)}" alt="${escAttr(brandText)}"${editableWordmark}></a>`;
    }
    // Mode 3: text fallback (equivalent to today's logo_url=NULL behavior).
    return `<a href="${escAttr(href)}" class="brand-header brand-header--text nav-brand"${editableText}>${escHtml(brandText)}</a>`;
  },
};

const SIGN_IN_BAR: BlockType = {
  label: 'Sign-in Bar',
  icon: '\u{1F511}',
  dynamic: true,
  zoneHints: ['header'],
  supportedSpans: ['1'],
  defaultConfig: { show_lang_toggle: true, show_theme_toggle: true },
  render(_section, _ctx) {
    return `<div class="nav-user" id="nav-user" data-block-hydrate="sign_in_bar"></div>`;
  },
  async hydrate(el, _section, ctx) {
    const { hydrateSignInBar } = await import('./block-hydrators.js');
    await hydrateSignInBar(el, _section, ctx);
  },
};

const SITE_SEARCH: BlockType = {
  label: 'Site Search',
  icon: '\u{1F50D}',
  dynamic: true,
  zoneHints: ['header', 'main'],
  supportedSpans: ['1', '1/2', '1/3'],
  defaultConfig: {
    placeholder: 'Search this site',
    submit_label: 'Search',
    destination: '/search',
    compact: true,
    default_type: 'all',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const p = cfg.presentation || {};
    const destination = cleanHref(cfg.destination, '/search');
    const placeholder = cfg.placeholder || 'Search this site';
    const submitLabel = cfg.submit_label || 'Search';
    const mode = cfg.mode === 'header_icon' ? 'header_icon' : 'form';
    if (mode === 'header_icon') {
      const inner = `<a class="site-search site-search--header-icon" href="${escAttr(destination)}" aria-label="${escAttr(placeholder)}" title="${escAttr(placeholder)}"><span class="site-search__icon" aria-hidden="true"></span></a>`;
      return adminWrap(section, ctx, inner, 'section section-site-search section-site-search--icon');
    }
    const defaultType = ['all', 'pages', 'resources', 'events'].includes(cfg.default_type)
      ? cfg.default_type
      : 'all';
    const compact = cfg.compact !== false;
    const sid = section.id ?? `pos-${section.position}`;
    const inputId = `site-search-${sid}`;
    const listId = `site-search-list-${sid}`;
    const cfgAttr = ` data-config="${jsonAttr({
      destination,
      default_type: defaultType,
      min_chars: cfg.min_chars || 2,
    })}"`;
    const style = styleAttr([
      cssVar('--site-search-max-width', p.max_width),
      cssVar('--site-search-form-gap', p.form_gap),
      cssVar('--site-search-form-border', p.form_border),
      cssVar('--site-search-form-radius', p.form_radius),
      cssVar('--site-search-form-overflow', p.form_overflow),
      cssVar('--site-search-form-bg', p.form_bg),
      cssVar('--site-search-input-height', p.input_height),
      cssVar('--site-search-input-border', p.input_border),
      cssVar('--site-search-input-radius', p.input_radius),
      cssVar('--site-search-input-padding', p.input_padding),
      cssVar('--site-search-submit-height', p.submit_height),
      cssVar('--site-search-submit-border', p.submit_border),
      cssVar('--site-search-submit-radius', p.submit_radius),
      cssVar('--site-search-submit-padding', p.submit_padding),
      cssVar('--site-search-submit-bg', p.submit_bg),
      cssVar('--site-search-submit-color', p.submit_color),
    ]);
    const form = `<form class="site-search__form" action="${escAttr(destination)}" method="get" role="search">
      <label class="sr-only" for="${escAttr(inputId)}">${escHtml(placeholder)}</label>
      <input class="site-search__input" id="${escAttr(inputId)}" name="q" type="search" maxlength="300" autocomplete="off" placeholder="${escAttr(placeholder)}" aria-autocomplete="list" aria-expanded="false" aria-controls="${escAttr(listId)}">
      <input type="hidden" name="type" value="${escAttr(defaultType)}">
      <button class="site-search__submit" type="submit">${escHtml(submitLabel)}</button>
      <div class="site-search__suggestions" id="${escAttr(listId)}" role="listbox" hidden></div>
    </form>`;
    const inner = `<div class="site-search site-search--${compact ? 'compact' : 'wide'}" data-block-hydrate="site_search"${cfgAttr}${style}>${form}</div>`;
    return adminWrap(section, ctx, inner, 'section section-site-search');
  },
  async hydrate(el, section, ctx) {
    const { hydrateSiteSearch } = await import('./block-hydrators.js');
    await hydrateSiteSearch(el, section, ctx);
  },
};

// --- Footer renderers ---

const FOOTER_ADDRESS: BlockType = {
  label: 'Address',
  icon: '\u{1F4CD}',
  dynamic: false,
  zoneHints: ['footer'],
  supportedSpans: ['1', '1/2', '1/3'],
  defaultConfig: {
    name: '',
    address_lines: [],
    phone: '',
    email: '',
    hours: '',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const name = cfg.name
      ? `<div class="footer-org-name"${editableAttr(section, 'name', ctx)}>${escHtml(cfg.name)}</div>`
      : '';
    const lines = (cfg.address_lines || [])
      .map((line: string, i: number) => `<div${editableAttr(section, `address_lines.${i}`, ctx)}>${escHtml(line)}</div>`)
      .join('');
    const phone = cfg.phone
      ? `<div class="footer-phone"><a href="tel:${escAttr(cfg.phone)}"${editableAttr(section, 'phone', ctx)}>${escHtml(cfg.phone)}</a></div>`
      : '';
    const email = cfg.email
      ? `<div class="footer-email"><a href="mailto:${escAttr(cfg.email)}"${editableAttr(section, 'email', ctx)}>${escHtml(cfg.email)}</a></div>`
      : '';
    const hours = cfg.hours
      ? `<div class="footer-hours"${editableAttr(section, 'hours', ctx)}>${escHtml(cfg.hours)}</div>`
      : '';
    const sid = section.id;
    const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
    const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
    return `<div class="footer-block footer-address"${sortable}${cfgAttr}>${name}${lines}${phone}${email}${hours}</div>`;
  },
};

const FOOTER_LINKS: BlockType = {
  label: 'Footer Links',
  icon: '\u{1F517}',
  dynamic: false,
  zoneHints: ['footer'],
  supportedSpans: ['1', '1/2', '1/3', '2/3'],
  defaultConfig: {
    columns: [
      { heading: 'About', items: [{ label: 'About Us', href: '/about' }] },
    ],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const cols = (cfg.columns || [])
      .map(
        (col: any, ci: number) => {
          const items = (col.items || [])
            .map(
              (it: any, ii: number) =>
                `<li><a href="${escAttr(cleanHref(it.href))}"${editableAttr(section, `columns.${ci}.items.${ii}.label`, ctx)}>${escHtml(it.label)}</a></li>`,
            )
            .join('');
          return `<div class="footer-links-col"><h4${editableAttr(section, `columns.${ci}.heading`, ctx)}>${escHtml(col.heading)}</h4><ul>${items}</ul></div>`;
        },
      )
      .join('');
    const sid = section.id;
    const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
    const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
    return `<div class="footer-block footer-links"${sortable}${cfgAttr}>${cols}</div>`;
  },
};

const FOOTER_COPYRIGHT: BlockType = {
  label: 'Copyright',
  icon: '©',
  dynamic: false,
  zoneHints: ['footer'],
  supportedSpans: ['1'],
  defaultConfig: {
    year: 'auto',
    org_name: '',
    admin_contact_label: '',
    admin_contact_href: '',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const year = cfg.year === 'auto'
      ? `<span data-year="auto">${new Date().getFullYear()}</span>`
      : escHtml(cfg.year);
    const orgName = cfg.org_name
      ? `<span${editableAttr(section, 'org_name', ctx)}>${escHtml(cfg.org_name)}</span>`
      : '';
    const adminContact = cfg.admin_contact_label && cfg.admin_contact_href
      ? ` &middot; <a href="${escAttr(cleanHref(cfg.admin_contact_href))}"${editableAttr(section, 'admin_contact_label', ctx)}>${escHtml(cfg.admin_contact_label)}</a>`
      : '';
    const sid = section.id;
    const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
    const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
    return `<div class="footer-block footer-copyright"${sortable}${cfgAttr}>&copy; ${year}${orgName ? ' ' + orgName : ''}${adminContact}</div>`;
  },
};

const FOOTER_SOCIAL: BlockType = {
  label: 'Social Links',
  icon: '\u{1F310}',
  dynamic: false,
  zoneHints: ['footer'],
  supportedSpans: ['1', '1/3'],
  defaultConfig: { icons: [] },
  render(section, ctx) {
    return renderSocialLinksBlock(section, ctx, {
      className: 'section footer-block',
      legacyFooter: true,
    });
  },
};

const FOOTER_ATTRIBUTION: BlockType = {
  label: 'Attribution',
  icon: '✨',
  dynamic: false,
  zoneHints: ['footer'],
  supportedSpans: ['1'],
  defaultConfig: {
    text: 'Powered by [Kychon](https://kychon.com) on [Run402](https://run402.com)',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const text = cfg.text || '';
    const sid = section.id;
    const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
    const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
    const editText = ctx.admin && sid != null
      ? ` data-editable="sections.${sid}.config.text"`
      : '';
    return `<div class="footer-block footer-attribution"${sortable}${cfgAttr}><p${editText}>${renderMarkdownLine(text)}</p></div>`;
  },
};

const CUSTOM: BlockType = {
  label: 'Custom HTML',
  icon: '\u{1F9F1}',
  dynamic: false,
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2', '1/3', '2/3'],
  defaultConfig: { html: '<p>Custom HTML</p>' },
  render(section, ctx) {
    const cfg = section.config || {};
    const richEdit = richEditableAttr(section, 'html', ctx);
    const inner = `<div class="ky-container"${richEdit}>${cfg.html || ''}</div>`;
    return adminWrap(section, ctx, inner);
  },
};

// --- Catalog blocks (block-types-catalog) ---

const TAGLINE_STRIP: BlockType = {
  label: 'Tagline Strip',
  icon: '\u{2766}', // ❦
  dynamic: false,
  zoneHints: ['main'],
  defaultConfig: {
    text: 'Your tagline here',
    color_scheme: 'primary',
    size: 'medium',
    alignment: 'center',
    icon: '',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const scheme = cfg.color_scheme || 'primary';
    const size = cfg.size || 'medium';
    const alignment = cfg.alignment || 'center';
    const cls = `block-tagline-strip block-tagline-strip--${escAttr(scheme)} block-tagline-strip--${escAttr(size)} block-tagline-strip--align-${escAttr(alignment)}`;
    const iconHtml = cfg.icon
      ? `<span class="block-tagline-strip__icon" aria-hidden="true">${escHtml(featureIcon(String(cfg.icon)))}</span>`
      : '';
    const textHtml = `<p class="block-tagline-strip__text"${editableAttr(section, 'text', ctx)}>${escHtml(cfg.text || '')}</p>`;
    const inner = `<div class="ky-container">${iconHtml}${textHtml}</div>`;
    return adminWrap(section, ctx, inner, cls);
  },
};

const PAGE_BANNER: BlockType = {
  label: 'Page Banner',
  icon: '\u{1F5BC}', // 🖼
  dynamic: false,
  zoneHints: ['header'],
  fullBleed: true,
  defaultConfig: {
    image_url: '',
    image_alt: '',
    caption_html: '',
    height: 'medium',
    overlay_color: '',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const height = cfg.height || 'medium';
    const heightCls = `block-page-banner--height-${escAttr(height)}`;
    const safeOverlay = cfg.overlay_color ? safeCssValue(cfg.overlay_color) : '';
    const overlay = safeOverlay
      ? `<div class="block-page-banner__overlay" style="background-color:${safeOverlay}"></div>`
      : '';
    const safeImageUrl = cfg.image_url ? safeCssUrl(cfg.image_url) : '';
    const bg = safeImageUrl
      ? ` style="background-image:url('${safeImageUrl}')"`
      : '';
    const safeCaption = sanitizeCaptionHtml(String(cfg.caption_html || ''));
    const captionHtml = safeCaption
      ? `<div class="block-page-banner__caption">${safeCaption}</div>`
      : '';
    const sid = section.id;
    const sortable = sid != null
      ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"`
      : '';
    const zoneAttr = ` data-section-zone="${section.zone}"`;
    const scopeAttr = ` data-section-scope="${section.scope}"`;
    const cfgAttr = sid != null && ctx.admin
      ? ` data-editable-config="${jsonAttr(cfg)}"`
      : '';
    const imgAttr = sid != null && ctx.admin
      ? ` data-editable-image="sections.${sid}.config.image_url"`
      : '';
    const adminCtrls = sid != null && ctx.admin
      ? `<div class="admin-section-actions">${adminScopeControls(section, ctx)}<button class="admin-section-btn danger" data-section-remove="${sid}" title="Remove section">&times;</button></div>`
      : '';
    const ariaLabel = cfg.image_alt
      ? ` aria-label="${escAttr(cfg.image_alt)}"`
      : ' aria-hidden="true"';
    return `<section class="block-page-banner ${heightCls}"${sortable}${zoneAttr}${scopeAttr}${cfgAttr}${imgAttr}${bg}${ariaLabel}>${adminCtrls}${overlay}<div class="block-page-banner__inner">${captionHtml}</div></section>`;
  },
};

// link_list — both modes share the renderer. Manual mode emits all items.
// Resources mode emits a hydration skeleton; runtime fetches & re-renders.
function renderLinkListItem(item: any, layout: string): string {
  const href = cleanHref(item.href, '#');
  const externalAttrs = item.external
    ? ` target="_blank" rel="noopener noreferrer"`
    : '';
  const externalIcon = item.external
    ? `<span class="block-link-list__ext" aria-hidden="true">\u{2197}</span>`
    : '';
  const badge = item.badge
    ? `<span class="block-link-list__badge block-link-list__badge--${escAttr(String(item.badge).toLowerCase())}">${escHtml(item.badge)}</span>`
    : '';
  const showDate = (layout === 'rows' || layout === 'compact') && item.date;
  const dateHtml = showDate
    ? `<span class="block-link-list__date">${escHtml(item.date)}</span>`
    : '';
  const label = `<span class="block-link-list__label">${escHtml(item.label || item.title || href)}</span>`;
  return `<li class="block-link-list__item"><a href="${escAttr(href)}" class="block-link-list__link"${externalAttrs}>${dateHtml}${badge}${label}${externalIcon}</a></li>`;
}

const LINK_LIST: BlockType = {
  label: 'Link List',
  icon: '\u{1F4DC}', // 📜
  dynamic: true,
  zoneHints: ['main'],
  defaultConfig: {
    heading: 'Links',
    source: 'manual',
    layout: 'bullets',
    items: [],
    filter: { category: '', limit: 6, order: 'newest' },
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const layout = cfg.layout || 'bullets';
    const heading = cfg.heading
      ? `<h2 class="block-link-list__heading"${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2>`
      : '';
    const cls = `section section-link-list block-link-list block-link-list--${escAttr(layout)}`;
    const source = cfg.source || 'manual';
    if (source === 'resources') {
      const skeleton = `<ul class="block-link-list__list block-link-list__skeleton">${'<li class="skeleton skeleton-text"></li>'.repeat(Math.max(1, cfg.filter?.limit || 6))}</ul>`;
      const inner = `<div class="ky-container" data-block-hydrate="link_list" data-config="${jsonAttr(cfg)}">${heading}${skeleton}</div>`;
      return adminWrap(section, ctx, inner, cls);
    }
    const items: any[] = Array.isArray(cfg.items) ? cfg.items : [];
    const itemsHtml = items.map((item) => renderLinkListItem(item, layout)).join('');
    const inner = `<div class="ky-container">${heading}<ul class="block-link-list__list">${itemsHtml}</ul></div>`;
    return adminWrap(section, ctx, inner, cls);
  },
  async hydrate(el, section, ctx) {
    if ((section.config?.source || 'manual') !== 'resources') return;
    const { hydrateLinkListResources } = await import('./block-hydrators.js');
    await hydrateLinkListResources(el, section, ctx);
  },
};

const PROMO_CARDS: BlockType = {
  label: 'Promo Cards',
  icon: '\u{25A6}', // ▦
  dynamic: false,
  zoneHints: ['main'],
  defaultConfig: {
    heading: '',
    columns: 3,
    items: [
      { image_url: '', image_alt: '', title: 'Card 1', title_position: 'top', cta_text: 'Learn more', cta_href: '#', overlay_color: '' },
      { image_url: '', image_alt: '', title: 'Card 2', title_position: 'top', cta_text: 'Learn more', cta_href: '#', overlay_color: '' },
      { image_url: '', image_alt: '', title: 'Card 3', title_position: 'top', cta_text: 'Learn more', cta_href: '#', overlay_color: '' },
    ],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const cols = Number(cfg.columns) || 3;
    const items: any[] = Array.isArray(cfg.items) ? cfg.items : [];
    const heading = cfg.heading
      ? `<h2 class="block-promo-cards__heading"${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2>`
      : '';
    const cards = items
      .map((item, i) => {
        const href = cleanHref(item.cta_href, '#');
        const titlePos = item.title_position === 'bottom' ? 'bottom' : 'top';
        const ariaLabel = `${item.title || ''}${item.cta_text ? `, ${item.cta_text}` : ''}`.trim();
        const safeOverlay = item.overlay_color ? safeCssValue(item.overlay_color) : '';
        const overlay = safeOverlay
          ? `<span class="promo-card__overlay" style="background-color:${safeOverlay}"></span>`
          : '';
        const safeItemImage = item.image_url ? safeCssUrl(item.image_url) : '';
        const imgStyle = safeItemImage
          ? ` style="background-image:url('${safeItemImage}')"`
          : '';
        const imgEdit = ctx.admin && section.id != null
          ? ` data-editable-image="sections.${section.id}.config.items.${i}.image_url"`
          : '';
        const titleEdit = editableAttr(section, `items.${i}.title`, ctx);
        const ctaEdit = editableAttr(section, `items.${i}.cta_text`, ctx);
        const ctaHtml = item.cta_text
          ? `<span class="promo-card__cta"${ctaEdit}>${escHtml(item.cta_text)}</span>`
          : '';
        return `<a class="promo-card promo-card--title-${titlePos}" href="${escAttr(href)}" aria-label="${escAttr(ariaLabel)}"><span class="promo-card__image"${imgStyle}${imgEdit}>${overlay}</span><span class="promo-card__body"><h3 class="promo-card__title"${titleEdit}>${escHtml(item.title || '')}</h3>${ctaHtml}</span></a>`;
      })
      .join('');
    const inner = `<div class="ky-container">${heading}<div class="block-promo-cards" style="--cols:${cols}">${cards}</div></div>`;
    return adminWrap(section, ctx, inner, 'section section-promo-cards');
  },
};

function renderImageAccordionPanel(
  panel: ImageAccordionPanelConfig,
  section: Section,
  ctx: BlockRenderContext,
  index: number,
): string {
  const fit = panel.fit === 'contain' ? 'contain' : 'cover';
  const panelStyle = styleAttr([
    cssVar('--accordion-panel-fit', fit),
    cssVar('--accordion-panel-position', panel.object_position || 'center'),
    cssVar('--accordion-panel-hover-bg', panel.interactions?.hover?.background),
    cssVar('--accordion-panel-hover-color', panel.interactions?.hover?.text),
    cssVar('--accordion-panel-focus-color', panel.interactions?.focus?.border || panel.interactions?.focus?.text),
  ]);
  const imageEdit = ctx.admin && section.id != null
    ? ` data-editable-image="sections.${section.id}.config.panels.${index}.image_url"`
    : '';
  const titleEdit = editableAttr(section, `panels.${index}.title`, ctx);
  const descEdit = editableAttr(section, `panels.${index}.description`, ctx);
  const ctaEdit = editableAttr(section, `panels.${index}.cta_label`, ctx);
  const img = panel.image_url
    ? `<img class="image-accordion__image" src="${escAttr(panel.image_url)}" alt="${escAttr(panel.image_alt || '')}" loading="${index === 0 ? 'eager' : 'lazy'}"${imageEdit}>`
    : `<span class="image-accordion__placeholder"${imageEdit}></span>`;
  const description = panel.description
    ? `<p class="image-accordion__description"${descEdit}>${escHtml(panel.description)}</p>`
    : '';
  const cta = panel.cta_label
    ? `<span class="image-accordion__cta"${ctaEdit}>${escHtml(panel.cta_label)}</span>`
    : '';
  const content = `<span class="image-accordion__overlay" aria-hidden="true"></span><span class="image-accordion__content"><span class="image-accordion__title"${titleEdit}>${escHtml(panel.title || '')}</span>${description}${cta}</span>`;
  const body = `${img}${content}`;
  const common = `class="image-accordion__panel" data-accordion-panel="${index}"${panelStyle}`;
  if (panel.href) {
    return `<a ${common} href="${escAttr(cleanHref(panel.href))}">${body}</a>`;
  }
  return `<div ${common} tabindex="0" role="group" aria-label="${escAttr(panel.title || `Panel ${index + 1}`)}">${body}</div>`;
}

const IMAGE_ACCORDION: BlockType = {
  label: 'Image Accordion',
  icon: '\u{1F5BC}',
  dynamic: false,
  zoneHints: ['main'],
  supportedSpans: ['1', '2/3', '1/2'],
  defaultConfig: {
    heading: 'Image accordion',
    active_ratio: 2.5,
    idle_ratio: 1,
    overlay_color: 'rgba(0,0,0,0.55)',
    overlay_opacity: 1,
    reveal_duration: '260ms',
    mobile_fallback: 'stack',
    panels: [
      { image_url: '', image_alt: '', title: 'Panel 1', description: 'Add source text.', cta_label: 'Learn more', href: '' },
      { image_url: '', image_alt: '', title: 'Panel 2', description: 'Add source text.', cta_label: 'Learn more', href: '' },
      { image_url: '', image_alt: '', title: 'Panel 3', description: 'Add source text.', cta_label: 'Learn more', href: '' },
    ],
  },
  render(section, ctx) {
    const cfg: ImageAccordionConfig = section.config || {};
    const panels = Array.isArray(cfg.panels) ? cfg.panels : [];
    const heading = cfg.heading
      ? `<h2 class="image-accordion__heading"${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2>`
      : '';
    const mobileFallback = cfg.mobile_fallback === 'cards' ? 'cards' : 'stack';
    const style = styleAttr([
      numberCssVar('--accordion-active', cfg.active_ratio ?? 2.5),
      numberCssVar('--accordion-idle', cfg.idle_ratio ?? 1),
      cssVar('--accordion-overlay-color', cfg.overlay_color || 'rgba(0,0,0,0.55)'),
      numberCssVar('--accordion-overlay-opacity', cfg.overlay_opacity ?? 1),
      cssVar('--accordion-reveal-duration', cfg.reveal_duration || '260ms'),
      cssVar('--accordion-hover-bg', cfg.interactions?.hover?.background),
      cssVar('--accordion-hover-color', cfg.interactions?.hover?.text),
      cssVar('--accordion-focus-color', cfg.interactions?.focus?.border || cfg.interactions?.focus?.text),
    ]);
    const renderedPanels = panels
      .map((panel, index) => renderImageAccordionPanel(panel, section, ctx, index))
      .join('');
    const empty = ctx.admin && panels.length === 0
      ? '<p class="ky-text-muted">No accordion panels yet — add panels via the editor.</p>'
      : '';
    const inner = `<div class="ky-container">${heading}<div class="image-accordion image-accordion--mobile-${escAttr(mobileFallback)}"${style}>${renderedPanels}${empty}</div></div>`;
    return adminWrap(section, ctx, inner, 'section section-image-accordion');
  },
};

const SHAPE_PRESETS: Record<string, string> = {
  wave: 'M0,64 C240,128 480,0 720,64 C960,128 1200,0 1440,64 L1440,120 L0,120 Z',
  tilt: 'M0,30 L1440,100 L1440,120 L0,120 Z',
  curve: 'M0,90 C360,0 1080,0 1440,90 L1440,120 L0,120 Z',
};

function renderShapeLayer(layer: ShapeDividerLayerConfig, fallbackPath: string, index: number): string {
  const path = sanitizeSvgPathData(layer.path || fallbackPath);
  if (!path) return '';
  const fill = safeCssValue(layer.fill || 'var(--shape-bottom-color)');
  const opacity = Number(layer.opacity);
  const opacityAttr = Number.isFinite(opacity) ? ` opacity="${Math.max(0, Math.min(1, opacity))}"` : '';
  const translate = safeCssValue(layer.translate_y != null ? `translate(0 ${layer.translate_y})` : '');
  const transformAttr = translate ? ` transform="${escAttr(translate)}"` : '';
  return `<path class="shape-divider__path shape-divider__path--${index}" d="${escAttr(path)}" fill="${escAttr(fill || 'currentColor')}"${opacityAttr}${transformAttr}></path>`;
}

const SHAPE_DIVIDER: BlockType = {
  label: 'Shape Divider',
  icon: '\u{3030}',
  dynamic: false,
  zoneHints: ['main'],
  supportedSpans: ['1'],
  fullBleed: true,
  defaultConfig: {
    preset: 'wave',
    path: '',
    view_box: '0 0 1440 120',
    top_color: 'var(--color-bg)',
    bottom_color: 'var(--color-primary)',
    placement: 'between',
    flip_x: false,
    flip_y: false,
    height: '96px',
    layers: [
      { fill: 'var(--shape-bottom-color)', opacity: 1 },
      { fill: 'var(--shape-top-color)', opacity: 0.35, translate_y: -18 },
    ],
  },
  render(section, ctx) {
    const cfg: ShapeDividerConfig = section.config || {};
    const presetPath = SHAPE_PRESETS[cfg.preset || 'wave'] || SHAPE_PRESETS.wave;
    const path = sanitizeSvgPathData(cfg.path || presetPath);
    if (!path) {
      const placeholder = ctx.admin
        ? '<div class="shape-divider__invalid">Invalid shape divider path</div>'
        : '';
      return adminWrap(section, ctx, placeholder, 'section section-shape-divider shape-divider shape-divider--invalid');
    }
    const viewBox = safeCssValue(cfg.view_box || '0 0 1440 120');
    const layers = Array.isArray(cfg.layers) && cfg.layers.length > 0
      ? cfg.layers
      : [{ fill: 'var(--shape-bottom-color)', opacity: 1 }];
    const paths = layers.map((layer, index) => renderShapeLayer(layer, path, index)).join('');
    const transforms = [
      cfg.flip_x ? 'scaleX(-1)' : '',
      cfg.flip_y ? 'scaleY(-1)' : '',
    ].filter(Boolean).join(' ');
    const style = styleAttr([
      cssVar('--shape-height', cfg.height || '96px'),
      cssVar('--shape-top-color', cfg.top_color || 'var(--color-bg)'),
      cssVar('--shape-bottom-color', cfg.bottom_color || 'var(--color-primary)'),
      transforms ? `--shape-transform:${transforms};` : '',
    ]);
    const placement = cfg.placement || 'between';
    const aria = ' aria-hidden="true"';
    const inner = `<div class="shape-divider__surface"${style} data-shape-placement="${escAttr(placement)}" data-top-color="${escAttr(cfg.top_color || 'var(--color-bg)')}" data-bottom-color="${escAttr(cfg.bottom_color || 'var(--color-primary)')}"><svg class="shape-divider__svg" viewBox="${escAttr(viewBox || '0 0 1440 120')}" preserveAspectRatio="none"${aria}>${paths}</svg></div>`;
    return adminWrap(section, ctx, inner, 'section section-shape-divider shape-divider');
  },
};

const EVENTS_LIST: BlockType = {
  label: 'Events List',
  icon: '\u{1F4C5}', // 📅
  dynamic: true,
  zoneHints: ['main'],
  defaultConfig: {
    heading: 'Upcoming Events',
    count: 4,
    filter: 'upcoming',
    layout: 'sidebar',
    show_image: false,
    show_location: true,
    show_time: true,
    color_scheme: 'primary',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const heading = cfg.heading
      ? `<h2 class="block-events-list__heading"${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2>`
      : '';
    const count = Math.max(1, Number(cfg.count) || 4);
    const layout = cfg.layout || 'sidebar';
    const skeletons = `<div class="block-events-list__skeleton block-events-list__skeleton--${escAttr(layout)}">${'<div class="event-skeleton-card skeleton"></div>'.repeat(count)}</div>`;
    const inner = `<div class="ky-container" data-block-hydrate="events_list" data-config="${jsonAttr(cfg)}">${heading}${skeletons}</div>`;
    const cls = `section section-events-list block-events-list block-events-list--${escAttr(layout)} block-events-list--${escAttr(cfg.color_scheme || 'primary')}`;
    return adminWrap(section, ctx, inner, cls);
  },
  async hydrate(el, section, ctx) {
    if (!ctx.isFeatureEnabled?.('feature_events')) {
      el.style.display = 'none';
      return;
    }
    const { hydrateEventsList } = await import('./block-hydrators.js');
    await hydrateEventsList(el, section, ctx);
  },
};

const EVENTS_CALENDAR: BlockType = {
  label: 'Events Calendar',
  icon: '\u{1F5D3}', // 🗓 spiral calendar pad — distinct from events_list (📅)
  dynamic: true,
  zoneHints: ['main'],
  // 1/3 column always falls through to agenda at runtime; the picker still
  // allows '1' (full) and '2/3' as desktop layouts.
  supportedSpans: ['1', '2/3', '1/2'],
  defaultConfig: {
    heading: 'Calendar',
    view: 'month',
    density: 'light',
    filter: 'all',
    first_day_of_week: 0,
    show_filter_chips: true,
    density_lock: false,
    agenda_show_empty_days: false,
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const heading = cfg.heading
      ? `<h2 class="block-events-calendar__heading"${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2>`
      : '';
    const view = (cfg.view as string) || 'month';
    const density = (cfg.density as string) || 'light';
    const skeleton = `<div class="block-events-calendar__skeleton">${'<div class="event-skeleton-card skeleton"></div>'.repeat(4)}</div>`;
    const inner = `<div class="ky-container" data-block-hydrate="events_calendar" data-config="${jsonAttr(cfg)}">${heading}${skeleton}</div>`;
    const cls = `section section-events-calendar block-events-calendar block-events-calendar--view-${escAttr(view)} block-events-calendar--density-${escAttr(density)}`;
    return adminWrap(section, ctx, inner, cls);
  },
  async hydrate(el, section, ctx) {
    if (!ctx.isFeatureEnabled?.('feature_events')) {
      el.style.display = 'none';
      return;
    }
    const { hydrateEventsCalendar } = await import('./block-hydrators.js');
    await hydrateEventsCalendar(el, section, ctx);
  },
};

const SLIDESHOW: BlockType = {
  label: 'Slideshow',
  icon: '\u{1F5BC}', // 🖼 (shared with banner; ok)
  dynamic: true,
  zoneHints: ['main'],
  defaultConfig: {
    heading: '',
    items: [
      { src: '', alt: 'Slide 1', caption: '', href: '' },
      { src: '', alt: 'Slide 2', caption: '', href: '' },
    ],
    auto_rotate_seconds: 5,
    show_arrows: true,
    show_dots: true,
    aspect_ratio: '16/9',
    height: '',
    mobile_height: '',
    fit: 'cover',
    transition: 'fade',
    transition_ms: 400,
    transition_easing: 'ease',
    pause_on_hover: true,
    pause_on_focus: true,
    manual_pause: false,
    arrow_style: {},
    dot_style: {},
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const items: any[] = Array.isArray(cfg.items) ? cfg.items : [];
    const heading = cfg.heading
      ? `<h2 class="block-slideshow__heading"${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2>`
      : '';
    if (!items.length) {
      // Empty: show a placeholder for admins, hide for visitors.
      const empty = ctx.admin
        ? `<div class="block-slideshow block-slideshow--empty"><p class="ky-text-muted">No slides yet — add some via the editor.</p></div>`
        : '';
      const inner = `<div class="ky-container">${heading}${empty}</div>`;
      return adminWrap(section, ctx, inner, 'section section-slideshow');
    }
    const aspect = cfg.aspect_ratio || '16/9';
    const fit = cfg.fit === 'contain' ? 'contain' : 'cover';
    const transition = cfg.transition === 'slide' ? 'slide' : 'fade';
    const slides = items
      .map((it, i) => {
        const isFirst = i === 0;
        const loading = isFirst ? 'eager' : 'lazy';
        const visible = isFirst ? ' is-active' : '';
        const slideFit = it.fit === 'contain' ? 'contain' : (it.fit === 'cover' ? 'cover' : fit);
        const imgStyle = styleAttr([
          cssVar('--slide-fit', slideFit),
          cssVar('--slide-position', it.object_position || cfg.object_position || 'center'),
        ]);
        const figcaption = it.caption
          ? `<figcaption class="block-slideshow__caption">${escHtml(it.caption)}</figcaption>`
          : '';
        const img = `<img src="${escAttr(it.src || '')}" alt="${escAttr(it.alt || '')}" loading="${loading}"${imgStyle}>`;
        const sources = [
          it.avif_src ? `<source srcset="${escAttr(it.avif_src)}" type="image/avif">` : '',
          it.webp_src ? `<source srcset="${escAttr(it.webp_src)}" type="image/webp">` : '',
        ].join('');
        const imgInner = sources ? `<picture>${sources}${img}</picture>` : img;
        const linked = it.href
          ? `<a href="${escAttr(cleanHref(it.href))}" class="block-slideshow__link">${imgInner}</a>`
          : imgInner;
        return `<figure class="block-slideshow__slide${visible}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${items.length}" data-slide-index="${i}">${linked}${figcaption}</figure>`;
      })
      .join('');
    const dots = cfg.show_dots !== false
      ? `<div class="block-slideshow__dots" role="tablist">${items
          .map(
            (_, i) =>
              `<button class="block-slideshow__dot${i === 0 ? ' is-active' : ''}" type="button" data-slide-go="${i}" aria-label="Slide ${i + 1} of ${items.length}"${i === 0 ? ' aria-current="true"' : ''}></button>`,
          )
          .join('')}</div>`
      : '';
    const arrows = cfg.show_arrows !== false
      ? `<button class="block-slideshow__arrow block-slideshow__arrow--prev" type="button" data-slide-prev aria-label="Previous slide">\u{2039}</button><button class="block-slideshow__arrow block-slideshow__arrow--next" type="button" data-slide-next aria-label="Next slide">\u{203A}</button>`
      : '';
    const liveRegion = `<div class="block-slideshow__live sr-only" aria-live="polite"></div>`;
    const ariaLabel = cfg.heading ? escAttr(cfg.heading) : 'Slideshow';
    const auto = Number(cfg.auto_rotate_seconds);
    const autoMs = Number.isFinite(auto) && auto > 0 ? Math.round(auto * 1000) : 0;
    const transitionMs = Number(cfg.transition_ms);
    const safeTransitionMs = Number.isFinite(transitionMs) && transitionMs >= 0 ? Math.round(transitionMs) : 400;
    const arrowStyle = cfg.arrow_style || {};
    const dotStyle = cfg.dot_style || {};
    const rootStyle = styleAttr([
      cssVar('--aspect', aspect),
      cssVar('--fit', fit),
      cssVar('--slideshow-height', cfg.height),
      cssVar('--slideshow-mobile-height', cfg.mobile_height),
      `${'--slideshow-transition-ms'}:${safeTransitionMs}ms;`,
      cssVar('--slideshow-transition-easing', cfg.transition_easing || 'ease'),
      cssVar('--slideshow-arrow-bg', arrowStyle.background),
      cssVar('--slideshow-arrow-color', arrowStyle.text || arrowStyle.icon),
      cssVar('--slideshow-arrow-hover-bg', arrowStyle.hover?.background),
      cssVar('--slideshow-arrow-hover-color', arrowStyle.hover?.text || arrowStyle.hover?.icon),
      cssVar('--slideshow-dot-bg', dotStyle.background),
      cssVar('--slideshow-dot-active-bg', dotStyle.active_background || dotStyle.hover?.background),
    ]);
    const pauseHover = cfg.pause_on_hover === false ? 'false' : 'true';
    const pauseFocus = cfg.pause_on_focus === false ? 'false' : 'true';
    const manualPause = cfg.manual_pause === true ? 'true' : 'false';
    const inner = `<div class="ky-container">${heading}<div class="block-slideshow block-slideshow--${escAttr(transition)}" tabindex="0" role="region" aria-roledescription="carousel" aria-label="${ariaLabel}" data-block-hydrate="slideshow" data-auto-ms="${autoMs}" data-fit="${escAttr(fit)}" data-pause-hover="${pauseHover}" data-pause-focus="${pauseFocus}" data-manual-pause="${manualPause}"${rootStyle}><div class="block-slideshow__track">${slides}</div>${arrows}${dots}${liveRegion}</div></div>`;
    return adminWrap(section, ctx, inner, 'section section-slideshow');
  },
  async hydrate(el, _section, _ctx) {
    const root = el.querySelector('[data-block-hydrate="slideshow"]') as HTMLElement | null;
    if (!root) return;
    if (root.dataset.hydrated === 'true') return;
    const { initSlideshow } = await import('./blocks/slideshow.js');
    initSlideshow(root);
  },
};

// --- Registry ---

import EMBED from './blocks/embed.js';
import SOCIAL_LINKS, { renderSocialLinksBlock } from './blocks/social-links.js';

export const BLOCK_TYPES: Record<string, BlockType> = {
  hero: HERO,
  features: FEATURES,
  cta: CTA,
  stats: STATS,
  testimonials: TESTIMONIALS,
  faq: FAQ,
  polls: POLLS,
  event_countdown: EVENT_COUNTDOWN,
  announcements_feed: ANNOUNCEMENTS_FEED,
  activity_feed: ACTIVITY_FEED,
  embed: EMBED,
  custom: CUSTOM,
  tagline_strip: TAGLINE_STRIP,
  page_banner: PAGE_BANNER,
  link_list: LINK_LIST,
  promo_cards: PROMO_CARDS,
  image_accordion: IMAGE_ACCORDION,
  shape_divider: SHAPE_DIVIDER,
  events_list: EVENTS_LIST,
  events_calendar: EVENTS_CALENDAR,
  slideshow: SLIDESHOW,
  social_links: SOCIAL_LINKS,
  nav: NAV,
  brand_header: BRAND_HEADER,
  sign_in_bar: SIGN_IN_BAR,
  site_search: SITE_SEARCH,
  footer_address: FOOTER_ADDRESS,
  footer_links: FOOTER_LINKS,
  footer_copyright: FOOTER_COPYRIGHT,
  footer_social: FOOTER_SOCIAL,
  footer_attribution: FOOTER_ATTRIBUTION,
};

const ALL_SPANS: ColumnSpan[] = ['1', '1/2', '1/3', '2/3'];

/** column-span-rows: legal spans for a registered block type. */
export function getSupportedSpans(type: string): ColumnSpan[] {
  return BLOCK_TYPES[type]?.supportedSpans ?? ALL_SPANS;
}

/**
 * column-span-rows: attach `data-column-span="<value>"` to the leading element
 * of a rendered block. Single edit point so individual BlockType.render
 * functions don't need to know about spans. The regex targets the first
 * opening tag in the string, allowing leading whitespace.
 *
 * Defensive: if the rendered HTML doesn't start with a tag (string content,
 * comment, etc.), the regex no-ops and the block renders without the
 * attribute. CSS `[data-column-span="1"]` selectors fall through to the
 * default full-width span via the universal CSS rules.
 */
export function applyColumnSpan(html: string, span: ColumnSpan): string {
  return html.replace(
    /^(\s*<[a-zA-Z][^>]*?)(\s*\/?\s*>)/,
    `$1 data-column-span="${span}"$2`,
  );
}

export function renderBlock(section: Section, ctx: BlockRenderContext): string {
  const type = BLOCK_TYPES[section.section_type];
  if (!type) {
    if (typeof console !== 'undefined') console.warn(`Unknown block type: ${section.section_type}`);
    return '';
  }
  if (section.visible === false) return '';
  const html = type.render(section, ctx);
  const span: ColumnSpan = section.column_span ?? '1';
  return applyColumnSpan(html, span);
}

export function renderZone(sections: Section[], zone: 'header' | 'main' | 'footer', ctx: BlockRenderContext): string {
  return sections
    .filter((s) => s.zone === zone)
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.position - b.position)
    .map((s) => renderBlock(s, ctx))
    .join('');
}

export function dynamicBlockTypes(): string[] {
  return Object.entries(BLOCK_TYPES)
    .filter(([, t]) => t.dynamic)
    .map(([name]) => name);
}
