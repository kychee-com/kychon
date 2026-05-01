import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, renderBlock, type BlockRenderContext, type Section } from '../../src/lib/blocks';

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

  it('emits CSS-Grid container with --cols custom property', () => {
    const html = renderBlock(
      promoSection({
        heading: '',
        columns: 4,
        items: [
          { image_url: '/a.jpg', image_alt: 'A', title: 'T1', cta_text: 'Learn', cta_href: '/a' },
        ],
      }),
      ctx,
    );
    expect(html).toContain('block-promo-cards');
    expect(html).toContain('--cols:4');
  });

  it('each card is a single anchor with aria-label', () => {
    const html = renderBlock(
      promoSection({
        columns: 3,
        items: [
          { image_url: '/m.jpg', image_alt: 'mem', title: 'Membership', title_position: 'top', cta_text: 'Click Here to Learn More', cta_href: '/join' },
        ],
      }),
      ctx,
    );
    expect(html).toContain('aria-label="Membership, Click Here to Learn More"');
    // Card href is /join on the anchor
    expect(html).toContain('href="/join"');
    // CTA text is in a <span>, not a nested <a>
    expect(html).toContain('promo-card__cta');
    const cardSubstring = html.split('promo-card promo-card--title-top')[1] || '';
    // Within the card markup there should be just one anchor (the wrapping one)
    const anchorCount = (cardSubstring.match(/<a /g) || []).length;
    expect(anchorCount).toBeLessThanOrEqual(0); // no nested <a> after the wrapping anchor opens
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
    expect(html).toContain('promo-card__overlay');
    expect(html).toContain('rgba(0,0,0,0.4)');
  });

  it('admin context emits per-item editable image attribute', () => {
    const html = renderBlock(
      promoSection({
        items: [
          { image_url: '/a.jpg', image_alt: 'A', title: 'T', cta_text: 'Go', cta_href: '/x' },
        ],
      }),
      { ...ctx, admin: true },
    );
    expect(html).toContain('data-editable-image="sections.31.config.items.0.image_url"');
  });

  it('title_position bottom adds the modifier class', () => {
    const html = renderBlock(
      promoSection({
        items: [
          { image_url: '/a.jpg', image_alt: 'A', title: 'T', title_position: 'bottom', cta_text: 'Go', cta_href: '/' },
        ],
      }),
      ctx,
    );
    expect(html).toContain('promo-card--title-bottom');
  });
});
