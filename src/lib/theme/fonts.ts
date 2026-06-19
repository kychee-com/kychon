// fonts.ts — Build-time Google Fonts URL builder for `theme-fonts-injection`.
// Reads `site_config.theme.{font_heading, font_body}` and emits Google Fonts
// `<link>` tags so non-system fonts named in the theme load at first paint.
//
// System fonts (per the SYSTEM_FONTS allowlist) skip injection — they resolve
// OS-side and the network round-trip is wasted.

export const SYSTEM_FONTS = [
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
  'serif',
  'monospace',
];

const SYSTEM_FONTS_LOWER = SYSTEM_FONTS.map((f) => f.toLowerCase());

function cleanFontName(name: string): string {
  return name.trim().replace(/^["']|["']$/g, '').trim();
}

export function isSystemFont(name: string): boolean {
  if (!name) return true;
  return SYSTEM_FONTS_LOWER.includes(cleanFontName(name).toLowerCase());
}

function familyParam(name: string, weights: string): string {
  // Google Fonts uses `+` for spaces and `:wght@…` for weights. Names like
  // "Source Sans 3" become "Source+Sans+3:wght@400;600". `encodeURIComponent`
  // would percent-encode the `+`, which Google Fonts doesn't want.
  const encoded = cleanFontName(name).replace(/\s+/g, '+');
  return `${encoded}:${weights}`;
}

export function buildGoogleFontsUrl(
  fontHeading?: string | null,
  fontBody?: string | null,
): string | null {
  const families: string[] = [];
  const heading = fontHeading ? cleanFontName(fontHeading) : '';
  const body = fontBody ? cleanFontName(fontBody) : '';

  if (heading && !isSystemFont(heading)) {
    families.push(familyParam(heading, 'wght@400;700'));
  }
  if (body && !isSystemFont(body) && body.toLowerCase() !== heading.toLowerCase()) {
    families.push(familyParam(body, 'wght@400;600'));
  }

  if (families.length === 0) return null;
  // `display=optional` over `swap`: when the font isn't ready within the
  // browser's ~100ms block window, the fallback font is used PERMANENTLY for
  // this paint — no later swap, so the page never reflows text width when
  // the woff2 arrives mid-render. Cached / fast-network users still get the
  // real font on first paint; slow-network users see fallback once, then the
  // real font on subsequent visits (woff2 cached). Matches Apple's no-flicker
  // model better than `swap`'s "first the fallback, then the real font, with
  // a visible CLS shift" behavior.
  return `https://fonts.googleapis.com/css2?family=${families.join('&family=')}&display=optional`;
}

export function renderFontPreconnect(): string {
  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  ].join('\n');
}

export function renderFontStylesheet(url: string): string {
  return `<link rel="stylesheet" href="${url}">`;
}

export function renderFontHead(
  fontHeading?: string | null,
  fontBody?: string | null,
): string {
  const url = buildGoogleFontsUrl(fontHeading, fontBody);
  const fallbackFaces = renderFallbackFontFaces(fontHeading, fontBody);
  if (!url) {
    // System fonts only — fallback faces aren't needed (system fonts paint
    // synchronously with their actual metrics).
    return '';
  }
  // The stylesheet `<link>` itself is NOT emitted here: Portal.astro bakes a
  // stable `<link id="wl-font-stylesheet">` (href from `chrome.fontStylesheetUrl`)
  // so the runtime can repoint it on a live font edit (live-config-coherence).
  // This fragment carries only the preconnect hints + size-adjust fallback faces.
  const tags = [renderFontPreconnect()];
  if (fallbackFaces) tags.push(`<style is:inline>${fallbackFaces}</style>`);
  return tags.join('\n');
}

// Size-adjust @font-face fallbacks for each Google Font we ship in a demo.
// When the real font isn't ready (block window of `display=optional`, slow
// network), the browser falls back to the matching local font — but with
// `size-adjust`/`ascent-override`/`descent-override` tuned so the fallback
// occupies the SAME metric box as the design font. Result: no text-width
// reflow on font load, no `<h1>` "grows and shrinks" CLS.
//
// Values are approximate — sourced from public fontaine / fontpie recipes.
// For unknown fonts we emit nothing (current behavior — browser falls back
// to whatever the generic-family declaration resolves to).
interface FallbackRecipe {
  readonly localFamily: string;
  readonly sizeAdjust: string;
  readonly ascentOverride: string;
  readonly descentOverride: string;
  readonly lineGapOverride: string;
}

const FALLBACK_METRICS: Record<string, FallbackRecipe> = {
  // Eagles
  'Cormorant Garamond': {
    localFamily: 'Times New Roman',
    sizeAdjust: '95%',
    ascentOverride: '94%',
    descentOverride: '25%',
    lineGapOverride: '0%',
  },
  Inter: {
    localFamily: 'Arial',
    sizeAdjust: '107.5%',
    ascentOverride: '90.49%',
    descentOverride: '22.55%',
    lineGapOverride: '0%',
  },
  // Silver Pines
  Bitter: {
    localFamily: 'Georgia',
    sizeAdjust: '93%',
    ascentOverride: '95%',
    descentOverride: '21%',
    lineGapOverride: '0%',
  },
  'IBM Plex Sans': {
    localFamily: 'Arial',
    sizeAdjust: '106%',
    ascentOverride: '92.5%',
    descentOverride: '23%',
    lineGapOverride: '0%',
  },
  // Barrio Unido
  Merriweather: {
    localFamily: 'Georgia',
    sizeAdjust: '108%',
    ascentOverride: '91%',
    descentOverride: '27%',
    lineGapOverride: '0%',
  },
  'Noto Sans': {
    localFamily: 'Arial',
    sizeAdjust: '105%',
    ascentOverride: '92%',
    descentOverride: '23%',
    lineGapOverride: '0%',
  },
  // Common test fixtures / older seeds
  'Playfair Display': {
    localFamily: 'Georgia',
    sizeAdjust: '91.5%',
    ascentOverride: '96%',
    descentOverride: '27%',
    lineGapOverride: '0%',
  },
  'Source Sans 3': {
    localFamily: 'Arial',
    sizeAdjust: '108%',
    ascentOverride: '90%',
    descentOverride: '23%',
    lineGapOverride: '0%',
  },
};

export function fallbackFontFamily(name: string): string | null {
  const clean = cleanFontName(name);
  return FALLBACK_METRICS[clean] ? `${clean} Fallback` : null;
}

export function renderFallbackFontFaces(
  fontHeading?: string | null,
  fontBody?: string | null,
): string {
  const families: string[] = [];
  if (fontHeading) families.push(cleanFontName(fontHeading));
  if (fontBody && cleanFontName(fontBody).toLowerCase() !== cleanFontName(fontHeading ?? '').toLowerCase()) {
    families.push(cleanFontName(fontBody));
  }
  const blocks: string[] = [];
  for (const family of families) {
    const recipe = FALLBACK_METRICS[family];
    if (!recipe) continue;
    blocks.push(
      `@font-face{font-family:"${family} Fallback";src:local("${recipe.localFamily}");` +
        `size-adjust:${recipe.sizeAdjust};` +
        `ascent-override:${recipe.ascentOverride};` +
        `descent-override:${recipe.descentOverride};` +
        `line-gap-override:${recipe.lineGapOverride};}`,
    );
  }
  return blocks.join('\n');
}

// Build the `--font-heading` / `--font-body` CSS variable VALUES with the
// fallback family inserted between the design font and the generic family.
// Used by the chrome bake to set the variables in `<style id="wl-theme-vars">`
// at FIRST paint — without this, the var defaults to the theme.css fallback
// (Inter for the heading) and the page repaints in the design font only AFTER
// JS runs `applyTheme(...)`. That repaint is the big "Inter → Cormorant
// Garamond" jump.
export function buildFontVarValue(
  name: string | undefined | null,
  generic: 'sans-serif' | 'serif',
): string | null {
  if (!name) return null;
  const clean = cleanFontName(name);
  if (!clean || isSystemFont(clean)) return null;
  const fallback = fallbackFontFamily(clean);
  const parts = [`"${clean}"`];
  if (fallback) parts.push(`"${fallback}"`);
  parts.push('system-ui', generic);
  return parts.join(', ');
}
