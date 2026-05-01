import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };

function linkListSection(config: Record<string, unknown> = {}): Section {
  return {
    id: 21,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'link_list',
    position: 1,
    config,
  };
}

describe('link_list block-type', () => {
  it('is registered as dynamic (resources mode is the dynamic case)', () => {
    const t = BLOCK_TYPES.link_list;
    expect(t).toBeDefined();
    expect(t.dynamic).toBe(true);
  });

  it('manual mode renders all configured items', () => {
    const html = renderBlock(
      linkListSection({
        heading: 'Curated',
        source: 'manual',
        layout: 'bullets',
        items: [
          { label: 'A', href: '/a' },
          { label: 'B', href: '/b', badge: 'PDF' },
          { label: 'C', href: 'https://ext.example.com', external: true },
        ],
      }),
      ctx,
    );
    expect(html).toContain('block-link-list--bullets');
    expect(html).toContain('href="/a"');
    expect(html).toContain('href="/b"');
    expect(html).toContain('block-link-list__badge--pdf');
    expect(html).toContain('PDF');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('data-block-hydrate="link_list"');
  });

  it('resources mode emits hydration skeleton with config payload', () => {
    const html = renderBlock(
      linkListSection({
        heading: 'News',
        source: 'resources',
        layout: 'rows',
        filter: { category: 'newsletters', limit: 3, order: 'newest' },
      }),
      ctx,
    );
    expect(html).toContain('data-block-hydrate="link_list"');
    expect(html).toContain('block-link-list__skeleton');
    expect(html).toContain('block-link-list--rows');
    expect(html).toContain('data-config=');
    expect(html).toContain('newsletters');
  });

  it.each(['bullets', 'rows', 'compact'])('layout=%s adds modifier class', (layout) => {
    const html = renderBlock(linkListSection({ source: 'manual', layout, items: [{ label: 'A', href: '/a' }] }), ctx);
    expect(html).toContain(`block-link-list--${layout}`);
  });

  it('rows layout shows date column when item has date', () => {
    const html = renderBlock(
      linkListSection({
        source: 'manual',
        layout: 'rows',
        items: [{ label: 'Item', href: '/x', date: '2026-01-15' }],
      }),
      ctx,
    );
    expect(html).toContain('block-link-list__date');
    expect(html).toContain('2026-01-15');
  });

  it('bullets layout omits date even if present (per spec)', () => {
    const html = renderBlock(
      linkListSection({
        source: 'manual',
        layout: 'bullets',
        items: [{ label: 'Item', href: '/x', date: '2026-01-15' }],
      }),
      ctx,
    );
    expect(html).not.toContain('block-link-list__date');
  });

  it('badge variants render with pill class', () => {
    for (const badge of ['PDF', 'NEW', 'MEMBERS']) {
      const html = renderBlock(
        linkListSection({
          source: 'manual',
          layout: 'bullets',
          items: [{ label: 'A', href: '/a', badge }],
        }),
        ctx,
      );
      expect(html).toContain(`block-link-list__badge--${badge.toLowerCase()}`);
      expect(html).toContain(badge);
    }
  });

  it('escapes user labels', () => {
    const html = renderBlock(
      linkListSection({
        source: 'manual',
        layout: 'bullets',
        items: [{ label: '<script>x</script>', href: '/' }],
      }),
      ctx,
    );
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
