import { describe, expect, it } from 'vitest';
import {
  BLOCK_TYPES,
  renderBlock,
  type BlockRenderContext,
  type Section,
} from '../../src/lib/blocks';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };

function bannerSection(config: Record<string, unknown> = {}, overrides: Partial<Section> = {}): Section {
  return {
    id: 11,
    page_slug: 'about',
    zone: 'header',
    scope: 'page',
    section_type: 'page_banner',
    position: 10,
    config,
    ...overrides,
  };
}

describe('page_banner block-type', () => {
  it('is registered, not dynamic, header-zoned', () => {
    const t = BLOCK_TYPES.page_banner;
    expect(t).toBeDefined();
    expect(t.dynamic).toBe(false);
    expect(t.zoneHints).toEqual(['header']);
  });

  it('emits background-image on the section', () => {
    const html = renderBlock(bannerSection({ image_url: '/banner.jpg', image_alt: 'Banner' }), ctx);
    expect(html).toContain('background-image:url(/banner.jpg)');
    expect(html).toContain('aria-label="Banner"');
  });

  it.each([
    ['small', 'block-page-banner--height-small'],
    ['medium', 'block-page-banner--height-medium'],
    ['large', 'block-page-banner--height-large'],
    ['auto', 'block-page-banner--height-auto'],
  ])('height=%s applies class %s', (height, cls) => {
    const html = renderBlock(bannerSection({ image_url: '/x.jpg', image_alt: 'x', height }), ctx);
    expect(html).toContain(cls);
  });

  it('renders overlay when overlay_color set', () => {
    const html = renderBlock(
      bannerSection({ image_url: '/x.jpg', image_alt: 'x', overlay_color: 'rgba(0,0,0,0.5)' }),
      ctx,
    );
    expect(html).toContain('block-page-banner__overlay');
    expect(html).toContain('rgba(0,0,0,0.5)');
  });

  it('omits overlay when not set', () => {
    const html = renderBlock(bannerSection({ image_url: '/x.jpg', image_alt: 'x' }), ctx);
    expect(html).not.toContain('block-page-banner__overlay');
  });

  it('renders sanitized caption HTML', () => {
    const html = renderBlock(
      bannerSection({
        image_url: '/x.jpg',
        image_alt: 'x',
        caption_html: 'Welcome <strong>home</strong>!',
      }),
      ctx,
    );
    expect(html).toContain('block-page-banner__caption');
    expect(html).toContain('Welcome <strong>home</strong>!');
  });
});

// Direct sanitizer tests live in tests/unit/blocks-hero.test.ts (the
// sanitizer is shared with the hero foreground caption). The page_banner
// renderer just delegates to it; the "renders sanitized caption HTML" case
// above proves the wiring.
