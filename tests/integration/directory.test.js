import { describe, expect, it } from 'vitest';
import { activeMember, allMembers, defaultTiers } from '../fixtures/members.js';

describe('directory rendering', () => {
  function renderMemberGrid(members) {
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    for (const m of members) {
      const card = document.createElement('div');
      card.className = 'card member-card';
      card.dataset.memberId = m.id;
      card.innerHTML = `
        <div class="member-name">${m.display_name}</div>
        <div class="member-meta">${m.tier_name || ''}</div>
      `;
      grid.appendChild(card);
    }
    return grid;
  }

  function filterMembers(members, { query, tierId }) {
    let filtered = members.filter((m) => m.status === 'active');
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter((m) => m.display_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
    }
    if (tierId) {
      filtered = filtered.filter((m) => String(m.tier_id) === String(tierId));
    }
    return filtered;
  }

  it('only shows active members', () => {
    const active = allMembers.filter((m) => m.status === 'active');
    const grid = renderMemberGrid(active);
    expect(grid.children.length).toBe(2); // admin + activeMember
    // pending and suspended should not be shown
  });

  it('search filters by name', () => {
    const tierMap = Object.fromEntries(defaultTiers.map((t) => [t.id, t.name]));
    const membersWithTier = allMembers.map((m) => ({ ...m, tier_name: tierMap[m.tier_id] || '' }));
    const filtered = filterMembers(membersWithTier, { query: 'Jane' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].display_name).toBe('Jane Member');
  });

  it('search filters by email', () => {
    const filtered = filterMembers(allMembers, { query: 'admin@' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].email).toBe('admin@test.com');
  });

  it('filters by tier', () => {
    const filtered = filterMembers(allMembers, { tierId: '2' });
    // Only suspended member has tier_id 2, but they're not active
    expect(filtered.length).toBe(0);
  });

  it('renders member cards with name', () => {
    const grid = renderMemberGrid([activeMember]);
    const name = grid.querySelector('.member-name');
    expect(name.textContent).toBe('Jane Member');
  });

  it('empty state when no members match', () => {
    const filtered = filterMembers(allMembers, { query: 'nobody' });
    expect(filtered.length).toBe(0);
  });
});
