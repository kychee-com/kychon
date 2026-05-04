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
    expect(chrome.headerHtml).toContain('nav-dropdown');
    expect(chrome.footerHtml).toContain('Old Dominion Boat Club');
    expect(chrome.footerHtml).toContain('Contact the GM');
    expect(chrome.fontHead).toContain('Playfair+Display');
    expect(chrome.fontHead).toContain('Source+Sans+3');
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
});
