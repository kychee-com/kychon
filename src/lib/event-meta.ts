// Per-event `<head>` metadata and asset references for the server-rendered
// `/event?id=N` route. Link previews (Slack, iMessage, search snippets) read
// `<title>`, `meta[name=description]` and `og:*`, never the island's body,
// so these are derived from the one event the request renders.

import { resolveAssetUrl, type AssetManifest } from './kychon-image.js';
import { stripHtml } from './search.js';

export const EVENT_META_DESCRIPTION_MAX = 200;

interface EventMetaSource {
  description?: string | null;
  image_url?: string | null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Plain-text summary of an event's rich-text description, cut at a word
 * boundary. Entities are decoded because Astro escapes attribute values
 * itself; leaving `&amp;` in would surface literally in previews.
 */
export function eventMetaDescription(event: EventMetaSource, max = EVENT_META_DESCRIPTION_MAX): string {
  const text = decodeEntities(stripHtml(event.description)).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Every `/assets/<name>` URL the event renders: the hero image plus `src` /
 * `href` references inside the description. These are the manifest entries
 * the server render needs to resolve, since the window manifest is absent.
 */
export function eventAssetUrls(event: EventMetaSource): string[] {
  const urls = new Set<string>();
  if (event.image_url) urls.add(event.image_url);
  const html = event.description ?? '';
  for (const match of html.matchAll(/\s(?:src|href)\s*=\s*(["'])(\/assets\/[^"'\s>]+)\1/gi)) {
    urls.add(match[2]);
  }
  return [...urls];
}

/** Absolute `og:image` URL for the event's hero, or '' when it has none. */
export function eventOgImageUrl(event: EventMetaSource, manifest: AssetManifest | null, origin: string): string {
  if (!event.image_url) return '';
  const resolved = resolveAssetUrl(event.image_url, manifest);
  try {
    return new URL(resolved, origin).href;
  } catch {
    return '';
  }
}
