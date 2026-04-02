// @ts-check
// config.js — Loads site_config, injects theme, builds nav, manages feature flags

import { applyA11yPrefs, buildA11yToolbar, trapFocus } from './accessibility.js?v=9';
import { get } from './api.js?v=9';
import { getRole, getSession, isAdmin } from './auth.js?v=9';
import { getAvailableLocales, getLocale, loadLocale, setAvailableLocales, setLanguage, t } from './i18n.js?v=9';

// Apply a11y preferences immediately (before config fetch) to prevent flash
applyA11yPrefs();

// --- Cache layer (stale-while-revalidate) ---
const WL_CACHE_CONFIG = 'wl_cache_site_config';
const WL_CACHE_MEMBER_PREFIX = 'wl_cache_member_';
const CONFIG_TTL = 5 * 60 * 1000; // 5 minutes
const MEMBER_TTL = 10 * 60 * 1000; // 10 minutes

function readCache(key) {
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

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // QuotaExceededError or disabled — skip silently
  }
}

function isFresh(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return typeof ts === 'number' && ts + ttlMs > Date.now();
  } catch {
    return false;
  }
}

export function clearCache(key) {
  localStorage.removeItem(key);
}

const WL_CACHE_HERO_IMG = 'wl_cache_hero_img';

export function preloadHeroImage() {
  const url = readCache(WL_CACHE_HERO_IMG);
  if (url && !document.querySelector('link[rel="preload"][as="image"]')) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  }
}

export function cacheHeroImage(url) {
  if (url) writeCache(WL_CACHE_HERO_IMG, url);
}

const siteConfig = {};
const features = {};

export function getConfig(key) {
  const row = siteConfig[key];
  return row !== undefined ? row : null;
}

export function isFeatureEnabled(flag) {
  return features[flag] === true;
}

function applyTheme(theme) {
  if (!theme) return;
  const el = document.documentElement;
  // Colors that dark mode overrides — set only on :root, not inline
  const darkOverridable = new Set(['bg', 'surface', 'text', 'text_muted', 'border']);
  const map = {
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
  // Non-dark-overridable vars go inline (highest priority, same in both modes)
  // Dark-overridable vars go into a :root stylesheet so [data-theme="dark"] wins
  const rootVars = [];
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
    // Insert before other stylesheets so [data-theme="dark"] can override
    const firstLink = document.querySelector('link[rel="stylesheet"]');
    if (firstLink) firstLink.before(styleEl);
    else document.head.appendChild(styleEl);
  }
  styleEl.textContent = `:root {\n  ${rootVars.join('\n  ')}\n}`;
}

function applyBranding(config) {
  const name = config.site_name || 'Wild Lychee';
  document.title = document.title ? `${document.title} — ${name}` : name;

  const brandEl = document.querySelector('.nav-brand-text');
  if (brandEl) brandEl.textContent = name;

  const logoEl = /** @type {HTMLImageElement|null} */ (document.querySelector('.nav-brand img'));
  if (logoEl && config.logo_url) {
    logoEl.src = config.logo_url;
    logoEl.alt = name;
  } else if (logoEl && !config.logo_url) {
    logoEl.style.display = 'none';
  }

  const favicon = /** @type {HTMLLinkElement|null} */ (document.querySelector('link[rel="icon"]'));
  if (favicon && config.favicon_url) favicon.href = config.favicon_url;
}

// Map common nav labels (any language) to i18n keys
const NAV_LABEL_KEYS = {
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
  Configuración: 'nav.settings',
  Profile: 'nav.profile',
  Perfil: 'nav.profile',
  'About Us': 'nav.about',
  Nosotros: 'nav.about',
  Committees: 'nav.committees',
  Programas: 'nav.committees',
  Ministries: 'nav.committees',
};

function buildNav(navItems) {
  const navEl = document.getElementById('nav-links');
  if (!navEl || !navItems) return;

  const session = getSession();
  const role = getRole();
  const currentPath = window.location.pathname;

  navEl.innerHTML = '';
  for (const item of navItems) {
    // Filter by feature flag
    if (item.feature && !isFeatureEnabled(item.feature)) continue;
    // Filter by auth requirement
    if (item.auth && !session) continue;
    // Filter by admin requirement
    if (item.admin && role !== 'admin') continue;
    // Public items shown to all (no filter needed)

    const a = document.createElement('a');
    a.className = `nav-link${currentPath === item.href ? ' active' : ''}`;
    a.href = item.href;
    // Translate nav labels via i18n key mapping
    const labelKey = NAV_LABEL_KEYS[item.label];
    a.textContent = labelKey ? t(labelKey) : item.label;
    navEl.appendChild(a);
  }
}

const LANG_LABELS = { en: 'EN', es: 'ES', pt: 'PT', fr: 'FR', de: 'DE', zh: '中文', ja: '日本語', ko: '한국어' };

function buildUserNav() {
  const userEl = document.getElementById('nav-user');
  if (!userEl) return;

  const session = getSession();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const locales = getAvailableLocales();
  const currentLocale = getLocale();

  // Build all nav-user HTML in one write to prevent multiple reflows
  const langBtn =
    locales.length >= 2
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

  // Attach event listeners after single DOM write
  document.getElementById('login-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('auth-modal');
    modal?.classList.remove('hidden');
    if (modal) trapFocus(modal.querySelector('.auth-panel'));
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
    document.getElementById('theme-toggle').textContent = next === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
  });
  if (locales.length >= 2) {
    document.getElementById('lang-toggle')?.addEventListener('click', async () => {
      const idx = locales.indexOf(currentLocale);
      const next = locales[(idx + 1) % locales.length];
      await setLanguage(next);
      window.location.reload();
    });
  }
}

function applyMemberToSession(member) {
  const session = getSession();
  if (!session) return;
  session.user.member = member;
  localStorage.setItem('wl_session', JSON.stringify(session));
}

async function loadMemberRecord() {
  const session = getSession();
  if (!session) return;

  const cacheKey = WL_CACHE_MEMBER_PREFIX + session.user.id;
  const cached = readCache(cacheKey);
  if (cached) {
    applyMemberToSession(cached);
    // Background refresh if stale
    if (!isFresh(cacheKey, MEMBER_TTL)) {
      get(`members?user_id=eq.${session.user.id}&limit=1`)
        .then((members) => {
          if (members?.[0]) {
            writeCache(cacheKey, members[0]);
            if (JSON.stringify(members[0]) !== JSON.stringify(cached)) {
              applyMemberToSession(members[0]);
              buildUserNav();
            }
          }
        })
        .catch(() => {});
    }
    return;
  }

  // Cache miss — blocking fetch (first visit)
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

async function loadAdminEditor() {
  if (!isAdmin()) return;
  document.body.classList.add('admin');
  const script = document.createElement('script');
  script.type = 'module';
  script.src = '/js/admin-editor.js';
  document.head.appendChild(script);
}

function populateConfigFromRows(rows) {
  for (const row of rows) {
    siteConfig[row.key] = row.value;
    if (row.key.startsWith('feature_') || row.key === 'directory_public') {
      features[row.key] = row.value === true || row.value === 'true';
    }
  }
}

const ADMIN_PATHS = ['/admin.html', '/admin-members.html', '/admin-settings.html'];

export async function init() {
  const isAdminPage = ADMIN_PATHS.includes(window.location.pathname);

  // Try cache first (skip on admin pages — admins need fresh data)
  const cached = !isAdminPage ? readCache(WL_CACHE_CONFIG) : null;

  // Preload hero image from cache (before any fetches)
  preloadHeroImage();

  if (cached) {
    // Cache hit — render immediately from cached data
    populateConfigFromRows(cached);
    applyTheme(siteConfig.theme);
    applyBranding(siteConfig);

    if (siteConfig.languages) setAvailableLocales(siteConfig.languages);
    await loadLocale(null, siteConfig.default_language);

    await loadMemberRecord();

    buildNav(siteConfig.nav);
    buildUserNav();
    buildA11yToolbar();

    // Background refresh if stale
    if (!isFresh(WL_CACHE_CONFIG, CONFIG_TTL)) {
      get('site_config')
        .then((rows) => {
          writeCache(WL_CACHE_CONFIG, rows);
          if (JSON.stringify(rows) !== JSON.stringify(cached)) {
            // Clear and re-populate with fresh data
            for (const key of Object.keys(siteConfig)) delete siteConfig[key];
            for (const key of Object.keys(features)) delete features[key];
            populateConfigFromRows(rows);
            applyTheme(siteConfig.theme);
            applyBranding(siteConfig);
            buildNav(siteConfig.nav);
          }
        })
        .catch(() => {});
    }
  } else {
    // Cache miss (first visit or admin page) — blocking fetch
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
    buildA11yToolbar();
  }

  // Mobile nav toggle
  document.getElementById('nav-toggle')?.addEventListener('click', () => {
    document.getElementById('nav-links')?.classList.toggle('open');
  });

  // Load admin editor if admin
  loadAdminEditor();

  return siteConfig;
}

// Translation helper for user-generated content
export async function getTranslatedContent(contentType, contentId, field) {
  const locale = localStorage.getItem('wl_locale') || siteConfig.default_language || 'en';
  const defaultLang = siteConfig.default_language || 'en';
  if (locale === defaultLang) return null; // Already in the base language
  try {
    const rows = await get(
      `content_translations?content_type=eq.${contentType}&content_id=eq.${contentId}&language=eq.${locale}&field=eq.${field}&limit=1`,
    );
    return rows.length > 0 ? rows[0].translated_text : null;
  } catch {
    return null;
  }
}

/**
 * Batch-translate an array of DB items. Fetches all translations for the content type
 * in one query, then patches each item's fields in-place.
 * @param {string} contentType - e.g. 'announcement', 'event', 'resource', 'page'
 * @param {Array} items - array of objects with `id` and text fields
 * @param {string[]} fields - which fields to translate, e.g. ['title', 'body']
 * @returns {Promise<Array>} the same items array, mutated with translations
 */
export async function translateItems(contentType, items, fields) {
  const locale = localStorage.getItem('wl_locale') || siteConfig.default_language || 'en';
  const defaultLang = siteConfig.default_language || 'en';
  if (locale === defaultLang || !items.length) return items;
  try {
    const ids = items.map((i) => i.id);
    const rows = await get(
      `content_translations?content_type=eq.${contentType}&language=eq.${locale}&content_id=in.(${ids.join(',')})`,
    );
    const map = {};
    for (const r of rows) {
      const key = `${r.content_id}:${r.field}`;
      map[key] = r.translated_text;
    }
    for (const item of items) {
      for (const field of fields) {
        const val = map[`${item.id}:${field}`];
        if (val) item[field] = val;
      }
    }
  } catch {
    // translation fetch failed, use originals
  }
  return items;
}

/**
 * Add a Twitter-style "Translate" link to a DOM element containing user-generated content.
 * When clicked, calls the AI translation function and shows the result inline.
 * @param {HTMLElement} el - the element containing the original text
 * @param {string} text - the original text to translate
 */
export function addTranslateButton(el, text) {
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
      const payload = { text, target_lang: locale };
      if (contentType && contentId && field) {
        payload.content_type = contentType;
        payload.content_id = contentId;
        payload.field = field;
      }
      const res = await fetch(`${window.__WILDLYCHEE_API}/functions/v1/translate-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.__WILDLYCHEE_ANON_KEY}`,
          apikey: window.__WILDLYCHEE_ANON_KEY,
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
