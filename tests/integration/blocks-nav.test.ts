// blocks-nav.test.ts — coverage for the `nav` block-type's renderer + hydrator.
// Verifies flat behavior, nested children, ARIA pattern, keyboard handlers,
// and click-outside dismissal.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, isPageActive, type Section } from '../../src/lib/blocks';
import { bindNavDropdowns, destroyNavDropdowns } from '../../src/lib/nav-dropdown';
import { appendBodyFixture, bodyFixture, clearBodyFixture, htmlFixture } from '../helpers/dom-fixture.js';

const NAV_VIEW = resolve(process.cwd(), 'src/components/kychon/NavBlockView.tsx');
const NAV_DROPDOWN = resolve(process.cwd(), 'src/lib/nav-dropdown.ts');
const PUBLIC_STYLES = resolve(process.cwd(), 'src/styles/public.css');

const baseCtx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => true,
  currentPath: '/',
};

interface NavDropdownTestWindow extends Window {
  __navDropdownClickBound?: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeSection(items: Array<Record<string, unknown>>, extraConfig: Record<string, unknown> = {}): Section {
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
  // Wrap as Portal does — `nav#zone-header > [data-layout-container] > <html>`.
  return htmlFixture(html);
}

function mountNavShell(html: string): void {
  bodyFixture(`
    <nav id="zone-header" data-nav-shell>
      <div class="mx-auto w-full max-w-[var(--max-width)] px-6" data-layout-container>${html}</div>
    </nav>
  `);
}

async function hydrateNav(target?: HTMLElement | null): Promise<HTMLElement> {
  await act(async () => {
    bindNavDropdowns(target);
  });
  return document.getElementById('nav-links') as HTMLElement;
}

async function destroyHydratedNav(): Promise<void> {
  const host = document.querySelector<HTMLElement>('[data-block-hydrate="nav"]');
  if (!host) return;
  await act(async () => {
    destroyNavDropdowns(host);
  });
}

async function clickElement(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
  });
}

async function dispatchElementEvent(element: HTMLElement | Window | Document, event: Event): Promise<void> {
  await act(async () => {
    element.dispatchEvent(event);
  });
}

function rect(width: number): DOMRect {
  return {
    bottom: 0,
    height: 24,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

async function forceOverflow(): Promise<void> {
  const links = document.getElementById('nav-links') as HTMLElement;
  const toggle = document.getElementById('nav-toggle') as HTMLElement;
  const items = Array.from(links.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && (child.hasAttribute('data-nav-link') || child.hasAttribute('data-nav-item-wrap')),
  );
  Object.defineProperty(links, 'getBoundingClientRect', { configurable: true, value: () => rect(90) });
  Object.defineProperty(toggle, 'getBoundingClientRect', { configurable: true, value: () => rect(36) });
  items.forEach((item, index) => {
    Object.defineProperty(item, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect(index === 0 ? 40 : 80),
    });
  });
  await dispatchElementEvent(window, new Event('resize'));
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

  it('does not keep a hash-less page link active when a hash link matches', () => {
    expect(isPageActive('/', '/#announcements-section')).toBe(false);
  });

  it('respects search param mismatches', () => {
    expect(isPageActive('/page.html?slug=foo', '/page.html?slug=foo')).toBe(true);
    expect(isPageActive('/page.html?slug=foo', '/page.html?slug=bar')).toBe(false);
    expect(isPageActive('/page.html?slug=foo', '/foo')).toBe(true);
    expect(isPageActive('/foo', '/page.html?slug=foo')).toBe(true);
  });
});

describe('nav block — flat behavior preserved', () => {
  it('renders the mobile toggle and overflow host statically with shadcn primitives', async () => {
    const section = makeSection([
      { label: 'Home', href: '/', public: true },
      { label: 'About', href: '/about', public: true },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    const view = await readFile(NAV_VIEW, 'utf8');
    const runtime = await readFile(NAV_DROPDOWN, 'utf8');
    const styles = await readFile(PUBLIC_STYLES, 'utf8');

    expect(html).toContain('id="nav-toggle"');
    expect(html).toContain('lucide-menu');
    expect(html).toContain('id="nav-links-overflow-menu"');
    expect(view).toContain('<Button');
    expect(view).toContain('Menu');
    expect(view).toContain('data-nav-trigger');
    expect(view).toContain('data-nav-menu');
    expect(view).toContain('data-nav-menuitem');
    expect(view).toContain('data-nav-toggle');
    expect(view).toContain('data-nav-overflow-menu');
    expect(runtime).not.toContain('document.createElement');
    expect(runtime).not.toContain("className = 'nav-overflow-menu'");
    expect(runtime).not.toContain('appendChild');
    expect(runtime).not.toContain('cloneNode');
    expect(runtime).not.toContain('replaceChildren');
    expect(runtime).not.toContain('.append(');
    expect(runtime).not.toContain('classList');
    expect(runtime).not.toMatch(/['"]\\.nav/);
    expect(runtime).not.toContain('nav--source-mobile');
    expect(runtime).not.toContain('nav--overflow');
    expect(runtime).not.toContain('nav-overflow-item');
    expect(runtime).toContain('NavBlockContent');
    expect(runtime).toContain('createRoot');
    expect(runtime).not.toContain('chevronBound');
    expect(runtime).not.toContain('navKeyboardBound');
    expect(runtime).not.toContain('querySelector');
    expect(runtime).not.toContain('querySelectorAll');
    expect(runtime).not.toContain('.closest(');
    expect(view).not.toContain('.closest(');
    expect(runtime).not.toContain('.matches(');
    expect(view).not.toContain('nav--source-mobile');
    expect(styles).not.toContain('nav--source-mobile');
    expect(styles).not.toContain('nav--overflow');
    expect(styles).not.toContain('.nav-overflow-item');
    expect(styles).toContain('[data-nav-source-mobile="true"]');
    expect(styles).toContain('[data-nav-overflow="true"]');
    expect(styles).toContain('[data-nav-overflowed="true"]');
    expect(html).toContain('data-nav-item-index="0"');
    expect(html).toContain('data-nav-overflow-source-index="0"');
  });

  it('renders flat items as plain anchors', () => {
    const section = makeSection([
      { label: 'Home', href: '/', public: true },
      { label: 'About', href: '/page.html?slug=about', public: true },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toContain('data-nav-link=""');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('>Home<');
    expect(html).toContain('>About<');
    expect(html).not.toContain('data-nav-trigger');
    expect(html).not.toContain('data-nav-menu=""');
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

  it('does not highlight Home with a matching hash nav item', () => {
    const section = makeSection([
      { label: 'Home', href: '/', public: true },
      { label: 'Announcements', href: '/#announcements-section', public: true },
    ]);
    const wrap = htmlFixture(
      `<div>${BLOCK_TYPES.nav.render(section, {
        ...baseCtx,
        currentPath: '/#announcements-section',
      })}</div>`,
    );
    const activeLabels = Array.from(wrap.querySelectorAll('[data-nav-item-index][data-nav-active="true"]')).map(
      (el) => el.textContent,
    );
    expect(activeLabels).toEqual(['Announcements']);
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

  it('toggles source mobile mode at custom breakpoint', async () => {
    const section = makeSection([{ label: 'About', children: [{ label: 'Team', href: '/team' }] }], {
      behavior: { mobile_breakpoint: 2000 },
    });
    mountNavShell(BLOCK_TYPES.nav.render(section, baseCtx));
    const host = document.getElementById('nav-links') as HTMLElement;
    const hydrated = await hydrateNav(host);
    expect(hydrated.dataset.navSourceMobile).toBe('true');
    await destroyHydratedNav();
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
    const root = renderInto(`<div>${html}</div>`);
    const parentLink = root.querySelector('[data-nav-link][href="/marina"]') as HTMLElement;
    expect(parentLink).toBeTruthy();
    expect(parentLink.hasAttribute('data-nav-parent-link')).toBe(true);
    expect(html).toContain('data-nav-trigger');
  });

  it('renders parent-only (no href) as a button trigger', () => {
    const section = makeSection([
      {
        label: 'Marina',
        children: [{ label: 'Layout', href: '/marina/layout' }],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toContain('data-nav-parent-trigger');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it('does not mark href-less parent menus active on home', () => {
    const section = makeSection([
      {
        label: 'Community',
        children: [{ label: 'Forum', href: '/forum' }],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    expect(html).toContain('data-nav-parent-trigger');
    expect(html).not.toContain('data-nav-parent-trigger="" data-nav-trigger="" data-nav-active="true"');
  });

  it('marks href-less parent menus active when a child matches', () => {
    const section = makeSection([
      {
        label: 'Community',
        children: [{ label: 'Forum', href: '/forum' }],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, { ...baseCtx, currentPath: '/forum' });
    const root = renderInto(`<div>${html}</div>`);
    const parent = root.querySelector('[data-nav-parent-trigger]') as HTMLElement;
    const child = root.querySelector('a[href="/forum"]') as HTMLElement;
    expect(parent.dataset.navActive).toBe('true');
    expect(child.dataset.navActive).toBe('true');
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
    const root = renderInto(`<div>${html}</div>`);
    expect(root.querySelector('ul[data-nav-menu][role="menu"]')).toBeTruthy();
    expect(root.querySelector('ul[data-nav-menu][data-nav-nested-menu][role="menu"]')).toBeTruthy();
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
    expect(html).not.toContain('data-nav-trigger');
  });
});

describe('nav block — ARIA attributes', () => {
  it('chevron carries role=button (implicit), aria-haspopup=menu, aria-expanded=false', () => {
    const section = makeSection([{ label: 'Marina', children: [{ label: 'Layout', href: '/m/l' }] }]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    const root = renderInto(`<div>${html}</div>`);
    const chevron = root.querySelector('[data-nav-trigger]') as HTMLElement;
    expect(chevron).toBeTruthy();
    expect(chevron.tagName.toLowerCase()).toBe('button');
    expect(chevron.getAttribute('aria-haspopup')).toBe('menu');
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
  });

  it('dropdown carries role=menu and items have role=menuitem with role=none on <li>', () => {
    const section = makeSection([{ label: 'Marina', children: [{ label: 'Layout', href: '/m/l' }] }]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    const root = renderInto(`<div>${html}</div>`);
    const ul = root.querySelector('[data-nav-menu]') as HTMLElement;
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
    const chevron = root.querySelector('[data-nav-trigger]') as HTMLElement;
    const controls = chevron.getAttribute('aria-controls') ?? '';
    expect(controls).toBeTruthy();
    const menu = root.querySelector(`#${CSS.escape(controls)}`);
    expect(menu).toBeTruthy();
    expect((menu as HTMLElement | null)?.hasAttribute('data-nav-menu')).toBe(true);
  });

  it('renders static overflow copies with duplicate-safe dropdown ids', () => {
    const section = makeSection([
      {
        label: 'Marina',
        children: [
          {
            label: 'Guides',
            children: [{ label: 'Layout', href: '/m/l' }],
          },
        ],
      },
    ]);
    const html = BLOCK_TYPES.nav.render(section, baseCtx);
    const root = renderInto(`<div>${html}</div>`);
    const ids = Array.from(root.querySelectorAll<HTMLElement>('[id]')).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    const overflowTrigger = root.querySelector<HTMLElement>('[data-nav-overflow-source-index] [aria-controls]');
    const controls = overflowTrigger?.getAttribute('aria-controls') ?? '';
    expect(controls).toContain('overflow-0');
    expect(root.querySelector(`#${CSS.escape(controls)}`)).toBeTruthy();
  });
});

describe('nav block — runtime keyboard + click', () => {
  let host: HTMLElement;

  beforeEach(async () => {
    clearBodyFixture();
    (window as NavDropdownTestWindow).__navDropdownClickBound = false;
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
    mountNavShell(html);
    host = await hydrateNav(document.getElementById('nav-links') as HTMLElement);
  });

  afterEach(async () => {
    await destroyHydratedNav();
    clearBodyFixture();
    delete (window as NavDropdownTestWindow).__navDropdownClickBound;
  });

  it('clicking the chevron opens the dropdown (sets aria-expanded=true, removes [hidden])', async () => {
    const chevron = host.querySelector('[data-nav-trigger]') as HTMLElement;
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(menu.hasAttribute('hidden')).toBe(true);
    await clickElement(chevron);
    expect(menu.hasAttribute('hidden')).toBe(false);
    expect(chevron.getAttribute('aria-expanded')).toBe('true');
  });

  it('binds dropdown behavior through data attributes rather than nav classes', async () => {
    await destroyHydratedNav();
    clearBodyFixture();
    (window as NavDropdownTestWindow).__navDropdownClickBound = false;
    const section = makeSection([
      {
        label: 'Resources',
        children: [{ label: 'Guides', href: '/guides' }],
      },
    ]);
    bodyFixture(
      `<nav id="zone-header" data-nav-shell><div data-layout-container>${BLOCK_TYPES.nav.render(section, baseCtx)}</div></nav>`,
    );
    const legacyNavClassTokens = Array.from(document.querySelectorAll<HTMLElement>('[class]')).flatMap((el) =>
      (el.getAttribute('class') || '').split(/\s+/).filter((className) => className.startsWith('nav-')),
    );
    expect(legacyNavClassTokens).toEqual([]);
    const links = await hydrateNav(document.getElementById('nav-links') as HTMLElement);

    const trigger = links.querySelector('[data-nav-trigger]') as HTMLElement;
    const menu = document.getElementById(trigger.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(menu.hasAttribute('hidden')).toBe(true);
    await clickElement(trigger);
    expect(menu.hasAttribute('hidden')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const toggle = document.querySelector('[data-nav-toggle]') as HTMLElement;
    await clickElement(toggle);
    expect((document.getElementById('nav-links') as HTMLElement).dataset.navMobileOpen).toBe('true');
  });

  it('clicking a hover-open parent pins it open instead of closing it', async () => {
    const chevron = host.querySelector('[data-nav-trigger]') as HTMLElement;
    const wrap = chevron.closest('[data-nav-item-wrap]') as HTMLElement;
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    const firstItem = menu.querySelector('a[role="menuitem"]') as HTMLElement;

    await dispatchElementEvent(wrap, new MouseEvent('mouseover', { bubbles: true }));
    expect(menu.hasAttribute('hidden')).toBe(false);

    await clickElement(chevron);
    expect(menu.hasAttribute('hidden')).toBe(false);
    expect(chevron.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).not.toBe(firstItem);

    await clickElement(chevron);
    expect(menu.hasAttribute('hidden')).toBe(true);
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking the hamburger toggles the mobile nav links', async () => {
    const toggle = document.getElementById('nav-toggle') as HTMLElement;
    const links = document.getElementById('nav-links') as HTMLElement;

    expect(toggle.getAttribute('aria-controls')).toBe('nav-links');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(links.dataset.navMobileOpen).toBeUndefined();

    await clickElement(toggle);
    expect(links.dataset.navMobileOpen).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await clickElement(toggle);
    expect(links.dataset.navMobileOpen).toBeUndefined();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking the hamburger in overflow mode opens only the overflow menu', async () => {
    const toggle = document.getElementById('nav-toggle') as HTMLElement;
    const links = document.getElementById('nav-links') as HTMLElement;

    await forceOverflow();
    expect(links.dataset.navOverflow).toBe('true');

    await clickElement(toggle);
    const menu = document.getElementById('nav-links-overflow-menu') as HTMLElement;
    expect(links.dataset.navMobileOpen).toBeUndefined();
    expect(toggle.getAttribute('aria-controls')).toBe('nav-links-overflow-menu');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(menu.hasAttribute('hidden')).toBe(false);
    const visibleOverflowText = Array.from(menu.children)
      .filter((child) => child instanceof HTMLElement && !child.hasAttribute('hidden'))
      .map((child) => child.textContent)
      .join('');
    expect(visibleOverflowText).toContain('Marina');
    expect(visibleOverflowText).not.toContain('Home');
    expect(menu.querySelector('[data-nav-overflow-source-index="0"]')?.hasAttribute('hidden')).toBe(true);
    expect(menu.querySelector('[data-nav-overflow-source-index="1"]')?.hasAttribute('hidden')).toBe(false);

    await clickElement(toggle);
    expect(menu.hasAttribute('hidden')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('binds dropdown triggers inside static overflow menu items', async () => {
    const toggle = document.getElementById('nav-toggle') as HTMLElement;

    await forceOverflow();
    await clickElement(toggle);
    const overflowTrigger = document.querySelector('[data-nav-overflow-menu] [data-nav-trigger]') as HTMLElement;
    const menu = document.getElementById(overflowTrigger.getAttribute('aria-controls') ?? '') as HTMLElement;

    expect(menu.hasAttribute('hidden')).toBe(true);
    await clickElement(overflowTrigger);
    expect(menu.hasAttribute('hidden')).toBe(false);
    expect(overflowTrigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('ArrowDown on chevron opens the menu and focuses the first item', async () => {
    const chevron = host.querySelector('[data-nav-trigger]') as HTMLElement;
    chevron.focus();
    await dispatchElementEvent(chevron, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(menu.hasAttribute('hidden')).toBe(false);
    const items = menu.querySelectorAll('a[role="menuitem"]');
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowDown on a menu item moves focus to the next item; wraps at end', async () => {
    const chevron = host.querySelector('[data-nav-trigger]') as HTMLElement;
    chevron.focus();
    await dispatchElementEvent(chevron, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('a[role="menuitem"]'));
    await dispatchElementEvent(items[0], new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    await dispatchElementEvent(items[1], new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[2]);
    // Wrap.
    await dispatchElementEvent(items[2], new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
  });

  it('Escape inside open menu closes it and returns focus to the chevron', async () => {
    const chevron = host.querySelector('[data-nav-trigger]') as HTMLElement;
    chevron.focus();
    await dispatchElementEvent(chevron, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    const firstItem = menu.querySelector<HTMLElement>('a[role="menuitem"]') as HTMLElement;
    await dispatchElementEvent(firstItem, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(chevron);
  });

  it('clicking outside the dropdown closes it', async () => {
    const chevron = host.querySelector('[data-nav-trigger]') as HTMLElement;
    await clickElement(chevron);
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(menu.hasAttribute('hidden')).toBe(false);
    // Click elsewhere.
    const [outside] = appendBodyFixture('<button type="button">Outside</button>');
    await clickElement(outside);
    expect(menu.hasAttribute('hidden')).toBe(true);
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
  });

  it('cleans a disconnected hydrated host before binding a replacement nav', async () => {
    const oldHost = document.querySelector<HTMLElement>('[data-block-hydrate="nav"]') as HTMLElement;
    expect(oldHost.dataset.hydrated).toBe('true');
    clearBodyFixture();
    const replacement = makeSection([{ label: 'Fresh', href: '/fresh' }]);
    mountNavShell(BLOCK_TYPES.nav.render(replacement, baseCtx));

    const replacementHost = document.querySelector<HTMLElement>('[data-block-hydrate="nav"]') as HTMLElement;
    await hydrateNav();

    expect(oldHost.dataset.hydrated).toBeUndefined();
    expect(replacementHost.dataset.hydrated).toBe('true');
    expect(document.querySelector('#nav-links [data-nav-link]')?.textContent).toBe('Fresh');
  });

  it('rebinding does not double-bind: a second bindNavDropdowns call is a no-op', async () => {
    const chevron = host.querySelector('[data-nav-trigger]') as HTMLElement;
    await hydrateNav(host);
    await hydrateNav(host);
    await clickElement(chevron);
    const menu = document.getElementById(chevron.getAttribute('aria-controls') ?? '') as HTMLElement;
    // After a single click, menu should be open (toggled once, not three times).
    expect(menu.hasAttribute('hidden')).toBe(false);
    await clickElement(chevron);
    expect(menu.hasAttribute('hidden')).toBe(true);
  });
});
