import { describe, expect, it } from 'vitest';
import { allMembers, sampleActivity } from '../fixtures/members.js';
import { escapeHtml, htmlFixture } from '../helpers/dom-fixture.js';

describe('dashboard rendering', () => {
  function renderStats(members) {
    const stats = {
      active: members.filter((m) => m.status === 'active').length,
      pending: members.filter((m) => m.status === 'pending').length,
      expired: members.filter((m) => m.status === 'expired').length,
      suspended: members.filter((m) => m.status === 'suspended').length,
    };

    const grid = htmlFixture(`
      <div data-dashboard-stats>
        ${Object.entries(stats)
          .map(
            ([label, value]) => `
          <div data-dashboard-stat="${escapeHtml(label)}">
            <div data-stat-value>${escapeHtml(value)}</div>
            <div data-stat-label>${escapeHtml(label)}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    `);
    return { grid, stats };
  }

  function renderActivityFeed(activities) {
    return htmlFixture(`
      <div>
        ${activities
          .map(
            (a) => `
          <div data-activity-entry>
            <span data-activity-action>${escapeHtml(a.action)}</span>
            <span>${escapeHtml(a.members?.display_name || 'Unknown')}</span>
          </div>
        `,
          )
          .join('')}
      </div>
    `);
  }

  it('computes correct stats from member data', () => {
    const { stats } = renderStats(allMembers);
    expect(stats.active).toBe(2); // admin + activeMember
    expect(stats.pending).toBe(1);
    expect(stats.suspended).toBe(1);
  });

  it('renders stat cards', () => {
    const { grid } = renderStats(allMembers);
    const values = [...grid.querySelectorAll('[data-stat-value]')].map((el) => el.textContent);
    expect(values).toContain('2'); // active
    expect(values).toContain('1'); // pending
  });

  it('renders activity feed entries', () => {
    const feed = renderActivityFeed(sampleActivity);
    expect(feed.children.length).toBe(3);
    const actions = [...feed.querySelectorAll('[data-activity-action]')].map((el) => el.textContent);
    expect(actions).toContain('signup');
    expect(actions).toContain('announcement');
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
