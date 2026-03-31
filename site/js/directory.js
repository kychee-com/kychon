// directory.js — Member directory logic

import { get } from './api.js?v=8';
import { requireAuth } from './auth.js?v=8';
import { getConfig } from './config.js?v=8';

let allMembers = [];
let tiers = [];

export async function initDirectory() {
  // Check auth gating
  const isPublic = getConfig('directory_public') === true;
  if (!isPublic && !requireAuth()) return;

  // Load tiers for filter dropdown
  try {
    tiers = await get('membership_tiers?order=position.asc');
    const tierFilter = document.getElementById('dir-tier-filter');
    if (tierFilter) {
      tierFilter.innerHTML =
        '<option value="">All Tiers</option>' +
        tiers.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    }
  } catch {}

  // Load members
  try {
    allMembers = await get('members?status=eq.active&order=display_name.asc');
    // Join tier names
    const tierMap = Object.fromEntries(tiers.map((t) => [t.id, t.name]));
    allMembers.forEach((m) => (m.tier_name = tierMap[m.tier_id] || ''));
  } catch (e) {
    console.warn('Failed to load members:', e);
  }

  renderMembers(allMembers);

  // Search
  document.getElementById('dir-search')?.addEventListener('input', applyFilters);
  document.getElementById('dir-tier-filter')?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const query = (document.getElementById('dir-search')?.value || '').toLowerCase();
  const tierId = document.getElementById('dir-tier-filter')?.value;

  let filtered = allMembers;
  if (query) {
    filtered = filtered.filter(
      (m) => m.display_name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query),
    );
  }
  if (tierId) {
    filtered = filtered.filter((m) => String(m.tier_id) === tierId);
  }
  renderMembers(filtered);
}

function renderMembers(members) {
  const grid = document.getElementById('dir-grid');
  if (!grid) return;

  if (members.length === 0) {
    grid.innerHTML = '<p class="text-muted text-center">No members found.</p>';
    return;
  }

  grid.innerHTML = members
    .map(
      (m) => `
    <div class="card member-card" data-member-id="${m.id}" style="cursor:pointer">
      ${
        m.avatar_url
          ? `<img class="member-avatar" src="${esc(m.avatar_url)}" alt="">`
          : `<div class="member-avatar" style="background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:600">${(m.display_name || '?')[0].toUpperCase()}</div>`
      }
      <div class="member-info">
        <div class="member-name">${esc(m.display_name)}</div>
        <div class="member-meta">
          ${m.tier_name ? `<span class="badge badge-primary">${esc(m.tier_name)}</span> ` : ''}
          Joined ${formatDate(m.joined_at)}
        </div>
      </div>
    </div>`,
    )
    .join('');

  // Click to show detail
  grid.querySelectorAll('[data-member-id]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.memberId, 10);
      showMemberDetail(members.find((m) => m.id === id));
    });
  });
}

function showMemberDetail(member) {
  if (!member) return;
  const modal = document.getElementById('member-modal');
  if (!modal) return;

  document.getElementById('mm-name').textContent = member.display_name;
  document.getElementById('mm-bio').textContent = member.bio || 'No bio yet.';
  document.getElementById('mm-tier').textContent = member.tier_name || 'Member';
  document.getElementById('mm-joined').textContent = `Joined ${formatDate(member.joined_at)}`;

  const avatar = document.getElementById('mm-avatar');
  if (member.avatar_url) {
    avatar.src = member.avatar_url;
    avatar.style.display = '';
  } else {
    avatar.style.display = 'none';
  }

  // Custom fields
  const cfEl = document.getElementById('mm-custom-fields');
  if (cfEl && member.custom_fields) {
    cfEl.innerHTML = Object.entries(member.custom_fields)
      .filter(([_, v]) => v)
      .map(([k, v]) => `<div class="text-sm"><strong>${esc(k)}:</strong> ${esc(v)}</div>`)
      .join('');
  }

  modal.classList.remove('hidden');
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
