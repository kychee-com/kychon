import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };

function promoSection(config: Record<string, unknown> = {}): Section {
  return {
    id: 31,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'promo_cards',
    position: 1,
    config,
  };
}

describe('promo_cards block-type', () => {
  it('is registered, not dynamic, main-zoned', () => {
    const t = BLOCK_TYPES.promo_cards;
    expect(t).toBeDefined();
    expect(t.dynamic).toBe(false);
    expect(t.zoneHints).toContain('main');
  });

  it('emits a responsive shadcn grid without block CSS primitives', () => {
    const html = renderBlock(
      promoSection({
        heading: '',
        columns: 4,
        items: [{ image_url: '/a.jpg', image_alt: 'A', title: 'T1', cta_text: 'Learn', cta_href: '/a' }],
      }),
      ctx,
    );
    expect(html).toContain('data-promo-cards=""');
    expect(html).toContain('grid-cols-[repeat(auto-fit');
    expect(html).not.toContain('block-promo-cards');
    expect(html).not.toContain('--cols:');
  });

  it('each card is a single anchor with aria-label', () => {
    const html = renderBlock(
      promoSection({
        columns: 3,
        items: [
          {
            image_url: '/m.jpg',
            image_alt: 'mem',
            title: 'Membership',
            title_position: 'top',
            cta_text: 'Click Here to Learn More',
            cta_href: '/join',
          },
        ],
      }),
      ctx,
    );
    expect(html).toContain('aria-label="Membership, Click Here to Learn More"');
    // Card href is /join on the anchor
    expect(html).toContain('href="/join"');
    expect(html).toContain('Click Here to Learn More');
    expect(html).toContain('text-primary underline-offset-4 hover:underline');
    // The whole card is the only anchor; the CTA remains non-nested text styled by the shadcn button variant.
    expect(html.match(/<a /g) || []).toHaveLength(1);
    expect(html).not.toContain('promo-card__cta');
  });

  it('overlay_color renders as semi-transparent layer', () => {
    const html = renderBlock(
      promoSection({
        items: [
          {
            image_url: '/a.jpg',
            image_alt: 'A',
            title: 'T',
            cta_text: 'Go',
            cta_href: '/x',
            overlay_color: 'rgba(0,0,0,0.4)',
          },
        ],
      }),
      ctx,
    );
    expect(html).toContain('pointer-events-none absolute inset-0');
    expect(html).toContain('rgba(0,0,0,0.4)');
    expect(html).not.toContain('promo-card__overlay');
  });

  it('admin context emits per-item editable image attribute', () => {
    const html = renderBlock(
      promoSection({
        items: [{ image_url: '/a.jpg', image_alt: 'A', title: 'T', cta_text: 'Go', cta_href: '/x' }],
      }),
      { ...ctx, admin: true },
    );
    expect(html).toContain('data-editable-image="sections.31.config.items.0.image_url"');
  });

  it('title_position bottom is represented without modifier classes', () => {
    const html = renderBlock(
      promoSection({
        items: [
          { image_url: '/a.jpg', image_alt: 'A', title: 'T', title_position: 'bottom', cta_text: 'Go', cta_href: '/' },
        ],
      }),
      ctx,
    );
    expect(html).toContain('data-title-position="bottom"');
    expect(html).not.toContain('promo-card--title-bottom');
  });

  it('does not keep retired promo card primitives in public CSS', () => {
    const css = readFileSync('src/styles/public.css', 'utf8');
    expect(css).not.toContain('block-promo-cards');
    expect(css).not.toContain('promo-card');
  });
});
