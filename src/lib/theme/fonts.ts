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
  return `https://fonts.googleapis.com/css2?family=${families.join('&family=')}&display=swap`;
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
  if (!url) return '';
  return `${renderFontPreconnect()}\n${renderFontStylesheet(url)}`;
}
