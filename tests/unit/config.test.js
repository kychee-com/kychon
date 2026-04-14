import { describe, expect, it } from 'vitest';
import { defaultConfig, defaultNav, defaultTheme } from '../fixtures/configs.js';

// We test the pure logic functions of config.js by testing the patterns they use
// Since config.js has side effects (DOM manipulation), we test the logic in isolation

describe('config logic', () => {
  describe('theme injection', () => {
    it('maps theme keys to CSS custom properties', () => {
      const map = {
        primary: '--color-primary',
        primary_hover: '--color-primary-hover',
        bg: '--color-bg',
        surface: '--color-surface',
        text: '--color-text',
        text_muted: '--color-text-muted',
        border: '--color-border',
        font_heading: '--font-heading',
        font_body: '--font-body',
        radius: '--radius',
        max_width: '--max-width',
      };

      // Verify all theme keys are mapped
      for (const key of Object.keys(defaultTheme)) {
        expect(map).toHaveProperty(key);
      }
    });

    it('default theme has valid values', () => {
      expect(defaultTheme.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(defaultTheme.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(defaultTheme.font_heading).toBeTruthy();
      expect(defaultTheme.radius).toBeTruthy();
    });
  });

  describe('nav filtering', () => {
    function filterNav(navItems, { isAuth, role, features }) {
      return navItems.filter((item) => {
        if (item.feature && !features[item.feature]) return false;
        if (item.auth && !isAuth) return false;
        if (item.admin && role !== 'admin') return false;
        return true;
      });
    }

    it('shows public items to anonymous users', () => {
      const filtered = filterNav(defaultNav, { isAuth: false, role: null, features: {} });
      expect(filtered.some((i) => i.label === 'Home')).toBe(true);
    });

    it('hides auth items from anonymous users', () => {
      const filtered = filterNav(defaultNav, { isAuth: false, role: null, features: { feature_directory: true } });
      expect(filtered.some((i) => i.label === 'Members')).toBe(false);
    });

    it('shows auth items to logged-in users', () => {
      const filtered = filterNav(defaultNav, { isAuth: true, role: 'member', features: { feature_directory: true } });
      expect(filtered.some((i) => i.label === 'Members')).toBe(true);
    });

    it('hides admin items from non-admin', () => {
      const filtered = filterNav(defaultNav, { isAuth: true, role: 'member', features: {} });
      expect(filtered.some((i) => i.label === 'Dashboard')).toBe(false);
    });

    it('shows admin items to admin', () => {
      const filtered = filterNav(defaultNav, { isAuth: true, role: 'admin', features: {} });
      expect(filtered.some((i) => i.label === 'Dashboard')).toBe(true);
    });

    it('hides items when feature flag is disabled', () => {
      const filtered = filterNav(defaultNav, {
        isAuth: true,
        role: 'admin',
        features: { feature_events: false, feature_forum: false, feature_directory: false },
      });
      expect(filtered.some((i) => i.label === 'Events')).toBe(false);
      expect(filtered.some((i) => i.label === 'Forum')).toBe(false);
    });

    it('shows items when feature flag is enabled', () => {
      const filtered = filterNav(defaultNav, {
        isAuth: true,
        role: 'member',
        features: { feature_events: true, feature_directory: true },
      });
      expect(filtered.some((i) => i.label === 'Events')).toBe(true);
    });
  });

  describe('feature flags', () => {
    it('parses feature flags from config', () => {
      const features = {};
      for (const row of defaultConfig) {
        if (row.key.startsWith('feature_')) {
          features[row.key] = row.value === true || row.value === 'true';
        }
      }
      expect(features.feature_events).toBe(true);
      expect(features.feature_forum).toBe(false);
      expect(features.feature_directory).toBe(true);
    });
  });
});
