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
    expect(html).toContain('data-site-search-root');
    expect(html).toContain('&quot;destination&quot;:&quot;/search&quot;');
    expect(html).toContain('&quot;default_type&quot;:&quot;all&quot;');
    expect(html).not.toContain('/Sys/Search');
  });

  it('canonicalizes configured legacy search destinations', () => {
    const html = renderBlock(section({ destination: '/search.html?q=hello&type=all' }), ctx);
    expect(html).toContain('&quot;destination&quot;:&quot;/search?q=hello&amp;type=all&quot;');
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
    expect(html).toContain('&quot;placeholder&quot;:&quot;Enter search string&quot;');
    expect(html).toContain('&quot;submit_label&quot;:&quot;Find&quot;');
    expect(html).toContain('&quot;default_type&quot;:&quot;resources&quot;');
    expect(html).toContain('&quot;compact&quot;:false');
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

    expect(html).toContain('&quot;max_width&quot;:&quot;18rem&quot;');
    expect(html).toContain('&quot;form_gap&quot;:&quot;0&quot;');
    expect(html).toContain('&quot;form_border&quot;:&quot;1px solid #d7dce3&quot;');
    expect(html).toContain('&quot;submit_bg&quot;:&quot;#F38C1C&quot;');
  });

  it('escapes copied labels', () => {
    const html = renderBlock(section({ placeholder: '<img>', submit_label: '<b>Go</b>' }), ctx);
    expect(html).toContain('&quot;placeholder&quot;:&quot;&lt;img&gt;&quot;');
    expect(html).toContain('&lt;b&gt;Go&lt;/b&gt;');
  });
});
