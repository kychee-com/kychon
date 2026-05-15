import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };

function eventsSection(config: Record<string, unknown> = {}): Section {
  return {
    id: 41,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'events_list',
    position: 1,
    config,
  };
}

describe('events_list block-type', () => {
  it('is registered as dynamic with main-zone hint', () => {
    const t = BLOCK_TYPES.events_list;
    expect(t).toBeDefined();
    expect(t.dynamic).toBe(true);
    expect(t.zoneHints).toContain('main');
  });

  it('emits shadcn island host with config payload', () => {
    const html = renderBlock(
      eventsSection({ heading: 'Upcoming', count: 4, filter: 'upcoming', layout: 'sidebar' }),
      ctx,
    );
    expect(html).toContain('data-block-hydrate="events_list"');
    expect(html).toContain('&quot;heading&quot;:&quot;Upcoming&quot;');
    expect(html).toContain('data-config=');
    expect(html).not.toContain('block-events-list__');
    expect(html).not.toContain('event-skeleton-card');
  });

  it('count is preserved in the island config', () => {
    const html = renderBlock(eventsSection({ heading: '', count: 6, filter: 'upcoming', layout: 'list' }), ctx);
    expect(html).toContain('&quot;count&quot;:6');
  });

  it.each(['sidebar', 'grid', 'list'])('layout=%s is preserved for the island', (layout) => {
    const html = renderBlock(eventsSection({ heading: '', count: 1, filter: 'upcoming', layout }), ctx);
    expect(html).toContain(`&quot;layout&quot;:&quot;${layout}&quot;`);
  });

  it('color_scheme is preserved for the island', () => {
    const html = renderBlock(eventsSection({ count: 1, layout: 'sidebar', color_scheme: 'accent' }), ctx);
    expect(html).toContain('&quot;color_scheme&quot;:&quot;accent&quot;');
  });

  it('default config has filter=upcoming, layout=sidebar', () => {
    const cfg = BLOCK_TYPES.events_list.defaultConfig;
    expect(cfg.filter).toBe('upcoming');
    expect(cfg.layout).toBe('sidebar');
    expect(cfg.count).toBe(4);
  });
});
