// blocks-nav.test.ts — coverage for the `nav` block-type's renderer + hydrator.
// Verifies flat behavior, nested children, ARIA pattern, keyboard handlers,
// and click-outside dismissal.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, isPageActive, type Section } from '../../src/lib/blocks';
import { bindNavDropdowns } from '../../src/lib/nav-dropdown';

const baseCtx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => true,
  currentPath: '/',
};

function makeSection(items: any[], extraConfig: Record<string, unknown> = {}): Section {
  return {
    page_slug: '*',
    zone: 'header',
    scope: 'global',
    section_type: 'nav',
    config: { items, ...extraConfig },
    position: 1,
  };
}

function renderInto(html: string): HTMLElement {
  const wrap = document.createElement('div');
  // Wrap as Portal does — `nav#zone-header > .ky-container > <html>`.
  wrap.innerHTML = html;
  return wrap.firstElementChild as HTMLElement;
}

describe('isPageActive — hash-aware active link detection', () => {
  it('matches the same pathname when no hash and no search', () => {
    expect(isPageActive('/', '/')).toBe(true);
    expect(isPageActive('/about', '/about')).toBe(true);
  });

  it('does not mark anchor-only links active when no hash on current path', () => {
    // The original bug: at `/`, both `/` and `/#announcements-section` lit up.
    expect(isPageActive('/#announcements-section', '/')).toBe(false);
    expect(isPageActive('/', '/')).toBe(true);
  });

  it('marks an anchor link active only when current path has the same hash', () => {
    expect(isPageActive('/#announcements-section', '/#announcements-section')).toBe(true);
    expect(isPageActive('/#announcements-section', '/#other')).toBe(false);
    expect(isPageActive('/#announcements-section', '/about')).toBe(false);
  });

  it('hash-less links remain active regardless of current URL hash', () => {
    // Home should still be active when user has scrolled to /#announcements
    expect(isPageActive('/', '/#announcements-section')).toBe(true);
  });

  it('respects search param mismatches', () => {
    expect(isPageActive('/page.html?slug=foo', '/page.html?slug=foo')).toBe(true);
    expect(isPageActive('/page.html?slug=foo', '/page.html?slug=bar')).toBe(false);
  });
});

describe('nav block — flat behavior preserved', () => {
  it('renders flat items as plain anchors', () => {
    const section = makeSection([
      { label: 'Home', href: '/', public: true },
      { label: 'About', href: '/about', public: true },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toContain('<a class="nav-link"');
    expect(html).toContain('href="/"');
    expect(html).toContain('>Home<');
    expect(html).toContain('>About<');
    expect(html).not.toContain('nav-chevron-toggle');
    expect(html).not.toContain('nav-dropdown');
    expect(html).not.toContain('data-mobile-breakpoint');
  });

  it('respects feature/auth/admin gates for top-level items', () => {
    const section = makeSection([
      { label: 'Public', href: '/', public: true },
      { label: 'Members', href: '/m', auth: true },
      { label: 'Admin', href: '/a', admin: true },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toContain('Public');
    expect(html).not.toContain('Members');
    expect(html).not.toContain('Admin');
  });
});

describe('nav block — source presentation config', () => {
  it('emits scoped variables and behavior data attributes', () => {
    const section = makeSection([{ label: 'About', children: [{ label: 'Team', href: '/team' }] }], {
      presentation: {
        link_hover_bg: '#ffcc00',
        link_hover_color: '#111111',
        dropdown_bg: '#ffffff',
        dropdown_shadow: '0 10px 20px rgba(0,0,0,0.2)',
        dropdown_width: '18rem',
        chevron_color: '#0057b8',
        transition: '220ms ease',
        surface_bg: '#0057b8',
        surface_padding: '0 .5rem',
        full_row: true,
        mobile_menu_bg: '#f7f7f7',
      },
      behavior: {
        mobile_breakpoint: 960,
        mobile_closed_layout: 'hidden',
        mobile_open_layout: 'inline',
      },
    });
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toContain('--nav-link-hover-bg:#ffcc00;');
    expect(html).toContain('--nav-dropdown-bg:#ffffff;');
    expect(html).toContain('--nav-dropdown-shadow:0 10px 20px rgba(0,0,0,0.2);');
    expect(html).toContain('--nav-dropdown-width:18rem;');
    expect(html).toContain('--nav-chevron-color:#0057b8;');
    expect(html).toContain('--nav-links-bg:#0057b8;');
    expect(html).toContain('--nav-links-padding:0 .5rem;');
    expect(html).toContain('data-nav-full-row="true"');
    expect(html).toContain('data-mobile-breakpoint="960"');
    expect(html).toContain('data-mobile-closed-layout="hidden"');
  });

  it('toggles source mobile mode at custom breakpoint', () => {
    const section = makeSection([{ label: 'About', children: [{ label: 'Team', href: '/team' }] }], {
      behavior: { mobile_breakpoint: 2000 },
    });
    document.body.innerHTML = `<nav id="zone-header" class="nav"><div class="ky-container">${BLOCK_TYPES.nav.render(section, baseCtx)}</div></nav>`;
    const host = document.getElementById('nav-links') as HTMLElement;
    bindNavDropdowns(host);
    expect(document.getElementById('zone-header')?.classList.contains('nav--source-mobile')).toBe(true);
  });
});

describe('nav block — nested children', () => {
  it('renders chevron + dropdown for items with children', () => {
    const section = makeSection([
      {
        label: 'Marina',
        children: [
          { label: 'Layout', href: '/marina/layout' },
          { label: 'How-To', href: '/marina/howto' },
        ],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('role="menu"');
    expect(html).toContain('hidden');
    expect(html).toContain('Layout');
    expect(html).toContain('How-To');
  });

  it('renders both <a> and chevron for parent with both href and children', () => {
    const section = makeSection([
      {
        label: 'Marina',
        href: '/marina',
        children: [{ label: 'Layout', href: '/marina/layout' }],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toMatch(/<a class="nav-link nav-parent[^"]*" href="\/marina">/);
    expect(html).toContain('nav-chevron-toggle');
  });

  it('renders parent-only (no href) as a button trigger', () => {
    const section = makeSection([
      {
        label: 'Marina',
        children: [{ label: 'Layout', href: '/marina/layout' }],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toContain('nav-parent-button');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it('supports recursive children at depth ≥ 2', () => {
    const section = makeSection([
      {
        label: 'Resources',
        children: [
          {
            label: 'Documents',
            children: [
              { label: 'Forms', href: '/r/forms' },
              { label: 'Reports', href: '/r/reports' },
            ],
          },
        ],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    // Outer dropdown.
    expect(html).toMatch(/<ul class="nav-dropdown" role="menu"/);
    // Nested dropdown inside.
    expect(html).toContain('nav-dropdown nav-dropdown-nested');
    expect(html).toContain('Forms');
    expect(html).toContain('Reports');
  });

  it('hides children that fail auth/admin/feature gates but keeps their parent if it has visible siblings', () => {
    const section = makeSection([
      {
        label: 'Resources',
        children: [
          { label: 'Forms', href: '/forms', public: true },
          { label: 'AdminOnly', href: '/admin', admin: true },
        ],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toContain('Forms');
    expect(html).not.toContain('AdminOnly');
  });

  it('drops parent entirely when no children survive gating and parent has no href', () => {
    const section = makeSection([
      {
        label: 'AdminMenu',
        children: [{ label: 'X', href: '/x', admin: true }],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    // Parent (no href) collapses to plain link rendering — no chevron.
    expect(html).not.toContain('nav-chevron-toggle');
  });
});

describe('nav block — ARIA attributes', () => {
  it('chevron carries role=button (implicit), aria-haspopup=menu, aria-expanded=false', () => {
    const section = makeSection([{ label: 'Marina', children: [{ label: 'Layout', href: '/m/l' }] }]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    const root = renderInto(`<div>${html}</div>`);
    const chevron = root.querySelector('.nav-chevron-toggle, .nav-parent-button') as HTMLElement;
    expect(chevron).toBeTruthy();
    expect(chevron.tagName.toLowerCase()).toBe('button');
    expect(chevron.getAttribute('aria-haspopup')).toBe('menu');
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
  });

  it('dropdown carries role=menu and items have role=menuitem with role=none on <li>', () => {
    const section = makeSection([{ label: 'Marina', children: [{ label: 'Layout', href: '/m/l' }] }]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    const root = renderInto(`<div>${html}</div>`);
    const ul = root.querySelector('.nav-dropdown') as HTMLElement;
    expect(ul.getAttribute('role')).toBe('menu');
    const li = ul.querySelector('li') as HTMLElement;
    expect(li.getAttribute('role')).toBe('none');
    const a = li.querySelector('a') as HTMLAnchorElement;
    expect(a.getAttribute('role')).toBe('menuitem');
  });

  it('aria-controls links chevron to its own dropdown id', () => {
    const section = makeSection([{ label: 'Marina', children: [{ label: 'Layout', href: '/m/l' }] }]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    const root = renderInto(`<div>${html}</div>`);
    const chevron = root.querySelector('.nav-chevron-toggle, .nav-parent-button') as HTMLElement;
    const controls = chevron.getAttribute('aria-controls') ?? '';
    expect(controls).toBeTruthy();
    const menu = root.querySelector(`#${CSS.escape(controls)}`);
    expect(menu).toBeTruthy();
    expect(menu?.classList.contains('nav-dropdown')).toBe(true);
  });
});

describe('nav block — runtime keyboard + click', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    (window as any).__navDropdownClickBound = false;
    const section = makeSection([
      { label: 'Home', href: '/', public: true },
      {
        label: 'Marina',
        children: [
          { label: 'Layout', href: '/m/layout' },
          { label: 'How-To', href: '/m/howto' },
          { label: 'App', href: '/m/app' },
        ],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    document.body.innerHTML = `<nav id="zone-header"><div class="ky-container">${html}</div></nav>`;
    host = document.getElementById('nav-links') as HTMLElement;
    bindNavDropdowns(host);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as any).__navDropdownClickBound;
  });

  it('clicking the chevron opens the dropdown (sets aria-expanded=true, removes [hidden])', () => {
    const chevron = host.querySelector('.nav-parent-button, .nav-chevron-toggle') as HTMLElement;
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(menu.hasAttribute('hidden')).toBe(true);
    chevron.click();
    expect(menu.hasAttribute('hidden')).toBe(false);
    expect(chevron.getAttribute('aria-expanded')).toBe('true');
  });

  it('ArrowDown on chevron opens the menu and focuses the first item', () => {
    const chevron = host.querySelector('.nav-parent-button, .nav-chevron-toggle') as HTMLElement;
    chevron.focus();
    chevron.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(menu.hasAttribute('hidden')).toBe(false);
    const items = menu.querySelectorAll('a[role="menuitem"]');
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowDown on a menu item moves focus to the next item; wraps at end', () => {
    const chevron = host.querySelector('.nav-parent-button, .nav-chevron-toggle') as HTMLElement;
    chevron.focus();
    chevron.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('a[role="menuitem"]'));
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[2]);
    // Wrap.
    items[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
  });

  it('Escape inside open menu closes it and returns focus to the chevron', () => {
    const chevron = host.querySelector('.nav-parent-button, .nav-chevron-toggle') as HTMLElement;
    chevron.focus();
    chevron.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    const firstItem = menu.querySelector<HTMLElement>('a[role="menuitem"]') as HTMLElement;
    firstItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(chevron);
  });

  it('clicking outside the dropdown closes it', () => {
    const chevron = host.querySelector('.nav-parent-button, .nav-chevron-toggle') as HTMLElement;
    chevron.click();
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(menu.hasAttribute('hidden')).toBe(false);
    // Click elsewhere.
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.click();
    expect(menu.hasAttribute('hidden')).toBe(true);
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
  });

  it('rebinding does not double-bind: a second bindNavDropdowns call is a no-op', () => {
    const chevron = host.querySelector('.nav-parent-button, .nav-chevron-toggle') as HTMLElement;
    bindNavDropdowns(host);
    bindNavDropdowns(host);
    chevron.click();
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    // After a single click, menu should be open (toggled once, not three times).
    expect(menu.hasAttribute('hidden')).toBe(false);
    chevron.click();
    expect(menu.hasAttribute('hidden')).toBe(true);
  });
});
