import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';

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
    expect(html).toContain('data-page-banner=""');
    expect(html).toContain('background-image:url(/banner.jpg)');
    expect(html).toContain('aria-label="Banner"');
    expect(html).not.toContain('block-page-banner');
  });

  it.each([
    ['small', 'min-h-[200px]'],
    ['medium', 'min-h-[320px]'],
    ['large', 'min-h-[480px]'],
    ['auto', 'min-h-0'],
  ])('height=%s applies utility class %s', (height, cls) => {
    const html = renderBlock(bannerSection({ image_url: '/x.jpg', image_alt: 'x', height }), ctx);
    expect(html).toContain(`data-height="${height}"`);
    expect(html).toContain(cls);
  });

  it('renders overlay when overlay_color set', () => {
    const html = renderBlock(
      bannerSection({ image_url: '/x.jpg', image_alt: 'x', overlay_color: 'rgba(0,0,0,0.5)' }),
      ctx,
    );
    expect(html).toContain('pointer-events-none absolute inset-0');
    expect(html).toContain('rgba(0,0,0,0.5)');
    expect(html).not.toContain('block-page-banner__overlay');
  });

  it('omits overlay when not set', () => {
    const html = renderBlock(bannerSection({ image_url: '/x.jpg', image_alt: 'x' }), ctx);
    expect(html).not.toContain('pointer-events-none absolute inset-0');
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
    expect(html).toContain('Welcome <strong>home</strong>!');
    expect(html).not.toContain('block-page-banner__caption');
  });

  it('keeps retired page banner classes out of source CSS and renderer', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');
    const blocks = readFileSync('src/lib/blocks.ts', 'utf8');

    expect(styles).not.toContain('block-page-banner');
    expect(blocks).not.toContain('block-page-banner');
  });
});

// Direct sanitizer tests live in tests/unit/blocks-hero.test.ts (the
// sanitizer is shared with the hero foreground caption). The page_banner
// renderer just delegates to it; the "renders sanitized caption HTML" case
// above proves the wiring.
