import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };
const slideshowViewSource = readFileSync(
  join(import.meta.dirname, '../../src/components/kychon/SlideshowBlockView.tsx'),
  'utf8',
);

function slideshowSection(config: Record<string, unknown> = {}): Section {
  return {
    id: 51,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'slideshow',
    position: 1,
    config,
  };
}

describe('slideshow block-type', () => {
  it('is registered as dynamic with main-zone hint', () => {
    const t = BLOCK_TYPES.slideshow;
    expect(t).toBeDefined();
    expect(t.dynamic).toBe(true);
    expect(t.zoneHints).toContain('main');
    expect(t.defaultConfig.auto_rotate_seconds).toBe(5);
  });

  it('emits ARIA carousel attributes', () => {
    const html = renderBlock(
      slideshowSection({
        heading: 'Gallery',
        items: [
          { src: '/a.jpg', alt: 'A', caption: 'Cap A' },
          { src: '/b.jpg', alt: 'B' },
        ],
      }),
      ctx,
    );
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="Gallery"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-roledescription="slide"');
    expect(html).toContain('aria-label="1 of 2"');
    expect(html).toContain('aria-label="2 of 2"');
  });

  it('first slide is eager-loaded without an unused preload hint; subsequent slides are lazy', () => {
    const html = renderBlock(
      slideshowSection({
        items: [
          { src: '/a.jpg', alt: 'A' },
          { src: '/b.jpg', alt: 'B' },
          { src: '/c.jpg', alt: 'C' },
        ],
      }),
      ctx,
    );
    const lazy = html.match(/loading="lazy"/g) || [];
    const eager = html.match(/loading="eager"/g) || [];
    expect(eager.length).toBe(1);
    expect(lazy.length).toBe(2);
    expect(html).toContain('fetchPriority="low"');
    expect(html).not.toContain('rel="preload"');
  });

  it('emits picture sources when AVIF/WebP derivatives are provided', () => {
    const html = renderBlock(
      slideshowSection({
        items: [{ src: '/a.jpg', webp_src: '/a.webp', avif_src: '/a.avif', alt: 'A' }],
      }),
      ctx,
    );
    expect(html).toContain('<picture');
    expect(html).toContain('srcSet="/a.avif" type="image/avif"');
    expect(html).toContain('srcSet="/a.webp" type="image/webp"');
    expect(html).toContain('src="/a.jpg"');
  });

  it('marks the first slide active with data-active', () => {
    const html = renderBlock(
      slideshowSection({
        items: [
          { src: '/a.jpg', alt: 'A' },
          { src: '/b.jpg', alt: 'B' },
        ],
      }),
      ctx,
    );
    const slides = html.match(/<figure[^>]+data-slideshow-slide[^>]+>/g) || [];
    expect(slides[0]).toContain('data-active="true"');
    expect(slides[1] || '').toContain('data-active="false"');
  });

  it('dots are rendered as buttons with aria labels', () => {
    const html = renderBlock(
      slideshowSection({
        items: [
          { src: '/a.jpg', alt: 'A' },
          { src: '/b.jpg', alt: 'B' },
          { src: '/c.jpg', alt: 'C' },
        ],
      }),
      ctx,
    );
    expect(html).toContain('aria-label="Slide 1 of 3"');
    expect(html).toContain('aria-label="Slide 2 of 3"');
    expect(html).toContain('aria-label="Slide 3 of 3"');
    expect(html).toContain('aria-current="true"');
  });

  it('show_dots=false omits dots', () => {
    const html = renderBlock(
      slideshowSection({
        items: [{ src: '/a.jpg', alt: 'A' }],
        show_dots: false,
      }),
      ctx,
    );
    expect(html).not.toContain('data-slideshow-dot');
  });

  it('show_arrows=false omits arrow buttons', () => {
    const html = renderBlock(
      slideshowSection({
        items: [{ src: '/a.jpg', alt: 'A' }],
        show_arrows: false,
      }),
      ctx,
    );
    expect(html).not.toContain('data-slide-prev');
    expect(html).not.toContain('data-slide-next');
  });

  it('live region for slide announcements is present', () => {
    const html = renderBlock(slideshowSection({ items: [{ src: '/a.jpg', alt: 'A' }] }), ctx);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-slideshow-live');
  });

  it('auto_rotate_seconds=0 disables auto rotation (data-auto-ms="0")', () => {
    const html = renderBlock(
      slideshowSection({
        items: [{ src: '/a.jpg', alt: 'A' }],
        auto_rotate_seconds: 0,
      }),
      ctx,
    );
    expect(html).toContain('data-auto-ms="0"');
  });

  it('emits rich carousel styling hooks while preserving legacy fields', () => {
    const html = renderBlock(
      slideshowSection({
        items: [
          { src: '/a.jpg', alt: 'A', object_position: '30% 40%', fit: 'contain' },
          { src: '/b.jpg', alt: 'B' },
        ],
        height: '420px',
        mobile_height: '260px',
        transition_ms: 700,
        transition_easing: 'ease-in-out',
        manual_pause: true,
        arrow_style: {
          background: '#111111',
          text: '#ffffff',
          hover: { background: '#333333' },
        },
        dot_style: { background: 'rgba(255,255,255,0.4)', active_background: '#ffcc00' },
      }),
      ctx,
    );
    expect(html).toContain('--slideshow-height:420px;');
    expect(html).toContain('--slideshow-mobile-height:260px;');
    expect(html).toContain('--slideshow-transition-ms:700ms;');
    expect(html).toContain('--slideshow-transition-easing:ease-in-out;');
    expect(html).toContain('--slideshow-arrow-bg:#111111;');
    expect(html).toContain('--slideshow-arrow-hover-bg:#333333;');
    expect(html).toContain('--slideshow-dot-active-bg:#ffcc00');
    expect(html).toContain('data-manual-pause="true"');
    expect(html).toContain('object-position:30% 40%');
    expect(html).toContain('object-fit:contain');
  });

  it('empty items hides the slideshow for visitors', () => {
    const html = renderBlock(slideshowSection({ items: [] }), ctx);
    expect(html).not.toContain('data-block-hydrate="slideshow"');
  });

  it('renders missing slide images as placeholders instead of empty src attributes', () => {
    const html = renderBlock(slideshowSection({ items: [{ src: '', alt: 'Missing slide' }] }), ctx);

    expect(html).toContain('data-slideshow-missing-image');
    expect(html).toContain('Missing slide');
    expect(html).not.toContain('src=""');
  });

  it('admin sees a placeholder when items are empty', () => {
    const html = renderBlock(slideshowSection({ items: [] }), { ...ctx, admin: true });
    expect(html).toContain('data-slideshow-empty');
  });

  it('escapes user-supplied alt and caption', () => {
    const html = renderBlock(
      slideshowSection({
        items: [{ src: '/a.jpg', alt: '<script>x</script>', caption: '<img src=x>' }],
      }),
      ctx,
    );
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('keeps retired slideshow classes out of source CSS and renderer output', () => {
    const html = renderBlock(
      slideshowSection({
        items: [
          { src: '/a.jpg', alt: 'A' },
          { src: '/b.jpg', alt: 'B' },
        ],
      }),
      ctx,
    );
    expect(html).not.toContain('block-slideshow');
    expect(html).not.toContain('section-slideshow');
  });

  it('renders slideshow controls through the shared Button component', () => {
    expect(slideshowViewSource).toContain("import { Button, Card, CardContent } from '@/components/kychon/ui'");
    expect(slideshowViewSource).toContain('<Button');
    expect(slideshowViewSource).not.toContain('<button');
    expect(slideshowViewSource).not.toContain('buttonVariants');
  });
});
