// live-config-coherence: runtime reconciliation of custom_css and web fonts.
// Proves the write-read coherence promise — a live site_config edit takes
// effect on the next render with no rebuild — at the DOM level. Both runtime
// appliers are find-only against the stable elements Portal.astro bakes
// (<style id="wl-custom-css">, <link id="wl-font-stylesheet">); they never
// create DOM (see tests/unit/legacy-static-primitives.test.ts).

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCustomCss, applyTheme } from '../../src/lib/config';
import { headFixture } from '../helpers/dom-fixture.js';

// We assert on the font <link> href but never want happy-dom to actually load
// the Google Fonts stylesheet (irrelevant to the behavior under test — that the
// stable <link> is repointed). Disable CSS file loading so no network happens,
// and swallow the one resource-load log happy-dom still emits for the skipped
// stylesheet (keeps test output clean).
let errorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  const settings = (window as unknown as { happyDOM?: { settings: { disableCSSFileLoading: boolean } } }).happyDOM
    ?.settings;
  if (settings) settings.disableCSSFileLoading = true;
  errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (/CSS file loading is disabled|Failed to load external stylesheet/.test(msg)) return;
    process.stderr.write(`${args.join(' ')}\n`);
  });
});
afterAll(() => {
  errorSpy?.mockRestore();
});

function customCssEl(): HTMLStyleElement | null {
  const el = document.head.querySelector('style#wl-custom-css');
  return el instanceof HTMLStyleElement ? el : null;
}

function fontLink(): HTMLLinkElement | null {
  const el = document.head.querySelector('link#wl-font-stylesheet');
  return el instanceof HTMLLinkElement ? el : null;
}

// Mirror Portal.astro's baked chrome head: the stable, always-present elements
// the runtime appliers locate and update.
const BAKED_HEAD =
  '<style id="wl-theme-vars"></style>' +
  '<link id="wl-font-stylesheet" rel="stylesheet">' +
  '<style id="wl-custom-css"></style>';

describe('applyCustomCss', () => {
  beforeEach(() => {
    headFixture(BAKED_HEAD);
  });

  it('applies non-empty custom_css into the baked style element', () => {
    applyCustomCss('.masthead { color: red; }');
    expect(customCssEl()?.textContent).toBe('.masthead { color: red; }');
  });

  it('updates the style element when the value changes (edit → reload publishing)', () => {
    applyCustomCss('.x { color: red; }');
    applyCustomCss('.x { color: blue; }');
    expect(document.head.querySelectorAll('style#wl-custom-css')).toHaveLength(1);
    expect(customCssEl()?.textContent).toBe('.x { color: blue; }');
  });

  it('empties the style element when custom_css is cleared or removed', () => {
    applyCustomCss('.x { color: red; }');
    applyCustomCss('');
    expect(customCssEl()?.textContent).toBe('');
    applyCustomCss(null);
    expect(customCssEl()?.textContent).toBe('');
  });

  it('no-ops safely when the baked style element is absent (never creates DOM)', () => {
    headFixture('<style id="wl-theme-vars"></style>');
    expect(() => applyCustomCss('.y { color: green; }')).not.toThrow();
    expect(customCssEl()).toBeNull();
  });
});

describe('applyTheme runtime font stylesheet', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
    headFixture(BAKED_HEAD);
  });

  it('repoints the baked font <link> to the live non-system font family', () => {
    applyTheme({ font_body: 'Inter', font_heading: 'Playfair Display' });
    const href = fontLink()?.getAttribute('href') || '';
    expect(href).toContain('Inter');
    expect(href).toContain('Playfair+Display');
  });

  it('keeps a single font <link> across repeated applies (cache/fresh/revalidate)', () => {
    applyTheme({ font_body: 'Inter' });
    applyTheme({ font_body: 'Bitter' });
    applyTheme({ font_body: 'Bitter' });
    expect(document.head.querySelectorAll('link#wl-font-stylesheet')).toHaveLength(1);
    expect(fontLink()?.getAttribute('href')).toContain('Bitter');
  });

  it('clears the href when the live theme uses only system fonts', () => {
    applyTheme({ font_body: 'Inter' });
    expect(fontLink()?.hasAttribute('href')).toBe(true);
    applyTheme({ font_body: 'Arial' });
    expect(fontLink()?.hasAttribute('href')).toBe(false);
  });

  it('no-ops safely when the baked font <link> is absent (never creates DOM)', () => {
    headFixture('<style id="wl-theme-vars"></style>');
    expect(() => applyTheme({ font_body: 'Inter' })).not.toThrow();
    expect(fontLink()).toBeNull();
  });
});
