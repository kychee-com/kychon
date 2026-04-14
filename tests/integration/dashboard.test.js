import { describe, expect, it } from 'vitest';
import { allMembers, sampleActivity } from '../fixtures/members.js';

describe('dashboard rendering', () => {
  function renderStats(members) {
    const stats = {
      active: members.filter((m) => m.status === 'active').length,
      pending: members.filter((m) => m.status === 'pending').length,
      expired: members.filter((m) => m.status === 'expired').length,
      suspended: members.filter((m) => m.status === 'suspended').length,
    };

    const grid = document.createElement('div');
    grid.className = 'stats-grid';
    for (const [label, value] of Object.entries(stats)) {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.innerHTML = `<div class="stat-value">${value}</div><div class="stat-label">${label}</div>`;
      grid.appendChild(card);
    }
    return { grid, stats };
  }

  function renderActivityFeed(activities) {
    const feed = document.createElement('div');
    for (const a of activities) {
      const entry = document.createElement('div');
      entry.className = 'activity-entry';
      entry.innerHTML = `
        <span class="badge">${a.action}</span>
        <span>${a.members?.display_name || 'Unknown'}</span>
      `;
      feed.appendChild(entry);
    }
    return feed;
  }

  it('computes correct stats from member data', () => {
    const { stats } = renderStats(allMembers);
    expect(stats.active).toBe(2); // admin + activeMember
    expect(stats.pending).toBe(1);
    expect(stats.suspended).toBe(1);
  });

  it('renders stat cards', () => {
    const { grid } = renderStats(allMembers);
    const values = [...grid.querySelectorAll('.stat-value')].map((el) => el.textContent);
    expect(values).toContain('2'); // active
    expect(values).toContain('1'); // pending
  });

  it('renders activity feed entries', () => {
    const feed = renderActivityFeed(sampleActivity);
    expect(feed.children.length).toBe(3);
    const badges = [...feed.querySelectorAll('.badge')].map((el) => el.textContent);
    expect(badges).toContain('signup');
    expect(badges).toContain('announcement');
  });

  it('shows display name in activity', () => {
    const feed = renderActivityFeed(sampleActivity);
    expect(feed.innerHTML).toContain('Admin User');
    expect(feed.innerHTML).toContain('Jane Member');
  });

  it('handles empty activity feed', () => {
    const feed = renderActivityFeed([]);
    expect(feed.children.length).toBe(0);
  });
});
