// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks.ts';
import { sanitizeRichHtml, sanitizeRichHtmlServer } from '../../src/lib/sanitize-html.ts';

const ctx: BlockRenderContext = {
  admin: false,
  authenticated: false,
  currentPath: '/',
  isFeatureEnabled: () => true,
  locale: 'en',
  role: null,
};

function customSection(html: string): Section {
  return {
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'custom',
    config: { html },
    position: 1,
    visible: true,
    column_span: '1',
  };
}

describe('custom block rich HTML sanitizer', () => {
  it('strips native controls, inline styles, and custom classes before rendering custom blocks', () => {
    const html = renderBlock(
      customSection(
        '<form class="legacy-form"><button type="submit" class="btn">Join</button><input name="q"><p class="card" style="color:red">Safe</p></form>',
      ),
      ctx,
    );

    expect(html).toContain('Join');
    expect(html).toContain('<p>Safe</p>');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('legacy-form');
    expect(html).not.toContain('class="btn"');
    expect(html).not.toContain('class="card"');
    expect(html).not.toContain('style=');
  });

  it('uses the same class/control policy in browser and server sanitizer paths', () => {
    const input = '<div class="legacy"><select><option>One</option></select><a class="link" href="/x">Link</a></div>';

    expect(sanitizeRichHtml(input)).toBe('<div><a href="/x">Link</a></div>');
    expect(sanitizeRichHtmlServer(input)).toBe('<div><a href="/x">Link</a></div>');
  });
});
