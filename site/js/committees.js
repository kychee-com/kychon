// committees.js — Committee listing and detail

import { del, get, post } from './api.js?v=6';
import { isAdmin } from './auth.js?v=6';
import { translateItems } from './config.js?v=6';

export async function initCommittees() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (id) {
    await renderCommitteeDetail(id);
  } else {
    await renderCommitteeList();
  }
}

async function renderCommitteeList() {
  const container = document.getElementById('committees-content');
  if (!container) return;

  try {
    const committees = await get('committees?order=name.asc');
    await translateItems('committee', committees, ['name', 'description']);
    // Get member counts
    const members = await get('committee_members?select=committee_id');
    const countMap = {};
    members.forEach((m) => {
      countMap[m.committee_id] = (countMap[m.committee_id] || 0) + 1;
    });

    if (committees.length === 0) {
      container.innerHTML = '<p class="text-muted">No committees yet.</p>';
    } else {
      container.innerHTML =
        '<div class="card-grid">' +
        committees
          .map(
            (c) => `
        <a href="/committees.html?id=${c.id}" class="card" style="text-decoration:none;color:inherit">
          <h3>${esc(c.name)}</h3>
          <p class="text-sm text-muted">${esc(c.description || '')}</p>
          <span class="badge badge-primary">${countMap[c.id] || 0} members</span>
        </a>
      `,
          )
          .join('') +
        '</div>';
    }

    if (isAdmin()) {
      document.getElementById('committee-create-btn')?.classList.remove('hidden');
      setupCreate(container);
    }
  } catch (_e) {
    container.innerHTML = '<p class="text-muted">Failed to load committees.</p>';
  }
}

async function renderCommitteeDetail(id) {
  const container = document.getElementById('committees-content');
  if (!container) return;

  try {
    const committees = await get(`committees?id=eq.${id}&limit=1`);
    if (committees.length === 0) {
      container.innerHTML = '<p>Committee not found.</p>';
      return;
    }
    const committee = committees[0];
    await translateItems('committee', [committee], ['name', 'description']);
    const members = await get(`committee_members?committee_id=eq.${id}&select=*,members(display_name,avatar_url)`);
    const allMembers = isAdmin() ? await get('members?status=eq.active&order=display_name.asc') : [];

    container.innerHTML = `
      <p class="mb-1"><a href="/committees.html">&larr; All Committees</a></p>
      <h2>${esc(committee.name)}</h2>
      <p class="text-muted">${esc(committee.description || '')}</p>

      <div class="mt-2">
        <h3 class="mb-1">Members (${members.length})</h3>
        ${members.length === 0 ? '<p class="text-muted">No members assigned.</p>' : ''}
        ${members
          .map(
            (m) => `
          <div class="member-card card mb-1">
            ${
              m.members?.avatar_url
                ? `<img class="member-avatar" src="${esc(m.members.avatar_url)}" alt="">`
                : `<div class="member-avatar" style="background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:600">${(m.members?.display_name || '?')[0].toUpperCase()}</div>`
            }
            <div class="member-info">
              <span class="member-name">${esc(m.members?.display_name || 'Member')}</span>
              <span class="badge badge-${m.role === 'chair' ? 'warning' : 'primary'}">${esc(m.role)}</span>
            </div>
            ${isAdmin() ? `<button class="btn btn-sm btn-danger cm-remove" data-id="${m.id}" style="margin-left:auto">Remove</button>` : ''}
          </div>
        `,
          )
          .join('')}
      </div>

      ${
        isAdmin()
          ? `
        <div class="card mt-2">
          <h4 class="mb-1">Add Member</h4>
          <div class="flex gap-1">
            <select class="form-select" id="cm-member-select" style="flex:1">
              <option value="">Select member...</option>
              ${allMembers.map((m) => `<option value="${m.id}">${esc(m.display_name)} (${esc(m.email)})</option>`).join('')}
            </select>
            <select class="form-select" id="cm-role-select" style="width:8rem">
              <option value="member">Member</option>
              <option value="chair">Chair</option>
            </select>
            <button class="btn btn-primary btn-sm" id="cm-add-btn">Add</button>
          </div>
        </div>
        <div class="mt-2">
          <button class="btn btn-danger btn-sm" id="cm-delete-committee">Delete Committee</button>
        </div>
      `
          : ''
      }
    `;

    // Admin handlers
    container.querySelectorAll('.cm-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await del(`committee_members?id=eq.${btn.dataset.id}`);
        renderCommitteeDetail(id);
      });
    });

    document.getElementById('cm-add-btn')?.addEventListener('click', async () => {
      const memberId = document.getElementById('cm-member-select')?.value;
      const role = document.getElementById('cm-role-select')?.value;
      if (!memberId) return;
      await post('committee_members', { committee_id: parseInt(id, 10), member_id: parseInt(memberId, 10), role });
      renderCommitteeDetail(id);
    });

    document.getElementById('cm-delete-committee')?.addEventListener('click', async () => {
      if (!confirm('Delete this committee?')) return;
      await del(`committees?id=eq.${id}`);
      window.location.href = '/committees.html';
    });
  } catch (_e) {
    container.innerHTML = '<p>Error loading committee.</p>';
  }
}

function setupCreate() {
  document.getElementById('committee-create-btn')?.addEventListener('click', () => {
    document.getElementById('cm-form-modal')?.classList.remove('hidden');
  });
  document.getElementById('cm-form-cancel')?.addEventListener('click', () => {
    document.getElementById('cm-form-modal')?.classList.add('hidden');
  });
  document.getElementById('cm-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await post('committees', {
      name: document.getElementById('cmf-name').value,
      description: document.getElementById('cmf-description').value,
    });
    document.getElementById('cm-form-modal')?.classList.add('hidden');
    document.getElementById('cm-form')?.reset();
    renderCommitteeList();
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}
