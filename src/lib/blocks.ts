// blocks.ts — Block-type registry. The single isomorphic renderer that runs
// at Astro build time (Node) and at runtime (browser). Renderers return HTML
// strings. Dynamic blocks emit a skeleton at bake time and a per-type
// `hydrate(el, ctx)` is called at runtime to fetch data and replace the body.

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

function jsonAttr(value: any): string {
  // Used inside data-editable-config="..." — escape so quotes survive.
  return JSON.stringify(value)
    .replace(/&/g, '&amp;')
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
    if (a.pathname !== b.pathname) return false;
    if (a.search && a.search !== b.search) return false;
    // Hash-aware: an item linking to "/#x" is active only when the current
    // URL has the same hash. Items without a hash ignore the current hash.
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
    const tagName = tagMatch[2].toLowerCase();
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
    return trimmed;
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
    ? `<a href="${escAttr(cfg.cta_href || '#')}" class="btn btn-primary btn-lg"${editableAttr(section, 'cta_text', ctx)}>${escHtml(cfg.cta_text)}</a>`
    : '';
  const inner = `<div class="container">${heading}${sub}${cta}</div>`;
  const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
  const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
  const imgAttr = sid != null && ctx.admin ? ` data-editable-image="sections.${sid}.config.bg_image"` : '';
  const styleAttr = cfg.bg_image ? ` style="background-image:url(${escAttr(cfg.bg_image)})"` : '';
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
    ? `<a href="${escAttr(cfg.cta_href || '#')}" class="btn btn-primary btn-lg"${editableAttr(section, 'cta_text', ctx)}>${escHtml(cfg.cta_text)}</a>`
    : '';
  const headingGroup = heading || sub || cta
    ? `<div class="hero-text"><div class="container">${heading}${sub}${cta}</div></div>`
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
        (item: any, i: number) =>
          `<div class="feature-card"><div class="feature-icon">${escHtml(featureIcon(item.icon))}</div><h3${editableAttr(section, `items.${i}.title`, ctx)}>${escHtml(item.title)}</h3><p${editableAttr(section, `items.${i}.desc`, ctx)}>${escHtml(item.desc)}</p></div>`,
      )
      .join('');
    return adminWrap(
      section,
      ctx,
      `<div class="container"><div class="features-grid" style="--cols:${cols}">${items}</div></div>`,
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
    cta_href: '/join.html',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const cta = cfg.cta_text
      ? `<a href="${escAttr(cfg.cta_href || '#')}" class="btn btn-primary btn-lg mt-2"${editableAttr(section, 'cta_text', ctx)}>${escHtml(cfg.cta_text)}</a>`
      : '';
    return adminWrap(
      section,
      ctx,
      `<div class="container"><h2${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2><p class="text-muted mt-1"${editableAttr(section, 'text', ctx)}>${escHtml(cfg.text)}</p>${cta}</div>`,
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
          ? `<a href="${escAttr(s.href)}" class="stat-card" style="text-decoration:none;color:inherit">${inner}</a>`
          : `<div class="stat-card">${inner}</div>`;
      })
      .join('');
    return adminWrap(
      section,
      ctx,
      `<div class="container"><div class="stats-grid">${items}</div></div>`,
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
          `<div class="card"><p style="font-style:italic"${editableAttr(section, `items.${i}.quote`, ctx)}>"${escHtml(t.quote)}"</p><p class="text-sm text-muted mt-1"${editableAttr(section, `items.${i}.name`, ctx)}>- ${escHtml(t.name)}${t.role ? `, ${escHtml(t.role)}` : ''}</p></div>`,
      )
      .join('');
    return adminWrap(section, ctx, `<div class="container"><div class="card-grid">${items}</div></div>`);
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
          `<details class="card mb-1" style="cursor:pointer"><summary style="font-weight:600"${editableAttr(section, `items.${i}.q`, ctx)}>${escHtml(f.q)}</summary><p class="text-muted mt-1"${editableAttr(section, `items.${i}.a`, ctx)}>${escHtml(f.a)}</p></details>`,
      )
      .join('');
    return adminWrap(section, ctx, `<div class="container"><h2 class="mb-2">FAQ</h2>${items}</div>`);
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
      `<div class="container" data-block-hydrate="polls">${heading}<div class="polls-skeleton"><div class="skeleton skeleton-card mb-1"></div></div></div>`,
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
      container.innerHTML += '<p class="text-muted">No polls to display.</p>';
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
      `<div class="container" data-block-hydrate="event_countdown">${heading}<div class="skeleton skeleton-card"></div></div>`,
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
        container.innerHTML += '<p class="text-muted">No upcoming events.</p>';
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
      `<div class="container" data-block-hydrate="announcements_feed"><div class="block-content"><div id="announcement-create" class="hidden mb-2"></div>${heading}<div id="announcements-feed"><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></div><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div></div></div></div></div>`,
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
      `<div class="container" data-block-hydrate="activity_feed">${heading}<div id="activity-feed"><div class="skeleton skeleton-card"></div></div></div>`,
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
  const href = item.href || '#';
  const active = isPageActive(href, ctx.currentPath) ? ' active' : '';
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
  const href = item.href || '';
  const active = isPageActive(href, ctx.currentPath) ? ' active' : '';
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
    const cfg = section.config || {};
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
    return `<button class="nav-toggle" id="nav-toggle" aria-label="Menu">&#9776;</button><div class="nav-links" id="nav-links" data-block-nav${editAttrs}>${links}</div>${adminEditBtn}`;
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
    const href = cfg.href || '/';
    const brandText = ctx.brandText || ctx.siteName || 'Kychon';
    const brandTextShort = ctx.brandTextShort || '';
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
      return `<a href="${escAttr(href)}" class="brand-header brand-header--icon nav-brand" aria-label="${escAttr(brandText)}"><img class="brand-icon" src="${escAttr(iconUrl)}" alt=""${editableIcon}><span class="brand-text"><span class="brand-text--full"${editableText}>${escHtml(brandText)}</span>${shortSpan}</span></a>`;
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
    await hydrateSignInBar(el, ctx);
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
      { heading: 'About', items: [{ label: 'About Us', href: '/page.html?slug=about' }] },
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
                `<li><a href="${escAttr(it.href)}"${editableAttr(section, `columns.${ci}.items.${ii}.label`, ctx)}>${escHtml(it.label)}</a></li>`,
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
      ? ` &middot; <a href="${escAttr(cfg.admin_contact_href)}"${editableAttr(section, 'admin_contact_label', ctx)}>${escHtml(cfg.admin_contact_label)}</a>`
      : '';
    const sid = section.id;
    const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
    const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
    return `<div class="footer-block footer-copyright"${sortable}${cfgAttr}>&copy; ${year}${orgName ? ' ' + orgName : ''}${adminContact}</div>`;
  },
};

const FOOTER_SOCIAL: BlockType = {
  label: 'Social Links',
  icon: '\u{1F30D}',
  dynamic: false,
  zoneHints: ['footer'],
  supportedSpans: ['1', '1/3'],
  defaultConfig: { icons: [] },
  render(section, ctx) {
    const cfg = section.config || {};
    const PLATFORM_ICONS: Record<string, string> = {
      facebook: '\u{1F4D8}',
      instagram: '\u{1F4F7}',
      x: '\u{1D54F}',
      twitter: '\u{1D54F}',
      linkedin: '\u{1F4BC}',
      youtube: '\u{1F4FA}',
      tiktok: '\u{1F3B5}',
      github: '\u{1F431}',
    };
    const icons = (cfg.icons || [])
      .map((it: any) => {
        const icon = PLATFORM_ICONS[String(it.platform || '').toLowerCase()] || '\u{1F517}';
        return `<a href="${escAttr(it.href)}" class="footer-social-link" aria-label="${escAttr(it.platform)}" target="_blank" rel="noopener">${icon}</a>`;
      })
      .join('');
    const sid = section.id;
    const sortable = sid != null ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"` : '';
    const cfgAttr = sid != null && ctx.admin ? ` data-editable-config="${jsonAttr(cfg)}"` : '';
    return `<div class="footer-block footer-social"${sortable}${cfgAttr}>${icons}</div>`;
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
    const inner = `<div class="container"${richEdit}>${cfg.html || ''}</div>`;
    return adminWrap(section, ctx, inner);
  },
};

// --- Caption HTML sanitizer (shared with hero foreground & page_banner) ---
//
// Allowlist: <br>, <strong>, <em>, <a href> with restricted href schemes.
// Anything else is escaped as text. The implementation keeps a tag stack so
// matched closing tags survive; un-allowlisted tags are stripped including
// their inner content cannot be guaranteed (we strip the tag and emit no
// content from it, e.g. <script>x</script> → '').
const ALLOWED_HREF_SCHEME = /^(https?:|mailto:|tel:|\/|#)/i;
const ALLOWED_INLINE_TAGS = new Set(['br', 'strong', 'em', 'a']);

export function sanitizeCaptionHtml(html: string): string {
  if (!html) return '';
  const out: string[] = [];
  // Tag-or-text tokenizer; stray `<` not starting a real tag falls through
  // to the single-char fallback and gets escaped as text.
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>|[^<]+|</g;
  let m: RegExpExecArray | null;
  // Skip-stack: how many nested forbidden tags are open. Forbidden tags drop
  // their inner content too — `<script>alert(1)</script>x` → `x`.
  let skip = 0;
  while ((m = re.exec(html)) !== null) {
    const fullTag = m[0];
    const rawTag = (m[1] || '').toLowerCase();
    const attrs = m[2] || '';
    if (!rawTag) {
      // Plain text segment (including a stray `<`).
      if (skip === 0) out.push(escHtml(fullTag));
      continue;
    }
    const closing = fullTag.startsWith('</');
    if (!ALLOWED_INLINE_TAGS.has(rawTag)) {
      if (closing) {
        if (skip > 0) skip--;
      } else if (!fullTag.endsWith('/>')) {
        skip++;
      }
      continue;
    }
    if (skip > 0) continue;
    if (rawTag === 'br') {
      out.push('<br>');
    } else if (rawTag === 'a') {
      if (closing) {
        out.push('</a>');
      } else {
        const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]*)"|\bhref\s*=\s*'([^']*)'/i);
        const href = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? '') : '';
        if (href && ALLOWED_HREF_SCHEME.test(href.trim())) {
          out.push(`<a href="${escAttr(href)}" rel="noopener noreferrer">`);
        } else {
          out.push('<a>');
        }
      }
    } else {
      // strong / em
      out.push(closing ? `</${rawTag}>` : `<${rawTag}>`);
    }
  }
  return out.join('');
}

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
    const inner = `<div class="container">${iconHtml}${textHtml}</div>`;
    return adminWrap(section, ctx, inner, cls);
  },
};

const PAGE_BANNER: BlockType = {
  label: 'Page Banner',
  icon: '\u{1F5BC}', // 🖼
  dynamic: false,
  zoneHints: ['header'],
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
    const overlay = cfg.overlay_color
      ? `<div class="block-page-banner__overlay" style="background-color:${escAttr(cfg.overlay_color)}"></div>`
      : '';
    const bg = cfg.image_url
      ? ` style="background-image:url(${escAttr(cfg.image_url)})"`
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
  const href = item.href || '#';
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
      const inner = `<div class="container" data-block-hydrate="link_list" data-config="${jsonAttr(cfg)}">${heading}${skeleton}</div>`;
      return adminWrap(section, ctx, inner, cls);
    }
    const items: any[] = Array.isArray(cfg.items) ? cfg.items : [];
    const itemsHtml = items.map((item) => renderLinkListItem(item, layout)).join('');
    const inner = `<div class="container">${heading}<ul class="block-link-list__list">${itemsHtml}</ul></div>`;
    return adminWrap(section, ctx, inner, cls);
  },
  async hydrate(el, section, ctx) {
    if ((section.config?.source || 'manual') !== 'resources') return;
    const { hydrateLinkListResources } = await import('./block-hydrators');
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
        const href = item.cta_href || '#';
        const titlePos = item.title_position === 'bottom' ? 'bottom' : 'top';
        const ariaLabel = `${item.title || ''}${item.cta_text ? `, ${item.cta_text}` : ''}`.trim();
        const overlay = item.overlay_color
          ? `<span class="promo-card__overlay" style="background-color:${escAttr(item.overlay_color)}"></span>`
          : '';
        const imgStyle = item.image_url
          ? ` style="background-image:url(${escAttr(item.image_url)})"`
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
    const inner = `<div class="container">${heading}<div class="block-promo-cards" style="--cols:${cols}">${cards}</div></div>`;
    return adminWrap(section, ctx, inner, 'section section-promo-cards');
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
    const inner = `<div class="container" data-block-hydrate="events_list" data-config="${jsonAttr(cfg)}">${heading}${skeletons}</div>`;
    const cls = `section section-events-list block-events-list block-events-list--${escAttr(layout)} block-events-list--${escAttr(cfg.color_scheme || 'primary')}`;
    return adminWrap(section, ctx, inner, cls);
  },
  async hydrate(el, section, ctx) {
    if (!ctx.isFeatureEnabled?.('feature_events')) {
      el.style.display = 'none';
      return;
    }
    const { hydrateEventsList } = await import('./block-hydrators');
    await hydrateEventsList(el, section, ctx);
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
    fit: 'cover',
    transition: 'fade',
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
        ? `<div class="block-slideshow block-slideshow--empty"><p class="text-muted">No slides yet — add some via the editor.</p></div>`
        : '';
      const inner = `<div class="container">${heading}${empty}</div>`;
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
        const figcaption = it.caption
          ? `<figcaption class="block-slideshow__caption">${escHtml(it.caption)}</figcaption>`
          : '';
        const imgInner = `<img src="${escAttr(it.src || '')}" alt="${escAttr(it.alt || '')}" loading="${loading}">`;
        const linked = it.href
          ? `<a href="${escAttr(it.href)}" class="block-slideshow__link">${imgInner}</a>`
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
    const inner = `<div class="container">${heading}<div class="block-slideshow block-slideshow--${escAttr(transition)}" tabindex="0" role="region" aria-roledescription="carousel" aria-label="${ariaLabel}" data-block-hydrate="slideshow" data-auto-ms="${autoMs}" data-fit="${escAttr(fit)}" style="--aspect:${escAttr(aspect)};--fit:${escAttr(fit)}"><div class="block-slideshow__track">${slides}</div>${arrows}${dots}${liveRegion}</div></div>`;
    return adminWrap(section, ctx, inner, 'section section-slideshow');
  },
  async hydrate(el, _section, _ctx) {
    const root = el.querySelector('[data-block-hydrate="slideshow"]') as HTMLElement | null;
    if (!root) return;
    if (root.dataset.hydrated === 'true') return;
    const { initSlideshow } = await import('./blocks/slideshow');
    initSlideshow(root);
  },
};

// --- Registry ---

import EMBED from './blocks/embed.js';

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
  events_list: EVENTS_LIST,
  slideshow: SLIDESHOW,
  nav: NAV,
  brand_header: BRAND_HEADER,
  sign_in_bar: SIGN_IN_BAR,
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
