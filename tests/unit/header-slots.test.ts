import { readFileSync } from 'node:fs';
import { is, selectAll, selectOne } from 'css-select';
import type { Document, Element } from 'domhandler';
import { parseDocument } from 'htmlparser2';
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

// Applies the header-slot rules to real header markup. css-select stands in
// for the browser because happy-dom mis-evaluates relative `:has()`. The baked
// markup (blocks are direct children of the container) and the hydrated markup
// (blocks inside the `display: contents` [data-react-html-children] wrapper)
// must place the same way: d25ec40 matched only the baked shape, so live pages
// ignored every slot.
describe('header slot CSS on baked and hydrated markup', () => {
  const css = readFileSync('src/styles/public.css', 'utf8');
  const section = css.slice(css.indexOf('/* Header slots (kychon#192)')).replace(/\/\*[\s\S]*?\*\//g, '');
  const mobileStart = section.indexOf('@media (max-width: 900px)');
  const rules = [...section.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    mobile: (m.index ?? 0) > mobileStart,
    decls: Object.fromEntries(
      m[2]
        .split(';')
        .map((decl) => decl.split(':').map((part) => part.trim()))
        .filter(([prop, value]) => prop && value)
        .map(([prop, ...value]) => [prop, value.join(':')]),
    ),
  }));

  function header(hydrated: boolean, sections: Section[]): Document {
    const html = sections.map((section) => renderBlock(section, ctx)).join('');
    const body = hydrated ? `<div data-react-html-children class="contents">${html}</div>` : html;
    return parseDocument(`<nav data-nav-shell><div data-layout-container>${body}</div></nav>`);
  }

  function find(doc: Document, selector: string): Element {
    const el = selectOne(selector, doc);
    if (!el) throw new Error(`missing ${selector}`);
    return el;
  }

  // Declarations from every matching slot rule, in source order.
  function placed(el: Element, mobile: boolean): Record<string, string> {
    return Object.assign(
      {},
      ...rules.filter((rule) => rule.mobile === mobile && is(el, rule.selector)).map((rule) => rule.decls),
    );
  }

  // OCEY's header (kychon#192): JOIN, RENEW and sign-in on row 1, search beside the nav.
  const ocey = [
    headerSection('brand_header'),
    headerSection('nav'),
    headerSection('safety_cta', { label: 'JOIN', header_slot: 'top_right', header_mobile: 'row' }),
    headerSection('safety_cta', { label: 'RENEW MEMBERSHIP', header_slot: 'top_right', header_mobile: 'row' }),
    headerSection('site_search', { header_slot: 'bottom_right' }),
    headerSection('sign_in_bar', { header_slot: 'top_right' }),
  ];

  it('parses the slot rules', () => {
    expect(rules.length).toBeGreaterThan(10);
    expect(rules.some((rule) => rule.mobile)).toBe(true);
  });

  describe.each([
    ['baked', false],
    ['hydrated', true],
  ])('%s markup', (_shape, hydrated) => {
    const doc = header(hydrated, ocey);
    const container = find(doc, '[data-layout-container]');
    const [join, renew] = selectAll('[data-safety-cta]', doc);
    const search = find(doc, '[data-header-slot="bottom_right"]');
    const signIn = find(doc, '#nav-user');
    const navLinks = find(doc, '[data-nav-links]');

    it('desktop: CTAs and sign-in on row 1, search on row 2 right of the nav', () => {
      expect(placed(container, false)).toMatchObject({
        '--nav-slot-top-span': '3',
        '--nav-slot-row-span': '4',
        'grid-template-columns': 'auto minmax(0, 1fr)',
      });
      for (const el of [join, renew, signIn]) {
        expect(placed(el, false)).toMatchObject({ 'grid-row': '1', 'grid-column': 'auto', 'white-space': 'nowrap' });
      }
      expect(placed(search, false)).toMatchObject({
        'grid-row': '2',
        'grid-column': '3 / span var(--nav-slot-top-span)',
        'justify-self': 'end',
      });
      expect(placed(navLinks, false)).toMatchObject({ 'grid-column': '2' });
    });

    it('mobile: CTAs share their own row below the nav, first start and second end', () => {
      expect(placed(join, true)).toMatchObject({
        'grid-row': '3',
        'grid-column': '1 / -1',
        'justify-self': 'start',
        'white-space': 'nowrap',
      });
      expect(placed(renew, true)).toMatchObject({ 'grid-row': '3', 'justify-self': 'end' });
      expect(placed(search, true)).toEqual({});
      expect(placed(signIn, true)).toEqual({});
    });

    it('without bottom_right the nav row runs under the top-right slots', () => {
      const noSearch = header(
        hydrated,
        ocey.filter((section) => section.section_type !== 'site_search'),
      );
      expect(placed(find(noSearch, '[data-nav-links]'), false)).toMatchObject({
        'grid-column': '2 / span var(--nav-slot-row-span)',
      });
    });

    it('leaves a header with no slots on the default grid', () => {
      const plain = header(hydrated, [
        headerSection('brand_header'),
        headerSection('nav'),
        headerSection('safety_cta'),
      ]);
      for (const el of selectAll('*', plain)) {
        expect(placed(el, false)).toEqual({});
        expect(placed(el, true)).toEqual({});
      }
    });
  });
});
