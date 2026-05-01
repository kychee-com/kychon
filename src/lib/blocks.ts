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
  logoUrl?: string;
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

const BRAND_HEADER: BlockType = {
  label: 'Brand / Logo',
  icon: '\u{1F3F7}️',
  dynamic: false,
  zoneHints: ['header'],
  supportedSpans: ['1'],
  defaultConfig: {
    name: 'Kychon',
    logo_url: '',
    href: '/',
  },
  render(section, ctx) {
    const cfg = section.config || {};
    const name = cfg.name || ctx.siteName || 'Kychon';
    const logo = cfg.logo_url || ctx.logoUrl || '';
    const logoImg = logo
      ? `<img src="${escAttr(logo)}" alt="${escAttr(name)}"${ctx.admin && section.id != null ? ` data-editable-image="sections.${section.id}.config.logo_url"` : ''}>`
      : `<img src="" alt="" style="display:none"${ctx.admin && section.id != null ? ` data-editable-image="sections.${section.id}.config.logo_url"` : ''}>`;
    return `<a href="${escAttr(cfg.href || '/')}" class="nav-brand">${logoImg}<span class="nav-brand-text"${editableAttr(section, 'name', ctx)}>${escHtml(name)}</span></a>`;
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
