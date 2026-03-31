// @ts-check
// config.js — Loads site_config, injects theme, builds nav, manages feature flags

import { applyA11yPrefs, buildA11yToolbar, trapFocus } from './accessibility.js?v=3';
import { get } from './api.js?v=3';
import { getRole, getSession, isAdmin } from './auth.js?v=3';
import { getLocale, loadLocale, setAvailableLocales, setLanguage, getAvailableLocales, t } from './i18n.js?v=3';

// Apply a11y preferences immediately (before config fetch) to prevent flash
applyA11yPrefs();

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
  Home: 'nav.home', Inicio: 'nav.home',
  Members: 'nav.members', Miembros: 'nav.members', Residents: 'nav.members',
  Events: 'nav.events', Eventos: 'nav.events',
  Resources: 'nav.resources', Recursos: 'nav.resources', Sermons: 'nav.resources', Documents: 'nav.resources',
  Forum: 'nav.forum', Foro: 'nav.forum',
  Dashboard: 'nav.dashboard', Panel: 'nav.dashboard',
  Settings: 'nav.settings', 'Configuración': 'nav.settings',
  Profile: 'nav.profile', Perfil: 'nav.profile',
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

function buildThemeToggle() {
  const userEl = document.getElementById('nav-user');
  if (!userEl) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const btn = document.createElement('button');
  btn.className = 'btn btn-sm btn-secondary';
  btn.id = 'theme-toggle';
  btn.setAttribute('aria-label', 'Toggle dark mode');
  btn.textContent = isDark ? '\u2600\uFE0F' : '\uD83C\uDF19';
  btn.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = dark ? 'light' : 'dark';
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('wl_theme', next);
    btn.textContent = next === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
  });
  userEl.prepend(btn);
}

function buildUserNav() {
  const userEl = document.getElementById('nav-user');
  if (!userEl) return;

  const session = getSession();
  if (!session) {
    userEl.innerHTML = `<button class="btn btn-primary btn-sm" id="login-btn">${t('nav.sign_in')}</button>`;
    document.getElementById('login-btn')?.addEventListener('click', () => {
      const modal = document.getElementById('auth-modal');
      modal?.classList.remove('hidden');
      if (modal) trapFocus(modal.querySelector('.auth-panel'));
    });
  } else {
    const user = session.user || {};
    const avatar = user.avatar_url
      ? `<img class="nav-avatar" src="${user.avatar_url}" alt="">`
      : `<div class="nav-avatar" style="background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:0.875rem">${(user.display_name || user.email || '?')[0].toUpperCase()}</div>`;
    userEl.innerHTML = `
      <a href="/profile.html" class="nav-link">${avatar}</a>
      <button class="btn btn-sm btn-secondary" id="logout-btn">Sign Out</button>
    `;
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      localStorage.removeItem('wl_session');
      window.location.href = '/';
    });
  }
  // Add theme toggle after user nav is built
  buildThemeToggle();
  buildLanguageSwitcher();
}

const LANG_LABELS = { en: 'EN', es: 'ES', pt: 'PT', fr: 'FR', de: 'DE', zh: '中文', ja: '日本語', ko: '한국어' };

function buildLanguageSwitcher() {
  const locales = getAvailableLocales();
  if (locales.length < 2) return;
  const userEl = document.getElementById('nav-user');
  if (!userEl) return;
  const current = getLocale();
  const btn = document.createElement('button');
  btn.className = 'btn btn-sm btn-secondary';
  btn.id = 'lang-toggle';
  btn.setAttribute('aria-label', 'Switch language');
  btn.textContent = LANG_LABELS[current] || current.toUpperCase();
  btn.addEventListener('click', async () => {
    const idx = locales.indexOf(current);
    const next = locales[(idx + 1) % locales.length];
    await setLanguage(next);
    window.location.reload();
  });
  userEl.prepend(btn);
}

async function loadMemberRecord() {
  const session = getSession();
  if (!session) return;
  try {
    const members = await get(`members?user_id=eq.${session.user.id}&limit=1`);
    if (members?.[0]) {
      session.user.member = members[0];
      localStorage.setItem('wl_session', JSON.stringify(session));
    }
    // Note: on-signup is now called automatically by Run402 as a lifecycle hook.
    // If the member record doesn't exist yet (race condition on first page load
    // right after signup), the nav will render without admin controls and the
    // next page load will pick it up.
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

export async function init() {
  // Load site config
  try {
    const rows = await get('site_config');
    for (const row of rows) {
      siteConfig[row.key] = row.value;
      if (row.key.startsWith('feature_') || row.key === 'directory_public') {
        features[row.key] = row.value === true || row.value === 'true';
      }
    }
  } catch (e) {
    console.warn('Failed to load site_config:', e);
  }

  // Apply theme
  applyTheme(siteConfig.theme);

  // Apply branding
  applyBranding(siteConfig);

  // Load i18n — pass DB languages if available
  if (siteConfig.languages) setAvailableLocales(siteConfig.languages);
  await loadLocale(null, siteConfig.default_language);

  // Load member record for authenticated users (must happen before nav build)
  await loadMemberRecord();

  // Build nav (after member record is loaded so admin role is known)
  buildNav(siteConfig.nav);
  buildUserNav();
  buildA11yToolbar();

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
  const locale = localStorage.getItem('wl_locale') || 'en';
  if (locale === 'en') return null; // Original content is English
  try {
    const rows = await get(
      `content_translations?content_type=eq.${contentType}&content_id=eq.${contentId}&language=eq.${locale}&field=eq.${field}&limit=1`,
    );
    return rows.length > 0 ? rows[0].translated_text : null;
  } catch {
    return null;
  }
}

export { features, siteConfig };
