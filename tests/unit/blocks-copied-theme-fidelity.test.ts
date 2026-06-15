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

describe('feature_panels block (#124)', () => {
  it('registers feature_panels as a main-zone list block', () => {
    expect(BLOCK_TYPES.feature_panels).toBeDefined();
    expect(BLOCK_TYPES.feature_panels.zoneHints).toContain('main');
    expect(BLOCK_TYPES.feature_panels.editorType).toBe('list');
    expect(BLOCK_TYPES.feature_panels.translatableFields).toEqual(
      expect.arrayContaining(['panels[].heading', 'panels[].body', 'panels[].cta_label']),
    );
  });

  it('renders a structured, escaped panel grid', () => {
    const html = renderBlock(
      section('feature_panels', {
        heading: 'Our pillars',
        panels: [
          {
            image_url: '/p.png',
            image_alt: 'Boats',
            heading: 'Sailing',
            body: '<Alpha> & more',
            cta_label: 'Learn',
            cta_href: '/sailing',
            fit: 'contain',
            object_position: '40% 50%',
          },
        ],
      }),
      ctx,
    );
    expect(html).toContain('data-feature-panels');
    expect(html).toContain('data-feature-panel');
    expect(html).toContain('Our pillars');
    expect(html).toContain('Sailing');
    expect(html).toContain('&lt;Alpha&gt; &amp; more');
    expect(html).toContain('object-fit:contain');
    expect(html).toContain('object-position:40% 50%');
    expect(html).toContain('href="/sailing"');
  });

  it('does not emit raw script from a panel body', () => {
    const html = renderBlock(
      section('feature_panels', { panels: [{ heading: 'X', body: '<script>x</script>' }] }),
      ctx,
    );
    expect(html).not.toContain('<script>x</script>');
  });

  it('exposes inline-edit hooks for admins', () => {
    const html = renderBlock(
      section('feature_panels', { heading: 'H', panels: [{ heading: 'P', body: 'B', image_url: '' }] }),
      { ...ctx, admin: true },
    );
    expect(html).toContain('data-editable="sections.700.config.heading"');
    expect(html).toContain('data-editable="sections.700.config.panels.0.heading"');
    expect(html).toContain('data-editable-image="sections.700.config.panels.0.image_url"');
  });
});

describe('menu block (#123)', () => {
  it('registers menu as a main-zone list block with nested translatable fields', () => {
    expect(BLOCK_TYPES.menu).toBeDefined();
    expect(BLOCK_TYPES.menu.zoneHints).toContain('main');
    expect(BLOCK_TYPES.menu.editorType).toBe('list');
    expect(BLOCK_TYPES.menu.translatableFields).toEqual(
      expect.arrayContaining(['sections[].name', 'sections[].items[].name', 'sections[].items[].description']),
    );
  });

  it('renders structured sections, items, prices, and dietary tags (escaped)', () => {
    const html = renderBlock(
      section('menu', {
        heading: 'Tap room',
        sections: [
          {
            name: 'Starters',
            items: [{ name: 'Chowder', description: 'House <special>', price: '$6', dietary_tags: ['GF', 'V'] }],
          },
        ],
      }),
      ctx,
    );
    expect(html).toContain('data-menu');
    expect(html).toContain('data-menu-section');
    expect(html).toContain('Starters');
    expect(html).toContain('Chowder');
    expect(html).toContain('$6');
    expect(html).toContain('data-menu-tag');
    expect(html).toContain('GF');
    expect(html).toContain('House &lt;special&gt;');
    expect(html).not.toContain('<special>');
  });

  it('exposes inline-edit hooks for section names, item names, and prices', () => {
    const html = renderBlock(
      section('menu', { sections: [{ name: 'Mains', items: [{ name: 'Burger', price: '$12' }] }] }),
      {
        ...ctx,
        admin: true,
      },
    );
    expect(html).toContain('data-editable="sections.700.config.sections.0.name"');
    expect(html).toContain('data-editable="sections.700.config.sections.0.items.0.name"');
    expect(html).toContain('data-editable="sections.700.config.sections.0.items.0.price"');
  });
});

describe('member_login block (#91)', () => {
  it('registers member_login with translatable label fields', () => {
    expect(BLOCK_TYPES.member_login).toBeDefined();
    expect(BLOCK_TYPES.member_login.zoneHints).toContain('main');
    expect(BLOCK_TYPES.member_login.translatableFields).toEqual(
      expect.arrayContaining(['heading', 'username_label', 'password_label', 'submit_label']),
    );
  });

  it('renders source-style labels and a sign-in CTA, never a fake credential form', () => {
    const html = renderBlock(
      section('member_login', {
        heading: 'AAGE member zone',
        username_label: 'Member email',
        password_label: 'Passphrase',
        submit_label: 'Enter',
        sign_in_href: '/join',
      }),
      ctx,
    );
    expect(html).toContain('data-member-login');
    expect(html).toContain('AAGE member zone');
    expect(html).toContain('Member email');
    expect(html).toContain('Passphrase');
    expect(html).toContain('data-member-login-cta');
    expect(html).toContain('href="/join"');
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('<input');
  });

  it('marks bot protection pending without rendering a faked widget', () => {
    const enabled = renderBlock(section('member_login', { enable_bot_protection: true }), ctx);
    expect(enabled).toContain('data-bot-protection="pending"');
    expect(enabled.toLowerCase()).not.toContain('recaptcha');
    expect(enabled).not.toContain('<iframe');
    expect(enabled).not.toContain('<script');

    const disabled = renderBlock(section('member_login', { enable_bot_protection: false }), ctx);
    expect(disabled).not.toContain('data-bot-protection');
  });
});

describe('utility header cluster blocks (#99)', () => {
  it('registers safety_cta, social_row, and utility_bar as header blocks', () => {
    for (const t of ['safety_cta', 'social_row', 'utility_bar']) {
      expect(BLOCK_TYPES[t]).toBeDefined();
      expect(BLOCK_TYPES[t].zoneHints).toContain('header');
    }
  });

  it('safety_cta renders an editable, escaped CTA with a variant', () => {
    const html = renderBlock(section('safety_cta', { label: 'Risk & safety', href: '/safety', variant: 'outline' }), {
      ...ctx,
      admin: true,
    });
    expect(html).toContain('data-safety-cta');
    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('href="/safety"');
    expect(html).toContain('Risk &amp; safety');
    expect(html).toContain('data-editable="sections.700.config.label"');
  });

  it('social_row renders only links that have both a network and an href', () => {
    const html = renderBlock(
      section('social_row', {
        links: [
          { network: 'facebook', href: 'https://fb.com/x' },
          { network: 'x', href: '' },
        ],
      }),
      ctx,
    );
    expect(html).toContain('data-network="facebook"');
    expect(html).toContain('href="https://fb.com/x"');
    expect(html).not.toContain('data-network="x"');
  });

  it('utility_bar renders editable items with alignment', () => {
    const html = renderBlock(
      section('utility_bar', { align: 'left', items: [{ label: 'Members', href: '/members' }] }),
      {
        ...ctx,
        admin: true,
      },
    );
    expect(html).toContain('data-utility-bar');
    expect(html).toContain('data-align="left"');
    expect(html).toContain('data-utility-item');
    expect(html).toContain('href="/members"');
    expect(html).toContain('data-editable="sections.700.config.items.0.label"');
  });
});
