// config.ts — Loads site_config, injects theme, builds nav, manages feature flags

import { get } from './api';
import { getRole, getSession, isAdmin } from './auth';
import { getAvailableLocales, getLocale, loadLocale, setAvailableLocales, setLanguage, t } from './i18n';

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

export function getConfig(key: string): any {
  const row = siteConfig[key];
  return row !== undefined ? row : null;
}

export function isFeatureEnabled(flag: string): boolean {
  return features[flag] === true;
}

// --- Theme ---
export function applyTheme(theme: Record<string, string> | null): void {
  if (!theme) return;
  const el = document.documentElement;
  const darkOverridable = new Set(['bg', 'surface', 'text', 'text_muted', 'border']);
  const map: Record<string, string> = {
    primary: '--color-primary',
    primary_hover: '--color-primary-hover',
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
export function applyBranding(config: Record<string, any>): void {
  const name = config.site_name || 'Kychon';
  document.title = document.title ? `${document.title} — ${name}` : name;

  const brandEl = document.querySelector('.nav-brand-text');
  if (brandEl) brandEl.textContent = name;

  const logoEl = document.querySelector('.nav-brand img') as HTMLImageElement | null;
  if (logoEl && config.logo_url) {
    logoEl.src = config.logo_url;
    logoEl.alt = name;
  } else if (logoEl && !config.logo_url) {
    logoEl.style.display = 'none';
  }

  const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (favicon && config.favicon_url) favicon.href = config.favicon_url;
}

// --- Navigation ---
const NAV_LABEL_KEYS: Record<string, string> = {
  Home: 'nav.home', Inicio: 'nav.home',
  Members: 'nav.members', Miembros: 'nav.members', Residents: 'nav.members',
  Events: 'nav.events', Eventos: 'nav.events',
  Resources: 'nav.resources', Recursos: 'nav.resources', Sermons: 'nav.resources', Documents: 'nav.resources',
  Forum: 'nav.forum', Foro: 'nav.forum',
  Dashboard: 'nav.dashboard', Panel: 'nav.dashboard',
  Settings: 'nav.settings', 'Configuración': 'nav.settings',
  Profile: 'nav.profile', Perfil: 'nav.profile',
  'About Us': 'nav.about', Nosotros: 'nav.about',
  Committees: 'nav.committees', Programas: 'nav.committees', Ministries: 'nav.committees',
};

export function buildNav(navItems: any[]): void {
  const navEl = document.getElementById('nav-links');
  if (!navEl || !navItems) return;

  const session = getSession();
  const role = getRole();
  const currentPath = window.location.pathname;

  navEl.innerHTML = '';
  for (const item of navItems) {
    if (item.feature && !isFeatureEnabled(item.feature)) continue;
    if (item.auth && !session) continue;
    if (item.admin && role !== 'admin') continue;

    const a = document.createElement('a');
    a.className = `nav-link${currentPath === item.href ? ' active' : ''}`;
    a.href = item.href;
    const labelKey = NAV_LABEL_KEYS[item.label];
    a.textContent = labelKey ? t(labelKey) : item.label;
    navEl.appendChild(a);
  }
}

// --- User nav ---
const LANG_LABELS: Record<string, string> = { en: 'EN', es: 'ES', pt: 'PT', fr: 'FR', de: 'DE', zh: '中文', ja: '日本語', ko: '한국어' };

export function buildUserNav(): void {
  const userEl = document.getElementById('nav-user');
  if (!userEl) return;

  const session = getSession();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const locales = getAvailableLocales();
  const currentLocale = getLocale();

  const langBtn = locales.length >= 2
    ? `<button class="btn btn-sm btn-secondary" id="lang-toggle" aria-label="Switch language">${LANG_LABELS[currentLocale] || currentLocale.toUpperCase()}</button>`
    : '';
  const themeBtn = `<button class="btn btn-sm btn-secondary" id="theme-toggle" aria-label="Toggle dark mode">${isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}</button>`;

  if (!session) {
    userEl.innerHTML = `${langBtn}${themeBtn}<button class="btn btn-primary btn-sm" id="login-btn">${t('nav.sign_in')}</button>`;
  } else {
    const user = session.user || {};
    const avatar = user.avatar_url
      ? `<img class="nav-avatar" src="${user.avatar_url}" alt="" width="32" height="32">`
      : `<div class="nav-avatar" style="background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:0.875rem">${(user.display_name || user.email || '?')[0].toUpperCase()}</div>`;
    userEl.innerHTML = `${langBtn}${themeBtn}<a href="/profile.html" class="nav-link">${avatar}</a><button class="btn btn-sm btn-secondary" id="logout-btn">Sign Out</button>`;
  }

  document.getElementById('login-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('auth-modal');
    modal?.classList.remove('hidden');
  });
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('wl_session');
    window.location.href = '/';
  });
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = dark ? 'light' : 'dark';
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('wl_theme', next);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = next === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
  });
  if (locales.length >= 2) {
    document.getElementById('lang-toggle')?.addEventListener('click', async () => {
      const idx = locales.indexOf(currentLocale);
      const next = locales[(idx + 1) % locales.length];
      await setLanguage(next);
      // Re-render nav with new translations instead of full reload
      buildNav(siteConfig.nav);
      buildUserNav();
      // Dispatch event so page scripts can re-render their content
      document.dispatchEvent(new CustomEvent('wl-locale-changed', { detail: { locale: next } }));
    });
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
            buildUserNav();
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

  preloadHeroImage();

  if (cached) {
    populateConfigFromRows(cached);
    applyTheme(siteConfig.theme);
    applyBranding(siteConfig);

    if (siteConfig.languages) setAvailableLocales(siteConfig.languages);
    await loadLocale(null, siteConfig.default_language);

    await loadMemberRecord();

    buildNav(siteConfig.nav);
    buildUserNav();

    if (!isFresh(WL_CACHE_CONFIG, CONFIG_TTL)) {
      get('site_config').then((rows: any[]) => {
        writeCache(WL_CACHE_CONFIG, rows);
        if (JSON.stringify(rows) !== JSON.stringify(cached)) {
          for (const key of Object.keys(siteConfig)) delete siteConfig[key];
          for (const key of Object.keys(features)) delete features[key];
          populateConfigFromRows(rows);
          applyTheme(siteConfig.theme);
          applyBranding(siteConfig);
          buildNav(siteConfig.nav);
        }
      }).catch(() => {});
    }
  } else {
    try {
      const rows = await get('site_config');
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

    buildNav(siteConfig.nav);
    buildUserNav();
  }

  document.getElementById('nav-toggle')?.addEventListener('click', () => {
    document.getElementById('nav-links')?.classList.toggle('open');
  });

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
