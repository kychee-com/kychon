import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import EMBED from '../../src/lib/blocks/embed.ts';
import type { BlockRenderContext, Section } from '../../src/lib/blocks.ts';

const baseSection = (config: Record<string, unknown>): Section => ({
  id: 1,
  page_slug: 'home',
  zone: 'main',
  scope: 'page',
  section_type: 'embed',
  config,
  position: 0,
  visible: true,
});

const memberCtx: BlockRenderContext = { admin: false, locale: 'en' };
const adminCtx: BlockRenderContext = { admin: true, locale: 'en' };

function sandboxTokens(html: string): string[] {
  const match = html.match(/sandbox="([^"]+)"/);
  if (!match) throw new Error('Expected sandbox attribute');
  return match[1].split(/\s+/).sort();
}

describe('embed renderer — happy paths', () => {
  it('renders a YouTube iframe with declared sandbox', () => {
    const html = EMBED.render(baseSection({ provider: 'youtube', params: { video_id: 'abcd1234' } }), memberCtx);
    expect(html).toContain('<iframe');
    expect(html).toContain('src="https://www.youtube.com/embed/abcd1234"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('data-section class="w-full"');
    expect(html).toContain('data-embed-state="ready"');
    expect(html).toContain('data-embed-provider="youtube"');
    expect(html).toContain('data-provider="youtube"');
    expect(html).not.toContain('block-embed');
  });

  it('renders a heading when provided', () => {
    const html = EMBED.render(
      baseSection({
        provider: 'youtube',
        params: { video_id: 'abcd1234' },
        heading: 'Watch our intro',
      }),
      memberCtx,
    );
    expect(html).toContain('data-embed-heading');
    expect(html).toContain('Watch our intro');
    expect(html).toContain('title="Watch our intro"');
  });

  it('uses provider label as iframe title when no heading', () => {
    const html = EMBED.render(baseSection({ provider: 'youtube', params: { video_id: 'abcd1234' } }), memberCtx);
    expect(html).toContain('title="YouTube video"');
  });

  it('applies aspect-ratio wrapper for responsive providers', () => {
    const html = EMBED.render(baseSection({ provider: 'youtube', params: { video_id: 'abcd1234' } }), memberCtx);
    expect(html).toContain('data-embed-responsive="true"');
    expect(html).toContain('aspect-video');
  });

  it('uses fixed height for non-responsive providers', () => {
    const html = EMBED.render(baseSection({ provider: 'calendly', params: { username: 'jane' } }), memberCtx);
    expect(html).toContain('height:700px');
    expect(html).toContain('data-embed-responsive="false"');
    expect(html).not.toContain('aspect-video');
  });

  it('respects explicit config.height for non-responsive providers', () => {
    const html = EMBED.render(
      baseSection({ provider: 'map', params: { address: 'Times Square' }, height: '500px' }),
      memberCtx,
    );
    expect(html).toContain('height:500px');
  });
});

describe('embed renderer — trust gate (generic iframe)', () => {
  it('refuses to emit iframe without trust_acknowledged', () => {
    const html = EMBED.render(baseSection({ provider: 'iframe', params: { src: 'https://example.com' } }), adminCtx);
    expect(html).toContain('data-embed-state="error"');
    expect(html).toContain('data-embed-error');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('trust acknowledgment');
  });

  it('renders iframe when trust_acknowledged is true', () => {
    const html = EMBED.render(
      baseSection({
        provider: 'iframe',
        params: { src: 'https://example.com/widget' },
        trust_acknowledged: true,
      }),
      adminCtx,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('src="https://example.com/widget"');
  });

  it('renders the External content pill for admins on iframe blocks', () => {
    const html = EMBED.render(
      baseSection({
        provider: 'iframe',
        params: { src: 'https://example.com' },
        trust_acknowledged: true,
      }),
      adminCtx,
    );
    expect(html).toContain('External content');
    expect(html).toContain('bg-secondary');
    expect(html).not.toContain('block-embed__pill');
    expect(html).not.toContain('block-embed');
  });

  it('does not render the pill for non-admins', () => {
    const html = EMBED.render(
      baseSection({
        provider: 'iframe',
        params: { src: 'https://example.com' },
        trust_acknowledged: true,
      }),
      memberCtx,
    );
    expect(html).not.toContain('External content');
  });

  it('does not render the pill for verified providers (even for admins)', () => {
    const html = EMBED.render(baseSection({ provider: 'youtube', params: { video_id: 'abcd1234' } }), adminCtx);
    expect(html).not.toContain('External content');
  });
});

describe('embed renderer — error states', () => {
  it('renders error placeholder for unknown provider', () => {
    const html = EMBED.render(baseSection({ provider: 'doesnotexist', params: {} }), memberCtx);
    expect(html).toContain('data-embed-state="error"');
    expect(html).toContain('Unknown provider');
    expect(html).not.toContain('<iframe');
  });

  it('renders error placeholder when buildSrc throws', () => {
    const html = EMBED.render(baseSection({ provider: 'youtube', params: {} }), memberCtx);
    expect(html).toContain('data-embed-state="error"');
    expect(html).toContain('Missing required param');
    expect(html).not.toContain('<iframe');
  });

  it('renders error placeholder when no provider configured', () => {
    const html = EMBED.render(baseSection({}), memberCtx);
    expect(html).toContain('data-embed-state="error"');
    expect(html).toContain('No provider configured');
  });

  it('error placeholder still emits the section wrapper for admin controls', () => {
    const html = EMBED.render(baseSection({ provider: 'unknown' }), adminCtx);
    expect(html).not.toContain('admin-section-actions');
    expect(html).toContain('data-section-remove');
  });
});

describe('embed renderer — sandbox enforcement', () => {
  it('uses exactly the provider sandbox tokens — never less, never more', () => {
    const html = EMBED.render(baseSection({ provider: 'youtube', params: { video_id: 'abcd1234' } }), memberCtx);
    const tokens = sandboxTokens(html);
    expect(tokens).toEqual(['allow-presentation', 'allow-same-origin', 'allow-scripts']);
  });

  it('calendly emits popups+forms (booking flow), not presentation', () => {
    const html = EMBED.render(baseSection({ provider: 'calendly', params: { username: 'jane' } }), memberCtx);
    const tokens = sandboxTokens(html);
    expect(tokens).toEqual(['allow-forms', 'allow-popups', 'allow-same-origin', 'allow-scripts']);
  });
});

describe('embed renderer — retired primitives', () => {
  it('keeps retired embed classes out of source CSS and renderer output', () => {
    const html = EMBED.render(baseSection({ provider: 'youtube', params: { video_id: 'abcd1234' } }), memberCtx);
    const source = readFileSync('src/lib/blocks/embed.ts', 'utf8');
    const adminStyles = readFileSync('public/css/admin-editing.css', 'utf8');

    expect(html).not.toContain('block-embed');
    expect(source).not.toContain('block-embed');
    expect(adminStyles).not.toContain('block-embed');
  });
});
