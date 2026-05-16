import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section, sanitizeCaptionHtml } from '../../src/lib/blocks.ts';

const blocksSource = readFileSync('src/lib/blocks.ts', 'utf8');

const baseCtx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  isFeatureEnabled: () => false,
  currentPath: '/',
};

function heroSection(config: Record<string, unknown>, id = 1): Section {
  return {
    id,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'hero',
    config,
    position: 1,
    visible: true,
  };
}

describe('hero renderer — background mode (existing behavior)', () => {
  it('renders CTA links through the shared Button component renderer', () => {
    expect(blocksSource).toContain('@/components/kychon/ui');
    expect(blocksSource).toContain('renderToStaticMarkup');
    expect(blocksSource).toContain('React.createElement');
    expect(blocksSource).not.toContain('buttonVariants');
  });

  it('renders the existing background hero when mode is unset', () => {
    const html = renderBlock(
      heroSection({
        heading: 'Welcome',
        subheading: 'Subhead',
        cta_text: 'Join',
        cta_href: '/join',
        bg_image: '/img/hero.jpg',
      }),
      baseCtx,
    );
    expect(html).toContain('class="section" data-hero data-hero-mode="background"');
    expect(html).not.toContain('data-hero-mode="foreground"');
    expect(html).toContain("background-image:url('/img/hero.jpg')");
    expect(html).toContain('<h1>Welcome</h1>');
    expect(html).toContain('<p>Subhead</p>');
    expect(html).toContain('href="/join"');
    expect(html).toContain('data-hero-cta');
    expect(html).toContain('Join');
    expect(html).not.toContain('btn btn-primary');
  });

  it("renders mode === 'background' identically to no-mode (no breaking change)", () => {
    const cfg = { heading: 'X', subheading: 'Y', bg_image: '/a.jpg', cta_text: '', cta_href: '' };
    const a = renderBlock(heroSection({ ...cfg }), baseCtx);
    const b = renderBlock(heroSection({ ...cfg, mode: 'background' }), baseCtx);
    expect(a).toEqual(b);
  });

  it('omits the background-image style when bg_image is empty', () => {
    const html = renderBlock(heroSection({ heading: 'h', subheading: 's' }), baseCtx);
    expect(html).not.toContain('background-image');
  });
});

describe('hero renderer — foreground mode', () => {
  it("emits <picture> with eager loading and async decoding when mode === 'foreground'", () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: 'https://cdn.example.com/banner.png',
        image_alt: 'Founded 1880',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-mode="foreground"');
    expect(html).toContain('<picture data-hero-picture');
    expect(html).toContain('src="https://cdn.example.com/banner.png"');
    expect(html).toContain('alt="Founded 1880"');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('decoding="async"');
    expect(html).not.toContain('background-image');
  });

  it("defaults aspect to 'auto' when image_aspect is unset", () => {
    const html = renderBlock(heroSection({ mode: 'foreground', image_url: '/x.png', image_alt: 'x' }), baseCtx);
    expect(html).toContain('data-hero-aspect="auto"');
  });

  it('applies non-auto aspect when configured', () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        image_aspect: '16/9',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-aspect="16/9"');
  });

  it("ignores invalid aspect ratios and falls back to 'auto'", () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        image_aspect: 'evil-value',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-aspect="auto"');
  });

  it('renders the logo overlay when logo_overlay_url is set, with default left position and 120px max-height', () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        logo_overlay_url: 'https://cdn.example.com/logo.svg',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-logo-overlay data-hero-position="left"');
    expect(html).toContain('src="https://cdn.example.com/logo.svg"');
    expect(html).toContain('alt=""');
    expect(html).toContain('max-height:120px');
  });

  it('respects logo_position and logo_max_height when set', () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        logo_overlay_url: '/logo.svg',
        logo_position: 'center',
        logo_max_height: '80px',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-position="center"');
    expect(html).toContain('max-height:80px');
  });

  it('omits the logo overlay when logo_overlay_url is unset', () => {
    const html = renderBlock(heroSection({ mode: 'foreground', image_url: '/x.png', image_alt: 'x' }), baseCtx);
    expect(html).not.toContain('data-hero-logo-overlay');
  });

  it('renders caption at default bottom-right position when caption_html is set', () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        caption_html: 'Alexandria, Virginia',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-caption data-hero-position="bottom-right"');
    expect(html).toContain('Alexandria, Virginia');
  });

  it('respects caption_position when valid', () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        caption_html: 'top corner',
        caption_position: 'top-left',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-position="top-left"');
  });

  it('falls back to bottom-right for invalid caption positions', () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        caption_html: 'x',
        caption_position: 'middle-middle',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-position="bottom-right"');
  });

  it("defaults text_position to 'over_image'", () => {
    const html = renderBlock(heroSection({ mode: 'foreground', image_url: '/x.png', image_alt: 'x' }), baseCtx);
    expect(html).toContain('data-hero-text-position="over_image"');
  });

  it("renders below_image when text_position is 'below_image'", () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        heading: 'H',
        subheading: 'S',
        text_position: 'below_image',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-text-position="below_image"');
    // <picture> appears before the heading group in document order
    const picIdx = html.indexOf('<picture');
    const headIdx = html.indexOf('<h1');
    expect(picIdx).toBeGreaterThan(-1);
    expect(headIdx).toBeGreaterThan(picIdx);
  });

  it('renders the heading group only when at least one heading field is present', () => {
    const noText = renderBlock(heroSection({ mode: 'foreground', image_url: '/x.png', image_alt: 'x' }), baseCtx);
    expect(noText).not.toContain('<div data-hero-text>');
    const withText = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        heading: 'Hi',
      }),
      baseCtx,
    );
    expect(withText).toContain('<div data-hero-text>');
    expect(withText).toContain('<h1');
  });

  it('uses the shared shadcn button classes for the foreground CTA', () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        heading: 'Hi',
        cta_text: 'Join',
        cta_href: '/join.html',
      }),
      baseCtx,
    );
    expect(html).toContain('data-hero-cta');
    expect(html).toContain('href="/join"');
    expect(html).toContain('inline-flex appearance-none');
    expect(html).not.toContain('btn btn-primary');
  });

  it('warns to console when image_alt is missing in foreground mode (a11y nudge)', () => {
    const orig = console.warn;
    let warned = '';
    console.warn = (msg: string) => {
      warned = String(msg);
    };
    try {
      renderBlock(heroSection({ mode: 'foreground', image_url: '/x.png' }), baseCtx);
    } finally {
      console.warn = orig;
    }
    expect(warned).toContain('image_alt');
  });
});

describe('hero renderer — admin attributes', () => {
  it('emits the generic section-edit button when admin (background mode)', () => {
    const html = renderBlock(heroSection({ heading: 'h', subheading: 's' }), { ...baseCtx, admin: true });
    // Hero blocks use the generic data-section-edit button (column-span-rows
    // unified popover); the popover surfaces a "Hero settings…" link that
    // opens the hero-specific mode/foreground editor.
    expect(html).toContain('data-section-edit="1"');
  });

  it('foreground mode also emits the generic section-edit button for admins', () => {
    const html = renderBlock(heroSection({ mode: 'foreground', image_url: '/x.png', image_alt: 'x' }), {
      ...baseCtx,
      admin: true,
    });
    expect(html).toContain('data-section-edit="1"');
  });

  it('keeps rich caption HTML inside data-editable-config from leaking into admin DOM', () => {
    const html = renderBlock(
      heroSection({
        mode: 'foreground',
        heading: 'Lifting Wichita',
        image_url: '/assets/hero.jpg',
        image_alt: 'Volunteers',
        caption_html: 'Founded 1995 · <strong>Sedgwick County, KS</strong>',
        image_aspect: '21/9',
        logo_overlay_url: '/assets/logo.png',
      }),
      { ...baseCtx, admin: true },
    );
    const editableConfig = html.match(/data-editable-config="([^"]+)"/)?.[1] || '';

    expect(editableConfig).toContain('&lt;strong&gt;Sedgwick County, KS&lt;/strong&gt;');
    expect(editableConfig).not.toContain('<strong>');
    expect(html).toContain(
      '<div data-hero-caption data-hero-position="bottom-right">Founded 1995 · <strong>Sedgwick County, KS</strong></div>',
    );
  });
});

describe('hero renderer — retired primitive classes', () => {
  it('keeps hero-specific CSS primitive classes out of renderer output and public CSS', () => {
    const foreground = renderBlock(
      heroSection({
        mode: 'foreground',
        image_url: '/x.png',
        image_alt: 'x',
        heading: 'Hi',
        caption_html: 'Caption',
        logo_overlay_url: '/logo.svg',
      }),
      baseCtx,
    );
    const background = renderBlock(heroSection({ heading: 'Welcome', bg_image: '/bg.jpg' }), baseCtx);
    const combined = `${foreground}\n${background}\n${blocksSource}`;
    const styles = readFileSync('src/styles/public.css', 'utf8');

    for (const retired of [
      'section-hero',
      'hero-foreground',
      'hero-picture',
      'hero-logo-overlay',
      'hero-caption',
      'hero-text',
    ]) {
      expect(combined).not.toMatch(new RegExp(`class="[^"]*\\b${retired}\\b`));
      expect(styles).not.toContain(`.${retired}`);
    }
  });
});

describe('sanitizeCaptionHtml — allowlist enforcement', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeCaptionHtml('')).toEqual('');
    expect(sanitizeCaptionHtml(undefined as unknown as string)).toEqual('');
  });

  it('keeps allowed inline tags', () => {
    expect(sanitizeCaptionHtml('Hello <strong>bold</strong> and <em>italic</em>.')).toEqual(
      'Hello <strong>bold</strong> and <em>italic</em>.',
    );
  });

  it('allows <br> with self-closing variants', () => {
    expect(sanitizeCaptionHtml('Line1<br>Line2')).toContain('<br>');
    expect(sanitizeCaptionHtml('Line1<br/>Line2')).toContain('<br>');
    expect(sanitizeCaptionHtml('Line1<br />Line2')).toContain('<br>');
  });

  it('strips <script> tags entirely', () => {
    const out = sanitizeCaptionHtml('<script>alert(1)</script>Hello <em>world</em>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('</script>');
    expect(out).toContain('Hello <em>world</em>');
  });

  it('strips event-handler attributes by stripping all attrs except href on <a>', () => {
    const out = sanitizeCaptionHtml('<em onclick="alert(1)">x</em>');
    expect(out).toEqual('<em>x</em>');
  });

  it('strips <img> entirely (not in allowlist)', () => {
    const out = sanitizeCaptionHtml('<img src=x onerror="alert(1)">hi');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror');
    expect(out).toContain('hi');
  });

  it('strips style/iframe/svg/object/etc.', () => {
    expect(sanitizeCaptionHtml('<style>body{}</style>x')).not.toContain('<style');
    expect(sanitizeCaptionHtml('<iframe src=x></iframe>x')).not.toContain('<iframe');
    expect(sanitizeCaptionHtml('<svg><circle/></svg>x')).not.toContain('<svg');
  });

  it('rejects javascript: hrefs', () => {
    const out = sanitizeCaptionHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).toContain('<a href="">');
    expect(out).not.toContain('javascript:');
  });

  it('rejects data: hrefs', () => {
    const out = sanitizeCaptionHtml('<a href="data:text/html,xss">click</a>');
    expect(out).toContain('<a href="">');
    expect(out).not.toContain('data:');
  });

  it('rejects vbscript: hrefs', () => {
    const out = sanitizeCaptionHtml('<a href="vbscript:msgbox">click</a>');
    expect(out).toContain('<a href="">');
    expect(out).not.toContain('vbscript:');
  });

  it('preserves http(s) hrefs', () => {
    expect(sanitizeCaptionHtml('<a href="https://example.com">x</a>')).toContain('href="https://example.com"');
    expect(sanitizeCaptionHtml('<a href="http://example.com">x</a>')).toContain('href="http://example.com"');
  });

  it('preserves mailto: hrefs', () => {
    expect(sanitizeCaptionHtml('<a href="mailto:x@y.com">x</a>')).toContain('href="mailto:x@y.com"');
  });

  it('preserves relative path hrefs', () => {
    expect(sanitizeCaptionHtml('<a href="/about">x</a>')).toContain('href="/about"');
    expect(sanitizeCaptionHtml('<a href="#anchor">x</a>')).toContain('href="#anchor"');
    expect(sanitizeCaptionHtml('<a href="?foo=bar">x</a>')).toContain('href="?foo=bar"');
  });

  it('rejects scheme-relative URLs (//evil.com) since they are not relative paths', () => {
    const out = sanitizeCaptionHtml('<a href="//evil.com">x</a>');
    expect(out).toContain('<a href="">');
  });

  it('strips uppercase/mixed-case <SCRIPT>', () => {
    expect(sanitizeCaptionHtml('<SCRIPT>alert(1)</SCRIPT>x')).toEqual('x');
    expect(sanitizeCaptionHtml('<ScRiPt>alert(1)</ScRiPt>x')).toEqual('x');
  });

  it('handles unclosed tags gracefully', () => {
    const out = sanitizeCaptionHtml('Hello <strong unclosed');
    expect(out).toEqual('Hello ');
  });

  it('drops unknown tags but keeps inner text', () => {
    expect(sanitizeCaptionHtml('<custom>hello</custom>')).toEqual('hello');
    expect(sanitizeCaptionHtml('<div class="x">y</div>')).toEqual('y');
  });

  it('escapes nothing it keeps — surrounding text passes through verbatim', () => {
    // Plain text outside tags is not escaped here (caption_html is admin-trust;
    // sanitizer is a structural defense, not an escape). The renderer relies
    // on the allowlist to keep dangerous tags out — admins should pre-escape
    // text they want literal. Verify the contract.
    const out = sanitizeCaptionHtml('a < b');
    expect(out).toContain('a ');
  });
});
