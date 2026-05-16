import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';
import {
  normalizeSocialLinkItems,
  normalizeSocialProvider,
  SUPPORTED_SOCIAL_PROVIDERS,
  sanitizeSocialHref,
} from '../../src/lib/blocks/social-links';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };

function section(
  section_type: string,
  config: Record<string, unknown> = {},
  zone: Section['zone'] = 'header',
): Section {
  return {
    id: 92,
    page_slug: '*',
    zone,
    scope: 'global',
    section_type,
    position: 2,
    config,
  };
}

describe('social link provider normalization', () => {
  it('publishes the supported canonical provider set', () => {
    expect(SUPPORTED_SOCIAL_PROVIDERS).toEqual([
      'facebook',
      'x',
      'linkedin',
      'instagram',
      'youtube',
      'email',
      'website',
    ]);
  });

  it('normalizes aliases and common source labels', () => {
    expect(normalizeSocialProvider('Twitter')).toBe('x');
    expect(normalizeSocialProvider('Linked In')).toBe('linkedin');
    expect(normalizeSocialProvider('homepage')).toBe('website');
    expect(normalizeSocialProvider('mail')).toBe('email');
  });

  it('infers provider from href when metadata is sparse', () => {
    expect(normalizeSocialProvider('', 'https://www.facebook.com/example')).toBe('facebook');
    expect(normalizeSocialProvider('', 'https://x.com/example')).toBe('x');
    expect(normalizeSocialProvider('', 'https://www.linkedin.com/company/example')).toBe('linkedin');
    expect(normalizeSocialProvider('', 'https://www.instagram.com/example')).toBe('instagram');
    expect(normalizeSocialProvider('', 'https://youtu.be/abc123')).toBe('youtube');
    expect(normalizeSocialProvider('', 'mailto:info@example.org')).toBe('email');
    expect(normalizeSocialProvider('', 'https://example.org')).toBe('website');
  });

  it('sanitizes unsafe hrefs', () => {
    expect(sanitizeSocialHref('javascript:alert(1)')).toBe('');
    expect(sanitizeSocialHref('data:text/html,hi')).toBe('');
    expect(sanitizeSocialHref('//example.org')).toBe('');
    expect(sanitizeSocialHref('https://example.org')).toBe('https://example.org');
    expect(sanitizeSocialHref('mailto:info@example.org')).toBe('mailto:info@example.org');
  });

  it('preserves unknown providers with href and label', () => {
    const items = normalizeSocialLinkItems({
      items: [{ platform: 'Mastodon', href: 'https://social.example/@club', label: 'Mastodon' }],
    });
    expect(items).toEqual([
      expect.objectContaining({
        provider: 'website',
        href: 'https://social.example/@club',
        label: 'Mastodon',
      }),
    ]);
  });
});

describe('social_links block rendering', () => {
  it('registers the generic social_links block for chrome zones', () => {
    expect(BLOCK_TYPES.social_links).toBeDefined();
    expect(BLOCK_TYPES.social_links.zoneHints).toEqual(['header', 'footer']);
  });

  it('renders supported providers as accessible SVG icon links', () => {
    const html = renderBlock(
      section('social_links', {
        items: [
          { platform: 'facebook', href: 'https://www.facebook.com/TheAAGELtd/' },
          { platform: 'x', href: 'https://x.com/wildapricot' },
          { platform: 'linkedin', href: 'http://www.linkedin.com/company/aage' },
          { platform: 'instagram', href: 'https://www.instagram.com/theaage/' },
        ],
      }),
      ctx,
    );

    for (const provider of ['facebook', 'x', 'linkedin', 'instagram']) {
      expect(html).toContain(`data-social-provider="${provider}"`);
    }
    expect(html).toContain('data-social-link-icon');
    expect(html).toContain('--social-link-provider-color:#1877f2');
    expect(html).toContain('aria-label="Facebook"');
    expect(html).toContain('aria-label="LinkedIn"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('block-social-links');
    expect(html).not.toContain('>f</a>');
    expect(html).not.toContain('>in</a>');
    expect(html).not.toContain('>ig</a>');
  });

  it('does not force mailto links into a new tab', () => {
    const html = renderBlock(
      section('social_links', {
        items: [{ platform: 'email', href: 'mailto:info@example.org' }],
      }),
      ctx,
    );

    expect(html).toContain('href="mailto:info@example.org"');
    expect(html).toContain('aria-label="Email"');
    expect(html).not.toContain('target="_blank"');
  });

  it('emits copied presentation variables for admin-editable icon styling', () => {
    const html = renderBlock(
      section('social_links', {
        items: [{ platform: 'facebook', href: 'https://www.facebook.com/example' }],
        presentation: {
          size: '1.8rem',
          icon_size: '1rem',
          radius: '.2rem',
          bg: '#3F88E8',
          color: '#ffffff',
          border: 'transparent',
          gap: '.35rem',
        },
      }),
      ctx,
    );

    expect(html).toContain('--social-link-size:1.8rem;');
    expect(html).toContain('--social-link-bg:#3F88E8;');
    expect(html).toContain('--social-link-border:transparent;');
    expect(html).toContain('--social-link-gap:.35rem;');
  });

  it('renders legacy footer_social icons through the same renderer', () => {
    const html = renderBlock(
      section(
        'footer_social',
        {
          icons: [{ platform: 'youtube', href: 'https://youtube.com/@example' }],
        },
        'footer',
      ),
      ctx,
    );

    expect(html).toContain('data-social-provider="youtube"');
    expect(html).toContain('data-social-link-icon');
    expect(html).toContain('data-legacy-footer-links');
    expect(html).toContain('data-footer-block');
    expect(html).not.toMatch(/class="[^"]*\bfooter(?:-|\b)/);
    expect(html).not.toContain('class="section');
    expect(html).not.toContain('footer-social');
  });

  it('keeps retired social link classes out of source CSS and renderer', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');
    const renderer = readFileSync('src/lib/blocks/social-links.ts', 'utf8');

    expect(renderer).toContain('@/components/kychon/ui');
    expect(renderer).toContain('Button');
    expect(renderer).toContain('renderToStaticMarkup');
    expect(renderer).not.toContain('buttonVariants');
    expect(styles).not.toContain('block-social-links');
    expect(renderer).not.toContain('block-social-links');
  });
});
