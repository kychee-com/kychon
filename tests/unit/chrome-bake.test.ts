import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bakeChrome } from '../../src/lib/chrome-bake';
import { seed as neutralSeed } from '../../src/seeds/neutral';
import type { ProjectSeed } from '../../src/seeds/types';

const root = join(import.meta.dirname, '../..');

function readSnapshot(path: string): ProjectSeed {
  return JSON.parse(readFileSync(join(root, path), 'utf-8')) as ProjectSeed;
}

describe('bakeChrome', () => {
  it('renders ODBC project chrome for first-byte HTML', () => {
    const snapshot = readSnapshot('fixtures/chrome/odbc.chrome-snapshot.json');

    const chrome = bakeChrome(snapshot, 'Calendar');

    expect(chrome.title).toBe('Calendar — Old Dominion Boat Club');
    expect(chrome.faviconUrl).toContain('data:image/svg+xml');
    expect(chrome.headerHtml).toContain('Old Dominion Boat Club');
    expect(chrome.headerHtml).toContain('The Club');
    expect(chrome.headerHtml).toContain('data-nav-menu');
    expect(chrome.footerHtml).toContain('Old Dominion Boat Club');
    expect(chrome.footerHtml).toContain('Contact the GM');
    // The stylesheet URL (with the font families) lives on fontStylesheetUrl so
    // Portal can bake it onto a stable, runtime-repointable <link>; fontHead keeps
    // the preconnect hints.
    expect(chrome.fontStylesheetUrl).toContain('Playfair+Display');
    expect(chrome.fontStylesheetUrl).toContain('Source+Sans+3');
    expect(chrome.fontHead).toContain('rel="preconnect"');
    expect(chrome.headerHtml + chrome.footerHtml + chrome.title).not.toContain('Kychon Community');
  });

  it('keeps representative page titles project-branded from the same snapshot', () => {
    const snapshot = readSnapshot('fixtures/chrome/odbc.chrome-snapshot.json');
    const pageTitles = [
      'Home',
      'Page',
      'Events',
      'Calendar',
      'Members',
      'Committees',
      'Forum',
      'Resources',
      'Polls',
      'Profile',
      'Join',
      'Event',
      'Admin Dashboard',
    ];

    for (const title of pageTitles) {
      const chrome = bakeChrome(snapshot, title);
      expect(chrome.title).toContain('Old Dominion Boat Club');
      expect(chrome.headerHtml).toContain('Old Dominion Boat Club');
      expect(chrome.footerHtml).toContain('Old Dominion Boat Club');
      expect(chrome.headerHtml + chrome.footerHtml + chrome.title).not.toContain('Kychon Community');
    }
  });

  it('renders neutral fallback chrome without demo branding', () => {
    const chrome = bakeChrome(neutralSeed, 'Events');

    expect(chrome.title).toBe('Events — Member Portal');
    expect(chrome.headerHtml).toContain('Member Portal');
    expect(chrome.headerHtml + chrome.footerHtml + chrome.title).not.toContain('Kychon Community');
  });

  it('renders header social icons from snapshot chrome before hydration', () => {
    const snapshot: ProjectSeed = {
      site_config: {
        site_name: 'Social Club',
        brand_text: 'Social Club',
      },
      sections: [
        {
          page_slug: '*',
          zone: 'header',
          scope: 'global',
          section_type: 'brand_header',
          config: { href: '/' },
          position: 1,
          visible: true,
        },
        {
          page_slug: '*',
          zone: 'header',
          scope: 'global',
          section_type: 'social_links',
          config: {
            items: [
              { platform: 'facebook', href: 'https://facebook.com/socialclub' },
              { platform: 'instagram', href: 'https://instagram.com/socialclub' },
            ],
          },
          position: 2,
          visible: true,
        },
      ],
    };

    const chrome = bakeChrome(snapshot, 'Home');

    expect(chrome.headerHtml).toContain('Social Club');
    expect(chrome.headerHtml).toContain('data-social-provider="facebook"');
    expect(chrome.headerHtml).toContain('data-social-provider="instagram"');
    expect(chrome.headerHtml).toContain('data-social-link-icon');
    expect(chrome.headerHtml).not.toContain('>f</a>');
    expect(chrome.headerHtml).not.toContain('>ig</a>');
  });

  it('renders AAGE copied-site social chrome from structured social links', () => {
    const snapshot = readSnapshot('fixtures/chrome/aage.chrome-snapshot.json');

    const chrome = bakeChrome(snapshot, 'Home');

    for (const provider of ['facebook', 'x', 'linkedin', 'instagram']) {
      expect(chrome.headerHtml).toContain(`data-social-provider="${provider}"`);
    }
    expect(chrome.headerHtml).toContain('aria-label="Facebook"');
    expect(chrome.headerHtml).toContain('aria-label="LinkedIn"');
    expect(chrome.headerHtml).not.toContain('class="aage-social"');
    expect(chrome.headerHtml).not.toContain('>f</a>');
    expect(chrome.headerHtml).not.toContain('>in</a>');
    expect(chrome.headerHtml).not.toContain('>ig</a>');
  });
});
