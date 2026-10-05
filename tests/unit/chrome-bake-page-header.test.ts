// kychon#190 — page-scoped header chrome (page_banner) must be in the served
// HTML of ITS page, and only its page. The global chrome bake stays global-only;
// a page's own header bake adds that page's scope='page' header sections.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Section } from '../../src/lib/blocks';
import { bakeChrome, renderHeaderZone } from '../../src/lib/chrome-bake';
import { mergeSeedSections } from '../../src/lib/merge-sections';
import type { ProjectSeed, SeedSection } from '../../src/seeds/types';

const root = join(import.meta.dirname, '../..');

const globalNav = {
  page_slug: '*',
  zone: 'header',
  scope: 'global',
  section_type: 'nav',
  config: { items: [{ label: 'Home', href: '/', icon: 'home', public: true }] },
  position: 1,
} as unknown as SeedSection;

const showcaseBanner = {
  page_slug: 'showcase',
  zone: 'header',
  scope: 'page',
  section_type: 'page_banner',
  config: {
    image_url: '/showcase-banner.jpg',
    image_alt: 'Showcase banner',
    caption_html: 'Showcase <strong>caption</strong>',
    height: 'medium',
  },
  position: 10,
} as unknown as SeedSection;

const aboutBanner = {
  page_slug: 'about',
  zone: 'header',
  scope: 'page',
  section_type: 'page_banner',
  config: {
    image_url: '/about-banner.jpg',
    image_alt: 'About banner',
    caption_html: 'About caption',
    height: 'medium',
  },
  position: 10,
} as unknown as SeedSection;

function seedWith(sections: SeedSection[]): ProjectSeed {
  return {
    site_config: { site_name: 'Banner Club', brand_text: 'Banner Club' },
    sections,
  } as unknown as ProjectSeed;
}

describe('page-scoped header bake (kychon#190)', () => {
  const seed = seedWith([globalNav, showcaseBanner, aboutBanner]);

  it("bakes the page's own page_banner (image + caption) into that page's header", () => {
    const chrome = bakeChrome(seed, 'Showcase', { pageSlug: 'showcase' });
    const header = chrome.headerHtml + chrome.headerFullBleedHtml;

    expect(chrome.headerFullBleedHtml).toContain('data-page-banner');
    expect(header).toContain('/showcase-banner.jpg');
    expect(header).toContain('Showcase <strong>caption</strong>');
    // Global chrome still present.
    expect(chrome.headerHtml).toContain('data-block-nav');
  });

  it("excludes other pages' page-scoped banners", () => {
    const chrome = bakeChrome(seed, 'Showcase', { pageSlug: 'showcase' });
    const header = chrome.headerHtml + chrome.headerFullBleedHtml;
    expect(header).not.toContain('/about-banner.jpg');
    expect(header).not.toContain('About caption');

    const home = bakeChrome(seed, 'Home', { pageSlug: 'index' });
    expect(home.headerHtml + home.headerFullBleedHtml).not.toContain('data-page-banner');
  });

  it('keeps the slug-less (global) chrome bake global-only', () => {
    const chrome = bakeChrome(seed, 'Events');
    expect(chrome.headerHtml + chrome.headerFullBleedHtml).not.toContain('data-page-banner');
    expect(chrome.headerFullBleedHtml).toBe('');
  });

  it('renders full-bleed blocks outside the nav container, like the runtime hydrate', () => {
    const bake = renderHeaderZone(seed, 'showcase');
    expect(bake.html).not.toContain('data-page-banner');
    expect(bake.fullBleedHtml).toContain('data-page-banner');
  });

  it('bakes DB-only page-scoped header sections merged in via mergeSeedSections', () => {
    const snapshot = seedWith([globalNav]);
    const dbRows = [{ ...showcaseBanner, id: 77 }] as unknown as Section[];
    const merged = mergeSeedSections(snapshot, 'showcase', dbRows);
    const chrome = bakeChrome(merged, 'Showcase', { pageSlug: 'showcase' });
    expect(chrome.headerFullBleedHtml).toContain('/showcase-banner.jpg');
  });

  it('dedupes a page-scoped DB header row that duplicates the seed row', () => {
    const dbRows = [
      { ...showcaseBanner, id: 77, config: { ...showcaseBanner.config, image_url: '/db-banner.jpg' } },
    ] as unknown as Section[];
    const merged = mergeSeedSections(seed, 'showcase', dbRows);
    const bake = renderHeaderZone(merged, 'showcase');
    expect(bake.fullBleedHtml).toContain('/db-banner.jpg');
    expect(bake.fullBleedHtml).not.toContain('/showcase-banner.jpg');
  });

  it('Portal bakes the page header into #zone-header and the header full-bleed host', () => {
    const portal = readFileSync(join(root, 'src/layouts/Portal.astro'), 'utf-8');
    expect(portal).toMatch(/pageSlug/);
    expect(portal).toMatch(/data-zone-fullbleed="header"[^>]*set:html=\{chrome\.headerFullBleedHtml\}/);

    for (const page of ['src/pages/index.astro', 'src/pages/[customPage].astro']) {
      const src = readFileSync(join(root, page), 'utf-8');
      expect(src, page).toMatch(/<Portal[^>]*pageSlug=/);
    }
  });
});
