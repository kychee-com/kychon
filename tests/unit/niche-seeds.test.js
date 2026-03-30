import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '../../');

function readSeed(name) {
  return readFileSync(join(root, name), 'utf-8');
}

describe('Niche seed variants', () => {
  const seeds = [
    { name: 'seed-church.sql', label: 'Church' },
    { name: 'seed-hoa.sql', label: 'HOA' },
    { name: 'seed-association.sql', label: 'Association' },
  ];

  for (const seed of seeds) {
    describe(seed.label, () => {
      let sql;
      beforeAll(() => { sql = readSeed(seed.name); });

      it('is idempotent (uses ON CONFLICT or WHERE NOT EXISTS)', () => {
        const insertCount = (sql.match(/INSERT INTO/gi) || []).length;
        const conflictCount = (sql.match(/ON CONFLICT/gi) || []).length;
        const whereNotExistsCount = (sql.match(/WHERE NOT EXISTS/gi) || []).length;
        expect(conflictCount + whereNotExistsCount).toBe(insertCount);
      });

      it('sets site_name', () => {
        expect(sql).toMatch(/INSERT INTO site_config.*site_name/s);
      });

      it('sets theme', () => {
        expect(sql).toMatch(/INSERT INTO site_config.*theme/s);
      });

      it('sets feature flags', () => {
        expect(sql).toMatch(/feature_events/);
        expect(sql).toMatch(/feature_directory/);
      });

      it('sets navigation', () => {
        expect(sql).toMatch(/INSERT INTO site_config.*'nav'/s);
      });

      it('creates membership tiers', () => {
        expect(sql).toMatch(/INSERT INTO membership_tiers/);
      });

      it('creates homepage sections', () => {
        expect(sql).toMatch(/INSERT INTO sections.*hero/s);
        expect(sql).toMatch(/INSERT INTO sections.*features/s);
        expect(sql).toMatch(/INSERT INTO sections.*cta/s);
      });

      it('includes the new feature_ai_event_recaps flag', () => {
        expect(sql).toMatch(/feature_ai_event_recaps/);
      });
    });
  }

  describe('Church-specific config', () => {
    let sql;
    beforeAll(() => { sql = readSeed('seed-church.sql'); });

    it('has church roles (Pastor, Elder, Member, Visitor)', () => {
      expect(sql).toMatch(/Pastor/);
      expect(sql).toMatch(/Elder/);
      expect(sql).toMatch(/Visitor/);
    });

    it('has church committees (Youth Ministry, Worship Team, Deacons)', () => {
      expect(sql).toMatch(/Youth Ministry/);
      expect(sql).toMatch(/Worship Team/);
      expect(sql).toMatch(/Deacons/);
    });

    it('has Prayer Requests forum category', () => {
      expect(sql).toMatch(/Prayer Requests/);
    });

    it('nav includes Sermons and Ministries labels', () => {
      expect(sql).toMatch(/"Sermons"/);
      expect(sql).toMatch(/"Ministries"/);
    });
  });

  describe('HOA-specific config', () => {
    let sql;
    beforeAll(() => { sql = readSeed('seed-hoa.sql'); });

    it('has HOA roles (Board Member, Resident, Tenant)', () => {
      expect(sql).toMatch(/Board Member/);
      expect(sql).toMatch(/Resident/);
      expect(sql).toMatch(/Tenant/);
    });

    it('has Maintenance Requests forum category', () => {
      expect(sql).toMatch(/Maintenance Requests/);
    });

    it('nav includes Documents and Board labels', () => {
      expect(sql).toMatch(/"Documents"/);
      expect(sql).toMatch(/"Board"/);
    });
  });

  describe('Association-specific config', () => {
    let sql;
    beforeAll(() => { sql = readSeed('seed-association.sql'); });

    it('has association tiers (Fellow, Member, Associate, Student)', () => {
      expect(sql).toMatch(/Fellow/);
      expect(sql).toMatch(/Associate/);
      expect(sql).toMatch(/Student/);
    });

    it('has company custom field', () => {
      expect(sql).toMatch(/INSERT INTO member_custom_fields.*company/s);
    });

    it('has multiple committees', () => {
      expect(sql).toMatch(/Executive Board/);
      expect(sql).toMatch(/Events Committee/);
      expect(sql).toMatch(/Standards Committee/);
    });

    it('nav emphasizes Directory', () => {
      expect(sql).toMatch(/"Directory"/);
    });
  });
});
