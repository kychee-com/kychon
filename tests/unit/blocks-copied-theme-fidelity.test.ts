import { describe, expect, it } from 'vitest';
import {
  BLOCK_TYPES,
  type BlockRenderContext,
  renderBlock,
  type Section,
  sanitizeSvgPathData,
} from '../../src/lib/blocks';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };

function section(section_type: string, config: Record<string, unknown> = {}): Section {
  return {
    id: 700,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type,
    config,
    position: 1,
  };
}

describe('copied-theme fidelity block registry', () => {
  it('registers image_accordion and shape_divider', () => {
    expect(BLOCK_TYPES.image_accordion).toBeDefined();
    expect(BLOCK_TYPES.shape_divider).toBeDefined();
    expect(BLOCK_TYPES.image_accordion.zoneHints).toContain('main');
    expect(BLOCK_TYPES.shape_divider.supportedSpans).toEqual(['1']);
  });
});

describe('image_accordion block', () => {
  it('renders ordered panels with editable-safe escaped content', () => {
    const html = renderBlock(
      section('image_accordion', {
        heading: 'Our Choirs',
        panels: [
          {
            image_url: '/a.jpg',
            image_alt: 'A',
            href: '/a',
            title: '<Alpha>',
            description: '<script>x</script>',
            cta_label: 'Learn',
            object_position: '40% 50%',
          },
          { image_url: '/b.jpg', image_alt: 'B', title: 'Beta' },
        ],
      }),
      ctx,
    );
    expect(html).toContain('data-accordion');
    expect(html).toContain('Our Choirs');
    expect(html).toContain('data-accordion-panel="0"');
    expect(html).toContain('data-accordion-panel="1"');
    expect(html).toContain('href="/a"');
    expect(html).toContain('object-position:40% 50%');
    expect(html).toContain('&lt;Alpha&gt;');
    expect(html).not.toContain('<script>x</script>');
  });

  it('exposes hover/focus and mobile fallback hooks', () => {
    const html = renderBlock(
      section('image_accordion', {
        mobile_fallback: 'cards',
        active_ratio: 3,
        idle_ratio: 1,
        interactions: { focus: { border: '#ffcc00' } },
        panels: [{ title: 'Solo', description: 'Readable on mobile' }],
      }),
      ctx,
    );
    expect(html).toContain('data-mobile-fallback="cards"');
    expect(html).toContain('--accordion-active:3;');
    expect(html).toContain('--accordion-idle:1;');
    expect(html).toContain('--accordion-focus-color:#ffcc00');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('md:hover:flex-[var(--accordion-active,2.5)_1_0]');
    expect(html).toContain('focus-visible:ring-[var(--accordion-panel-focus-color)]');
  });

  it('keeps retired image accordion classes out of renderer output', () => {
    const html = renderBlock(
      section('image_accordion', {
        panels: [{ image_url: '/a.jpg', image_alt: 'A', title: 'Alpha' }],
      }),
      ctx,
    );

    expect(html).not.toContain('image-accordion');
    expect(html).not.toContain('section-image-accordion');
  });
});

describe('shape_divider block', () => {
  it('renders imported path layers with orientation metadata', () => {
    const html = renderBlock(
      section('shape_divider', {
        path: 'M0,60 C300,0 900,120 1440,60 L1440,120 L0,120 Z',
        top_color: '#ffffff',
        bottom_color: '#0057b8',
        height: '88px',
        flip_x: true,
        layers: [
          { fill: '#0057b8', opacity: 1 },
          { fill: '#ffffff', opacity: 0.4, translate_y: -12 },
        ],
      }),
      ctx,
    );
    expect(html).toContain('data-shape-divider');
    expect(html).toContain('data-top-color="#ffffff"');
    expect(html).toContain('data-bottom-color="#0057b8"');
    expect(html).toContain('--shape-height:88px;');
    expect(html).toContain('--shape-transform:scaleX(-1);');
    expect(html).toContain('opacity="0.4"');
    expect(html).toContain('transform="translate(0 -12)"');
    expect(html).not.toContain('shape-divider__');
    expect(html).not.toContain('section-shape-divider');
  });

  it('rejects unsafe path data safely', () => {
    expect(sanitizeSvgPathData('M0,0 L10,10 Z')).toBe('M0,0 L10,10 Z');
    expect(sanitizeSvgPathData('<script>alert(1)</script>')).toBe('');
    const visitorHtml = renderBlock(section('shape_divider', { path: '<script>x</script>' }), ctx);
    expect(visitorHtml).not.toContain('<script>');
    expect(visitorHtml).not.toContain('data-shape-invalid');
    const adminHtml = renderBlock(section('shape_divider', { path: '<script>x</script>' }), { ...ctx, admin: true });
    expect(adminHtml).toContain('data-shape-invalid');
    expect(adminHtml).not.toContain('shape-divider__invalid');
  });
});
