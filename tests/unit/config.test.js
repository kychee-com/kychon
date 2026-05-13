import { describe, expect, it } from 'vitest';
import {
  COPIED_THEME_CSS_VAR_PATHS,
  getBrandedTitle,
  getRouteKey,
  isNavItemActive,
  THEME_CSS_VAR_MAP,
  THEME_KYCHON_CSS_VAR_MAP,
  themeCssVars,
} from '../../src/lib/config.ts';
import { defaultConfig, defaultNav, defaultTheme } from '../fixtures/configs.js';

// We test the pure logic functions of config.js by testing the patterns they use
// Since config.js has side effects (DOM manipulation), we test the logic in isolation

describe('config logic', () => {
  describe('theme injection', () => {
    it('maps theme keys to CSS custom properties', () => {
      // Verify all theme keys are mapped
      for (const key of Object.keys(defaultTheme)) {
        expect(THEME_CSS_VAR_MAP).toHaveProperty(key);
      }
    });

    it('maps runtime theme keys to Kychon token bridge properties', () => {
      expect(THEME_KYCHON_CSS_VAR_MAP.primary).toBe('--ky-color-primary');
      expect(THEME_KYCHON_CSS_VAR_MAP.bg).toBe('--ky-color-bg');
      expect(THEME_KYCHON_CSS_VAR_MAP.text).toBe('--ky-color-text');
      expect(THEME_KYCHON_CSS_VAR_MAP.border).toBe('--ky-color-border');
      expect(THEME_KYCHON_CSS_VAR_MAP.radius).toBe('--ky-radius');
    });

    it('maps copied-theme interaction and nav tokens to CSS custom properties', () => {
      expect(COPIED_THEME_CSS_VAR_PATHS['interactions.button.hover.background']).toBe('--button-hover-bg');
      expect(COPIED_THEME_CSS_VAR_PATHS['header.logo_max_height']).toBe('--nav-logo-max-height');
      expect(COPIED_THEME_CSS_VAR_PATHS['nav.dropdown_bg']).toBe('--nav-dropdown-bg');
      expect(COPIED_THEME_CSS_VAR_PATHS['nav.surface_bg']).toBe('--nav-links-bg');
      expect(COPIED_THEME_CSS_VAR_PATHS['social.bg']).toBe('--social-link-bg');
      expect(COPIED_THEME_CSS_VAR_PATHS['footer.background']).toBe('--footer-bg');
      expect(COPIED_THEME_CSS_VAR_PATHS['carousel.arrow.hover.background']).toBe('--slideshow-arrow-hover-bg');
    });

    it('flattens copied-theme tokens for cache-first application', () => {
      const vars = themeCssVars({
        primary: '#123456',
        interactions: {
          button: { hover: { background: '#ffcc00', text: '#111111' } },
          card: { hover: { transform: 'translateY(-4px)', shadow: '0 8px 20px rgba(0,0,0,0.2)' } },
        },
        header: { padding: '1rem 0', logo_max_height: '4rem', background: '#ffffff' },
        nav: { dropdown_bg: '#ffffff', mobile_menu_bg: '#f7f7f7', surface_bg: '#17324d' },
        social: { bg: '#17324d', color: '#ffffff' },
        footer: { background: '#111111', heading_color: '#ffcc00' },
        carousel: { arrow: { hover: { background: 'rgba(0,0,0,0.8)' } } },
      });
      expect(vars['--color-primary']).toBe('#123456');
      expect(vars['--ky-color-primary']).toBe('#123456');
      expect(vars['--button-hover-bg']).toBe('#ffcc00');
      expect(vars['--button-hover-text']).toBe('#111111');
      expect(vars['--card-hover-transform']).toBe('translateY(-4px)');
      expect(vars['--nav-header-padding']).toBe('1rem 0');
      expect(vars['--nav-logo-max-height']).toBe('4rem');
      expect(vars['--nav-header-bg']).toBe('#ffffff');
      expect(vars['--nav-dropdown-bg']).toBe('#ffffff');
      expect(vars['--nav-links-bg']).toBe('#17324d');
      expect(vars['--nav-mobile-menu-bg']).toBe('#f7f7f7');
      expect(vars['--social-link-bg']).toBe('#17324d');
      expect(vars['--social-link-color']).toBe('#ffffff');
      expect(vars['--footer-bg']).toBe('#111111');
      expect(vars['--footer-heading-color']).toBe('#ffcc00');
      expect(vars['--slideshow-arrow-hover-bg']).toBe('rgba(0,0,0,0.8)');
    });

    it('ignores unsafe copied-theme token values', () => {
      const vars = themeCssVars({
        interactions: { button: { hover: { background: 'red;background:url(javascript:alert(1))' } } },
      });
      expect(vars['--button-hover-bg']).toBeUndefined();
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

  describe('route matching', () => {
    it('normalizes route keys including sorted query params', () => {
      expect(getRouteKey('/search.html?b=2&a=1')).toBe('/search?a=1&b=2');
      expect(getRouteKey('/events.html/')).toBe('/events.html');
      expect(getRouteKey('/events.html')).toBe('/events');
    });

    it('treats query-based nav items as exact matches', () => {
      expect(isNavItemActive('/page.html?slug=about', 'https://eagles.kychon.com/page.html?slug=about')).toBe(true);
      expect(isNavItemActive('/page.html?slug=about', 'https://eagles.kychon.com/page.html?slug=volunteer')).toBe(
        false,
      );
      expect(isNavItemActive('/page.html?slug=about', 'https://eagles.kychon.com/about')).toBe(true);
      expect(isNavItemActive('/about', 'https://eagles.kychon.com/page.html?slug=about')).toBe(true);
    });

    it('keeps parent nav items active for related detail pages', () => {
      expect(isNavItemActive('/events', 'https://eagles.kychon.com/event?id=42')).toBe(true);
    });
  });

  describe('branding title', () => {
    it('adds the site name once', () => {
      expect(getBrandedTitle('About', 'Eagles')).toBe('About — Eagles');
    });

    it('does not duplicate the site name when init runs repeatedly', () => {
      expect(getBrandedTitle('About — Eagles', 'Eagles')).toBe('About — Eagles');
      expect(getBrandedTitle('About — Eagles — Eagles', 'Eagles')).toBe('About — Eagles');
    });
  });
});
