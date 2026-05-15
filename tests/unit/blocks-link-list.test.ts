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

  it('manual mode emits a shadcn island host with config payload', () => {
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
    expect(html).toContain('data-block-hydrate="link_list"');
    expect(html).toContain('&quot;heading&quot;:&quot;Curated&quot;');
    expect(html).toContain('&quot;label&quot;:&quot;A&quot;');
    expect(html).not.toContain('block-link-list__');
  });

  it('resources mode emits the same island host with config payload', () => {
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
    expect(html).toContain('data-config=');
    expect(html).toContain('newsletters');
    expect(html).not.toContain('block-link-list__');
  });

  it.each(['bullets', 'rows', 'compact'])('layout=%s is preserved for the island', (layout) => {
    const html = renderBlock(linkListSection({ source: 'manual', layout, items: [{ label: 'A', href: '/a' }] }), ctx);
    expect(html).toContain(`&quot;layout&quot;:&quot;${layout}&quot;`);
  });

  it('rows layout preserves item dates for the island', () => {
    const html = renderBlock(
      linkListSection({
        source: 'manual',
        layout: 'rows',
        items: [{ label: 'Item', href: '/x', date: '2026-01-15' }],
      }),
      ctx,
    );
    expect(html).toContain('2026-01-15');
  });

  it('badge variants are preserved for the island', () => {
    for (const badge of ['PDF', 'NEW', 'MEMBERS']) {
      const html = renderBlock(
        linkListSection({
          source: 'manual',
          layout: 'bullets',
          items: [{ label: 'A', href: '/a', badge }],
        }),
        ctx,
      );
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
