import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock, type Section } from '../../src/lib/blocks.ts';

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  authenticated: false,
  role: null,
  currentPath: '/',
};

function section(config: Record<string, unknown> = {}): Section {
  return {
    id: 12,
    page_slug: '*',
    zone: 'header',
    scope: 'global',
    section_type: 'site_search',
    config,
    position: 3,
    visible: true,
  };
}

describe('site_search block renderer', () => {
  it('renders native search form defaults', () => {
    const html = renderBlock(section(), ctx);
    expect(html).toContain('data-block-hydrate="site_search"');
    expect(html).toContain('action="/search.html"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain('name="type" value="all"');
    expect(html).not.toContain('/Sys/Search');
  });

  it('preserves copied labels and configured type', () => {
    const html = renderBlock(
      section({
        placeholder: 'Enter search string',
        submit_label: 'Find',
        default_type: 'resources',
        compact: false,
      }),
      ctx,
    );
    expect(html).toContain('placeholder="Enter search string"');
    expect(html).toContain('>Find</button>');
    expect(html).toContain('name="type" value="resources"');
    expect(html).toContain('site-search--wide');
  });

  it('escapes copied labels', () => {
    const html = renderBlock(section({ placeholder: '<img>', submit_label: '<b>Go</b>' }), ctx);
    expect(html).toContain('placeholder="&lt;img&gt;"');
    expect(html).toContain('&lt;b&gt;Go&lt;/b&gt;');
  });
});
