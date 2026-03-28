// config.js — Loads site_config, injects theme, builds nav, manages feature flags

import { get } from './api.js';
import { getSession, getRole, isAdmin } from './auth.js';
import { loadLocale, t } from './i18n.js';

let siteConfig = {};
let features = {};

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
  for (const [key, prop] of Object.entries(map)) {
    if (theme[key]) el.style.setProperty(prop, theme[key]);
  }
}

function applyBranding(config) {
  const name = config.site_name || 'Wild Lychee';
  document.title = document.title ? document.title + ' — ' + name : name;

  const brandEl = document.querySelector('.nav-brand-text');
  if (brandEl) brandEl.textContent = name;

  const logoEl = document.querySelector('.nav-brand img');
  if (logoEl && config.logo_url) {
    logoEl.src = config.logo_url;
    logoEl.alt = name;
  } else if (logoEl && !config.logo_url) {
    logoEl.style.display = 'none';
  }

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && config.favicon_url) favicon.href = config.favicon_url;
}

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
    a.className = 'nav-link' + (currentPath === item.href ? ' active' : '');
    a.href = item.href;
    a.textContent = item.label;
    navEl.appendChild(a);
  }
}

function buildUserNav() {
  const userEl = document.getElementById('nav-user');
  if (!userEl) return;

  const session = getSession();
  if (!session) {
    userEl.innerHTML = '<button class="btn btn-primary btn-sm" id="login-btn">Sign In</button>';
    document.getElementById('login-btn')?.addEventListener('click', () => {
      document.getElementById('auth-modal')?.classList.remove('hidden');
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
}

async function ensureMemberRecord() {
  const session = getSession();
  if (!session) return;
  try {
    const members = await get('members?user_id=eq.' + session.user.id + '&limit=1');
    if (!members || members.length === 0) {
      // Call on-signup function to create member record
      const res = await fetch(window.__WILDLYCHEE_API + '/functions/v1/on-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: window.__WILDLYCHEE_ANON_KEY,
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ email: session.user.email }),
      });
      if (res.ok) {
        // Refresh session data
        const member = await get('members?user_id=eq.' + session.user.id + '&limit=1');
        if (member && member[0]) {
          session.user.member = member[0];
          localStorage.setItem('wl_session', JSON.stringify(session));
        }
      }
    } else {
      session.user.member = members[0];
      localStorage.setItem('wl_session', JSON.stringify(session));
    }
  } catch (e) {
    console.warn('ensureMemberRecord failed:', e);
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

  // Load i18n
  await loadLocale();

  // Ensure member record exists for authenticated users (must happen before nav build)
  await ensureMemberRecord();

  // Build nav (after member record is loaded so admin role is known)
  buildNav(siteConfig.nav);
  buildUserNav();

  // Mobile nav toggle
  document.getElementById('nav-toggle')?.addEventListener('click', () => {
    document.getElementById('nav-links')?.classList.toggle('open');
  });

  // Load admin editor if admin
  loadAdminEditor();

  return siteConfig;
}

export { siteConfig, features };
