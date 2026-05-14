// config.ts — Loads site_config, injects theme, manages feature flags.
// composable-layout: nav and sign-in rendering moved to block renderers
// (src/lib/blocks.ts) and per-block hydrators (src/lib/block-hydrators.ts).
// This module no longer touches #nav-links / #nav-user.

import { get, getCurrentActorContext } from './api.js';
import { getSession, getSessionEmail } from './auth.js';
import { canonicalRouteKey } from './clean-routes.js';
import { loadLocale, setAvailableLocales, t } from './i18n.js';

// --- Cache layer (stale-while-revalidate) ---
const WL_CACHE_CONFIG = 'wl_cache_site_config';
const WL_CACHE_MEMBER_PREFIX = 'wl_cache_member_';
const CONFIG_TTL = 5 * 60 * 1000;
const MEMBER_TTL = 10 * 60 * 1000;

function readCache(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function writeCache(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function isFresh(key: string, ttlMs: number): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const { ts } = parsed;
    return typeof ts === 'number' && ts + ttlMs > Date.now();
  } catch {
    return false;
  }
}

export function clearCache(key: string): void {
  localStorage.removeItem(key);
}

// --- Hero image preload ---
// The active hero section's image (background `bg_image` OR foreground
// `image_url`) is cached to localStorage on every page render so that the
// next visit's <link rel="preload" as="image"> can fire before the section
// fetch completes. Both modes warm the same key — the resolution happens at
// cache-write time via getHeroImageUrl().
const WL_CACHE_HERO_IMG = 'wl_cache_hero_img';

interface HeroSectionLike {
  section_type?: string;
  config?: Record<string, any> | null;
}

/** Extract the active hero image URL from a hero section's config. Returns
 * `image_url` for foreground mode, `bg_image` for background mode. Returns
 * null when neither is set. */
export function getHeroImageUrl(section: HeroSectionLike | null | undefined): string | null {
  if (!section) return null;
  const cfg = section.config || {};
  if (cfg.mode === 'foreground') {
    return typeof cfg.image_url === 'string' && cfg.image_url ? cfg.image_url : null;
  }
  return typeof cfg.bg_image === 'string' && cfg.bg_image ? cfg.bg_image : null;
}

export function preloadHeroImage(): void {
  const url = readCache(WL_CACHE_HERO_IMG);
  if (url && !document.querySelector('link[rel="preload"][as="image"]')) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  }
}

/** Persist the active hero image URL for the next page's preload hint.
 * Accepts either a URL string (legacy) or a hero section whose mode-aware
 * URL is resolved via getHeroImageUrl(). */
export function cacheHeroImage(input: string | HeroSectionLike): void {
  const url = typeof input === 'string' ? input : getHeroImageUrl(input);
  if (url) writeCache(WL_CACHE_HERO_IMG, url);
}

// --- Config state ---
const siteConfig: Record<string, any> = {};
const features: Record<string, boolean> = {};
const ADMIN_PATHS = ['/admin', '/admin.html', '/admin-members', '/admin-members.html', '/admin-settings', '/admin-settings.html'];

let resolveReady: () => void;
export const ready: Promise<void> = new Promise((r) => {
  resolveReady = r;
});

export function getConfig(key: string): any {
  const row = siteConfig[key];
  return row !== undefined ? row : null;
}

export function isFeatureEnabled(flag: string): boolean {
  return features[flag] === true;
}

export function getRouteKey(
  urlLike: string,
  base = typeof window !== 'undefined' ? window.location.origin : 'https://kychon.local',
): string {
  return canonicalRouteKey(urlLike, base);
}

const ACTIVE_ROUTE_ALIASES: Record<string, string[]> = {
  '/event': ['/events'],
};

function splitRouteKey(key: string): { path: string; search: string } {
  const idx = key.indexOf('?');
  return idx >= 0
    ? { path: key.slice(0, idx), search: key.slice(idx) }
    : { path: key, search: '' };
}

export function isNavItemActive(
  itemHref: string,
  currentHref = typeof window !== 'undefined' ? window.location.href : 'https://kychon.local/',
): boolean {
  const current = new URL(currentHref, typeof window !== 'undefined' ? window.location.origin : 'https://kychon.local');
  const target = new URL(itemHref, current);
  if (target.origin !== current.origin) return false;

  const currentKey = getRouteKey(`${current.pathname}${current.search}`, current.origin);
  const targetKey = getRouteKey(`${target.pathname}${target.search}`, current.origin);
  const currentRoute = splitRouteKey(currentKey);
  const targetRoute = splitRouteKey(targetKey);

  if (targetRoute.search) {
    return currentKey === targetKey;
  }

  if (currentRoute.path === targetRoute.path) return true;

  return (ACTIVE_ROUTE_ALIASES[currentRoute.path] || []).includes(targetRoute.path);
}

export function getBrandedTitle(title: string, siteName: string): string {
  const cleanSiteName = String(siteName || '').trim();
  if (!cleanSiteName) return String(title || '').trim();

  const cleanTitle = String(title || '').trim();
  if (!cleanTitle || cleanTitle === cleanSiteName) return cleanSiteName;

  const suffix = ` — ${cleanSiteName}`;
  let normalizedTitle = cleanTitle;
  while (normalizedTitle.endsWith(suffix)) {
    normalizedTitle = normalizedTitle.slice(0, -suffix.length).trimEnd();
  }

  return normalizedTitle ? `${normalizedTitle}${suffix}` : cleanSiteName;
}

// --- Theme ---
export const THEME_CSS_VAR_MAP: Record<string, string> = {
  primary: '--color-primary',
  primary_hover: '--color-primary-hover',
  accent: '--color-accent',
  bg: '--color-bg',
  surface: '--color-surface',
  text: '--color-text',
  text_muted: '--color-text-muted',
  border: '--color-border',
  success: '--color-success',
  warning: '--color-warning',
  danger: '--color-danger',
  font_heading: '--font-heading',
  font_body: '--font-body',
  radius: '--radius',
  max_width: '--max-width',
};

export const THEME_KYCHON_CSS_VAR_MAP: Record<string, string> = {
  primary: '--ky-color-primary',
  primary_hover: '--ky-color-primary-hover',
  accent: '--ky-color-accent',
  bg: '--ky-color-bg',
  surface: '--ky-color-surface',
  text: '--ky-color-text',
  text_muted: '--ky-color-text-muted',
  border: '--ky-color-border',
  success: '--ky-color-success',
  warning: '--ky-color-warning',
  danger: '--ky-color-danger',
  radius: '--ky-radius',
};

export const COPIED_THEME_CSS_VAR_PATHS: Record<string, string> = {
  'interactions.default.hover.background': '--interaction-hover-bg',
  'interactions.default.hover.text': '--interaction-hover-text',
  'interactions.default.hover.transform': '--interaction-transform',
  'interactions.default.hover.duration': '--interaction-duration',
  'interactions.default.hover.easing': '--interaction-easing',
  'interactions.default.focus.border': '--interaction-focus-color',
  'interactions.button.hover.background': '--button-hover-bg',
  'interactions.button.hover.text': '--button-hover-text',
  'interactions.card.hover.transform': '--card-hover-transform',
  'interactions.card.hover.shadow': '--card-hover-shadow',
  'interactions.social.hover.background': '--social-link-hover-bg',
  'interactions.social.hover.text': '--social-link-hover-color',
  'interactions.social.hover.border': '--social-link-hover-border',
  'interactions.social.hover.transform': '--social-link-hover-transform',
  'header.padding': '--nav-header-padding',
  'header.background': '--nav-header-bg',
  'header.border_bottom': '--nav-header-border-bottom',
  'header.shadow': '--nav-header-shadow',
  'header.gap': '--nav-header-gap',
  'header.wrap': '--nav-header-wrap',
  'header.align_items': '--nav-header-align-items',
  'header.logo_max_height': '--nav-logo-max-height',
  'header.logo_max_width': '--nav-logo-max-width',
  'header.wordmark_max_height': '--nav-wordmark-max-height',
  'header.brand_text_color': '--brand-text-color',
  'header.brand_text_size': '--brand-text-size',
  'header.brand_text_weight': '--brand-text-weight',
  'nav.link_color': '--nav-link-color',
  'nav.link_hover_bg': '--nav-link-hover-bg',
  'nav.link_hover_color': '--nav-link-hover-color',
  'nav.link_active_bg': '--nav-link-active-bg',
  'nav.link_active_color': '--nav-link-active-color',
  'nav.link_gap': '--nav-link-gap',
  'nav.link_padding': '--nav-link-padding',
  'nav.link_radius': '--nav-link-radius',
  'nav.font_family': '--nav-link-font-family',
  'nav.font_size': '--nav-link-font-size',
  'nav.font_weight': '--nav-link-font-weight',
  'nav.surface_bg': '--nav-links-bg',
  'nav.surface_padding': '--nav-links-padding',
  'nav.surface_radius': '--nav-links-radius',
  'nav.surface_shadow': '--nav-links-shadow',
  'nav.wrap': '--nav-links-wrap',
  'nav.dropdown_bg': '--nav-dropdown-bg',
  'nav.dropdown_color': '--nav-dropdown-color',
  'nav.dropdown_hover_bg': '--nav-dropdown-hover-bg',
  'nav.dropdown_hover_color': '--nav-dropdown-hover-color',
  'nav.dropdown_border': '--nav-dropdown-border',
  'nav.dropdown_shadow': '--nav-dropdown-shadow',
  'nav.dropdown_width': '--nav-dropdown-width',
  'nav.chevron_color': '--nav-chevron-color',
  'nav.transition': '--nav-transition',
  'nav.mobile_menu_bg': '--nav-mobile-menu-bg',
  'nav.mobile_menu_padding': '--nav-mobile-menu-padding',
  'social.size': '--social-link-size',
  'social.icon_size': '--social-link-icon-size',
  'social.radius': '--social-link-radius',
  'social.bg': '--social-link-bg',
  'social.color': '--social-link-color',
  'social.border': '--social-link-border',
  'social.gap': '--social-link-gap',
  'social.justify': '--social-link-justify',
  'footer.background': '--footer-bg',
  'footer.text': '--footer-text',
  'footer.link_color': '--footer-link-color',
  'footer.heading_color': '--footer-heading-color',
  'footer.border_top': '--footer-border-top',
  'footer.padding': '--footer-padding',
  'footer.text_align': '--footer-text-align',
  'footer.link_columns': '--footer-link-columns',
  'footer.link_gap': '--footer-link-gap',
  'carousel.arrow.background': '--slideshow-arrow-bg',
  'carousel.arrow.text': '--slideshow-arrow-color',
  'carousel.arrow.hover.background': '--slideshow-arrow-hover-bg',
  'carousel.arrow.hover.text': '--slideshow-arrow-hover-color',
  'carousel.dot.background': '--slideshow-dot-bg',
  'carousel.dot.active_background': '--slideshow-dot-active-bg',
};

const SAFE_THEME_CSS_VALUE_RE = /^[#%(),./"'`\-\w\s]+$/;

function safeThemeCssValue(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s || s.length > 180) return '';
  return SAFE_THEME_CSS_VALUE_RE.test(s) ? s : '';
}

function readPath(obj: Record<string, any>, path: string): unknown {
  let cur: any = obj;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function preservesSourceColorScheme(theme: Record<string, any>): boolean {
  return String(theme.color_scheme || '').toLowerCase() === 'source';
}

export function themeCssVars(theme: Record<string, any> | null): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!theme) return vars;
  for (const [key, prop] of Object.entries(THEME_CSS_VAR_MAP)) {
    const safe = safeThemeCssValue(theme[key]);
    if (safe) vars[prop] = safe;
  }
  for (const [key, prop] of Object.entries(THEME_KYCHON_CSS_VAR_MAP)) {
    const safe = safeThemeCssValue(theme[key]);
    if (safe) vars[prop] = safe;
  }
  for (const [path, prop] of Object.entries(COPIED_THEME_CSS_VAR_PATHS)) {
    const safe = safeThemeCssValue(readPath(theme, path));
    if (safe) vars[prop] = safe;
  }
  return vars;
}

export function applyTheme(theme: Record<string, any> | null): void {
  if (!theme) return;
  const el = document.documentElement;
  const darkOverridable = preservesSourceColorScheme(theme)
    ? new Set<string>()
    : new Set(['bg', 'surface', 'text', 'text_muted', 'border']);
  const vars = themeCssVars(theme);
  const rootVars: string[] = [];
  const themeVarEntries = [...Object.entries(THEME_CSS_VAR_MAP), ...Object.entries(THEME_KYCHON_CSS_VAR_MAP)];
  for (const [prop, value] of Object.entries(vars)) {
    const key = themeVarEntries.find(([, mappedProp]) => mappedProp === prop)?.[0];
    if (key && darkOverridable.has(key)) {
      el.style.removeProperty(prop);
      rootVars.push(`${prop}: ${value};`);
    } else {
      el.style.setProperty(prop, value);
    }
  }
  let styleEl = document.getElementById('wl-theme-vars');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'wl-theme-vars';
    const firstLink = document.querySelector('link[rel="stylesheet"]');
    if (firstLink) firstLink.before(styleEl);
    else document.head.appendChild(styleEl);
  }
  const rootSelector = darkOverridable.size > 0 ? ':root:not([data-theme="dark"])' : ':root';
  styleEl.textContent = `${rootSelector} {\n  ${rootVars.join('\n  ')}\n}`;
}

// --- Branding ---
// Only updates document.title and favicon — the visible brand row in the header
// is owned by the `brand_header` block.
//
// Favicon fallback chain (matches Portal.astro's frontmatter bake):
//   site_config.favicon_url → site_config.brand_icon_url → /favicon.svg
// Accepts `https://`, root-relative, and `data:image/svg+xml,…` URLs as-is.
function isSvgFaviconUrl(url: string): boolean {
  return /\.svg($|\?)/i.test(url) || url.startsWith('data:image/svg+xml');
}

export function applyBranding(config: Record<string, any>): void {
  const name = config.brand_text || config.site_name || 'Kychon';
  document.title = getBrandedTitle(document.title, name);

  const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!favicon) return;
  const faviconUrl =
    (config.favicon_url && String(config.favicon_url)) ||
    (config.brand_icon_url && String(config.brand_icon_url)) ||
    '/favicon.svg';
  if (favicon.href !== faviconUrl) favicon.href = faviconUrl;
  if (isSvgFaviconUrl(faviconUrl)) {
    favicon.type = 'image/svg+xml';
  } else {
    favicon.removeAttribute('type');
  }
}

// --- Member record ---
function applyMemberToSession(member: any): void {
  const session = getSession();
  if (!session) return;
  if (!session.user || typeof session.user !== 'object') session.user = {};
  session.user.member = member;
  localStorage.setItem('wl_session', JSON.stringify(session));
}

function clearStoredSession(): void {
  localStorage.removeItem('wl_session');
  document.dispatchEvent(new CustomEvent('wl-auth-changed'));
}

function actorMemberToSessionMember(member: any): any | null {
  if (!member?.id) return null;
  return {
    id: member.id,
    user_id: member.userId || null,
    email: member.email || '',
    display_name: member.displayName || '',
    role: member.role || 'member',
    status: member.status || 'pending',
  };
}

function actorCanReadMembers(actor: any): boolean {
  return ['active_member', 'moderator', 'admin', 'project_admin'].includes(actor?.state);
}

function isAuthOrPermissionError(error: unknown): boolean {
  const code = (error as any)?.code;
  return code === 'permission.denied' || (typeof code === 'string' && code.startsWith('auth.'));
}

async function findMemberForSession(session: any): Promise<any | null> {
  const userId = session?.user?.id;

  const context = await getCurrentActorContext();
  const actor = context?.actor;
  if (!actor?.authenticated) {
    clearStoredSession();
    return null;
  }

  const actorMember = actorMemberToSessionMember(actor.member);
  if (!actorMember) return null;

  let member = actorMember;
  if (actorCanReadMembers(actor)) {
    try {
      const members = await get(`members?id=eq.${encodeURIComponent(String(actorMember.id))}&limit=1`);
      if (members?.[0]) member = members[0];
    } catch (error) {
      if (!isAuthOrPermissionError(error)) throw error;
    }
  }

  if (member && userId && member.user_id !== userId && member.role === 'admin') {
    patchMemberUserId(member.id, userId).catch(() => {});
  }
  return member;
}

async function patchMemberUserId(memberId: unknown, userId: string): Promise<void> {
  if (!memberId || !userId) return;
  const { patch } = await import('./api.js');
  await patch(`members?id=eq.${memberId}`, { user_id: userId });
}

export async function refreshMemberRecord(): Promise<void> {
  const session = getSession();
  if (!session) return;

  const userId = session?.user?.id;
  const sessionKey = userId || getSessionEmail(session) || String(session?.access_token || '').slice(0, 16);
  const cacheKey = WL_CACHE_MEMBER_PREFIX + sessionKey;
  const useMemberCache = !ADMIN_PATHS.includes(window.location.pathname);
  const cached = useMemberCache ? readCache(cacheKey) : null;
  if (cached) {
    applyMemberToSession(cached);
    if (!isFresh(cacheKey, MEMBER_TTL)) {
      findMemberForSession(session).then((member) => {
        if (member) {
          writeCache(cacheKey, member);
          if (JSON.stringify(member) !== JSON.stringify(cached)) {
            applyMemberToSession(member);
            // Page-render hydration will refresh the sign_in_bar block.
            document.dispatchEvent(new CustomEvent('wl-auth-changed'));
          }
        }
      }).catch(() => {});
    }
    return;
  }

  try {
    const member = await findMemberForSession(session);
    if (member) {
      applyMemberToSession(member);
      writeCache(cacheKey, member);
    }
  } catch (e) {
    console.warn('loadMemberRecord failed:', e);
  }
}

// --- Populate config ---
function populateConfigFromRows(rows: any[]): void {
  for (const row of rows) {
    siteConfig[row.key] = row.value;
    if (row.key.startsWith('feature_') || row.key === 'directory_public') {
      features[row.key] = row.value === true || row.value === 'true';
    }
  }
}

// --- A11y prefs (apply before paint) ---
export function applyA11yPrefs(): void {
  const scale = localStorage.getItem('wl_font_scale');
  if (scale) document.documentElement.style.setProperty('--wl-font-scale', scale);
  if (localStorage.getItem('wl_high_contrast') === '1') {
    document.documentElement.classList.add('wl-high-contrast');
  }
  if (localStorage.getItem('wl_reduced_motion') === '1') {
    document.documentElement.classList.add('wl-reduced-motion');
  }
}

// --- Main init ---
export async function init(): Promise<Record<string, any>> {
  const isAdminPage = ADMIN_PATHS.includes(window.location.pathname);
  const cached = !isAdminPage ? readCache(WL_CACHE_CONFIG) : null;

  if (cached) {
    for (const key of Object.keys(siteConfig)) delete siteConfig[key];
    for (const key of Object.keys(features)) delete features[key];
    populateConfigFromRows(cached);
    applyTheme(siteConfig.theme);
    applyBranding(siteConfig);

    if (siteConfig.languages) setAvailableLocales(siteConfig.languages);
    await loadLocale(null, siteConfig.default_language);

    await refreshMemberRecord();

    if (!isFresh(WL_CACHE_CONFIG, CONFIG_TTL)) {
      get('site_config').then((rows: any[]) => {
        writeCache(WL_CACHE_CONFIG, rows);
        if (JSON.stringify(rows) !== JSON.stringify(cached)) {
          for (const key of Object.keys(siteConfig)) delete siteConfig[key];
          for (const key of Object.keys(features)) delete features[key];
          populateConfigFromRows(rows);
          applyTheme(siteConfig.theme);
          applyBranding(siteConfig);
          // Notify page-render so chrome blocks can re-hydrate from fresh config.
          document.dispatchEvent(new CustomEvent('wl-config-changed'));
        }
      }).catch(() => {});
    }
  } else {
    try {
      const rows = await get('site_config');
      for (const key of Object.keys(siteConfig)) delete siteConfig[key];
      for (const key of Object.keys(features)) delete features[key];
      populateConfigFromRows(rows);
      writeCache(WL_CACHE_CONFIG, rows);
    } catch (e) {
      console.warn('Failed to load site_config:', e);
    }

    applyTheme(siteConfig.theme);
    applyBranding(siteConfig);

    if (siteConfig.languages) setAvailableLocales(siteConfig.languages);
    await loadLocale(null, siteConfig.default_language);

    await refreshMemberRecord();
  }

  resolveReady();
  return siteConfig;
}

// --- Content translation helpers ---
export async function getTranslatedContent(contentType: string, contentId: number, field: string): Promise<string | null> {
  const locale = localStorage.getItem('wl_locale') || siteConfig.default_language || 'en';
  const defaultLang = siteConfig.default_language || 'en';
  if (locale === defaultLang) return null;
  try {
    const rows = await get(
      `content_translations?content_type=eq.${contentType}&content_id=eq.${contentId}&language=eq.${locale}&field=eq.${field}&limit=1`,
    );
    return rows.length > 0 ? rows[0].translated_text : null;
  } catch {
    return null;
  }
}

export async function translateItems(contentType: string, items: any[], fields: string[]): Promise<any[]> {
  const locale = localStorage.getItem('wl_locale') || siteConfig.default_language || 'en';
  const defaultLang = siteConfig.default_language || 'en';
  if (locale === defaultLang || !items.length) return items;
  try {
    const ids = items.map((i: any) => i.id);
    const rows = await get(
      `content_translations?content_type=eq.${contentType}&language=eq.${locale}&content_id=in.(${ids.join(',')})`,
    );
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[`${r.content_id}:${r.field}`] = r.translated_text;
    }
    for (const item of items) {
      for (const field of fields) {
        const val = map[`${item.id}:${field}`];
        if (val) item[field] = val;
      }
    }
  } catch {}
  return items;
}

export function addTranslateButton(el: HTMLElement, text: string): void {
  if (!text || text.length < 10) return;
  const locale = localStorage.getItem('wl_locale') || siteConfig.default_language || 'en';
  const defaultLang = siteConfig.default_language || 'en';
  if (locale === defaultLang) return;

  const contentType = el.dataset.ct || '';
  const contentId = el.dataset.ci || '';
  const field = el.dataset.cf || '';

  const link = document.createElement('button');
  link.className = 'translate-link';
  link.textContent = t('common.translate') || 'Translate';
  link.addEventListener('click', async () => {
    link.textContent = t('common.translating') || 'Translating...';
    link.disabled = true;
    try {
      const payload: Record<string, any> = { text, target_lang: locale };
      if (contentType && contentId && field) {
        payload.content_type = contentType;
        payload.content_id = contentId;
        payload.field = field;
      }
      const res = await fetch(`${window.__KYCHON_API}/functions/v1/translate-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.__KYCHON_ANON_KEY}`,
          apikey: window.__KYCHON_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.translated) {
        const translatedEl = document.createElement('div');
        translatedEl.className = 'translated-content';
        translatedEl.innerHTML = `<div class="translated-text">${data.translated}</div><span class="translated-label">${t('common.translated_by_ai') || 'Translated by AI'}</span>`;
        link.replaceWith(translatedEl);
      } else {
        link.textContent = t('common.translation_failed') || 'Translation unavailable';
      }
    } catch {
      link.textContent = t('common.translation_failed') || 'Translation unavailable';
    }
  });
  el.after(link);
}

export { features, siteConfig };
