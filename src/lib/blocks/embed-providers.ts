// embed-providers.ts — Allowlist of third-party iframe providers the embed
// block can render. Each provider declares a typed URL builder, sandbox
// attributes, and a CSP `frame-src` host. Adding a provider is a code change
// by design — that's the security model. The runtime never accepts admin-
// pasted iframe HTML; URLs are always constructed via `buildSrc`.

export type EmbedTrustLevel = 'verified' | 'generic';

export interface ParamSchemaEntry {
  type: 'text' | 'number' | 'select';
  required?: boolean;
  options?: string[];
  label?: string;
  help?: string;
  placeholder?: string;
}

export interface EmbedProvider {
  /** Stable id used as `config.provider` in section rows. */
  id: string;
  /** Display label shown in the admin provider selector. */
  label: string;
  /** Single emoji or short string shown alongside the label in the picker. */
  icon: string;
  /** Pure function: construct the iframe `src` URL from typed params. Throws
   *  on invalid input. */
  buildSrc: (params: Record<string, unknown>) => string;
  /** Declarative schema for the admin params form. */
  paramsSchema: Record<string, ParamSchemaEntry>;
  /** Tokens emitted in the iframe `sandbox` attribute. The renderer emits
   *  exactly these — never more, never less. */
  sandbox: string[];
  /** CSP `frame-src` host(s) for this provider. Listed in `_headers` and the
   *  Portal.astro CSP meta tag at build time. The generic `iframe` provider
   *  uses `https:` so any HTTPS source is permitted (the trust gate is the
   *  per-block boundary). */
  frameAncestor: string;
  /** Default fixed iframe height for non-responsive providers. */
  defaultHeight: string;
  /** When true, renderer applies `aspect-ratio` styling for fluid width. */
  responsive: boolean;
  /** `'generic'` providers (just the iframe escape hatch) require an explicit
   *  admin trust acknowledgment before they render. `'verified'` providers
   *  ship without that gate. */
  trustLevel: EmbedTrustLevel;
}

// --- Helpers shared across providers ---

function requireString(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`Missing required param: ${key}`);
  }
  return v;
}

function optionalString(params: Record<string, unknown>, key: string): string | undefined {
  const v = params[key];
  if (v == null || v === '') return undefined;
  if (typeof v !== 'string') return String(v);
  return v;
}

function optionalNumber(params: Record<string, unknown>, key: string): number | undefined {
  const v = params[key];
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

// --- Providers ---

const youtube: EmbedProvider = {
  id: 'youtube',
  label: 'YouTube video',
  icon: '\u{1F4FA}',
  buildSrc(params) {
    const videoId = requireString(params, 'video_id');
    const url = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
    const start = optionalNumber(params, 'start');
    if (start !== undefined && start > 0) url.searchParams.set('start', String(Math.floor(start)));
    const autoplay = params['autoplay'];
    if (autoplay === true || autoplay === 'true' || autoplay === 1 || autoplay === '1') {
      url.searchParams.set('autoplay', '1');
    }
    return url.toString();
  },
  paramsSchema: {
    video_id: { type: 'text', required: true, label: 'Video ID', placeholder: 'dQw4w9WgXcQ' },
    start: { type: 'number', label: 'Start at (seconds)' },
    autoplay: { type: 'select', label: 'Autoplay', options: ['no', 'yes'] },
  },
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation'],
  frameAncestor: 'https://www.youtube.com',
  defaultHeight: '360px',
  responsive: true,
  trustLevel: 'verified',
};

const vimeo: EmbedProvider = {
  id: 'vimeo',
  label: 'Vimeo video',
  icon: '\u{1F39E}',
  buildSrc(params) {
    const videoId = requireString(params, 'video_id');
    if (!/^\d+$/.test(videoId)) {
      throw new Error('Vimeo video_id must be numeric');
    }
    return `https://player.vimeo.com/video/${videoId}`;
  },
  paramsSchema: {
    video_id: {
      type: 'text',
      required: true,
      label: 'Video ID',
      help: 'Numeric only (e.g. 76979871)',
    },
  },
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-presentation'],
  frameAncestor: 'https://player.vimeo.com',
  defaultHeight: '360px',
  responsive: true,
  trustLevel: 'verified',
};

const calendly: EmbedProvider = {
  id: 'calendly',
  label: 'Calendly booking',
  icon: '\u{1F4C5}',
  buildSrc(params) {
    const username = requireString(params, 'username');
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Calendly username must be alphanumeric, dash, or underscore');
    }
    const eventType = optionalString(params, 'event_type');
    if (eventType !== undefined) {
      if (!/^[a-zA-Z0-9_-]+$/.test(eventType)) {
        throw new Error('Calendly event_type must be alphanumeric, dash, or underscore');
      }
      return `https://calendly.com/${username}/${eventType}`;
    }
    return `https://calendly.com/${username}`;
  },
  paramsSchema: {
    username: { type: 'text', required: true, label: 'Username', placeholder: 'jane-smith' },
    event_type: { type: 'text', label: 'Event type slug (optional)', placeholder: '30min' },
  },
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-forms'],
  frameAncestor: 'https://calendly.com',
  defaultHeight: '700px',
  responsive: false,
  trustLevel: 'verified',
};

const map: EmbedProvider = {
  id: 'map',
  label: 'Google Maps',
  icon: '\u{1F5FA}',
  buildSrc(params) {
    const address = optionalString(params, 'address');
    const lat = optionalNumber(params, 'lat');
    const lng = optionalNumber(params, 'lng');
    let q: string;
    if (address) {
      q = address;
    } else if (lat !== undefined && lng !== undefined) {
      q = `${lat},${lng}`;
    } else {
      throw new Error('Map provider requires either `address` or both `lat` and `lng`');
    }
    const url = new URL('https://www.google.com/maps');
    url.searchParams.set('q', q);
    url.searchParams.set('output', 'embed');
    return url.toString();
  },
  paramsSchema: {
    address: { type: 'text', label: 'Address or place name', placeholder: '1600 Pennsylvania Ave NW, Washington, DC' },
    lat: { type: 'number', label: 'Latitude' },
    lng: { type: 'number', label: 'Longitude' },
  },
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-forms'],
  frameAncestor: 'https://www.google.com',
  defaultHeight: '320px',
  responsive: false,
  trustLevel: 'verified',
};

const weather: EmbedProvider = {
  id: 'weather',
  label: 'Weather (Windy)',
  icon: '\u{1F324}',
  buildSrc(params) {
    const lat = optionalNumber(params, 'lat');
    const lon = optionalNumber(params, 'lon');
    if (lat === undefined || lon === undefined) {
      throw new Error('Weather provider requires both `lat` and `lon`');
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('Weather provider lat/lon out of range');
    }
    const units = optionalString(params, 'units');
    const url = new URL('https://embed.windy.com/embed2.html');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('zoom', '10');
    url.searchParams.set('type', 'map');
    url.searchParams.set('location', 'coordinates');
    url.searchParams.set('metricTemp', units === 'imperial' ? '°F' : 'default');
    url.searchParams.set('metricWind', units === 'imperial' ? 'mph' : 'default');
    return url.toString();
  },
  paramsSchema: {
    lat: { type: 'number', required: true, label: 'Latitude' },
    lon: { type: 'number', required: true, label: 'Longitude' },
    units: { type: 'select', label: 'Units', options: ['metric', 'imperial'] },
    location: { type: 'text', label: 'Display location label (optional)' },
  },
  sandbox: ['allow-scripts', 'allow-same-origin'],
  frameAncestor: 'https://embed.windy.com',
  defaultHeight: '360px',
  responsive: false,
  trustLevel: 'verified',
};

const tideChart: EmbedProvider = {
  id: 'tide_chart',
  label: 'NOAA tide chart',
  icon: '\u{1F30A}',
  buildSrc(params) {
    const stationId = requireString(params, 'station_id');
    if (!/^\d{6,9}$/.test(stationId)) {
      throw new Error('NOAA station_id must be a 6-9 digit number');
    }
    const url = new URL('https://tidesandcurrents.noaa.gov/noaatidepredictions.html');
    url.searchParams.set('id', stationId);
    return url.toString();
  },
  paramsSchema: {
    station_id: {
      type: 'text',
      required: true,
      label: 'NOAA station ID',
      help: 'Look up at tidesandcurrents.noaa.gov (e.g. 8594900 for Alexandria, VA)',
      placeholder: '8594900',
    },
  },
  sandbox: ['allow-scripts', 'allow-same-origin', 'allow-popups'],
  frameAncestor: 'https://tidesandcurrents.noaa.gov',
  defaultHeight: '360px',
  responsive: false,
  trustLevel: 'verified',
};

const iframe: EmbedProvider = {
  id: 'iframe',
  label: 'Generic iframe (untrusted source)',
  icon: '\u{1F517}',
  buildSrc(params) {
    const src = requireString(params, 'src');
    let url: URL;
    try {
      url = new URL(src);
    } catch {
      throw new Error(`Invalid URL: ${src}`);
    }
    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new Error(`Disallowed scheme: ${url.protocol} (only https: and http: are permitted)`);
    }
    return url.toString();
  },
  paramsSchema: {
    src: {
      type: 'text',
      required: true,
      label: 'Source URL',
      help: 'Must be https://… (http:// permitted with warning)',
      placeholder: 'https://example.com/widget',
    },
  },
  sandbox: ['allow-scripts', 'allow-same-origin'],
  // The generic iframe doesn't have a fixed host. CSP frame-src includes `https:`
  // so any HTTPS source is permitted — the trust gate + sandbox are the per-block
  // boundary. See design.md decision 3.
  frameAncestor: 'https:',
  defaultHeight: '320px',
  responsive: true,
  trustLevel: 'generic',
};

/** The full set of registered providers. */
export const PROVIDERS: Record<string, EmbedProvider> = {
  youtube,
  vimeo,
  calendly,
  map,
  weather,
  tide_chart: tideChart,
  iframe,
};

/** Hosts (origins) listed in the CSP `frame-src` directive — derived from
 *  the registry. Used by `csp.ts` and the deploy validator. */
export function getProviderHosts(): string[] {
  const hosts = new Set<string>();
  for (const p of Object.values(PROVIDERS)) {
    if (p.frameAncestor) hosts.add(p.frameAncestor);
  }
  return Array.from(hosts).sort();
}

/** Lookup a provider by id. Returns undefined for unknown ids — callers
 *  should render the embed error placeholder when this happens. */
export function getProvider(id: string): EmbedProvider | undefined {
  return PROVIDERS[id];
}
