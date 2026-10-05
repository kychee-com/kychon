// Regression coverage for #195 (mobile dropdown chevrons wrapped onto their
// own lines) and #168 (nav chevron_color had no consumer).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, type Section } from '../../src/lib/blocks';
import { htmlFixture } from '../helpers/dom-fixture.js';

const root = join(import.meta.dirname, '../..');
const css = readFileSync(join(root, 'src/styles/public.css'), 'utf8');

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => true,
  currentPath: '/',
};

// Each container context the mobile/overflow menu restyles the bar items in.
const MOBILE_CONTEXTS = [
  '[[data-nav-overflow-menu]_&]',
  '[[data-nav-links][data-nav-source-mobile=true][data-nav-mobile-open=true]_&]',
  '[[data-nav-shell][data-nav-source-mobile=true]_[data-nav-links][data-nav-mobile-open=true]_&]',
];

function renderNav(): HTMLElement {
  const section: Section = {
    page_slug: '*',
    zone: 'header',
    scope: 'global',
    section_type: 'nav',
    config: {
      presentation: { chevron_color: '#ff0000' },
      behavior: { mobile_open_layout: 'dropdown' },
      items: [
        { label: 'Parent One', href: '/one', children: [{ label: 'Child A', href: '/one/a' }] },
        { label: 'Parent Two', children: [{ label: 'Child B', href: '/two/b' }] },
        { label: 'Contact', href: '/contact' },
      ],
    },
    position: 1,
  };
  return htmlFixture(`<div>${BLOCK_TYPES.nav.render(section, ctx)}</div>`);
}

function classes(el: Element | null): string[] {
  return (el?.getAttribute('class') || '').split(/\s+/);
}

describe('#195 mobile dropdown keeps the chevron on its label row', () => {
  it('parent wraps lay out as a wrapping row (not a column) in mobile/overflow menus', () => {
    const wraps = renderNav().querySelectorAll('#nav-links > [data-nav-item-wrap]');
    expect(wraps.length).toBe(2);
    for (const wrap of wraps) {
      const cls = classes(wrap);
      for (const context of MOBILE_CONTEXTS) {
        expect(cls).not.toContain(`${context}:flex-col`);
        expect(cls).toContain(`${context}:flex-row`);
        expect(cls).toContain(`${context}:flex-wrap`);
        expect(cls).toContain(`${context}:items-center`);
      }
    }
  });

  it('the parent label grows so its chevron trails on the same row; the submenu takes the next full row', () => {
    const nav = renderNav();
    const parentLink = nav.querySelector('#nav-links > [data-nav-item-wrap] > [data-nav-parent-link]');
    const parentTrigger = nav.querySelector('#nav-links > [data-nav-item-wrap] > [data-nav-parent-trigger]');
    const submenu = nav.querySelector('#nav-links > [data-nav-item-wrap] > [data-nav-menu]');
    for (const context of MOBILE_CONTEXTS) {
      expect(classes(parentLink)).toContain(`${context}:flex-1`);
      expect(classes(parentTrigger)).toContain(`${context}:flex-1`);
      expect(classes(submenu)).toContain(`${context}:basis-full`);
    }
    // label and chevron button are direct siblings in the same row container
    const linkWrap = parentLink?.parentElement;
    expect(linkWrap?.querySelector(':scope > [data-nav-trigger] [data-nav-chevron]')).toBeTruthy();
  });

  it('public.css does not force the overflow item wrap back into a column', () => {
    const rule = css.split('[data-nav-overflow-menu] [data-nav-item-wrap] {')[1]?.split('}')[0] ?? '';
    expect(rule).not.toContain('flex-direction: column');
  });
});

describe('#168 nav chevron_color has a consumer', () => {
  it('the block writes --nav-chevron-color and the chevron reads it', () => {
    const nav = renderNav();
    const host = nav.querySelector('[style*="--nav-chevron-color"]');
    expect(host?.getAttribute('style')).toContain('--nav-chevron-color:#ff0000');
    const chevrons = nav.querySelectorAll('[data-nav-chevron]');
    expect(chevrons.length).toBeGreaterThan(0);
    for (const chevron of chevrons) {
      expect(classes(chevron)).toContain('text-[color:var(--nav-chevron-color,currentColor)]');
    }
  });
});
