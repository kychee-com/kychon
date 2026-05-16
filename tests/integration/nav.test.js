import { describe, expect, it } from 'vitest';
import { defaultNav } from '../fixtures/configs.js';
import { escapeHtml, htmlFixture } from '../helpers/dom-fixture.js';

describe('nav rendering', () => {
  function renderNav(navItems, { isAuth, role, features }) {
    return htmlFixture(`
      <div>
        ${navItems
          .filter((item) => {
            if (item.feature && !features[item.feature]) return false;
            if (item.auth && !isAuth) return false;
            if (item.admin && role !== 'admin') return false;
            return true;
          })
          .map(
            (item) => `
          <a data-nav-link href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>
        `,
          )
          .join('')}
      </div>
    `);
  }

  it('renders public nav items for anonymous users', () => {
    const nav = renderNav(defaultNav, { isAuth: false, role: null, features: {} });
    const links = nav.querySelectorAll('a');
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].textContent).toBe('Home');
  });

  it('renders feature-gated items when feature is enabled', () => {
    const nav = renderNav(defaultNav, {
      isAuth: true,
      role: 'member',
      features: { feature_events: true, feature_directory: true },
    });
    const labels = [...nav.querySelectorAll('a')].map((a) => a.textContent);
    expect(labels).toContain('Events');
    expect(labels).toContain('Members');
  });

  it('hides feature-gated items when disabled', () => {
    const nav = renderNav(defaultNav, {
      isAuth: true,
      role: 'member',
      features: { feature_events: false, feature_directory: false },
    });
    const labels = [...nav.querySelectorAll('a')].map((a) => a.textContent);
    expect(labels).not.toContain('Events');
    expect(labels).not.toContain('Members');
  });

  it('renders admin items for admin users', () => {
    const nav = renderNav(defaultNav, { isAuth: true, role: 'admin', features: {} });
    const labels = [...nav.querySelectorAll('a')].map((a) => a.textContent);
    expect(labels).toContain('Dashboard');
  });

  it('hides admin items for regular members', () => {
    const nav = renderNav(defaultNav, { isAuth: true, role: 'member', features: {} });
    const labels = [...nav.querySelectorAll('a')].map((a) => a.textContent);
    expect(labels).not.toContain('Dashboard');
  });

  it('sets correct href on nav links', () => {
    const nav = renderNav(defaultNav, {
      isAuth: true,
      role: 'admin',
      features: { feature_events: true, feature_directory: true },
    });
    const links = [...nav.querySelectorAll('a')];
    const homeLink = links.find((a) => a.textContent === 'Home');
    expect(homeLink.href).toContain('/');
    const dashLink = links.find((a) => a.textContent === 'Dashboard');
    expect(dashLink.href).toContain('/admin');
  });
});
