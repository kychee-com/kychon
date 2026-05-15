import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock } from '../../src/lib/blocks';
import { themeCssVars } from '../../src/lib/config';
import { copiedThemeFidelitySections, copiedThemeFidelityTheme } from '../fixtures/copied-theme-fidelity';

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  currentPath: '/',
};

describe('copied-theme fidelity fixture', () => {
  it('exercises source nav, accordion, shape divider, carousel, and theme tokens', () => {
    const html = copiedThemeFidelitySections.map((section) => renderBlock(section, ctx)).join('\n');
    const vars = themeCssVars(copiedThemeFidelityTheme);

    expect(vars['--button-hover-bg']).toBe('#ffcc00');
    expect(vars['--nav-header-padding']).toBe('1rem 0');
    expect(vars['--slideshow-arrow-bg']).toBe('#17324d');

    expect(html).toContain('data-mobile-breakpoint="820"');
    expect(html).toContain('data-mobile-open-layout="drawer"');
    expect(html).toContain('--nav-dropdown-width:18rem;');

    expect(html).toContain('section-image-accordion');
    expect(html).toContain('data-accordion-panel="0"');
    expect(html).toContain('--accordion-active:3;');

    expect(html).toContain('section-shape-divider');
    expect(html).toContain('data-top-color="#ffffff"');
    expect(html).toContain('data-bottom-color="#17324d"');

    expect(html).toContain('data-slideshow-card');
    expect(html).toContain('--slideshow-height:440px;');
    expect(html).toContain('data-manual-pause="true"');
    expect(html).toContain('object-position:50% 35%');
  });
});
