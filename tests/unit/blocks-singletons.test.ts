import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, isSingletonBlockType, renderZone, type Section } from '../../src/lib/blocks';

const ctx: BlockRenderContext = { admin: false, locale: 'en', currentPath: '/' };

function brandSection(overrides: Partial<Section>): Section {
  return {
    id: 1,
    page_slug: '*',
    zone: 'header',
    scope: 'global',
    section_type: 'brand_header',
    config: { href: '/', title: 'The Eagles' },
    position: 1,
    visible: true,
    ...overrides,
  };
}

describe('block singleton rendering', () => {
  it('renders only one header brand block when duplicate brand rows exist', () => {
    const html = renderZone(
      [
        brandSection({ id: 1, position: 1, config: { href: '/', title: 'The Eagles' } }),
        brandSection({ id: 2, position: 2, config: { href: '/', title: 'Duplicate Eagles' } }),
      ],
      'header',
      ctx,
    );

    expect(html.match(/data-nav-brand/g)).toHaveLength(1);
    expect(html).toContain('The Eagles');
    expect(html).not.toContain('Duplicate Eagles');
  });

  it('prefers a page-specific singleton over the global copy for the active page', () => {
    const html = renderZone(
      [
        brandSection({ id: 1, position: 1, config: { href: '/', title: 'Global Eagles' } }),
        brandSection({
          id: 2,
          page_slug: 'about',
          scope: 'page',
          position: 20,
          config: { href: '/', title: 'About Eagles' },
        }),
      ],
      'header',
      { ...ctx, currentPath: '/about' },
    );

    expect(html.match(/data-nav-brand/g)).toHaveLength(1);
    expect(html).toContain('About Eagles');
    expect(html).not.toContain('Global Eagles');
  });

  it('keeps site search singleton-scoped to the header only', () => {
    expect(isSingletonBlockType('site_search', 'header')).toBe(true);
    expect(isSingletonBlockType('site_search', 'main')).toBe(false);
  });
});
