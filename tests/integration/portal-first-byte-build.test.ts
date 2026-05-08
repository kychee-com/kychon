import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, 'fixtures/chrome/odbc.chrome-snapshot.json');
const BRAND = 'Old Dominion Boat Club';
const FORBIDDEN_BRAND = 'Kychon Community';

const REPRESENTATIVE_PAGES = [
  'index.html',
  'page.html',
  'events.html',
  'calendar.html',
  'directory.html',
  'committees.html',
  'forum.html',
  'resources.html',
  'polls.html',
  'profile.html',
  'join.html',
  'event.html',
  'admin.html',
  'admin-members.html',
  'admin-settings.html',
];

const ADMIN_PAGES = new Set(['admin.html', 'admin-members.html', 'admin-settings.html']);

describe('Portal first-byte build output', () => {
  it('renders project chrome before runtime hydration', () => {
    execFileSync('npm', ['run', 'build'], {
      cwd: ROOT,
      env: {
        ...process.env,
        KYCHON_CHROME_SNAPSHOT: SNAPSHOT,
      },
      stdio: 'pipe',
    });

    for (const page of REPRESENTATIVE_PAGES) {
      const html = readFileSync(join(ROOT, 'dist', page), 'utf8');
      expect(html, page).toContain(BRAND);
      expect(html, page).not.toContain(FORBIDDEN_BRAND);
      expect(html, page).toContain('/css/theme.css?b=');
      expect(html, page).not.toContain('/css/styles.css?b=');
      expect(html, page).toMatch(/\/_astro\/[^"']+\.css/);
      expect(html, page).toContain('/css/nav-dropdown.css?b=');
      expect(html, page).toContain('/css/zone-grid.css?b=');
      expect(html, page).toContain('/css/a11y.css?b=');
      expect(html, page).toContain('/js/env.js?b=');

      if (ADMIN_PAGES.has(page)) {
        expect(html, page).toContain('data-admin-access-checking');
        expect(html, page).toContain('Checking access');
        expect(html, page).toMatch(/<div[^>]*data-admin-content[^>]*hidden|<div[^>]*hidden[^>]*data-admin-content/);
      }
    }
  }, 30_000);
});
