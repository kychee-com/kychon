import { describe, expect, it } from 'vitest';

import { generateSeedSql } from '../../scripts/generate-seed-sql';
import { renderZone, type Section } from '../../src/lib/blocks';
import { bakeChrome } from '../../src/lib/chrome-bake';
import { isDemoModeSeed } from '../../src/lib/demo-mode';
import { buildFreshSeed } from '../../src/seeds/fresh';
import { resolveActiveProjectSeed } from '../../src/seeds/index';
import type { ProjectSeed, SeedSection, SiteConfigEntry } from '../../src/seeds/types';

function entryValue(raw: SiteConfigEntry | unknown): unknown {
  return raw && typeof raw === 'object' && 'value' in raw ? (raw as SiteConfigEntry).value : raw;
}

function configValue(seed: ProjectSeed, key: string): unknown {
  return entryValue(seed.site_config[key]);
}

function section(seed: ProjectSeed, sectionType: string): SeedSection | undefined {
  return seed.sections.find((item) => item.section_type === sectionType);
}

describe('fresh starter seed', () => {
  it('uses the submitted organization name in first-byte chrome and homepage copy', () => {
    const seed = buildFreshSeed({
      organizationName: 'North Side Club',
      portalSlug: 'north-side',
    });

    expect(configValue(seed, 'site_name')).toBe('North Side Club');
    expect(configValue(seed, 'brand_text')).toBe('North Side Club');
    expect(configValue(seed, 'portal_url')).toBe('https://north-side.kychon.com');
    expect(section(seed, 'hero')?.config).toMatchObject({
      heading: 'Welcome to North Side Club',
      cta_text: 'Finish setup',
      cta_href: '/admin.html',
    });
  });

  it('contains the skeletal portal shape without demo content', () => {
    const seed = buildFreshSeed({ organizationName: 'North Side Club' });

    expect(seed.membership_tiers).toEqual([
      expect.objectContaining({
        name: 'Member',
        is_default: true,
      }),
    ]);
    expect(seed.membership_tiers).toHaveLength(1);
    expect(configValue(seed, 'signup_mode')).toBe('approved');
    expect(configValue(seed, 'feature_events')).toBe(true);
    expect(configValue(seed, 'feature_resources')).toBe(true);
    expect(configValue(seed, 'feature_directory')).toBe(true);
    expect(configValue(seed, 'feature_forum')).toBe(false);
    expect(isDemoModeSeed(seed)).toBe(false);
    expect(section(seed, 'announcements_feed')).toBeTruthy();
    expect(section(seed, 'events_list')).toBeTruthy();
    expect(section(seed, 'link_list')).toBeTruthy();

    const sql = generateSeedSql(seed);
    expect(sql).not.toMatch(/Kychon Community|Eagles|Barrio Unido|Silver Pines|Premium/);
    expect(sql).not.toMatch(/Run402/);
  });

  it('renders first-byte starter HTML with the organization name and no demo brands', () => {
    const seed = buildFreshSeed({
      organizationName: 'North Side Club',
      portalSlug: 'north-side',
    });
    const chrome = bakeChrome(seed, 'Home');
    const mainHtml = renderZone(seed.sections as unknown as Section[], 'main', chrome.bakeCtx);
    const html = [chrome.title, chrome.headerHtml, mainHtml, chrome.footerHtml].join('\n');

    expect(html).toContain('North Side Club');
    expect(html).toContain('Welcome to North Side Club');
    expect(html).not.toMatch(/Kychon Community|Eagles|Barrio Unido|Silver Pines|Premium|Run402/);
  });

  it('is selectable through KYCHON_PROJECT=fresh', async () => {
    const previousProject = process.env.KYCHON_PROJECT;
    const previousName = process.env.KYCHON_ORGANIZATION_NAME;
    try {
      process.env.KYCHON_PROJECT = 'fresh';
      process.env.KYCHON_ORGANIZATION_NAME = 'Fresh Test Club';

      const active = await resolveActiveProjectSeed();

      expect(active.source).toEqual({ kind: 'typed-seed', project: 'fresh' });
      expect(configValue(active.seed, 'site_name')).toBe('Fresh Test Club');
    } finally {
      if (previousProject === undefined) delete process.env.KYCHON_PROJECT;
      else process.env.KYCHON_PROJECT = previousProject;
      if (previousName === undefined) delete process.env.KYCHON_ORGANIZATION_NAME;
      else process.env.KYCHON_ORGANIZATION_NAME = previousName;
    }
  });
});
