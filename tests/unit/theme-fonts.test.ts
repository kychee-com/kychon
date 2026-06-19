import { describe, expect, it } from 'vitest';
import {
  buildGoogleFontsUrl,
  isSystemFont,
  renderFontHead,
  renderFontPreconnect,
  renderFontStylesheet,
  SYSTEM_FONTS,
} from '../../src/lib/theme/fonts';

describe('isSystemFont', () => {
  it('classifies every allowlisted name as system', () => {
    for (const name of SYSTEM_FONTS) {
      expect(isSystemFont(name)).toBe(true);
    }
  });

  it('treats quoted system fonts as system', () => {
    expect(isSystemFont('"system-ui"')).toBe(true);
    expect(isSystemFont("'sans-serif'")).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isSystemFont('SYSTEM-UI')).toBe(true);
    expect(isSystemFont('Sans-Serif')).toBe(true);
  });

  it('trims whitespace around the name', () => {
    expect(isSystemFont('  system-ui  ')).toBe(true);
  });

  it('rejects named non-system fonts', () => {
    expect(isSystemFont('Inter')).toBe(false);
    expect(isSystemFont('Playfair Display')).toBe(false);
    expect(isSystemFont('Bitter')).toBe(false);
    expect(isSystemFont('Source Sans 3')).toBe(false);
  });

  it('treats empty/missing input as system (no injection)', () => {
    expect(isSystemFont('')).toBe(true);
  });
});

describe('buildGoogleFontsUrl', () => {
  it('returns null when both fonts are system', () => {
    expect(buildGoogleFontsUrl('system-ui', 'sans-serif')).toBeNull();
  });

  it('returns null when both fonts are missing', () => {
    expect(buildGoogleFontsUrl(undefined, undefined)).toBeNull();
    expect(buildGoogleFontsUrl(null, null)).toBeNull();
  });

  it('emits heading-only URL when body is system', () => {
    const url = buildGoogleFontsUrl('Playfair Display', 'system-ui');
    expect(url).toBe('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=optional');
  });

  it('emits body-only URL when heading is system', () => {
    const url = buildGoogleFontsUrl('sans-serif', 'Inter');
    expect(url).toBe('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=optional');
  });

  it('emits combined URL with both fonts in order (heading first)', () => {
    const url = buildGoogleFontsUrl('Cormorant Garamond', 'Inter');
    expect(url).toBe(
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;700&family=Inter:wght@400;600&display=optional',
    );
  });

  it('deduplicates when heading and body are the same font', () => {
    const url = buildGoogleFontsUrl('Inter', 'Inter');
    const matches = url?.match(/family=Inter/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(url).toBe('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=optional');
  });

  it('dedupe is case-insensitive', () => {
    const url = buildGoogleFontsUrl('Inter', 'inter');
    expect(url?.match(/family=Inter/gi) ?? []).toHaveLength(1);
  });

  it('URL-encodes spaces with + (Google Fonts format, not %20)', () => {
    const url = buildGoogleFontsUrl('Source Sans 3', 'Noto Sans');
    expect(url).toContain('Source+Sans+3:wght@400;700');
    expect(url).toContain('Noto+Sans:wght@400;600');
    expect(url).not.toContain('%20');
    expect(url).not.toContain('Source Sans');
  });

  // `display=optional` over `swap`: when the woff2 isn't ready within the
  // browser's ~100ms block window, the fallback font is used permanently for
  // this paint — never reflows when the real font arrives mid-render. See
  // src/lib/theme/fonts.ts for the rationale.
  it('always appends &display=optional', () => {
    const url = buildGoogleFontsUrl('Playfair Display', undefined);
    expect(url?.endsWith('&display=optional')).toBe(true);
  });

  it('strips quotes around font names before encoding', () => {
    const url = buildGoogleFontsUrl('"Playfair Display"', "'Inter'");
    expect(url).toBe(
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;600&display=optional',
    );
  });
});

describe('renderFontPreconnect', () => {
  it('emits both preconnect links with crossorigin on gstatic', () => {
    const html = renderFontPreconnect();
    expect(html).toContain('<link rel="preconnect" href="https://fonts.googleapis.com">');
    expect(html).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
  });
});

describe('renderFontStylesheet', () => {
  it('emits a stylesheet link tag for the given URL', () => {
    const url = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=optional';
    expect(renderFontStylesheet(url)).toBe(`<link rel="stylesheet" href="${url}">`);
  });
});

describe('renderFontHead', () => {
  it('emits empty string when both fonts are system', () => {
    expect(renderFontHead('system-ui', 'sans-serif')).toBe('');
  });

  it('emits preconnects (but NOT the stylesheet link) when a non-system font is named', () => {
    // The stylesheet <link> moved to a stable, runtime-repointable
    // <link id="wl-font-stylesheet"> baked by Portal.astro (live-config-coherence);
    // renderFontHead now carries only preconnect hints + fallback faces.
    const html = renderFontHead('Bitter', 'IBM Plex Sans');
    expect(html).toContain('rel="preconnect"');
    expect(html).toContain('href="https://fonts.googleapis.com"');
    expect(html).toContain('href="https://fonts.gstatic.com" crossorigin');
    expect(html).not.toContain('rel="stylesheet"');
  });
});
