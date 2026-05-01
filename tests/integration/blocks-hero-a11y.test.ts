// A11y check for the foreground hero. Asserts the structural properties that
// axe-core (and similar tools) would flag: image-alt, decorative-img-empty-alt,
// heading hierarchy, semantic role correctness. Uses the happy-dom environment
// already configured for tests/integration/* in vitest.config.ts.

import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks.ts';

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => false,
  currentPath: '/',
};

function renderHero(config: Record<string, unknown>): HTMLElement {
  const section: Section = {
    id: 7,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'hero',
    config,
    position: 1,
    visible: true,
  };
  const html = renderBlock(section, ctx);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.firstElementChild as HTMLElement;
}

describe('foreground hero a11y', () => {
  it('every <img> has an alt attribute (no axe `image-alt` violation)', () => {
    const root = renderHero({
      mode: 'foreground',
      image_url: '/banner.png',
      image_alt: 'Founded 1880, banner photo',
      logo_overlay_url: '/logo.svg',
      caption_html: 'Alexandria, VA',
      heading: 'Old Dominion Boat Club',
      subheading: 'Tagline',
      cta_text: 'Join',
      cta_href: '/join',
    });
    const imgs = Array.from(root.querySelectorAll('img'));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img.hasAttribute('alt')).toBe(true);
    }
  });

  it('the picture <img> has the configured alt text (image-alt rule)', () => {
    const root = renderHero({
      mode: 'foreground',
      image_url: '/banner.png',
      image_alt: 'Banner photo of the clubhouse',
    });
    const pictureImg = root.querySelector('.hero-picture img') as HTMLImageElement;
    expect(pictureImg).toBeTruthy();
    expect(pictureImg.getAttribute('alt')).toEqual('Banner photo of the clubhouse');
  });

  it('the logo overlay has alt="" (decorative — pairs with the picture alt)', () => {
    const root = renderHero({
      mode: 'foreground',
      image_url: '/banner.png',
      image_alt: 'Banner with brand mark',
      logo_overlay_url: '/logo.svg',
    });
    const logoImg = root.querySelector('.hero-logo-overlay img') as HTMLImageElement;
    expect(logoImg).toBeTruthy();
    expect(logoImg.getAttribute('alt')).toEqual('');
  });

  it('caption is a <div> with no role override (descriptive text only)', () => {
    const root = renderHero({
      mode: 'foreground',
      image_url: '/banner.png',
      image_alt: 'x',
      caption_html: 'Founded 1880',
    });
    const caption = root.querySelector('.hero-caption') as HTMLElement;
    expect(caption).toBeTruthy();
    expect(caption.tagName.toLowerCase()).toEqual('div');
    expect(caption.hasAttribute('role')).toBe(false);
    expect(caption.hasAttribute('aria-label')).toBe(false);
  });

  it('the heading group uses <h1> (heading-order rule)', () => {
    const root = renderHero({
      mode: 'foreground',
      image_url: '/banner.png',
      image_alt: 'x',
      heading: 'Welcome',
    });
    const h1 = root.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1?.textContent).toEqual('Welcome');
    // No competing headings on the section.
    expect(root.querySelectorAll('h2,h3,h4,h5,h6').length).toEqual(0);
  });

  it('the CTA is a real <a> with an href (link-name rule)', () => {
    const root = renderHero({
      mode: 'foreground',
      image_url: '/banner.png',
      image_alt: 'x',
      heading: 'Welcome',
      cta_text: 'Join now',
      cta_href: '/join',
    });
    const cta = root.querySelector('a.btn') as HTMLAnchorElement;
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('href')).toEqual('/join');
    expect(cta.textContent).toEqual('Join now');
  });

  it('section has no aria-hidden or hidden attribute that would suppress content for screen readers', () => {
    const root = renderHero({
      mode: 'foreground',
      image_url: '/banner.png',
      image_alt: 'x',
      heading: 'h',
    });
    expect(root.hasAttribute('aria-hidden')).toBe(false);
    expect(root.hasAttribute('hidden')).toBe(false);
  });

  it('foreground hero with empty alt still renders and is salvageable (warning is logged elsewhere)', () => {
    // image-alt rule recommends alt="" for purely decorative images. We accept
    // empty alt without throwing — the renderer logs a console.warn pointing
    // admins at the issue, but the markup must remain valid HTML.
    const orig = console.warn;
    console.warn = () => {};
    try {
      const root = renderHero({ mode: 'foreground', image_url: '/banner.png' });
      const img = root.querySelector('.hero-picture img') as HTMLImageElement;
      expect(img.hasAttribute('alt')).toBe(true);
      expect(img.getAttribute('alt')).toEqual('');
    } finally {
      console.warn = orig;
    }
  });

  it('caption with sanitized markup is rendered into the DOM as expected', () => {
    const root = renderHero({
      mode: 'foreground',
      image_url: '/x.png',
      image_alt: 'x',
      caption_html: '<script>alert(1)</script>Founded <strong>1880</strong>',
    });
    const caption = root.querySelector('.hero-caption') as HTMLElement;
    // Script tag was stripped, content was preserved.
    expect(caption.querySelector('script')).toBeNull();
    expect(caption.textContent).toEqual('Founded 1880');
    expect(caption.querySelector('strong')).toBeTruthy();
  });
});

describe('background hero a11y (regression check)', () => {
  it('background mode still produces an <h1> and an accessible CTA', () => {
    const root = renderHero({
      heading: 'Welcome',
      subheading: 'Tagline',
      bg_image: '/bg.jpg',
      cta_text: 'Join',
      cta_href: '/join',
    });
    expect(root.querySelector('h1')?.textContent).toEqual('Welcome');
    const cta = root.querySelector('a.btn') as HTMLAnchorElement;
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('href')).toEqual('/join');
  });
});
