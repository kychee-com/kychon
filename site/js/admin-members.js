// admin-members.js — Member management

import { get, patch } from './api.js?v=3';
import { requireAdmin } from './auth.js?v=3';

let allMembers = [];
let tiers = [];

export async function initAdminMembers() {
  if (!requireAdmin()) return;

  // Load tiers
  try {
    tiers = await get('membership_tiers?order=position.asc');
    const tierFilter = document.getElementById('am-tier-filter');
    if (tierFilter) {
      tierFilter.innerHTML =
        '<option value="">All Tiers</option>' +
        tiers.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    }
  } catch {}

  await loadMembers();

  document.getElementById('am-search')?.addEventListener('input', applyFilters);
  document.getElementById('am-status-filter')?.addEventListener('change', applyFilters);
  document.getElementById('am-tier-filter')?.addEventListener('change', applyFilters);
  document.getElementById('am-export')?.addEventListener('click', exportCSV);
}

async function loadMembers() {
  try {
    allMembers = await get('members?order=created_at.desc');
    const tierMap = Object.fromEntries(tiers.map((t) => [t.id, t.name]));
    allMembers.forEach((m) => (m.tier_name = tierMap[m.tier_id] || ''));
    applyFilters();
  } catch (e) {
    console.warn('Failed to load members:', e);
  }
}

function applyFilters() {
  const query = (document.getElementById('am-search')?.value || '').toLowerCase();
  const status = document.getElementById('am-status-filter')?.value;
  const tierId = document.getElementById('am-tier-filter')?.value;

  let filtered = allMembers;
  if (query)
    filtered = filtered.filter(
      (m) => m.display_name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query),
    );
  if (status) filtered = filtered.filter((m) => m.status === status);
  if (tierId) filtered = filtered.filter((m) => String(m.tier_id) === tierId);

  renderTable(filtered);
}

function renderTable(members) {
  const tbody = document.getElementById('am-tbody');
  if (!tbody) return;

  if (members.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No members found.</td></tr>';
    return;
  }

  const tierOpts = tiers.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

  tbody.innerHTML = members
    .map(
      (m) => `
    <tr>
      <td>
        <div class="flex items-center gap-1">
          ${
            m.avatar_url
              ? `<img class="member-avatar" src="${esc(m.avatar_url)}" alt="" style="width:2rem;height:2rem">`
              : `<div class="member-avatar" style="width:2rem;height:2rem;background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-size:0.75rem;font-weight:600">${(m.display_name || '?')[0].toUpperCase()}</div>`
          }
          <div>
            <div style="font-weight:500">${esc(m.display_name)}</div>
            <div class="text-sm text-muted">${esc(m.email)}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-${statusColor(m.status)}">${esc(m.status)}</span></td>
      <td>${esc(m.tier_name)}</td>
      <td>${esc(m.role)}</td>
      <td class="text-sm text-muted">${formatDate(m.joined_at)}</td>
      <td>
        <div class="flex gap-1" style="flex-wrap:wrap">
          ${m.status === 'pending' ? `<button class="btn btn-sm btn-primary am-action" data-id="${m.id}" data-action="approve">Approve</button>` : ''}
          ${m.status === 'active' ? `<button class="btn btn-sm btn-secondary am-action" data-id="${m.id}" data-action="suspend">Suspend</button>` : ''}
          ${m.status === 'suspended' ? `<button class="btn btn-sm btn-secondary am-action" data-id="${m.id}" data-action="activate">Activate</button>` : ''}
          <select class="form-select btn-sm am-tier-change" data-id="${m.id}" style="width:auto;padding:0.2rem 0.4rem;font-size:0.8rem">
            <option value="">Tier...</option>
            ${tierOpts}
          </select>
          <select class="form-select btn-sm am-role-change" data-id="${m.id}" style="width:auto;padding:0.2rem 0.4rem;font-size:0.8rem">
            <option value="">Role...</option>
            <option value="member">Member</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </td>
    </tr>`,
    )
    .join('');

  // Actions
  tbody.querySelectorAll('.am-action').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const statusMap = { approve: 'active', suspend: 'suspended', activate: 'active' };
      await patch(`members?id=eq.${id}`, { status: statusMap[action] });
      loadMembers();
    });
  });

  tbody.querySelectorAll('.am-tier-change').forEach((sel) => {
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      await patch(`members?id=eq.${sel.dataset.id}`, { tier_id: parseInt(sel.value, 10) });
      loadMembers();
    });
  });

  tbody.querySelectorAll('.am-role-change').forEach((sel) => {
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      await patch(`members?id=eq.${sel.dataset.id}`, { role: sel.value });
      loadMembers();
    });
  });
}

function exportCSV() {
  const headers = ['display_name', 'email', 'status', 'role', 'tier', 'joined_at'];
  const rows = allMembers.map((m) => [m.display_name, m.email, m.status, m.role, m.tier_name, m.joined_at]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'members.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function statusColor(s) {
  const map = { active: 'success', pending: 'warning', expired: 'danger', suspended: 'danger' };
  return map[s] || 'primary';
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}
