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
    expect(html).toContain('action="/search"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain('name="type" value="all"');
    expect(html).not.toContain('/Sys/Search');
  });

  it('canonicalizes configured legacy search destinations', () => {
    const html = renderBlock(section({ destination: '/search.html?q=hello&type=all' }), ctx);
    expect(html).toContain('action="/search?q=hello&amp;type=all"');
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

  it('emits copied presentation variables for compact source search styling', () => {
    const html = renderBlock(
      section({
        presentation: {
          max_width: '18rem',
          form_gap: '0',
          form_border: '1px solid #d7dce3',
          submit_bg: '#F38C1C',
          submit_color: '#172033',
        },
      }),
      ctx,
    );

    expect(html).toContain('--site-search-max-width:18rem;');
    expect(html).toContain('--site-search-form-gap:0;');
    expect(html).toContain('--site-search-form-border:1px solid #d7dce3;');
    expect(html).toContain('--site-search-submit-bg:#F38C1C;');
  });

  it('escapes copied labels', () => {
    const html = renderBlock(section({ placeholder: '<img>', submit_label: '<b>Go</b>' }), ctx);
    expect(html).toContain('placeholder="&lt;img&gt;"');
    expect(html).toContain('&lt;b&gt;Go&lt;/b&gt;');
  });
});
