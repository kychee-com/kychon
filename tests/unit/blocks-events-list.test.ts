import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, renderBlock, type BlockRenderContext, type Section } from '../../src/lib/blocks';

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

  it('emits hydration skeleton with config payload', () => {
    const html = renderBlock(
      eventsSection({ heading: 'Upcoming', count: 4, filter: 'upcoming', layout: 'sidebar' }),
      ctx,
    );
    expect(html).toContain('data-block-hydrate="events_list"');
    expect(html).toContain('block-events-list--sidebar');
    expect(html).toContain('block-events-list__skeleton');
    expect(html).toContain('Upcoming');
    expect(html).toContain('data-config=');
  });

  it('skeleton card count matches config.count', () => {
    const html = renderBlock(
      eventsSection({ heading: '', count: 6, filter: 'upcoming', layout: 'list' }),
      ctx,
    );
    const cards = html.match(/event-skeleton-card/g) || [];
    expect(cards.length).toBe(6);
  });

  it.each(['sidebar', 'grid', 'list'])('layout=%s emits modifier class', (layout) => {
    const html = renderBlock(
      eventsSection({ heading: '', count: 1, filter: 'upcoming', layout }),
      ctx,
    );
    expect(html).toContain(`block-events-list--${layout}`);
  });

  it('count clamps to a minimum of 1 for negative input', () => {
    const html = renderBlock(eventsSection({ count: -3, layout: 'sidebar' }), ctx);
    const cards = html.match(/event-skeleton-card/g) || [];
    expect(cards.length).toBe(1);
  });

  it('count=0 falls back to default 4', () => {
    const html = renderBlock(eventsSection({ count: 0, layout: 'sidebar' }), ctx);
    const cards = html.match(/event-skeleton-card/g) || [];
    expect(cards.length).toBe(4);
  });

  it('color_scheme adds modifier class', () => {
    const html = renderBlock(
      eventsSection({ count: 1, layout: 'sidebar', color_scheme: 'accent' }),
      ctx,
    );
    expect(html).toContain('block-events-list--accent');
  });

  it('default config has filter=upcoming, layout=sidebar', () => {
    const cfg = BLOCK_TYPES.events_list.defaultConfig;
    expect(cfg.filter).toBe('upcoming');
    expect(cfg.layout).toBe('sidebar');
    expect(cfg.count).toBe(4);
  });
});
