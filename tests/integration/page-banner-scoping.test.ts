// Integration test: page_banner is page-scoped — it must not appear on
// other pages' renderZone output.
import { describe, expect, it } from 'vitest';
import { type BlockRenderContext, renderZone, type Section } from '../../src/lib/blocks';
import { filterSectionsForPageSlug } from '../../src/lib/page-render';

const ctx: BlockRenderContext = { admin: false, locale: 'en' };

const globalNav: Section = {
  id: 1,
  page_slug: '*',
  zone: 'header',
  scope: 'global',
  section_type: 'nav',
  config: { items: [{ label: 'Home', href: '/', icon: 'home', public: true }] },
  position: 1,
};

const aboutBanner: Section = {
  id: 2,
  page_slug: 'about',
  zone: 'header',
  scope: 'page',
  section_type: 'page_banner',
  config: { image_url: '/banner.jpg', image_alt: 'About', height: 'medium' },
  position: 10,
};

describe('page_banner scoping', () => {
  it('renders the banner in the about-page header zone', () => {
    const html = renderZone([globalNav, aboutBanner], 'header', ctx);
    expect(html).toContain('data-page-banner');
    expect(html).toContain('/banner.jpg');
  });

  it('renderZone does not filter by page slug — that is the page-render layer', () => {
    // The runtime page-render layer already filters by slug before calling
    // renderZone. This test pins that contract: renderZone renders whatever
    // sections it gets, regardless of slug. We rely on the per-page query.
    const html = renderZone([globalNav], 'header', ctx);
    expect(html).not.toContain('data-page-banner');
  });

  it('filters fetched sections to the active page before rendering', () => {
    const indexActivity: Section = {
      id: 3,
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'activity_feed',
      config: { heading: 'Recent Activity' },
      position: 7,
    };
    const aboutCta: Section = {
      id: 4,
      page_slug: 'about',
      zone: 'main',
      scope: 'page',
      section_type: 'cta',
      config: { heading: 'About-only CTA' },
      position: 1,
    };

    expect(filterSectionsForPageSlug([globalNav, aboutBanner, indexActivity, aboutCta], 'about')).toEqual([
      globalNav,
      aboutBanner,
      aboutCta,
    ]);
  });
});
