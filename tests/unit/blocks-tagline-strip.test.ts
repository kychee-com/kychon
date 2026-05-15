import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };

function makeSection(config: Record<string, unknown> = {}): Section {
  return {
    id: 1,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'tagline_strip',
    position: 1,
    config,
  };
}

describe('tagline_strip block-type', () => {
  it('is registered and not dynamic', () => {
    const t = BLOCK_TYPES.tagline_strip;
    expect(t).toBeDefined();
    expect(t.dynamic).toBe(false);
    expect(t.zoneHints).toContain('main');
    expect(t.defaultConfig.text).toBeDefined();
  });

  it('renders with primary scheme by default', () => {
    const html = renderBlock(makeSection({ text: 'Hello world' }), ctx);
    expect(html).toContain('data-tagline-strip=""');
    expect(html).toContain('data-color-scheme="primary"');
    expect(html).toContain('data-size="medium"');
    expect(html).toContain('bg-primary text-primary-foreground');
    expect(html).toContain('Hello world');
    expect(html).not.toContain('block-tagline-strip');
  });

  it.each(['dark', 'light', 'primary', 'accent'])('emits color_scheme data and token classes for %s', (scheme) => {
    const html = renderBlock(makeSection({ text: 'X', color_scheme: scheme }), ctx);
    expect(html).toContain(`data-color-scheme="${scheme}"`);
    expect(html).not.toContain(`block-tagline-strip--${scheme}`);
  });

  it.each(['small', 'medium', 'large'])('emits size data and utility spacing for %s', (size) => {
    const html = renderBlock(makeSection({ text: 'X', size }), ctx);
    expect(html).toContain(`data-size="${size}"`);
    expect(html).not.toContain(`block-tagline-strip--${size}`);
  });

  it('renders inline icon when configured', () => {
    const html = renderBlock(makeSection({ text: 'X', icon: 'star' }), ctx);
    expect(html).toContain('<svg');
    expect(html).not.toContain('block-tagline-strip__icon');
  });

  it('omits icon svg when icon not set', () => {
    const html = renderBlock(makeSection({ text: 'X' }), ctx);
    expect(html).not.toContain('<svg');
  });

  it('escapes user text', () => {
    const html = renderBlock(makeSection({ text: '<script>alert(1)</script>' }), ctx);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('produces no JavaScript', () => {
    const html = renderBlock(makeSection({ text: 'X' }), ctx);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('on=');
    expect(html).not.toMatch(/onerror|onload|onclick/i);
  });

  it('admin context adds editable attributes', () => {
    const html = renderBlock(makeSection({ text: 'X' }), { ...ctx, admin: true });
    expect(html).toContain('data-editable=');
    expect(html).toContain('data-editable-config=');
  });

  it('keeps retired tagline strip classes out of source CSS and renderer', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');
    const blocks = readFileSync('src/lib/blocks.ts', 'utf8');

    expect(styles).not.toContain('block-tagline-strip');
    expect(blocks).not.toContain('block-tagline-strip');
  });
});
