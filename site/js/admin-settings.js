// admin-settings.js — Site settings panel

import { get, patch, post } from './api.js';
import { requireAdmin } from './auth.js';

let configMap = {};

export async function initAdminSettings() {
  if (!requireAdmin()) return;

  // Load current config
  try {
    const rows = await get('site_config');
    for (const row of rows) configMap[row.key] = row.value;
  } catch {}

  // Populate branding
  setVal('as-site-name', configMap.site_name);
  setVal('as-site-tagline', configMap.site_tagline);
  setVal('as-site-description', configMap.site_description);
  setVal('as-logo-url', configMap.logo_url);
  setVal('as-favicon-url', configMap.favicon_url);

  // Populate theme
  const theme = configMap.theme || {};
  setVal('as-primary', theme.primary);
  setVal('as-primary-hover', theme.primary_hover);
  setVal('as-bg', theme.bg);
  setVal('as-surface', theme.surface);
  setVal('as-text', theme.text);
  setVal('as-text-muted', theme.text_muted);
  setVal('as-border', theme.border);
  setVal('as-font-heading', theme.font_heading);
  setVal('as-font-body', theme.font_body);
  setVal('as-radius', theme.radius);

  // Populate feature flags
  const featureContainer = document.getElementById('as-features');
  if (featureContainer) {
    const flags = Object.entries(configMap)
      .filter(([k]) => k.startsWith('feature_'))
      .sort(([a], [b]) => a.localeCompare(b));
    featureContainer.innerHTML = flags.map(([key, val]) => `
      <label class="flex items-center gap-1" style="padding:0.5rem 0">
        <input type="checkbox" class="feature-toggle" data-key="${key}" ${val === true || val === 'true' ? 'checked' : ''}>
        <span>${key.replace('feature_', '').replace(/_/g, ' ')}</span>
      </label>`).join('');
  }

  // Load tiers
  await loadTiers();

  // Save handlers
  document.getElementById('as-branding-form')?.addEventListener('submit', saveBranding);
  document.getElementById('as-theme-form')?.addEventListener('submit', saveTheme);

  // Feature flag toggles
  document.querySelectorAll('.feature-toggle').forEach(cb => {
    cb.addEventListener('change', async () => {
      await patchConfig(cb.dataset.key, cb.checked);
    });
  });
}

async function saveBranding(e) {
  e.preventDefault();
  await Promise.all([
    patchConfig('site_name', getVal('as-site-name')),
    patchConfig('site_tagline', getVal('as-site-tagline')),
    patchConfig('site_description', getVal('as-site-description')),
    patchConfig('logo_url', getVal('as-logo-url')),
    patchConfig('favicon_url', getVal('as-favicon-url')),
  ]);
  showSaved('as-branding-save');
}

async function saveTheme(e) {
  e.preventDefault();
  const theme = {
    primary: getVal('as-primary'),
    primary_hover: getVal('as-primary-hover'),
    bg: getVal('as-bg'),
    surface: getVal('as-surface'),
    text: getVal('as-text'),
    text_muted: getVal('as-text-muted'),
    border: getVal('as-border'),
    font_heading: getVal('as-font-heading'),
    font_body: getVal('as-font-body'),
    radius: getVal('as-radius'),
  };
  await patchConfig('theme', theme);
  showSaved('as-theme-save');
}

async function patchConfig(key, value) {
  // Use service-level patch: update existing row
  await patch('site_config?key=eq.' + key, { value: JSON.stringify(value) });
}

async function loadTiers() {
  const container = document.getElementById('as-tiers');
  if (!container) return;
  try {
    const tiers = await get('membership_tiers?order=position.asc');
    container.innerHTML = tiers.map(t => `
      <div class="card mb-1 flex justify-between items-center" style="padding:0.75rem 1rem">
        <div>
          <strong>${esc(t.name)}</strong>
          ${t.is_default ? '<span class="badge badge-primary">Default</span>' : ''}
          <div class="text-sm text-muted">${esc(t.price_label || 'Free')} — ${(t.benefits || []).join(', ')}</div>
        </div>
      </div>`).join('');
  } catch {}
}

function getVal(id) { return document.getElementById(id)?.value || ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
function showSaved(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.textContent = 'Saved!';
  setTimeout(() => btn.textContent = 'Save', 2000);
}
function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
