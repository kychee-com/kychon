// config.ts — Loads site_config, injects theme, manages feature flags.
// composable-layout: nav and sign-in rendering moved to block renderers
// (src/lib/blocks.ts) and per-block hydrators (src/lib/block-hydrators.ts).
// This module no longer touches #nav-links / #nav-user.

import { get } from './api';
import { getSession } from './auth';
import { loadLocale, setAvailableLocales, t } from './i18n';

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
    const { ts } = JSON.parse(raw);
    return typeof ts === 'number' && ts + ttlMs > Date.now();
  } catch {
    return false;
  }
}

export function clearCache(key: string): void {
  localStorage.removeItem(key);
}

// --- Hero image preload ---
const WL_CACHE_HERO_IMG = 'wl_cache_hero_img';

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

export function cacheHeroImage(url: string): void {
  if (url) writeCache(WL_CACHE_HERO_IMG, url);
}

// --- Config state ---
const siteConfig: Record<string, any> = {};
const features: Record<string, boolean> = {};

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

export function getRouteKey(
  urlLike: string,
  base = typeof window !== 'undefined' ? window.location.origin : 'https://kychon.local',
): string {
  const url = new URL(urlLike, base);
  return `${normalizePathname(url.pathname)}${normalizeSearch(url.search)}`;
}

const ACTIVE_ROUTE_ALIASES: Record<string, string[]> = {
  '/event.html': ['/events.html'],
};

export function isNavItemActive(
  itemHref: string,
  currentHref = typeof window !== 'undefined' ? window.location.href : 'https://kychon.local/',
): boolean {
  const current = new URL(currentHref, typeof window !== 'undefined' ? window.location.origin : 'https://kychon.local');
  const target = new URL(itemHref, current);
  const currentPath = normalizePathname(current.pathname);
  const targetPath = normalizePathname(target.pathname);

  if (normalizeSearch(target.search)) {
    return currentPath === targetPath && normalizeSearch(current.search) === normalizeSearch(target.search);
  }

  if (currentPath === targetPath) return true;

  return (ACTIVE_ROUTE_ALIASES[currentPath] || []).includes(targetPath);
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
export function applyTheme(theme: Record<string, string> | null): void {
  if (!theme) return;
  const el = document.documentElement;
  const darkOverridable = new Set(['bg', 'surface', 'text', 'text_muted', 'border']);
  const map: Record<string, string> = {
    primary: '--color-primary',
    primary_hover: '--color-primary-hover',
    accent: '--color-accent',
    bg: '--color-bg',
    surface: '--color-surface',
    text: '--color-text',
    text_muted: '--color-text-muted',
    border: '--color-border',
    font_heading: '--font-heading',
    font_body: '--font-body',
    radius: '--radius',
    max_width: '--max-width',
  };
  const rootVars: string[] = [];
  for (const [key, prop] of Object.entries(map)) {
    if (!theme[key]) continue;
    if (darkOverridable.has(key)) {
      rootVars.push(`${prop}: ${theme[key]};`);
    } else {
      el.style.setProperty(prop, theme[key]);
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
  styleEl.textContent = `:root {\n  ${rootVars.join('\n  ')}\n}`;
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
  session.user.member = member;
  localStorage.setItem('wl_session', JSON.stringify(session));
}

async function loadMemberRecord(): Promise<void> {
  const session = getSession();
  if (!session) return;

  const cacheKey = WL_CACHE_MEMBER_PREFIX + session.user.id;
  const cached = readCache(cacheKey);
  if (cached) {
    applyMemberToSession(cached);
    if (!isFresh(cacheKey, MEMBER_TTL)) {
      get(`members?user_id=eq.${session.user.id}&limit=1`).then((members: any[]) => {
        if (members?.[0]) {
          writeCache(cacheKey, members[0]);
          if (JSON.stringify(members[0]) !== JSON.stringify(cached)) {
            applyMemberToSession(members[0]);
            // Page-render hydration will refresh the sign_in_bar block.
            document.dispatchEvent(new CustomEvent('wl-auth-changed'));
          }
        }
      }).catch(() => {});
    }
    return;
  }

  try {
    const members = await get(`members?user_id=eq.${session.user.id}&limit=1`);
    if (members?.[0]) {
      applyMemberToSession(members[0]);
      writeCache(cacheKey, members[0]);
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
const ADMIN_PATHS = ['/admin.html', '/admin-members.html', '/admin-settings.html'];

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

    await loadMemberRecord();

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

    await loadMemberRecord();
  }

  const navToggle = document.getElementById('nav-toggle');
  if (navToggle && navToggle.dataset.bound !== 'true') {
    navToggle.dataset.bound = 'true';
    navToggle.addEventListener('click', () => {
      document.getElementById('nav-links')?.classList.toggle('open');
    });
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
