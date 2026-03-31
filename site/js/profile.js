// profile.js — Profile editor logic

import { get, patch } from './api.js?v=8';
import { getSession, requireAuth } from './auth.js?v=8';

const API = window.__WILDLYCHEE_API || 'https://api.run402.com';
const ANON_KEY = window.__WILDLYCHEE_ANON_KEY || '';

export async function initProfile() {
  if (!requireAuth()) return;

  const session = getSession();
  const member = session.user?.member;
  if (!member) return;

  // Populate fields
  document.getElementById('profile-name').value = member.display_name || '';
  document.getElementById('profile-bio').value = member.bio || '';
  if (member.avatar_url) {
    document.getElementById('profile-avatar-img').src = member.avatar_url;
  }

  // Load custom fields
  await renderCustomFields(member);

  // Save handler
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      display_name: document.getElementById('profile-name').value,
      bio: document.getElementById('profile-bio').value,
    };

    // Gather custom fields
    const customFields = { ...member.custom_fields };
    document.querySelectorAll('[data-custom-field]').forEach((el) => {
      customFields[el.dataset.customField] = el.value;
    });
    body.custom_fields = customFields;

    await patch(`members?id=eq.${member.id}`, body);

    // Update session
    Object.assign(member, body);
    localStorage.setItem('wl_session', JSON.stringify(session));

    const btn = document.getElementById('profile-save');
    btn.textContent = 'Saved!';
    setTimeout(() => (btn.textContent = 'Save'), 2000);
  });

  // Avatar upload
  document.getElementById('profile-avatar-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const path = `avatars/${member.id}/${file.name}`;
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API}/storage/v1/upload/${path}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      const avatarUrl = data.url || `/storage/${path}`;
      await patch(`members?id=eq.${member.id}`, { avatar_url: avatarUrl });
      document.getElementById('profile-avatar-img').src = avatarUrl;
      member.avatar_url = avatarUrl;
      localStorage.setItem('wl_session', JSON.stringify(session));
    }
  });
}

async function renderCustomFields(member) {
  const container = document.getElementById('custom-fields');
  if (!container) return;
  try {
    const fields = await get('member_custom_fields?order=position.asc');
    if (fields.length === 0) return;
    container.innerHTML = fields
      .map((f) => {
        const val = member.custom_fields?.[f.field_name] || '';
        switch (f.field_type) {
          case 'textarea':
            return `<div class="form-group">
            <label class="form-label">${esc(f.field_label)}</label>
            <textarea class="form-textarea" data-custom-field="${esc(f.field_name)}">${esc(val)}</textarea>
          </div>`;
          case 'select': {
            const opts = (f.options || [])
              .map((o) => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`)
              .join('');
            return `<div class="form-group">
            <label class="form-label">${esc(f.field_label)}</label>
            <select class="form-select" data-custom-field="${esc(f.field_name)}"><option value="">—</option>${opts}</select>
          </div>`;
          }
          case 'date':
            return `<div class="form-group">
            <label class="form-label">${esc(f.field_label)}</label>
            <input class="form-input" type="date" data-custom-field="${esc(f.field_name)}" value="${esc(val)}">
          </div>`;
          case 'url':
            return `<div class="form-group">
            <label class="form-label">${esc(f.field_label)}</label>
            <input class="form-input" type="url" data-custom-field="${esc(f.field_name)}" value="${esc(val)}">
          </div>`;
          default:
            return `<div class="form-group">
            <label class="form-label">${esc(f.field_label)}</label>
            <input class="form-input" type="text" data-custom-field="${esc(f.field_name)}" value="${esc(val)}">
          </div>`;
        }
      })
      .join('');
  } catch (e) {
    console.warn('Failed to load custom fields:', e);
  }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}
