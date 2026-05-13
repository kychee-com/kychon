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
  it('keeps desktop hover/focus and mobile source-nav selectors in CSS', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');
    const navStyles = readFileSync('public/css/nav-dropdown.css', 'utf8');
    const navHtml = htmlFor('nav');

    expect(navHtml).toContain('data-mobile-closed-layout="hidden"');
    expect(navHtml).toContain('data-mobile-open-layout="drawer"');
    expect(styles).toContain('.nav.nav--source-mobile .nav-links.open');
    expect(navStyles).toContain(':focus-within > .nav-dropdown');
    expect(navStyles).toContain('.nav-chevron-toggle:focus-visible');
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
    expect(styles).toContain('.image-accordion__panel:hover');
    expect(styles).toContain('.image-accordion__panel:focus-within');
    expect(styles).toContain('.image-accordion__panel:focus-visible');
  });

  it('keeps carousel control and orientation hooks visible to browser checks', () => {
    const styles = readFileSync('src/styles/public.css', 'utf8');
    const carouselHtml = htmlFor('slideshow');
    const shapeHtml = htmlFor('shape_divider');

    expect(carouselHtml).toContain('data-block-hydrate="slideshow"');
    expect(carouselHtml).toContain('data-auto-ms="4000"');
    expect(carouselHtml).toContain('data-slide-next');
    expect(styles).toContain('.block-slideshow__arrow:hover');

    expect(shapeHtml).toContain('data-top-color="#ffffff"');
    expect(shapeHtml).toContain('data-bottom-color="#17324d"');
    expect(shapeHtml).toContain('--shape-transform:scaleX(-1);');
  });
});
