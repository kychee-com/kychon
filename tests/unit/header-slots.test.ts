import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  applyHeaderPlacement,
  BLOCK_TYPES,
  type BlockRenderContext,
  headerPlacement,
  renderBlock,
  type Section,
  supportsHeaderPlacement,
  withHeaderPlacement,
} from '../../src/lib/blocks';

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => true,
  currentPath: '/',
  siteName: 'Test',
  logoUrl: '',
};

function headerSection(type: string, config: Record<string, unknown> = {}, zone: Section['zone'] = 'header'): Section {
  return {
    id: 7,
    page_slug: '*',
    zone,
    scope: 'global',
    section_type: type,
    config: { ...(BLOCK_TYPES[type]?.defaultConfig ?? {}), ...config },
    position: 1,
    visible: true,
  };
}

describe('headerPlacement', () => {
  it('reads known slots and ignores anything else', () => {
    expect(headerPlacement({ header_slot: 'top_right', header_mobile: 'row' })).toEqual({
      slot: 'top_right',
      mobile: 'row',
    });
    expect(headerPlacement({ header_slot: 'bottom_right' })).toEqual({ slot: 'bottom_right', mobile: null });
    expect(headerPlacement({ header_slot: 'left"><script>', header_mobile: 'stack' })).toEqual({
      slot: null,
      mobile: null,
    });
    expect(headerPlacement(undefined)).toEqual({ slot: null, mobile: null });
  });

  it('withHeaderPlacement sets and clears keys without touching the rest of config', () => {
    const base = { label: 'Join', header_slot: 'top_right', header_mobile: 'row' };
    expect(withHeaderPlacement(base, { slot: 'bottom_right' })).toEqual({ ...base, header_slot: 'bottom_right' });
    expect(withHeaderPlacement(base, { mobile: null })).toEqual({ label: 'Join', header_slot: 'top_right' });
    expect(withHeaderPlacement(base, { slot: null, mobile: null })).toEqual({ label: 'Join' });
    expect(base.header_slot).toBe('top_right');
  });

  it('applyHeaderPlacement stamps the leading element only', () => {
    expect(applyHeaderPlacement('<a href="#"><span>x</span></a>', { slot: 'top_right', mobile: 'row' })).toBe(
      '<a href="#" data-header-slot="top_right" data-header-mobile="row"><span>x</span></a>',
    );
    expect(applyHeaderPlacement('<a href="#">x</a>', { slot: null, mobile: null })).toBe('<a href="#">x</a>');
  });

  it('nav, brand_header and full-bleed blocks are never slotted', () => {
    expect(supportsHeaderPlacement('nav')).toBe(false);
    expect(supportsHeaderPlacement('brand_header')).toBe(false);
    expect(supportsHeaderPlacement('page_banner')).toBe(false);
    expect(supportsHeaderPlacement('safety_cta')).toBe(true);
    expect(supportsHeaderPlacement('sign_in_bar')).toBe(true);
    expect(supportsHeaderPlacement('site_search')).toBe(true);
  });
});

describe('renderBlock header placement', () => {
  it('stamps slot attributes on header-zone blocks', () => {
    const cta = renderBlock(
      headerSection('safety_cta', { label: 'JOIN', header_slot: 'top_right', header_mobile: 'row' }),
      ctx,
    );
    expect(cta).toMatch(/^<a data-safety-cta[^>]* data-header-slot="top_right" data-header-mobile="row">JOIN<\/a>$/);

    const signIn = renderBlock(headerSection('sign_in_bar', { header_slot: 'top_right' }), ctx);
    expect(signIn).toMatch(/^<div id="nav-user"[^>]* data-header-slot="top_right"/);
  });

  it('leaves unconfigured headers and non-header zones untouched', () => {
    expect(renderBlock(headerSection('safety_cta'), ctx)).not.toContain('data-header-');
    expect(renderBlock(headerSection('site_search', { header_slot: 'bottom_right' }, 'main'), ctx)).not.toContain(
      'data-header-',
    );
  });

  it('site_search gives up its default grid-cell utilities once placed', () => {
    const unplaced = renderBlock(headerSection('site_search'), ctx);
    expect(unplaced).toContain('col-[4] row-[1] justify-self-end');

    const placed = renderBlock(headerSection('site_search', { header_slot: 'bottom_right' }), ctx);
    expect(placed).toMatch(/^<section data-section class="flex w-full[^"]*"[^>]* data-header-slot="bottom_right"/);
    expect(placed).not.toContain('col-[4]');
    expect(placed).not.toContain('justify-self-end');
  });
});

describe('header slot CSS', () => {
  const css = readFileSync('src/styles/public.css', 'utf8');

  it('places top_right on row 1 and bottom_right on row 2 on desktop', () => {
    const desktop = css.slice(css.indexOf('/* Header slots (kychon#192)'));
    expect(desktop).toContain('@media (min-width: 901px)');
    expect(desktop).toMatch(/> \[data-header-slot="top_right"\] \{\s*grid-row: 1;\s*grid-column: auto;/);
    expect(desktop).toMatch(
      /> \[data-header-slot="bottom_right"\] \{\s*grid-row: 2;\s*grid-column: 3 \/ span var\(--nav-slot-top-span\);/,
    );
  });

  it('gives mobile-row blocks their own unclipped row', () => {
    const mobile = css.slice(css.lastIndexOf('@media (max-width: 900px)'));
    expect(mobile).toMatch(
      /> \[data-header-mobile="row"\] \{\s*grid-row: 3;\s*grid-column: 1 \/ -1;\s*justify-self: start;/,
    );
    expect(mobile).toContain('white-space: nowrap');
    expect(mobile).toMatch(/\[data-header-mobile="row"\] ~ \[data-header-mobile="row"\] \{\s*justify-self: end;/);
  });
});
