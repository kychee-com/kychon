// blocks.ts — Block-type registry. The single isomorphic renderer that runs
// at Astro build time (Node) and at runtime (browser). Renderers return HTML
// strings. Dynamic blocks emit a skeleton at bake time and a per-type
// `hydrate(el, ctx)` is called with the `[data-block-hydrate]` host at runtime
// to fetch data and replace the body.

import { canonicalRouteKey, canonicalizeKychonHref, currentPageSlugFromLocation } from './clean-routes.js';
import {
  renderMarketingBlockHtml,
  renderPageBannerBlockHtml,
  renderPromoCardsBlockHtml,
  renderTaglineStripBlockHtml,
} from '@/components/kychon/MarketingBlocksView';
import { renderSlideshowBlockHtml, type SlideshowRenderItem } from '@/components/kychon/SlideshowBlockView';
import { renderEventsListStaticHtml, type EventsListEventRow } from '@/components/kychon/EventsListIsland';
import { renderAnnouncementsFeedStaticHtml } from '@/components/kychon/AnnouncementsFeedIsland';
import { renderEventsCalendarShellHtml } from '@/components/kychon/EventsCalendarBlockView';
import { renderNavBlockHtml, type NavBlockItem, type NavBlockStyle } from '@/components/kychon/NavBlockView';
import {
  renderImageAccordionBlockHtml,
  type ImageAccordionRenderPanel,
} from '@/components/kychon/ImageAccordionBlockView';
import {
  renderShapeDividerBlockHtml,
  type ShapeDividerRenderLayer,
} from '@/components/kychon/ShapeDividerBlockView';
import { constrainedContainerClass } from './ui/container.js';
import { richTextContentClass } from './ui/rich-text.js';
import { sanitizeRichHtmlServer } from './sanitize-html.js';
import { renderStaticLinkButtonHtml } from './static-link-button.js';
import { kychonImageHtml, kychonChromeImgAttrs, lookupAssetRef, pickSingleVariantUrl } from './kychon-image.js';
import {
  adminDragHandleHtml,
  adminNavEditButtonHtml,
  adminSectionActionsHtml,
  adminScopePillHtml,
  adminScopeToggleHtml,
  adminSectionEditButtonHtml,
  adminSectionRemoveButtonHtml,
} from './admin-action-controls.js';
import { normalizeSiteSearchConfig } from './site-search-config.js';
import { sectionShellFor } from './dom-structure.js';

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
  /**
   * Resolved asset manifest from @run402/astro@0.2's assetsDir build step.
   * When set, image emitters (hero foreground, promo_cards, slideshow, etc.)
   * look up `/assets/X.jpg` URLs and emit `<picture>` markup with v1.49
   * variants (320/800/1920 WebP ladder). Null/undefined when (a) the build
   * had no assetsDir configured (non-demo builds), (b) the renderer is
   * baking chrome at build time (chrome is logos sub-320 — single `<img>`
   * either way), or (c) the runtime hydrate's manifest fetch hasn't
   * completed yet. Misses fall back to a plain `<img>` referencing the
   * original URL.
   */
  manifest?: import('./kychon-image').AssetManifest | null;
  /**
   * Build-time event rows fetched via `@kychon/sdk` in
   * `src/lib/build-events.ts`, populated by pages that await
   * `ensureBuildEventsLoaded()` before calling `renderMainZone`. The
   * `EVENTS_LIST` block drains this per-block (filter + count) to emit
   * real `<EventCard>` HTML in the first paint instead of the empty
   * `data-block-hydrate` shell that today only fills in post-hydration.
   * Undefined at runtime and on pages that don't pre-fetch — the block
   * falls back to today's skeleton + client-fetch path.
   */
  buildEvents?: import('@/schemas/event').Event[] | null;
  /**
   * Build-time announcement rows — symmetric with `buildEvents`. Source:
   * `src/lib/build-announcements.ts:ensureBuildAnnouncementsLoaded`. The
   * `ANNOUNCEMENTS_FEED` block emits real announcement cards in the
   * first paint when this is populated; polls + per-user vote state
   * still arrive via the runtime hydrate (per-user, can't SSR with
   * anon key).
   */
  buildAnnouncements?: import('@/schemas/content').Announcement[] | null;
}

export interface BlockType {
  render: (section: Section, ctx: BlockRenderContext) => string;
  /** Runtime receives the concrete `[data-block-hydrate]` host, not a wrapper. */
  hydrate?: (el: HTMLElement, section: Section, ctx: BlockRenderContext) => Promise<void> | void;
  defaultConfig: Record<string, any>;
  label: string;
  icon: string;
  dynamic: boolean;
  zoneHints?: ('header' | 'main' | 'footer')[];
  /** Zones where only one visible instance of this block type should render. */
  singletonZones?: ('header' | 'main' | 'footer')[];
  /** column-span-rows: spans this block accepts; omit for "all four". */
  supportedSpans?: ColumnSpan[];
  /**
   * When true, the block opts out of the zone's constrained wrapper and
   * renders as a full-bleed sibling below it.
   * Used for blocks like `page_banner` that need 100% viewport width and
   * their own intrinsic vertical space — putting them inside the container
   * forces the chrome row (brand / nav / sign-in) to absorb the banner's
   * height, which is exactly the wrong layout.
   */
  fullBleed?: boolean;
  /**
   * admin-content-management: declares which editor UI the admin should see
   * when clicking the block's edit affordance.
   *
   * - `'inline'`: flat config — text/image fields are edited directly on the
   *   rendered block via `data-editable*` attributes. Default.
   * - `'list'`: config contains a top-level array of items — the
   *   `BlockListEditor` Popover is the editing surface.
   * - `'custom'`: bespoke editing UI (nav items editor, embed provider picker).
   */
  editorType?: 'inline' | 'list' | 'custom';
  /**
   * admin-content-management: dot-path strings identifying the text fields
   * eligible for per-locale translation. Used by `BlockTranslationEditor`
   * to render source/translation pairs and by `section_translations` to
   * scope the partial config persisted. Empty array (or omitted) = not
   * translatable (e.g. custom_html, embed, shape_divider, dynamic blocks
   * whose data lives in other tables with their own translation flow).
   *
   * Array notation: `'items[].title'` matches `config.items[*].title`.
   * Nested: `'columns[].items[].label'`.
   */
  translatableFields?: string[];
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

function constrainedContainerHtml(attrs = '', content = ''): string {
  return `<div class="${constrainedContainerClass}" data-layout-container${attrs}>${content}</div>`;
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
  /** Text color for the mobile/overflow menu surface. Defaults to the bar's
   *  link color (which pairs with mobile_menu_bg), so submenu items stay
   *  legible on a dark mobile panel instead of inheriting the desktop
   *  popover color. */
  mobile_menu_color?: string;
  mobile_menu_padding?: string;
  /** 'static' lets the header scroll with the page (copied-site source
   *  behavior parity); default is the sticky header. */
  header_position?: string;
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
  const pill = isGlobal ? adminScopePillHtml() : '';
  const toggleLabel = isGlobal ? 'Make page-only' : 'Make global';
  const toggleNext = isGlobal ? 'page' : 'global';
  return `${pill}${adminScopeToggleHtml(sid, toggleNext, toggleLabel)}`;
}

// column-span-rows: cog button that opens the per-block edit popover (span
// radio + scope toggle + remove). Rendered alongside the existing inline
// scope toggle / remove for back-compat — the popover is the primary
// surface but the inline buttons keep working.
function adminEditButton(section: Section, ctx: BlockRenderContext): string {
  if (!ctx.admin || section.id == null) return '';
  return adminSectionEditButtonHtml(section.id);
}

function adminWrap(section: Section, ctx: BlockRenderContext, inner: string, classes = ''): string {
  const sid = section.id;
  const sortable = sid != null
    ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"`
    : '';
  const zoneAttr = ` data-section-zone="${section.zone}"`;
  const scopeAttr = ` data-section-scope="${section.scope}"`;
  const classAttr = classes.trim() ? ` class="${escAttr(classes.trim())}"` : '';
  const cfgAttr = sid != null && ctx.admin
    ? ` data-editable-config="${jsonAttr(section.config || {})}"`
    : '';
  const adminCtrls = sid != null && ctx.admin
    ? adminSectionActionsHtml(`${adminEditButton(section, ctx)}${adminScopeControls(section, ctx)}${adminSectionRemoveButtonHtml(sid)}`)
    : '';
  const dragHandle = sid != null && ctx.admin ? adminDragHandleHtml() : '';
  return `<section data-section${classAttr}${sortable}${zoneAttr}${scopeAttr}${cfgAttr}>${dragHandle}${adminCtrls}${inner}</section>`;
}

function editableAttr(section: Section, path: string, ctx: BlockRenderContext): string {
  if (!ctx.admin || section.id == null) return '';
  return ` data-editable="sections.${section.id}.config.${path}"`;
}

function editablePath(section: Section, path: string, ctx: BlockRenderContext): string | undefined {
  if (!ctx.admin || section.id == null) return undefined;
  return `sections.${section.id}.config.${path}`;
}

function richEditableAttr(section: Section, path: string, ctx: BlockRenderContext): string {
  if (!ctx.admin || section.id == null) return '';
  return ` data-editable-rich="sections.${section.id}.config.${path}"`;
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

function renderShadcnLinkButton(
  section: Section,
  ctx: BlockRenderContext,
  href: unknown,
  text: unknown,
  editableConfigPath: string,
  dataAttrs: Record<`data-${string}`, string | number | boolean | undefined> = {},
): string {
  return renderStaticLinkButtonHtml({
    className: 'mt-2',
    dataAttrs,
    editablePath: editablePath(section, editableConfigPath, ctx),
    href: cleanHref(href, '#'),
    size: 'lg',
    text: String(text ?? ''),
  });
}

function renderBackgroundHero(section: Section, ctx: BlockRenderContext): string {
  const cfg = section.config || {};
  const sid = section.id;
  const heading = `<h1${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h1>`;
  const sub = `<p${editableAttr(section, 'subheading', ctx)}>${escHtml(cfg.subheading)}</p>`;
  const cta = cfg.cta_text
    ? renderShadcnLinkButton(section, ctx, cfg.cta_href, cfg.cta_text, 'cta_text', { 'data-hero-cta': true })
    : '';
  const inner = constrainedContainerHtml('', `${heading}${sub}${cta}`);
  const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
  const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
  const imgAttr = sid != null && ctx.admin ? ` data-editable-image="sections.${sid}.config.bg_image"` : '';
  // Manifest hit → swap the background-image URL to a CDN variant. CSS
  // `background-image: url(...)` can't host a responsive ladder, so we pick
  // the medium (800w) variant as the single source — small enough to keep
  // first-paint fast, large enough to avoid visible blur at typical hero
  // widths. Miss → keep the original `/assets/X.jpg` URL (admin uploads or
  // dev builds without an assetsDir, anything not in the manifest).
  const bgRef = cfg.bg_image ? lookupAssetRef(cfg.bg_image, ctx.manifest) : null;
  const rawBg = bgRef ? pickSingleVariantUrl(bgRef) : (cfg.bg_image as string | undefined);
  const safeBg = rawBg ? safeCssUrl(rawBg) : '';
  const styleAttr = safeBg ? ` style="background-image:url('${safeBg}')"` : '';
  const adminCtrls = sid != null && ctx.admin
    ? adminSectionActionsHtml(`${adminEditButton(section, ctx)}${adminSectionRemoveButtonHtml(sid)}`)
    : '';
  const dragHandle = sid != null && ctx.admin ? adminDragHandleHtml() : '';
  const bgImageAttr = safeBg ? ' data-hero-bg-image="true"' : '';
  return `<section data-section data-hero data-hero-mode="background"${bgImageAttr}${sortable}${cfgAttr}${imgAttr}${styleAttr}>${dragHandle}${adminCtrls}${inner}</section>`;
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
  // Hero foreground is the largest single image per page — biggest win from
  // the v1.49 variant ladder. `kychonImageHtml` emits `<picture>` with the
  // WebP srcset when the manifest carries variants for this URL, and
  // gracefully falls back to a plain `<img>` when not (admin-uploaded photos
  // post-deploy, dev builds without an assetsDir, the build-time chrome bake
  // running before the manifest fetch in page-render.ts).
  const pictureMarkup = imageUrl
    ? kychonImageHtml(
        imageUrl,
        imageAlt,
        {
          sizes: '100vw',
          priority: true,
          imgAttrs: ' decoding="async"',
          pictureAttrs: ` data-hero-picture data-hero-aspect="${escAttr(aspect)}"${imgAttr}`,
        },
        ctx.manifest,
      )
    : `<picture data-hero-picture data-hero-aspect="${escAttr(aspect)}"${imgAttr}></picture>`;

  // Logo overlay — small (max 120px tall), explicitly NOT a candidate for
  // variants (below the 320px encoder threshold). Keep the existing single
  // <img> emission; running it through kychonImageHtml would still emit a
  // single <img> for sub-320 sources, but the explicit max-height inline
  // style needs the imgAttrs splice which would be a bigger refactor.
  const logoMarkup = cfg.logo_overlay_url
    ? `<div data-hero-logo-overlay data-hero-position="${escAttr(logoPosition)}"><img src="${escAttr(cfg.logo_overlay_url)}" alt="" style="max-height:${escAttr(logoMaxHeight)}" /></div>`
    : '';

  const safeCaption = cfg.caption_html ? sanitizeCaptionHtml(cfg.caption_html) : '';
  const captionMarkup = safeCaption
    ? `<div data-hero-caption data-hero-position="${escAttr(captionPosition)}">${safeCaption}</div>`
    : '';

  const heading = cfg.heading
    ? `<h1${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h1>`
    : '';
  const sub = cfg.subheading
    ? `<p${editableAttr(section, 'subheading', ctx)}>${escHtml(cfg.subheading)}</p>`
    : '';
  const cta = cfg.cta_text
    ? renderShadcnLinkButton(section, ctx, cfg.cta_href, cfg.cta_text, 'cta_text', { 'data-hero-cta': true })
    : '';
  const headingGroup = heading || sub || cta
    ? `<div data-hero-text>${constrainedContainerHtml('', `${heading}${sub}${cta}`)}</div>`
    : '';

  const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
  const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
  const adminCtrls = sid != null && ctx.admin
    ? adminSectionActionsHtml(`${adminEditButton(section, ctx)}${adminSectionRemoveButtonHtml(sid)}`)
    : '';
  const dragHandle = sid != null && ctx.admin ? adminDragHandleHtml() : '';

  // Body order: picture first, then overlays/captions, then heading group.
  // For below_image, headingGroup falls below the picture in document order.
  const body = `${pictureMarkup}${logoMarkup}${captionMarkup}${headingGroup}`;

  return `<section data-section data-hero data-hero-mode="foreground" data-hero-text-position="${escAttr(textPosition)}"${sortable}${cfgAttr}>${dragHandle}${adminCtrls}${body}</section>`;
}

const HERO: BlockType = {
  label: 'Hero Banner',
  icon: '\u{1F3DE}',
  dynamic: false,
  editorType: 'inline',
  translatableFields: ['heading', 'subheading', 'cta_text'],
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
  editorType: 'list',
  translatableFields: ['items[].title', 'items[].desc'],
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2', '1/3', '2/3'],
  defaultConfig: {
    columns: 3,
    items: [{ icon: 'home', title: 'Feature 1', desc: 'Description' }],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    return adminWrap(
      section,
      ctx,
      renderMarketingBlockHtml('features', cfg, { editablePath: (path) => editablePath(section, path, ctx) }),
      'w-full py-12 sm:py-16',
    );
  },
};

const CTA: BlockType = {
  label: 'Call to Action',
  icon: '\u{1F4E2}',
  dynamic: false,
  editorType: 'inline',
  translatableFields: ['heading', 'text', 'cta_text'],
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
    return adminWrap(
      section,
      ctx,
      renderMarketingBlockHtml('cta', cfg, { editablePath: (path) => editablePath(section, path, ctx) }),
      'w-full py-12 sm:py-16',
    );
  },
};

const STATS: BlockType = {
  label: 'Stats',
  icon: '\u{1F4CA}',
  dynamic: false,
  editorType: 'inline',
  translatableFields: ['items[].label'],
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
    return adminWrap(
      section,
      ctx,
      renderMarketingBlockHtml('stats', cfg, { editablePath: (path) => editablePath(section, path, ctx) }),
      'w-full py-12 sm:py-16',
    );
  },
};

const TESTIMONIALS: BlockType = {
  label: 'Testimonials',
  icon: '\u{1F4AC}',
  dynamic: false,
  editorType: 'list',
  translatableFields: ['items[].name', 'items[].role', 'items[].text'],
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2', '1/3', '2/3'],
  defaultConfig: {
    items: [{ quote: 'Great community!', name: 'Member', role: '' }],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    return adminWrap(
      section,
      ctx,
      renderMarketingBlockHtml('testimonials', cfg, { editablePath: (path) => editablePath(section, path, ctx) }),
      'w-full py-12 sm:py-16',
    );
  },
};

const FAQ: BlockType = {
  label: 'FAQ',
  icon: '❓',
  dynamic: false,
  editorType: 'list',
  translatableFields: ['items[].question', 'items[].answer'],
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2'],
  defaultConfig: {
    items: [{ q: 'Question?', a: 'Answer here.' }],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    return adminWrap(
      section,
      ctx,
      renderMarketingBlockHtml('faq', cfg, { editablePath: (path) => editablePath(section, path, ctx) }),
      'w-full py-12 sm:py-16',
    );
  },
};

const POLLS: BlockType = {
  label: 'Polls',
  icon: '\u{1F4CA}',
  dynamic: true,
  editorType: 'inline',
  translatableFields: [],
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2'],
  defaultConfig: { heading: '', poll_ids: [] },
  render(section, ctx) {
    const cfg = section.config || {};
    return adminWrap(
      section,
      ctx,
      constrainedContainerHtml(` data-block-hydrate="polls" data-config="${jsonAttr(cfg)}"`),
      'w-full py-8',
    );
  },
  async hydrate(el, section, ctx) {
    if (el.getAttribute('data-block-hydrate') !== 'polls') return;
    const shell = sectionShellFor(el);
    if (!ctx.isFeatureEnabled?.('feature_polls')) {
      shell.hidden = true;
      return;
    }
    let cfg: Record<string, unknown> = section.config || {};
    try {
      cfg = { ...cfg, ...JSON.parse(el.getAttribute('data-config') || '{}') };
    } catch {}
    const { mountPollsBlockIsland } = await import('@/components/kychon/PollsBlockIsland');
    mountPollsBlockIsland(el, {
      config: cfg,
      headingEditablePath: ctx.admin && section.id != null ? `sections.${section.id}.config.heading` : undefined,
    });
    el.dataset.hydrated = 'true';
  },
};

const EVENT_COUNTDOWN: BlockType = {
  label: 'Event Countdown',
  icon: '⏱️',
  dynamic: true,
  editorType: 'inline',
  translatableFields: [],
  zoneHints: ['main'],
  supportedSpans: ['1', '1/3', '1/2'],
  defaultConfig: { heading: 'Next Event' },
  render(section, ctx) {
    const cfg = section.config || {};
    return adminWrap(
      section,
      ctx,
      constrainedContainerHtml(` data-block-hydrate="event_countdown" data-config="${jsonAttr(cfg)}"`),
      'w-full py-8',
    );
  },
  async hydrate(el, section, ctx) {
    if (el.getAttribute('data-block-hydrate') !== 'event_countdown') return;
    const shell = sectionShellFor(el);
    if (!ctx.isFeatureEnabled?.('feature_events')) {
      shell.hidden = true;
      return;
    }
    let cfg: Record<string, unknown> = section.config || {};
    try {
      cfg = { ...cfg, ...JSON.parse(el.getAttribute('data-config') || '{}') };
    } catch {}
    const { mountEventCountdownIsland } = await import('@/components/kychon/EventCountdownIsland');
    mountEventCountdownIsland(el, {
      config: cfg,
      headingEditablePath: ctx.admin && section.id != null ? `sections.${section.id}.config.heading` : undefined,
    });
    el.dataset.hydrated = 'true';
  },
};

const ANNOUNCEMENTS_FEED: BlockType = {
  label: 'Announcements',
  icon: '\u{1F4E3}',
  dynamic: true,
  editorType: 'inline',
  translatableFields: [],
  zoneHints: ['main'],
  supportedSpans: ['1', '2/3'],
  defaultConfig: { heading: 'Announcements', limit: 20 },
  render(section, ctx) {
    const cfg = section.config || {};
    // Symmetric with EVENTS_LIST.render: when build-time announcements
    // are cached, emit real `<AnnouncementCard>` HTML and stash the
    // pre-loaded rows in `data-announcements-payload` so the React
    // hydrator can hand them to `useState` as `initialAnnouncements`
    // (first React render matches SSR → no skeleton flash, no
    // destructive create-root replace). Polls + per-user votes still
    // arrive via the runtime refresh in `useEffect`.
    const ssrAnnouncements = ctx.buildAnnouncements
      ? selectBuildAnnouncements(ctx.buildAnnouncements, cfg)
      : null;
    if (ssrAnnouncements) {
      const ssrHtml = renderAnnouncementsFeedStaticHtml({
        announcements: ssrAnnouncements,
        config: cfg,
      });
      const inner = constrainedContainerHtml(
        ` data-block-hydrate="announcements_feed" data-config="${jsonAttr(cfg)}" data-announcements-payload="${jsonAttr(ssrAnnouncements)}"`,
        ssrHtml,
      );
      return adminWrap(section, ctx, inner, 'w-full py-8');
    }
    return adminWrap(
      section,
      ctx,
      constrainedContainerHtml(` data-block-hydrate="announcements_feed" data-config="${jsonAttr(cfg)}"`),
      'w-full py-8',
    );
  },
  async hydrate(el, section, ctx) {
    const { hydrateAnnouncementsFeed } = await import('./block-hydrators.js');
    await hydrateAnnouncementsFeed(el, section, ctx);
  },
};

/**
 * Slice the build-time announcements cache per a single block's `limit`
 * config. Mirrors the runtime `getAnnouncements(...&limit=N)` query;
 * the cache is already ordered (pinned-first, then newest) by the
 * `announcements.list` capability, so we just truncate.
 */
function selectBuildAnnouncements(
  cache: NonNullable<BlockRenderContext['buildAnnouncements']>,
  cfg: Record<string, unknown>,
): import('@/schemas/content').Announcement[] | null {
  if (!Array.isArray(cache) || cache.length === 0) return null;
  const raw = Number(cfg.limit);
  const limit = Math.max(1, Math.min(100, Number.isFinite(raw) ? Math.floor(raw) : 20));
  return cache.slice(0, limit);
}

const ACTIVITY_FEED: BlockType = {
  label: 'Activity Feed',
  icon: '\u{1F4DD}',
  dynamic: true,
  editorType: 'inline',
  translatableFields: [],
  zoneHints: ['main'],
  supportedSpans: ['1', '1/3', '2/3'],
  defaultConfig: { heading: 'Recent Activity', limit: 15 },
  render(section, ctx) {
    if (!ctx.isFeatureEnabled?.('feature_activity_feed')) return '';
    const cfg = section.config || {};
    const heading = cfg.heading
      ? `<h2${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2>`
      : '';
    return adminWrap(
      section,
      ctx,
      constrainedContainerHtml(' data-block-hydrate="activity_feed"', heading),
      '',
    );
  },
  async hydrate(el, section, ctx) {
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

function navBlockItem(item: NavItem, ctx: BlockRenderContext, path: string, topLevel: boolean): NavBlockItem {
  const hasKids = Array.isArray(item.children) && item.children.length > 0
    && item.children.some((c) => navItemVisible(c, ctx));
  const children = hasKids
    ? item.children!.filter((child) => navItemVisible(child, ctx)).map((child, index) => navBlockItem(child, ctx, `${path}-${index}`, false))
    : [];

  return {
    active: navItemActive(item, ctx),
    children,
    hasHref: !!item.href,
    href: cleanHref(item.href, topLevel ? '' : '#'),
    label: item.label,
    menuId: children.length ? navMenuId(item, path) : undefined,
  };
}

function setNavStyle(style: NavBlockStyle, name: `--${string}`, value: unknown): void {
  const safe = safeCssValue(value);
  if (safe) style[name] = safe;
}

function renderNavPresentationProps(cfg: NavConfig): {
  desktopOpen?: string;
  mobileBreakpoint?: number | null;
  mobileClosedLayout?: string;
  mobileOpenLayout?: string;
  presentationStyle?: NavBlockStyle;
  useFullRow?: boolean;
} {
  const p = cfg.presentation || {};
  const b = cfg.behavior || {};
  const i = cfg.interactions || {};
  const hover = i.hover || {};
  const focus = i.focus || {};
  const style = {} as NavBlockStyle;
  setNavStyle(style, '--nav-link-color', p.link_color);
  setNavStyle(style, '--nav-link-hover-bg', p.link_hover_bg || hover.background);
  setNavStyle(style, '--nav-link-hover-color', p.link_hover_color || hover.text);
  setNavStyle(style, '--nav-link-active-bg', p.link_active_bg);
  setNavStyle(style, '--nav-link-active-color', p.link_active_color);
  setNavStyle(style, '--nav-link-padding', p.link_padding);
  setNavStyle(style, '--nav-link-radius', p.link_radius);
  setNavStyle(style, '--nav-link-gap', p.link_gap);
  setNavStyle(style, '--nav-link-font-family', p.font_family);
  setNavStyle(style, '--nav-link-font-size', p.font_size);
  setNavStyle(style, '--nav-link-font-weight', p.font_weight);
  setNavStyle(style, '--nav-links-bg', p.surface_bg);
  setNavStyle(style, '--nav-links-padding', p.surface_padding);
  setNavStyle(style, '--nav-links-radius', p.surface_radius);
  setNavStyle(style, '--nav-links-shadow', p.surface_shadow);
  setNavStyle(style, '--nav-links-wrap', p.wrap);
  setNavStyle(style, '--nav-dropdown-bg', p.dropdown_bg);
  setNavStyle(style, '--nav-dropdown-color', p.dropdown_color);
  setNavStyle(style, '--nav-dropdown-hover-bg', p.dropdown_hover_bg || hover.background);
  setNavStyle(style, '--nav-dropdown-hover-color', p.dropdown_hover_color || hover.text);
  setNavStyle(style, '--nav-dropdown-border', p.dropdown_border);
  setNavStyle(style, '--nav-dropdown-shadow', p.dropdown_shadow);
  setNavStyle(style, '--nav-dropdown-width', p.dropdown_width);
  setNavStyle(style, '--nav-dropdown-offset-x', p.dropdown_offset_x);
  setNavStyle(style, '--nav-dropdown-offset-y', p.dropdown_offset_y);
  setNavStyle(style, '--nav-chevron-color', p.chevron_color || hover.icon);
  setNavStyle(style, '--nav-focus-color', focus.border || focus.text);
  setNavStyle(style, '--nav-transition', p.transition || hover.duration);
  setNavStyle(style, '--nav-mobile-menu-bg', p.mobile_menu_bg);
  setNavStyle(style, '--nav-mobile-menu-color', p.mobile_menu_color);
  setNavStyle(style, '--nav-mobile-menu-padding', p.mobile_menu_padding);
  setNavStyle(style, '--nav-header-position', p.header_position);

  let mobileBreakpoint: number | null = null;
  if (b.mobile_breakpoint != null) {
    const n = Number(b.mobile_breakpoint);
    if (Number.isFinite(n) && n > 0) mobileBreakpoint = Math.round(n);
  }

  return {
    desktopOpen: b.desktop_open,
    mobileBreakpoint,
    mobileClosedLayout: b.mobile_closed_layout,
    mobileOpenLayout: b.mobile_open_layout,
    presentationStyle: Object.keys(style).length ? style : undefined,
    useFullRow: p.full_row === true,
  };
}

const NAV: BlockType = {
  label: 'Navigation',
  icon: '\u{1F9ED}',
  dynamic: false,
  editorType: 'custom',
  translatableFields: ['items[].label', 'items[].children[].label'],
  zoneHints: ['header'],
  singletonZones: ['header'],
  supportedSpans: ['1'],
  defaultConfig: {
    items: [
      { label: 'Home', href: '/', icon: 'home', public: true },
    ],
  },
  render(section, ctx) {
    const cfg: NavConfig = section.config || {};
    const items: NavItem[] = cfg.items || [];
    const sid = section.id;
    const adminEditBtn = sid != null && ctx.admin
      ? adminNavEditButtonHtml(sid)
      : '';
    const navHtml = renderNavBlockHtml({
      ...renderNavPresentationProps(cfg),
      blockId: sid != null && ctx.admin ? sid : null,
      items: items
        .filter((item) => navItemVisible(item, ctx))
        .map((item, index) => navBlockItem(item, ctx, `top-${index}`, true)),
    });
    return `${navHtml}${adminEditBtn}`;
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
  editorType: 'inline',
  translatableFields: [],
  zoneHints: ['header'],
  singletonZones: ['header'],
  supportedSpans: ['1'],
  defaultConfig: {
    href: '/',
    brand_header_mode: 'auto',
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

    // Chrome image attrs (width/height + LQIP background-image) from the
    // manifest — closes the CLS gap on the nav row when the logo PNG loads.
    const iconChromeAttrs = iconUrl ? kychonChromeImgAttrs(iconUrl, ctx.manifest) : '';
    const wordmarkChromeAttrs = wordmarkUrl ? kychonChromeImgAttrs(wordmarkUrl, ctx.manifest) : '';

    // brand_header_mode (#106): an explicit `wordmark` / `icon` / `auto` choice
    // so a ported site can show its wordmark while still setting a favicon/icon.
    // `auto` (default) keeps the historical icon → wordmark → text priority; a
    // requested mode whose asset is missing falls back to that same priority.
    const mode = typeof cfg.brand_header_mode === 'string' ? cfg.brand_header_mode.trim() : 'auto';

    const renderIcon = () => {
      // Mode 1: icon + text. Short text swaps in via CSS at narrow viewports.
      const shortSpan = brandTextShort
        ? `<span data-brand-text-short${editableTextShort}>${escHtml(brandTextShort)}</span>`
        : '';
      const subtitleSpan = brandSubtitle
        ? `<span data-brand-subtitle>${escHtml(brandSubtitle)}</span>`
        : '';
      return `<a href="${escAttr(href)}" data-nav-brand data-brand-mode="icon" aria-label="${escAttr(brandText)}"><img data-brand-icon src="${escAttr(iconUrl)}" alt=""${iconChromeAttrs}${editableIcon}><span data-brand-copy><span data-brand-text><span data-brand-text-full${editableText}>${escHtml(brandText)}</span>${shortSpan}</span>${subtitleSpan}</span></a>`;
    };
    // Mode 2: wordmark alone — the image already contains the org name, so no
    // separate text element is rendered.
    const renderWordmark = () =>
      `<a href="${escAttr(href)}" data-nav-brand data-brand-mode="wordmark" aria-label="${escAttr(brandText)}"><img data-brand-wordmark src="${escAttr(wordmarkUrl)}" alt="${escAttr(brandText)}"${wordmarkChromeAttrs}${editableWordmark}></a>`;
    // Mode 3: text fallback (equivalent to today's logo_url=NULL behavior).
    const renderText = () =>
      `<a href="${escAttr(href)}" data-nav-brand data-brand-mode="text"${editableText}>${escHtml(brandText)}</a>`;

    if (mode === 'wordmark' && wordmarkUrl) return renderWordmark();
    if (mode === 'icon' && iconUrl) return renderIcon();
    if (iconUrl) return renderIcon();
    if (wordmarkUrl) return renderWordmark();
    return renderText();
  },
};

const SIGN_IN_BAR: BlockType = {
  label: 'Sign-in Bar',
  icon: '\u{1F511}',
  dynamic: true,
  editorType: 'inline',
  translatableFields: [],
  zoneHints: ['header'],
  singletonZones: ['header'],
  supportedSpans: ['1'],
  defaultConfig: { show_lang_toggle: true, show_theme_toggle: true },
  render(_section, _ctx) {
    return `<div id="nav-user" data-block-hydrate="sign_in_bar" data-nav-user></div>`;
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
  editorType: 'inline',
  translatableFields: [],
  zoneHints: ['header', 'main'],
  singletonZones: ['header'],
  supportedSpans: ['1', '1/2', '1/3'],
  defaultConfig: {
    placeholder: 'Search this site',
    submit_label: 'Search',
    destination: '/search',
    compact: true,
    default_type: 'all',
  },
  render(section, ctx) {
    const config = normalizeSiteSearchConfig(section.config || {});
    const cfgAttr = ` data-config="${jsonAttr({
      compact: config.compact,
      default_type: config.defaultType,
      destination: config.destination,
      min_chars: config.minChars,
      mode: config.mode,
      placeholder: config.placeholder,
      presentation: config.presentation,
      submit_label: config.submitLabel,
    })}"`;
    const inner = `<div data-block-hydrate="site_search" data-site-search-root${cfgAttr}></div>`;
    const headerClasses = config.mode === 'header_icon'
      ? 'col-[4] row-[1] flex w-9 justify-self-end py-0'
      : 'col-[4] row-[1] flex w-full min-w-0 max-w-md justify-self-end py-0 sm:max-w-[18rem]';
    const classes = section.zone === 'header' ? headerClasses : 'w-full py-1';
    return adminWrap(section, ctx, inner, classes);
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
  editorType: 'inline',
  translatableFields: ['name', 'street', 'city', 'phone', 'email'],
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
      ? `<div data-footer-org-name${editableAttr(section, 'name', ctx)}>${escHtml(cfg.name)}</div>`
      : '';
    const lines = (cfg.address_lines || [])
      .map((line: string, i: number) => `<div${editableAttr(section, `address_lines.${i}`, ctx)}>${escHtml(line)}</div>`)
      .join('');
    const phone = cfg.phone
      ? `<div data-footer-phone><a href="tel:${escAttr(cfg.phone)}"${editableAttr(section, 'phone', ctx)}>${escHtml(cfg.phone)}</a></div>`
      : '';
    const email = cfg.email
      ? `<div data-footer-email><a href="mailto:${escAttr(cfg.email)}"${editableAttr(section, 'email', ctx)}>${escHtml(cfg.email)}</a></div>`
      : '';
    const hours = cfg.hours
      ? `<div data-footer-hours${editableAttr(section, 'hours', ctx)}>${escHtml(cfg.hours)}</div>`
      : '';
    const sid = section.id;
    const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
    const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
    const dragHandle = sid != null && ctx.admin ? adminDragHandleHtml() : '';
    return `<div data-footer-block data-footer-address${sortable}${cfgAttr}>${dragHandle}${name}${lines}${phone}${email}${hours}</div>`;
  },
};

const FOOTER_LINKS: BlockType = {
  label: 'Footer Links',
  icon: '\u{1F517}',
  dynamic: false,
  editorType: 'list',
  translatableFields: ['columns[].heading', 'columns[].items[].label'],
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
          return `<div data-footer-links-col><h4${editableAttr(section, `columns.${ci}.heading`, ctx)}>${escHtml(col.heading)}</h4><ul>${items}</ul></div>`;
        },
      )
      .join('');
    const sid = section.id;
    const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
    const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
    const dragHandle = sid != null && ctx.admin ? adminDragHandleHtml() : '';
    return `<div data-footer-block data-footer-links${sortable}${cfgAttr}>${dragHandle}${cols}</div>`;
  },
};

const FOOTER_COPYRIGHT: BlockType = {
  label: 'Copyright',
  icon: '©',
  dynamic: false,
  editorType: 'inline',
  translatableFields: ['text', 'admin_contact_label'],
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
    const dragHandle = sid != null && ctx.admin ? adminDragHandleHtml() : '';
    return `<div data-footer-block data-footer-copyright${sortable}${cfgAttr}>${dragHandle}&copy; ${year}${orgName ? ' ' + orgName : ''}${adminContact}</div>`;
  },
};

const FOOTER_SOCIAL: BlockType = {
  label: 'Social Links',
  icon: '\u{1F310}',
  dynamic: false,
  editorType: 'list',
  translatableFields: [],
  zoneHints: ['footer'],
  supportedSpans: ['1', '1/3'],
  defaultConfig: { icons: [] },
  render(section, ctx) {
    return renderSocialLinksBlock(section, ctx, {
      legacyFooter: true,
    });
  },
};

const FOOTER_ATTRIBUTION: BlockType = {
  label: 'Attribution',
  icon: '✨',
  dynamic: false,
  editorType: 'inline',
  translatableFields: ['text'],
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
    const dragHandle = sid != null && ctx.admin ? adminDragHandleHtml() : '';
    return `<div data-footer-block data-footer-attribution${sortable}${cfgAttr}>${dragHandle}<p${editText}>${renderMarkdownLine(text)}</p></div>`;
  },
};

const CUSTOM: BlockType = {
  label: 'Custom HTML',
  icon: '\u{1F9F1}',
  dynamic: false,
  editorType: 'inline',
  translatableFields: [],
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2', '1/3', '2/3'],
  defaultConfig: { html: '<p>Custom HTML</p>' },
  render(section, ctx) {
    const cfg = section.config || {};
    const richEdit = richEditableAttr(section, 'html', ctx);
    const richContent = `<div class="${richTextContentClass}"${richEdit}>${sanitizeRichHtmlServer(cfg.html || '')}</div>`;
    const inner = constrainedContainerHtml('', richContent);
    return adminWrap(section, ctx, inner);
  },
};

// --- Catalog blocks (block-types-catalog) ---

const TAGLINE_STRIP: BlockType = {
  label: 'Tagline Strip',
  editorType: 'inline',
  translatableFields: ['text'],
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
    const inner = renderTaglineStripBlockHtml(cfg, {
      editablePath(path) {
        return editablePath(section, path, ctx);
      },
    });
    return adminWrap(section, ctx, inner, 'w-full p-0');
  },
};

const PAGE_BANNER: BlockType = {
  label: 'Page Banner',
  editorType: 'inline',
  translatableFields: ['heading', 'subheading'],
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
    const safeOverlay = cfg.overlay_color ? safeCssValue(cfg.overlay_color) : '';
    const safeImageUrl = cfg.image_url ? safeCssUrl(cfg.image_url) : '';
    const safeCaption = sanitizeCaptionHtml(String(cfg.caption_html || ''));
    const inner = renderPageBannerBlockHtml(cfg, {
      captionHtml: safeCaption,
      imageEditablePath: ctx.admin && section.id != null
        ? `sections.${section.id}.config.image_url`
        : undefined,
      imageUrl: safeImageUrl,
      manifest: ctx.manifest,
      overlayColor: safeOverlay,
    });
    return adminWrap(section, ctx, inner, 'w-full p-0');
  },
};

const LINK_LIST: BlockType = {
  label: 'Link List',
  editorType: 'list',
  translatableFields: [],
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
    const inner = constrainedContainerHtml(` data-block-hydrate="link_list" data-config="${jsonAttr(cfg)}"`);
    return adminWrap(section, ctx, inner, 'w-full py-8 has-[[data-link-list-empty=true]]:hidden');
  },
  async hydrate(el, section, ctx) {
    const { hydrateLinkListResources } = await import('./block-hydrators.js');
    await hydrateLinkListResources(el, section, ctx);
  },
};

const PROMO_CARDS: BlockType = {
  label: 'Promo Cards',
  editorType: 'list',
  translatableFields: ['cards[].tag', 'cards[].title', 'cards[].description'],
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
    const inner = renderPromoCardsBlockHtml(cfg, {
      editableImagePath(index) {
        return ctx.admin && section.id != null
          ? `sections.${section.id}.config.items.${index}.image_url`
          : undefined;
      },
      editablePath(path) {
        return editablePath(section, path, ctx);
      },
      manifest: ctx.manifest,
      sanitizeCssValue(value) {
        return safeCssValue(value);
      },
    });
    return adminWrap(section, ctx, inner, 'w-full');
  },
};

const IMAGE_ACCORDION: BlockType = {
  label: 'Image Accordion',
  icon: '\u{1F5BC}',
  dynamic: false,
  editorType: 'list',
  translatableFields: ['panels[].title', 'panels[].description', 'panels[].cta_label'],
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
    const mobileFallback = cfg.mobile_fallback === 'cards' ? 'cards' : 'stack';
    const numericStyle = (fallback: number, value: any) => {
      const n = Number(value ?? fallback);
      return Number.isFinite(n) ? String(n) : String(fallback);
    };
    const rootStyle: Record<string, string> = {
      '--accordion-active': numericStyle(2.5, cfg.active_ratio),
      '--accordion-idle': numericStyle(1, cfg.idle_ratio),
      '--accordion-overlay-color': safeCssValue(cfg.overlay_color || 'rgba(0,0,0,0.55)') || 'rgba(0,0,0,0.55)',
      '--accordion-overlay-opacity': numericStyle(1, cfg.overlay_opacity),
      '--accordion-reveal-duration': safeCssValue(cfg.reveal_duration || '260ms') || '260ms',
      '--accordion-hover-color': safeCssValue(cfg.interactions?.hover?.text) || '#fff',
      '--accordion-focus-color': safeCssValue(cfg.interactions?.focus?.border || cfg.interactions?.focus?.text)
        || 'var(--interaction-focus-color,var(--color-primary))',
    };
    const renderPanels: ImageAccordionRenderPanel[] = panels.map((panel, index) => {
      const objectFit = panel.fit === 'contain' ? 'contain' : 'cover';
      const hoverColor = safeCssValue(panel.interactions?.hover?.text) || rootStyle['--accordion-hover-color'];
      const focusColor = safeCssValue(panel.interactions?.focus?.border || panel.interactions?.focus?.text)
        || rootStyle['--accordion-focus-color'];
      return {
        ctaEditablePath: editablePath(section, `panels.${index}.cta_label`, ctx),
        ctaLabel: panel.cta_label ? String(panel.cta_label) : '',
        description: panel.description ? String(panel.description) : '',
        descriptionEditablePath: editablePath(section, `panels.${index}.description`, ctx),
        href: panel.href ? cleanHref(panel.href) : undefined,
        imageAlt: String(panel.image_alt || ''),
        imageEditablePath: ctx.admin && section.id != null
          ? `sections.${section.id}.config.panels.${index}.image_url`
          : undefined,
        imageUrl: panel.image_url ? String(panel.image_url) : '',
        objectFit,
        objectPosition: safeCssValue(panel.object_position || 'center') || 'center',
        panelStyle: {
          '--accordion-panel-hover-color': hoverColor,
          '--accordion-panel-focus-color': focusColor,
          '--accordion-panel-position': safeCssValue(panel.object_position || 'center') || 'center',
          '--accordion-panel-fit': objectFit,
        },
        title: panel.title ? String(panel.title) : '',
        titleEditablePath: editablePath(section, `panels.${index}.title`, ctx),
      };
    });
    const inner = renderImageAccordionBlockHtml({
      editableHeadingPath: editablePath(section, 'heading', ctx),
      heading: cfg.heading ? String(cfg.heading) : '',
      manifest: ctx.manifest,
      mobileFallback,
      panels: renderPanels,
      rootStyle,
      showEmptyPlaceholder: ctx.admin,
    });
    return adminWrap(section, ctx, inner, 'w-full py-8');
  },
};

// feature_panels (#124): the recurring association-homepage "coordinated panels"
// source pattern as structured config — image + heading + body + optional CTA per
// panel, in a responsive grid. Replaces the custom-HTML workaround that degraded
// to stacked prose; the sanitizer is untouched (no looser HTML mode).
const FEATURE_PANELS: BlockType = {
  label: 'Feature Panels',
  icon: '\u{1F5C2}',
  dynamic: false,
  editorType: 'list',
  translatableFields: ['heading', 'panels[].heading', 'panels[].body', 'panels[].cta_label'],
  zoneHints: ['main'],
  supportedSpans: ['1', '2/3', '1/2'],
  defaultConfig: {
    heading: '',
    panels: [
      { image_url: '', image_alt: '', heading: 'Panel 1', body: 'Add source text.', cta_label: '', cta_href: '', fit: 'cover', object_position: 'center' },
      { image_url: '', image_alt: '', heading: 'Panel 2', body: 'Add source text.', cta_label: '', cta_href: '', fit: 'cover', object_position: 'center' },
      { image_url: '', image_alt: '', heading: 'Panel 3', body: 'Add source text.', cta_label: '', cta_href: '', fit: 'cover', object_position: 'center' },
    ],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const panels = Array.isArray(cfg.panels) ? cfg.panels : [];
    const editableAttr = (path: string | undefined) => (path ? ` data-editable="${escAttr(path)}"` : '');

    const headingText = typeof cfg.heading === 'string' ? cfg.heading.trim() : '';
    const headingHtml =
      headingText || ctx.admin
        ? `<h2 data-feature-panels-heading class="mb-6 text-2xl font-medium"${editableAttr(editablePath(section, 'heading', ctx))}>${escHtml(headingText)}</h2>`
        : '';

    const panelsHtml = panels
      .map((panel, index) => {
        const p = panel || {};
        const imageUrl = typeof p.image_url === 'string' ? p.image_url.trim() : '';
        const fit = p.fit === 'contain' ? 'contain' : 'cover';
        const position = safeCssValue(p.object_position || 'center') || 'center';
        const imageEdit =
          ctx.admin && section.id != null ? `sections.${section.id}.config.panels.${index}.image_url` : undefined;
        const image =
          imageUrl || ctx.admin
            ? `<img data-feature-panel-image src="${escAttr(imageUrl)}" alt="${escAttr(p.image_alt || '')}" loading="lazy" decoding="async" class="aspect-[4/3] w-full bg-muted" style="object-fit:${fit};object-position:${position}"${imageEdit ? ` data-editable-image="${escAttr(imageEdit)}"` : ''}>`
            : '';
        const headingField =
          p.heading || ctx.admin
            ? `<h3 data-feature-panel-heading class="text-lg font-medium"${editableAttr(editablePath(section, `panels.${index}.heading`, ctx))}>${escHtml(p.heading || '')}</h3>`
            : '';
        const body =
          p.body || ctx.admin
            ? `<p data-feature-panel-body class="text-sm leading-relaxed text-muted-foreground"${editableAttr(editablePath(section, `panels.${index}.body`, ctx))}>${escHtml(p.body || '')}</p>`
            : '';
        const ctaLabel = typeof p.cta_label === 'string' ? p.cta_label.trim() : '';
        const cta =
          ctaLabel || ctx.admin
            ? `<a data-feature-panel-cta class="mt-auto inline-flex w-fit pt-1 text-sm font-medium text-primary hover:underline" href="${escAttr(cleanHref(p.cta_href) || '#')}"${editableAttr(editablePath(section, `panels.${index}.cta_label`, ctx))}>${escHtml(ctaLabel)}</a>`
            : '';
        return `<article data-feature-panel class="flex flex-col overflow-hidden rounded-lg border border-border bg-card">${image}<div data-feature-panel-copy class="flex flex-1 flex-col gap-2 p-4">${headingField}${body}${cta}</div></article>`;
      })
      .join('');

    const grid = `<div data-feature-panels-grid class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${panelsHtml}</div>`;
    const inner = `<div data-feature-panels class="mx-auto max-w-5xl px-4">${headingHtml}${grid}</div>`;
    return adminWrap(section, ctx, inner, 'w-full py-8');
  },
};

// menu (#123): restaurant/bar menus carried by copied club sites as structured
// data — ordered sections, each with ordered items { name, description, price,
// dietary_tags } — so a price edit is structured config, not raw HTML.
const MENU: BlockType = {
  label: 'Menu',
  icon: '\u{1F37D}',
  dynamic: false,
  editorType: 'list',
  translatableFields: ['heading', 'sections[].name', 'sections[].items[].name', 'sections[].items[].description'],
  zoneHints: ['main'],
  supportedSpans: ['1', '2/3', '1/2'],
  defaultConfig: {
    heading: '',
    sections: [
      {
        name: 'Starters',
        items: [{ name: 'Soup of the day', description: '', price: '', dietary_tags: [] }],
      },
    ],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const sections = Array.isArray(cfg.sections) ? cfg.sections : [];
    const editableAttr = (path: string | undefined) => (path ? ` data-editable="${escAttr(path)}"` : '');

    const headingText = typeof cfg.heading === 'string' ? cfg.heading.trim() : '';
    const headingHtml =
      headingText || ctx.admin
        ? `<h2 data-menu-heading class="mb-6 text-2xl font-medium"${editableAttr(editablePath(section, 'heading', ctx))}>${escHtml(headingText)}</h2>`
        : '';

    const sectionsHtml = sections
      .map((menuSection, si) => {
        const s: any = menuSection || {};
        const items: any[] = Array.isArray(s.items) ? s.items : [];
        const sectionName = `<h3 data-menu-section-name class="mb-3 border-b border-border pb-1 text-lg font-medium"${editableAttr(editablePath(section, `sections.${si}.name`, ctx))}>${escHtml(s.name || '')}</h3>`;
        const itemsHtml = items
          .map((item, ii) => {
            const it: any = item || {};
            const priceText = it.price == null ? '' : String(it.price).trim();
            const price =
              priceText || ctx.admin
                ? `<span data-menu-item-price class="shrink-0 tabular-nums text-muted-foreground"${editableAttr(editablePath(section, `sections.${si}.items.${ii}.price`, ctx))}>${escHtml(priceText)}</span>`
                : '';
            const descText = typeof it.description === 'string' ? it.description.trim() : '';
            const desc =
              descText || ctx.admin
                ? `<p data-menu-item-desc class="text-sm text-muted-foreground"${editableAttr(editablePath(section, `sections.${si}.items.${ii}.description`, ctx))}>${escHtml(descText)}</p>`
                : '';
            const tags: any[] = Array.isArray(it.dietary_tags) ? it.dietary_tags : [];
            const tagsHtml = tags.length
              ? `<span data-menu-item-tags class="mt-1 flex flex-wrap gap-1">${tags.map((t) => `<span data-menu-tag class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">${escHtml(String(t))}</span>`).join('')}</span>`
              : '';
            const name = `<span data-menu-item-name class="font-medium"${editableAttr(editablePath(section, `sections.${si}.items.${ii}.name`, ctx))}>${escHtml(it.name || '')}</span>`;
            return `<li data-menu-item class="flex flex-col gap-0.5"><div data-menu-item-head class="flex items-baseline justify-between gap-3">${name}${price}</div>${desc}${tagsHtml}</li>`;
          })
          .join('');
        return `<section data-menu-section class="mb-8 last:mb-0">${sectionName}<ul data-menu-items class="flex flex-col gap-3">${itemsHtml}</ul></section>`;
      })
      .join('');

    const inner = `<div data-menu class="mx-auto max-w-3xl px-4">${headingHtml}${sectionsHtml}</div>`;
    return adminWrap(section, ctx, inner, 'w-full py-8');
  },
};

// member_login (#91, Kychon side): a configurable login surface for copied Wild
// Apricot member zones. Source-style labels/icons are structured config; actual
// credential entry happens on the Run402-hosted sign-in the CTA links to — we
// never render a fake credential-capturing form. The reCAPTCHA hook itself is a
// Run402 platform escalation; here we only carry the flag + a pending marker.
const MEMBER_LOGIN: BlockType = {
  label: 'Member Login',
  icon: '\u{1F510}',
  dynamic: false,
  editorType: 'inline',
  translatableFields: ['heading', 'subtitle', 'username_label', 'password_label', 'submit_label'],
  zoneHints: ['main'],
  supportedSpans: ['1', '1/2', '2/3'],
  defaultConfig: {
    heading: 'Member login',
    subtitle: '',
    username_label: 'Email',
    password_label: 'Password',
    submit_label: 'Sign in',
    sign_in_href: '/join',
    icon_url: '',
    enable_bot_protection: false,
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const editableAttr = (path: string | undefined) => (path ? ` data-editable="${escAttr(path)}"` : '');
    const text = (key: string, fallback: string) =>
      typeof cfg[key] === 'string' && cfg[key].trim() ? cfg[key].trim() : fallback;

    const heading = text('heading', 'Member login');
    const subtitle = typeof cfg.subtitle === 'string' ? cfg.subtitle.trim() : '';
    const usernameLabel = text('username_label', 'Email');
    const passwordLabel = text('password_label', 'Password');
    const submitLabel = text('submit_label', 'Sign in');
    const signInHref = cleanHref(cfg.sign_in_href, '/join');
    const iconUrl = typeof cfg.icon_url === 'string' ? cfg.icon_url.trim() : '';
    const botProtection = cfg.enable_bot_protection === true;

    const icon = iconUrl
      ? `<img data-member-login-icon src="${escAttr(iconUrl)}" alt="" loading="lazy" decoding="async" class="h-12 w-12 rounded-full object-cover">`
      : '';
    const subtitleHtml =
      subtitle || ctx.admin
        ? `<p data-member-login-subtitle class="text-sm text-muted-foreground"${editableAttr(editablePath(section, 'subtitle', ctx))}>${escHtml(subtitle)}</p>`
        : '';
    // Source-style field labels shown for parity; the actual sign-in is the
    // hosted form the CTA links to — no fake, credential-capturing inputs here.
    const fields = `<ul data-member-login-fields class="flex list-none flex-col gap-1.5 text-sm text-muted-foreground"><li data-member-login-field class="rounded-md border border-border bg-background px-3 py-2"${editableAttr(editablePath(section, 'username_label', ctx))}>${escHtml(usernameLabel)}</li><li data-member-login-field class="rounded-md border border-border bg-background px-3 py-2"${editableAttr(editablePath(section, 'password_label', ctx))}>${escHtml(passwordLabel)}</li></ul>`;
    const cta = `<a data-member-login-cta class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90" href="${escAttr(signInHref)}"${editableAttr(editablePath(section, 'submit_label', ctx))}>${escHtml(submitLabel)}</a>`;
    // Bot protection is a Run402 platform hook; until it exists we emit a
    // machine-readable pending marker (no visible or faked widget) for the
    // coverage report to surface.
    const botMarker = botProtection ? '<div data-bot-protection="pending" aria-hidden="true" hidden></div>' : '';

    const inner = `<div data-member-login class="mx-auto flex max-w-sm flex-col gap-4 rounded-lg border border-border bg-card p-6">${icon}<h2 data-member-login-heading class="text-xl font-medium"${editableAttr(editablePath(section, 'heading', ctx))}>${escHtml(heading)}</h2>${subtitleHtml}${fields}${cta}${botMarker}</div>`;
    return adminWrap(section, ctx, inner, 'w-full py-8');
  },
};

// safety_cta / social_row / utility_bar (#99): the small composable header-zone
// primitives a Wild Apricot-style utility cluster is built from. Each is an
// independently editable data block in the existing header layout; a porter
// preset (tracked separately) drops the coordinated cluster in one operation.
const SAFETY_CTA: BlockType = {
  label: 'Safety CTA',
  icon: '\u{1F6E1}',
  dynamic: false,
  editorType: 'inline',
  translatableFields: ['label'],
  zoneHints: ['header'],
  supportedSpans: ['1'],
  defaultConfig: { label: 'Safety', href: '#', variant: 'solid' },
  render(section, ctx) {
    const cfg = section.config || {};
    const label = typeof cfg.label === 'string' && cfg.label.trim() ? cfg.label.trim() : 'Safety';
    const href = cleanHref(cfg.href, '#');
    const variant = cfg.variant === 'outline' ? 'outline' : 'solid';
    const editable = editablePath(section, 'label', ctx);
    const editableAttr = editable ? ` data-editable="${escAttr(editable)}"` : '';
    const variantClass =
      variant === 'outline'
        ? 'border border-border hover:bg-muted'
        : 'bg-primary text-primary-foreground hover:bg-primary/90';
    return `<a data-safety-cta data-variant="${variant}" class="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${variantClass}" href="${escAttr(href)}"${editableAttr}>${escHtml(label)}</a>`;
  },
};

const SOCIAL_ROW: BlockType = {
  label: 'Social Row',
  icon: '\u{1F517}',
  dynamic: false,
  editorType: 'list',
  translatableFields: [],
  zoneHints: ['header'],
  supportedSpans: ['1'],
  defaultConfig: {
    links: [
      { network: 'facebook', href: '' },
      { network: 'instagram', href: '' },
    ],
  },
  render(section, _ctx) {
    const cfg = section.config || {};
    const links = Array.isArray(cfg.links) ? cfg.links : [];
    const itemsHtml = links
      .map((link) => {
        const l = link || {};
        const network = String(l.network || '')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '');
        const href = cleanHref(l.href);
        if (!network || !href) return '';
        return `<a data-social-link data-network="${escAttr(network)}" class="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" href="${escAttr(href)}" rel="noopener" target="_blank" aria-label="${escAttr(network)}">${escHtml(network)}</a>`;
      })
      .join('');
    return `<div data-social-row class="flex items-center gap-2">${itemsHtml}</div>`;
  },
};

const UTILITY_BAR: BlockType = {
  label: 'Utility Bar',
  icon: '\u{2630}',
  dynamic: false,
  editorType: 'list',
  translatableFields: ['items[].label'],
  zoneHints: ['header'],
  supportedSpans: ['1'],
  defaultConfig: {
    align: 'right',
    items: [{ label: 'Welcome', href: '' }],
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const items = Array.isArray(cfg.items) ? cfg.items : [];
    const align = cfg.align === 'left' ? 'left' : 'right';
    const itemsHtml = items
      .map((item, index) => {
        const it = item || {};
        const label = typeof it.label === 'string' ? it.label.trim() : '';
        if (!label && !ctx.admin) return '';
        const editable = editablePath(section, `items.${index}.label`, ctx);
        const editableAttr = editable ? ` data-editable="${escAttr(editable)}"` : '';
        const href = cleanHref(it.href);
        return href
          ? `<a data-utility-item class="transition-colors hover:text-foreground" href="${escAttr(href)}"${editableAttr}>${escHtml(label)}</a>`
          : `<span data-utility-item${editableAttr}>${escHtml(label)}</span>`;
      })
      .join('');
    return `<div data-utility-bar data-align="${align}" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground ${align === 'left' ? 'justify-start' : 'justify-end'}">${itemsHtml}</div>`;
  },
};

const SHAPE_PRESETS: Record<string, string> = {
  wave: 'M0,64 C240,128 480,0 720,64 C960,128 1200,0 1440,64 L1440,120 L0,120 Z',
  tilt: 'M0,30 L1440,100 L1440,120 L0,120 Z',
  curve: 'M0,90 C360,0 1080,0 1440,90 L1440,120 L0,120 Z',
};

const SHAPE_DIVIDER: BlockType = {
  label: 'Shape Divider',
  icon: '\u{3030}',
  dynamic: false,
  editorType: 'inline',
  translatableFields: [],
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
        ? renderShapeDividerBlockHtml({
          bottomColor: 'var(--color-primary)',
          height: '96px',
          invalid: true,
          layers: [],
          placement: 'between',
          topColor: 'var(--color-bg)',
          viewBox: '0 0 1440 120',
        })
        : '';
      return adminWrap(section, ctx, placeholder, 'w-full overflow-visible p-0');
    }
    const layers = Array.isArray(cfg.layers) && cfg.layers.length > 0
      ? cfg.layers
      : [{ fill: 'var(--shape-bottom-color)', opacity: 1 }];
    const renderLayers = layers
      .map((layer, index): ShapeDividerRenderLayer | null => {
        const layerPath = sanitizeSvgPathData(layer.path || path);
        if (!layerPath) return null;
        const opacity = Number(layer.opacity);
        const translate = safeCssValue(layer.translate_y != null ? `translate(0 ${layer.translate_y})` : '');
        return {
          d: layerPath,
          fill: safeCssValue(layer.fill || 'var(--shape-bottom-color)') || 'currentColor',
          index,
          opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : undefined,
          transform: translate || undefined,
        };
      })
      .filter((layer): layer is ShapeDividerRenderLayer => Boolean(layer));
    const transforms = [
      cfg.flip_x ? 'scaleX(-1)' : '',
      cfg.flip_y ? 'scaleY(-1)' : '',
    ].filter(Boolean).join(' ');
    const inner = renderShapeDividerBlockHtml({
      bottomColor: safeCssValue(cfg.bottom_color || 'var(--color-primary)') || 'var(--color-primary)',
      height: safeCssValue(cfg.height || '96px') || '96px',
      invalid: false,
      layers: renderLayers,
      placement: String(cfg.placement || 'between'),
      topColor: safeCssValue(cfg.top_color || 'var(--color-bg)') || 'var(--color-bg)',
      transform: safeCssValue(transforms) || undefined,
      viewBox: safeCssValue(cfg.view_box || '0 0 1440 120') || '0 0 1440 120',
    });
    return adminWrap(section, ctx, inner, 'w-full overflow-visible p-0');
  },
};

const EVENTS_LIST: BlockType = {
  label: 'Events List',
  editorType: 'inline',
  translatableFields: [],
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
    // Try the build-time SSR path: `index.astro` (and any page that
    // awaits `ensureBuildEventsLoaded`) populates the events cache before
    // `renderMainZone` runs; we drain it here per-block to produce real
    // `<EventCard>` HTML in the first paint. The runtime hydrate still
    // fires (`data-block-hydrate` stays in place), reads the pre-loaded
    // events from `data-events-payload`, and uses them as React's initial
    // state — so the first React render matches the SSR HTML and the
    // background refresh fetches any admin edits made between build and
    // visit. Cache miss → fall through to today's skeleton + client-fetch
    // path, which is what every page outside index.astro still does.
    const ssrEvents = ctx.buildEvents
      ? selectBuildEvents(ctx.buildEvents, cfg)
      : null;
    if (ssrEvents) {
      const ssrHtml = renderEventsListStaticHtml({
        events: ssrEvents as EventsListEventRow[],
        config: cfg,
        // headingEditablePath is admin-only; build-time renders the
        // public view so we deliberately omit it here.
      });
      const inner = constrainedContainerHtml(
        ` data-block-hydrate="events_list" data-config="${jsonAttr(cfg)}" data-events-payload="${jsonAttr(ssrEvents)}"`,
        ssrHtml,
      );
      return adminWrap(section, ctx, inner, 'w-full py-6');
    }
    const inner = constrainedContainerHtml(` data-block-hydrate="events_list" data-config="${jsonAttr(cfg)}"`);
    return adminWrap(section, ctx, inner, 'w-full py-6');
  },
  async hydrate(el, section, ctx) {
    if (el.getAttribute('data-block-hydrate') !== 'events_list') return;
    if (!ctx.isFeatureEnabled?.('feature_events')) {
      sectionShellFor(el).hidden = true;
      return;
    }
    const { hydrateEventsList } = await import('./block-hydrators.js');
    await hydrateEventsList(el, section, ctx);
  },
};

/**
 * Filter+sort+slice the build-time event cache per a single block's
 * config. Mirrors `eventsQuery` in `EventsListIsland.tsx` so the SSR
 * output matches what the runtime fetch would return for the same
 * config. Kept inline (rather than imported from `build-events.ts`)
 * so `blocks.ts` doesn't pull the SDK transitively on the runtime
 * bundle — `ctx.buildEvents` is provided by the build-time caller.
 */
function selectBuildEvents(
  cache: NonNullable<BlockRenderContext['buildEvents']>,
  cfg: Record<string, unknown>,
): EventsListEventRow[] | null {
  if (!Array.isArray(cache) || cache.length === 0) return null;
  const rawFilter = String(cfg.filter || 'upcoming') as 'past' | 'this_week' | 'upcoming';
  const filter = rawFilter === 'past' || rawFilter === 'this_week' ? rawFilter : 'upcoming';
  const count = Math.max(1, Math.min(50, Math.floor(Number(cfg.count) || 4)));
  const now = Date.now();
  const horizon = now + 7 * 86400 * 1000;
  let filtered: EventsListEventRow[];
  if (filter === 'past') {
    filtered = cache
      .filter((e) => e.starts_at && Date.parse(e.starts_at) < now)
      .sort((a, b) => Date.parse(b.starts_at!) - Date.parse(a.starts_at!));
  } else if (filter === 'this_week') {
    filtered = cache
      .filter((e) => {
        if (!e.starts_at) return false;
        const ts = Date.parse(e.starts_at);
        return ts >= now && ts < horizon;
      })
      .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!));
  } else {
    filtered = cache
      .filter((e) => e.starts_at && Date.parse(e.starts_at) >= now)
      .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!));
  }
  return filtered.length === 0 ? null : filtered.slice(0, count);
}

const EVENTS_CALENDAR: BlockType = {
  label: 'Events Calendar',
  editorType: 'inline',
  translatableFields: [],
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
    const inner = renderEventsCalendarShellHtml({
      configJson: JSON.stringify(cfg),
      editableHeadingPath: editablePath(section, 'heading', ctx),
      heading: cfg.heading ? String(cfg.heading) : '',
    });
    return adminWrap(section, ctx, inner);
  },
  async hydrate(el, section, ctx) {
    if (el.getAttribute('data-block-hydrate') !== 'events_calendar') return;
    if (!ctx.isFeatureEnabled?.('feature_events')) {
      sectionShellFor(el).hidden = true;
      return;
    }
    const { hydrateEventsCalendar } = await import('./block-hydrators.js');
    await hydrateEventsCalendar(el, section, ctx);
  },
};

const SLIDESHOW: BlockType = {
  label: 'Slideshow',
  editorType: 'list',
  translatableFields: [],
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
    const aspect = cfg.aspect_ratio || '16/9';
    const fit = cfg.fit === 'contain' ? 'contain' : 'cover';
    const transition = cfg.transition === 'slide' ? 'slide' : 'fade';
    const ariaLabel = cfg.heading ? escAttr(cfg.heading) : 'Slideshow';
    const auto = Number(cfg.auto_rotate_seconds);
    const autoMs = Number.isFinite(auto) && auto > 0 ? Math.round(auto * 1000) : 0;
    const transitionMs = Number(cfg.transition_ms);
    const safeTransitionMs = Number.isFinite(transitionMs) && transitionMs >= 0 ? Math.round(transitionMs) : 400;
    const arrowStyle = cfg.arrow_style || {};
    const dotStyle = cfg.dot_style || {};
    const rootStyle: Record<string, string> = {};
    const addStyleVar = (name: string, value: any) => {
      const safe = safeCssValue(value);
      if (safe) rootStyle[name] = safe;
    };
    rootStyle['--aspect'] = safeCssValue(aspect) || '16/9';
    rootStyle['--fit'] = fit;
    addStyleVar('--slideshow-height', cfg.height);
    addStyleVar('--slideshow-mobile-height', cfg.mobile_height);
    rootStyle['--slideshow-transition-ms'] = `${safeTransitionMs}ms`;
    addStyleVar('--slideshow-transition-easing', cfg.transition_easing || 'ease');
    addStyleVar('--slideshow-arrow-bg', arrowStyle.background);
    addStyleVar('--slideshow-arrow-color', arrowStyle.text || arrowStyle.icon);
    addStyleVar('--slideshow-arrow-hover-bg', arrowStyle.hover?.background);
    addStyleVar('--slideshow-arrow-hover-color', arrowStyle.hover?.text || arrowStyle.hover?.icon);
    addStyleVar('--slideshow-dot-bg', dotStyle.background);
    addStyleVar('--slideshow-dot-active-bg', dotStyle.active_background || dotStyle.hover?.background);
    const renderItems: SlideshowRenderItem[] = items.map((it, i) => {
      const slideFit = it.fit === 'contain' ? 'contain' : (it.fit === 'cover' ? 'cover' : fit);
      return {
        alt: String(it.alt || ''),
        avifSrc: it.avif_src ? String(it.avif_src) : undefined,
        caption: it.caption ? String(it.caption) : undefined,
        fit: slideFit,
        fetchPriority: i === 0 ? 'low' : undefined,
        href: it.href ? cleanHref(it.href) : undefined,
        loading: i === 0 ? 'eager' : 'lazy',
        objectPosition: safeCssValue(it.object_position || cfg.object_position || 'center') || 'center',
        src: String(it.src || ''),
        webpSrc: it.webp_src ? String(it.webp_src) : undefined,
      };
    });
    const pauseHover = cfg.pause_on_hover === false ? 'false' : 'true';
    const pauseFocus = cfg.pause_on_focus === false ? 'false' : 'true';
    const manualPause = cfg.manual_pause === true ? 'true' : 'false';
    const inner = renderSlideshowBlockHtml({
      ariaLabel,
      autoMs,
      editableHeadingPath: editablePath(section, 'heading', ctx),
      fit,
      heading: cfg.heading ? String(cfg.heading) : '',
      items: renderItems,
      manifest: ctx.manifest,
      manualPause: manualPause === 'true',
      pauseFocus: pauseFocus === 'true',
      pauseHover: pauseHover === 'true',
      rootStyle,
      showArrows: cfg.show_arrows !== false,
      showDots: cfg.show_dots !== false,
      showEmptyPlaceholder: ctx.admin,
      transition,
    });
    return adminWrap(section, ctx, inner, 'w-full py-4');
  },
  async hydrate(el, _section, _ctx) {
    if (el.getAttribute('data-block-hydrate') !== 'slideshow') return;
    if (el.dataset.hydrated === 'true') return;
    const slideshow = await import('./blocks/slideshow.js');
    void slideshow.initSlideshows;
    slideshow.initSlideshow(el);
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
  feature_panels: FEATURE_PANELS,
  menu: MENU,
  member_login: MEMBER_LOGIN,
  safety_cta: SAFETY_CTA,
  social_row: SOCIAL_ROW,
  utility_bar: UTILITY_BAR,
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

export function isSingletonBlockType(type: string, zone?: Section['zone']): boolean {
  const singletonZones = BLOCK_TYPES[type]?.singletonZones;
  if (!singletonZones || singletonZones.length === 0) return false;
  return zone ? singletonZones.includes(zone) : true;
}

function singletonSortValue(section: Section): number {
  return Number.isFinite(section.position) ? section.position : Number.MAX_SAFE_INTEGER;
}

function singletonIdValue(section: Section): number {
  return Number.isFinite(section.id) ? Number(section.id) : Number.MAX_SAFE_INTEGER;
}

function isPageSpecificSingleton(section: Section, currentSlug: string): boolean {
  return Boolean(currentSlug) && section.scope !== 'global' && section.page_slug === currentSlug;
}

function compareSingletonSections(a: Section, b: Section, currentSlug: string): number {
  const aPageSpecific = isPageSpecificSingleton(a, currentSlug);
  const bPageSpecific = isPageSpecificSingleton(b, currentSlug);
  if (aPageSpecific !== bPageSpecific) return aPageSpecific ? -1 : 1;
  const positionDelta = singletonSortValue(a) - singletonSortValue(b);
  if (positionDelta !== 0) return positionDelta;
  return singletonIdValue(a) - singletonIdValue(b);
}

export function dedupeSingletonSections(sections: Section[], currentSlug = ''): Section[] {
  const winnerByKey = new Map<string, Section>();
  for (const section of sections) {
    if (!isSingletonBlockType(section.section_type, section.zone)) continue;
    const key = `${section.zone}:${section.section_type}`;
    const current = winnerByKey.get(key);
    if (!current || compareSingletonSections(section, current, currentSlug) < 0) {
      winnerByKey.set(key, section);
    }
  }

  return sections.filter((section) => {
    if (!isSingletonBlockType(section.section_type, section.zone)) return true;
    return winnerByKey.get(`${section.zone}:${section.section_type}`) === section;
  });
}

function currentSlugFromRenderContext(ctx: BlockRenderContext): string {
  if (!ctx.currentPath) return '';
  const url = new URL(ctx.currentPath, 'https://kychon.local');
  return currentPageSlugFromLocation(url.pathname, url.search);
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
  const filtered = sections
    .filter((s) => s.zone === zone)
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.position - b.position);

  return dedupeSingletonSections(filtered, currentSlugFromRenderContext(ctx))
    .map((s) => renderBlock(s, ctx))
    .join('');
}

export function dynamicBlockTypes(): string[] {
  return Object.entries(BLOCK_TYPES)
    .filter(([, t]) => t.dynamic)
    .map(([name]) => name);
}
