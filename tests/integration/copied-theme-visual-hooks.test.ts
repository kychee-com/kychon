import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderBlock } from '../../src/lib/blocks';
import { copiedThemeFidelitySections } from '../fixtures/copied-theme-fidelity';

const ctx: BlockRenderContext = {
  admin: false,
  locale: 'en',
  currentPath: '/',
};

function htmlFor(type: string): string {
  const section = copiedThemeFidelitySections.find((candidate) => candidate.section_type === type);
  if (!section) throw new Error(`Missing copied-theme fixture section: ${type}`);
  return renderBlock(section, ctx);
}

describe('copied-theme visual verification hooks', () => {
  it('keeps static nav dropdown and mobile source-nav hooks in shipped sources', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');
    const navComponent = readFileSync('src/components/kychon/NavBlockView.tsx', 'utf8');
    const navHtml = htmlFor('nav');

    expect(navHtml).toContain('data-mobile-closed-layout="hidden"');
    expect(navHtml).toContain('data-mobile-open-layout="drawer"');
    expect(navHtml).toContain('class="nav-overflow-menu"');
    expect(navHtml).toContain('data-nav-overflow-source-index="');
    expect(navHtml).toContain('nav-chevron-toggle');
    expect(navHtml).toContain('nav-dropdown absolute left-0 top-full');
    expect(styles).toContain('.nav.nav--source-mobile .nav-links.open');
    expect(styles).toContain('.nav-overflow-menu[hidden]');
    expect(navComponent).toContain('hover:bg-accent');
    expect(navComponent).toContain('focus:bg-accent');
    expect(navComponent).not.toContain('nav-dropdown.css');
  });

  it('keeps the header brand on the utility row with a responsive subtitle', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');

    expect(styles).toContain('.nav .ky-container:has(.brand-header--icon)');
    expect(styles).toContain('.brand-header--icon.nav-brand');
    expect(styles).toContain('grid-row: 1 / 3;');
    expect(styles).toContain('grid-column: 1 / 3;');
    expect(styles).toContain('max(var(--nav-logo-max-height, 2rem), 4rem)');
    expect(styles).toContain('.brand-header .brand-subtitle::before');
    expect(styles).toContain('@container (max-width: 21rem)');
  });

  it('keeps desktop nav dropdowns visible outside the nav links row', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');

    expect(styles).toMatch(/\.nav-links\s*\{[\s\S]*overflow: visible;/);
  });

  it('keeps image accordion hover and keyboard focus reveal hooks', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');
    const accordionHtml = htmlFor('image_accordion');

    expect(accordionHtml).toContain('data-accordion-panel="0"');
    expect(accordionHtml).toContain('href="/junior.html"');
    expect(accordionHtml).toContain('md:hover:flex-[var(--accordion-active,2.5)_1_0]');
    expect(accordionHtml).toContain('group-focus-within:translate-y-0');
    expect(accordionHtml).toContain('focus-visible:ring-[var(--accordion-panel-focus-color)]');
    expect(styles).not.toContain('image-accordion');
  });

  it('keeps carousel control and orientation hooks visible to browser checks', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');
    const carouselHtml = htmlFor('slideshow');
    const shapeHtml = htmlFor('shape_divider');

    expect(carouselHtml).toContain('data-block-hydrate="slideshow"');
    expect(carouselHtml).toContain('data-auto-ms="4000"');
    expect(carouselHtml).toContain('data-slide-next');
    expect(carouselHtml).toContain('hover:bg-[var(--slideshow-arrow-hover-bg');
    expect(styles).not.toContain('block-slideshow');

    expect(shapeHtml).toContain('data-top-color="#ffffff"');
    expect(shapeHtml).toContain('data-bottom-color="#17324d"');
    expect(shapeHtml).toContain('--shape-transform:scaleX(-1);');
    expect(shapeHtml).toContain('data-shape-layer="0"');
    expect(shapeHtml).not.toContain('shape-divider__');
  });
});
