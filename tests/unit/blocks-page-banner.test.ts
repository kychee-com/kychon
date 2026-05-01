import { describe, expect, it } from 'vitest';
import {
  BLOCK_TYPES,
  renderBlock,
  sanitizeCaptionHtml,
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

describe('sanitizeCaptionHtml', () => {
  it('strips script tags AND their content', () => {
    expect(sanitizeCaptionHtml('<script>alert(1)</script>Welcome!')).toBe('Welcome!');
  });

  it('drops disallowed tags and their inner text', () => {
    const out = sanitizeCaptionHtml('<div>not allowed</div><strong>kept</strong>');
    expect(out).toContain('<strong>kept</strong>');
    // Forbidden tags push the skip-stack so their content is dropped, too.
    expect(out).not.toContain('not allowed');
  });

  it('allows br, strong, em, a', () => {
    expect(sanitizeCaptionHtml('a<br>b')).toContain('<br>');
    expect(sanitizeCaptionHtml('<em>x</em>')).toBe('<em>x</em>');
    expect(sanitizeCaptionHtml('<a href="https://example.com">x</a>')).toContain('href="https://example.com"');
    expect(sanitizeCaptionHtml('<a href="https://example.com">x</a>')).toContain('rel="noopener noreferrer"');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>',
    'vbscript:msgbox(1)',
  ])('rejects unsafe href scheme %s', (href) => {
    const out = sanitizeCaptionHtml(`<a href="${href}">x</a>`);
    expect(out).not.toContain(href);
    expect(out).toContain('<a>');
  });

  it.each([
    'https://example.com',
    'http://example.com',
    'mailto:hi@example.com',
    'tel:+15551234',
    '/relative',
    '#anchor',
  ])('keeps safe href scheme %s', (href) => {
    const out = sanitizeCaptionHtml(`<a href="${href}">x</a>`);
    expect(out).toContain(`href="${href}"`);
  });

  it('escapes plain text properly', () => {
    expect(sanitizeCaptionHtml('a < b & c > d')).toContain('&lt;');
    expect(sanitizeCaptionHtml('a < b & c > d')).toContain('&amp;');
  });

  it('strips iframe content (forbidden tag opens skip-stack)', () => {
    const out = sanitizeCaptionHtml('<iframe>injected</iframe>after');
    expect(out).toContain('after');
    expect(out).not.toContain('injected');
  });
});
