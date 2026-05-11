import { describe, expect, it } from 'vitest';
import { generateSeedSql } from '../../scripts/generate-seed-sql';
import { isDemoModeSeed } from '../../src/lib/demo-mode';
import { seed as barrioSeed } from '../../src/seeds/barrio-unido';
import { seed as eaglesSeed } from '../../src/seeds/eagles';
import { seed as silverPinesSeed } from '../../src/seeds/silver-pines';
import type { ProjectSeed, SeedSection, SiteConfigEntry } from '../../src/seeds/types';

const DEMOS = [
  {
    name: 'Eagles',
    seed: eaglesSeed,
    pollLabel: 'Polls',
    pollQuestion: 'Which volunteer project should we spotlight next month?',
    searchPlaceholder: 'Search The Eagles',
    searchSubmit: 'Search',
  },
  {
    name: 'Silver Pines',
    seed: silverPinesSeed,
    pollLabel: 'Polls',
    pollQuestion: 'Which Friday social should we add next month?',
    searchPlaceholder: 'Search Silver Pines',
    searchSubmit: 'Search',
  },
  {
    name: 'Barrio Unido',
    seed: barrioSeed,
    pollLabel: 'Encuestas',
    pollQuestion: '¿Qué taller deberíamos ofrecer el próximo mes?',
    searchPlaceholder: 'Buscar Barrio Unido',
    searchSubmit: 'Buscar',
  },
] as const;

function entryValue(raw: SiteConfigEntry | unknown): unknown {
  return raw && typeof raw === 'object' && 'value' in raw ? (raw as SiteConfigEntry).value : raw;
}

function configValue(seed: ProjectSeed, key: string): unknown {
  return entryValue(seed.site_config[key]);
}

function headerSection(seed: ProjectSeed, type: string): SeedSection | undefined {
  return seed.sections.find(
    (section) =>
      section.page_slug === '*' &&
      section.zone === 'header' &&
      section.scope === 'global' &&
      section.section_type === type,
  );
}

function indexSection(seed: ProjectSeed, type: string): SeedSection | undefined {
  return seed.sections.find(
    (section) =>
      section.page_slug === 'index' &&
      section.zone === 'main' &&
      section.scope === 'page' &&
      section.section_type === type,
  );
}

describe('demo seed feature coverage', () => {
  for (const demo of DEMOS) {
    describe(demo.name, () => {
      it('enables the shared interactive feature flags', () => {
        expect(isDemoModeSeed(demo.seed)).toBe(true);
        expect(configValue(demo.seed, 'feature_activity_feed')).toBe(true);
        expect(configValue(demo.seed, 'feature_reactions')).toBe(true);
        expect(configValue(demo.seed, 'feature_polls')).toBe(true);
        expect(configValue(demo.seed, 'polls_member_create')).toBe(false);
      });

      it('includes polls in the header navigation', () => {
        const nav = headerSection(demo.seed, 'nav');
        const items = Array.isArray(nav?.config.items) ? nav.config.items : [];
        expect(items).toContainEqual(
          expect.objectContaining({
            label: demo.pollLabel,
            href: '/polls',
            feature: 'feature_polls',
          }),
        );
      });

      it('seeds a standalone demo poll with options and votes', () => {
        const sql = generateSeedSql(demo.seed);
        expect(sql).toContain(`INSERT INTO polls`);
        expect(sql).toContain(demo.pollQuestion);
        expect(sql).toContain(`INSERT INTO poll_options`);
        expect(sql).toContain(`INSERT INTO poll_votes`);
        expect(sql).toContain(`'poll_create'`);
      });

      it('adds native site search to global chrome', () => {
        const search = headerSection(demo.seed, 'site_search');
        expect(search).toEqual(
          expect.objectContaining({
            position: 4,
            config: expect.objectContaining({
              placeholder: demo.searchPlaceholder,
              submit_label: demo.searchSubmit,
              destination: '/search',
              compact: true,
              default_type: 'all',
            }),
          }),
        );
      });

      it('uses the tokenized demo theme and foreground hero path', () => {
        const theme = configValue(demo.seed, 'theme');
        expect(theme).toEqual(
          expect.objectContaining({
            primary: expect.any(String),
            primary_hover: expect.any(String),
            accent: expect.any(String),
            success: expect.any(String),
            warning: expect.any(String),
            danger: expect.any(String),
            header: expect.any(Object),
            nav: expect.any(Object),
            footer: expect.any(Object),
            interactions: expect.any(Object),
          }),
        );

        const hero = indexSection(demo.seed, 'hero');
        expect(hero?.config).toEqual(
          expect.objectContaining({
            mode: 'foreground',
            image_url: expect.stringMatching(/^\/assets\/.+/),
            image_alt: expect.any(String),
            image_aspect: '21/9',
            text_position: 'over_image',
          }),
        );
      });
    });
  }
});
