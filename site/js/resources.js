// resources.js — Resource library logic

import { get, post, del } from './api.js';
import { isAdmin, isAuthenticated } from './auth.js';

let allResources = [];

export async function initResources() {
  try {
    allResources = await get('resources?order=created_at.desc');
    renderResources(allResources);
  } catch (e) {
    console.warn('Failed to load resources:', e);
  }

  document.getElementById('res-category-filter')?.addEventListener('change', applyFilter);

  if (isAdmin()) setupUpload();
}

function applyFilter() {
  const cat = document.getElementById('res-category-filter')?.value;
  const filtered = cat ? allResources.filter(r => r.category === cat) : allResources;
  renderResources(filtered);
}

function renderResources(resources) {
  const grid = document.getElementById('resources-grid');
  if (!grid) return;

  // Populate category filter
  const cats = [...new Set(allResources.map(r => r.category).filter(Boolean))];
  const filter = document.getElementById('res-category-filter');
  if (filter && filter.children.length <= 1) {
    filter.innerHTML = '<option value="">All Categories</option>' +
      cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }

  if (resources.length === 0) {
    grid.innerHTML = '<p class="text-muted">No resources yet.</p>';
    return;
  }

  grid.innerHTML = resources.map(r => {
    // Hide members-only from anonymous
    if (r.is_members_only && !isAuthenticated()) return '';
    const icon = fileTypeIcon(r.file_type);
    return `
      <div class="card">
        <div class="flex items-center gap-1 mb-1">
          <span style="font-size:1.5rem">${icon}</span>
          <div>
            <h4 style="margin:0">${esc(r.title)}</h4>
            ${r.category ? `<span class="badge badge-primary">${esc(r.category)}</span>` : ''}
          </div>
        </div>
        ${r.description ? `<p class="text-sm text-muted">${esc(r.description)}</p>` : ''}
        <div class="flex gap-1 mt-1">
          ${r.file_url ? `<a href="${esc(r.file_url)}" class="btn btn-sm btn-secondary" target="_blank">Download</a>` : ''}
          ${r.is_members_only ? '<span class="badge badge-warning">Members Only</span>' : ''}
          ${isAdmin() ? `<button class="btn btn-sm btn-danger res-delete" data-id="${r.id}">Delete</button>` : ''}
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.res-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this resource?')) return;
      await del('resources?id=eq.' + btn.dataset.id);
      allResources = allResources.filter(r => r.id !== parseInt(btn.dataset.id));
      renderResources(allResources);
    });
  });
}

function setupUpload() {
  const btn = document.getElementById('res-upload-btn');
  if (!btn) return;
  btn.classList.remove('hidden');
  btn.addEventListener('click', () => {
    document.getElementById('res-form-modal')?.classList.remove('hidden');
  });

  document.getElementById('res-form-cancel')?.addEventListener('click', () => {
    document.getElementById('res-form-modal')?.classList.add('hidden');
  });

  document.getElementById('res-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const session = JSON.parse(localStorage.getItem('wl_session') || '{}');

    // For link-type resources, just insert directly
    const fileType = document.getElementById('rf-type').value;
    const data = {
      title: document.getElementById('rf-title').value,
      description: document.getElementById('rf-description').value,
      category: document.getElementById('rf-category').value,
      file_type: fileType,
      is_members_only: document.getElementById('rf-members-only').checked,
      uploaded_by: session.user?.member?.id,
    };

    if (fileType === 'link') {
      data.file_url = document.getElementById('rf-url').value;
      await post('resources', data);
    } else {
      // Upload file via edge function
      const fileInput = document.getElementById('rf-file');
      const file = fileInput?.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify(data));
        const res = await fetch(window.__WILDLYCHEE_API + '/functions/v1/upload-resource', {
          method: 'POST',
          headers: {
            apikey: window.__WILDLYCHEE_ANON_KEY,
            Authorization: 'Bearer ' + session.access_token,
          },
          body: formData,
        });
        if (!res.ok) {
          console.error('Upload failed:', await res.text());
          return;
        }
      }
    }

    document.getElementById('res-form-modal')?.classList.add('hidden');
    document.getElementById('res-form')?.reset();
    allResources = await get('resources?order=created_at.desc');
    renderResources(allResources);
  });
}

function fileTypeIcon(type) {
  const icons = { pdf: '📄', video: '🎬', link: '🔗', image: '🖼️' };
  return icons[type] || '📁';
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
