import { describe, expect, it } from 'vitest';

import { getProvider, getProviderHosts, PROVIDERS } from '../../src/lib/blocks/embed-providers.ts';

function provider(id: keyof typeof PROVIDERS) {
  const resolved = PROVIDERS[id];
  if (!resolved) throw new Error(`Missing provider: ${id}`);
  return resolved;
}

describe('PROVIDERS registry shape', () => {
  it('includes the v1 providers + admin-content-management expansion (12 total)', () => {
    const ids = Object.keys(PROVIDERS).sort();
    expect(ids).toEqual([
      'calendly',
      'eventbrite',
      'google_forms',
      'iframe',
      'map',
      'soundcloud',
      'spotify',
      'tide_chart',
      'typeform',
      'vimeo',
      'weather',
      'youtube',
    ]);
  });

  it('every provider has all required fields', () => {
    for (const [id, provider] of Object.entries(PROVIDERS)) {
      expect(provider.id, `${id}.id`).toBe(id);
      expect(provider.label, `${id}.label`).toBeTruthy();
      expect(provider.icon, `${id}.icon`).toBeTruthy();
      expect(typeof provider.buildSrc, `${id}.buildSrc`).toBe('function');
      expect(provider.paramsSchema, `${id}.paramsSchema`).toBeTruthy();
      expect(Array.isArray(provider.sandbox), `${id}.sandbox`).toBe(true);
      expect(provider.frameAncestor, `${id}.frameAncestor`).toBeTruthy();
      expect(provider.defaultHeight, `${id}.defaultHeight`).toBeTruthy();
      expect(typeof provider.responsive, `${id}.responsive`).toBe('boolean');
      expect(['verified', 'generic']).toContain(provider.trustLevel);
    }
  });

  it('only the iframe provider is generic', () => {
    expect(provider('iframe').trustLevel).toBe('generic');
    for (const id of [
      'youtube',
      'vimeo',
      'calendly',
      'map',
      'weather',
      'tide_chart',
      'spotify',
      'soundcloud',
      'eventbrite',
      'google_forms',
      'typeform',
    ] as const) {
      expect(provider(id).trustLevel, id).toBe('verified');
    }
  });

  it('getProviderHosts returns deduped sorted host list', () => {
    const hosts = getProviderHosts();
    expect(hosts).toEqual([...new Set(hosts)].sort());
    expect(hosts).toContain('https://www.youtube.com');
    expect(hosts).toContain('https:'); // generic iframe
  });

  it('getProvider returns undefined for unknown ids', () => {
    expect(getProvider('not-a-provider')).toBeUndefined();
    expect(getProvider('youtube')?.id).toBe('youtube');
  });
});

describe('youtube buildSrc', () => {
  const { buildSrc } = provider('youtube');

  it('produces the embed URL from a clean video_id', () => {
    expect(buildSrc({ video_id: 'abcd1234' })).toBe('https://www.youtube.com/embed/abcd1234');
  });

  it('appends start when provided', () => {
    expect(buildSrc({ video_id: 'abcd1234', start: 90 })).toBe('https://www.youtube.com/embed/abcd1234?start=90');
  });

  it('appends autoplay=1 when truthy', () => {
    expect(buildSrc({ video_id: 'abcd1234', autoplay: true })).toBe(
      'https://www.youtube.com/embed/abcd1234?autoplay=1',
    );
    expect(buildSrc({ video_id: 'abcd1234', autoplay: 'yes' })).toBe('https://www.youtube.com/embed/abcd1234');
  });

  it('encodes hostile video_id without escape', () => {
    const result = buildSrc({ video_id: 'abc&xyz=evil' });
    expect(result).toBe('https://www.youtube.com/embed/abc%26xyz%3Devil');
    // No raw `&` or `=` after the path that could open a query-string injection.
    expect(result).not.toContain('abc&xyz');
  });

  it('throws when video_id is missing', () => {
    expect(() => buildSrc({})).toThrow(/Missing required param/);
  });
});

describe('vimeo buildSrc', () => {
  const { buildSrc } = provider('vimeo');

  it('produces the embed URL', () => {
    expect(buildSrc({ video_id: '76979871' })).toBe('https://player.vimeo.com/video/76979871');
  });

  it('rejects non-numeric video_id', () => {
    expect(() => buildSrc({ video_id: 'notanumber' })).toThrow(/numeric/);
    expect(() => buildSrc({ video_id: '12;evil' })).toThrow();
  });
});

describe('calendly buildSrc', () => {
  const { buildSrc } = provider('calendly');

  it('produces a username-only URL', () => {
    expect(buildSrc({ username: 'jane-smith' })).toBe('https://calendly.com/jane-smith');
  });

  it('appends event_type when provided', () => {
    expect(buildSrc({ username: 'jane-smith', event_type: '30min' })).toBe('https://calendly.com/jane-smith/30min');
  });

  it('rejects path-traversal in username', () => {
    expect(() => buildSrc({ username: '../evil' })).toThrow(/alphanumeric/);
    expect(() => buildSrc({ username: 'evil/path' })).toThrow();
  });

  it('rejects path-traversal in event_type', () => {
    expect(() => buildSrc({ username: 'jane', event_type: '../boom' })).toThrow(/alphanumeric/);
  });
});

describe('map buildSrc', () => {
  const { buildSrc } = provider('map');

  it('builds with address', () => {
    const url = new URL(buildSrc({ address: 'Times Square' }));
    expect(url.host).toBe('www.google.com');
    expect(url.searchParams.get('q')).toBe('Times Square');
    expect(url.searchParams.get('output')).toBe('embed');
  });

  it('builds with lat+lng', () => {
    const url = new URL(buildSrc({ lat: 38.9072, lng: -77.0369 }));
    expect(url.searchParams.get('q')).toBe('38.9072,-77.0369');
  });

  it('throws when neither address nor coords are provided', () => {
    expect(() => buildSrc({})).toThrow(/address.*lat.*lng/);
    expect(() => buildSrc({ lat: 1 })).toThrow();
  });

  it('correctly URL-encodes addresses with special chars', () => {
    const result = buildSrc({ address: 'Café & Bistro, Paris' });
    expect(result).toContain('Caf%C3%A9');
    expect(result).toContain('%26');
  });
});

describe('weather buildSrc', () => {
  const { buildSrc } = provider('weather');

  it('builds with lat+lon', () => {
    const url = new URL(buildSrc({ lat: 38.8, lon: -77.0 }));
    expect(url.host).toBe('embed.windy.com');
    expect(url.searchParams.get('lat')).toBe('38.8');
    expect(url.searchParams.get('lon')).toBe('-77');
  });

  it('throws when lat or lon missing', () => {
    expect(() => buildSrc({ lat: 38.8 })).toThrow(/lat.*lon/);
    expect(() => buildSrc({})).toThrow();
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => buildSrc({ lat: 91, lon: 0 })).toThrow(/range/);
    expect(() => buildSrc({ lat: 0, lon: 200 })).toThrow();
  });

  it('switches metric units when units=imperial', () => {
    const url = new URL(buildSrc({ lat: 38, lon: -77, units: 'imperial' }));
    expect(url.searchParams.get('metricTemp')).toBe('°F');
  });
});

describe('tide_chart buildSrc', () => {
  const { buildSrc } = provider('tide_chart');

  it('builds the predictions URL', () => {
    const url = new URL(buildSrc({ station_id: '8594900' }));
    expect(url.host).toBe('tidesandcurrents.noaa.gov');
    expect(url.pathname).toBe('/noaatidepredictions.html');
    expect(url.searchParams.get('id')).toBe('8594900');
  });

  it('rejects non-numeric station_id', () => {
    expect(() => buildSrc({ station_id: 'abc' })).toThrow(/digit/);
    expect(() => buildSrc({ station_id: '12345; rm -rf /' })).toThrow();
  });
});

describe('iframe (generic) buildSrc', () => {
  const { buildSrc } = provider('iframe');

  it('passes through valid HTTPS URLs', () => {
    expect(buildSrc({ src: 'https://example.com/widget' })).toBe('https://example.com/widget');
  });

  it('passes through valid HTTP URLs (warning, not block)', () => {
    expect(buildSrc({ src: 'http://example.com/widget' })).toBe('http://example.com/widget');
  });

  it('rejects javascript: URLs', () => {
    expect(() => buildSrc({ src: 'javascript:alert(1)' })).toThrow(/scheme/);
  });

  it('rejects data: URLs', () => {
    expect(() => buildSrc({ src: 'data:text/html,<script>alert(1)</script>' })).toThrow(/scheme/);
  });

  it('rejects vbscript: URLs', () => {
    expect(() => buildSrc({ src: 'vbscript:msgbox(1)' })).toThrow(/scheme/);
  });

  it('rejects empty/missing src', () => {
    expect(() => buildSrc({})).toThrow(/Missing required param/);
    expect(() => buildSrc({ src: '' })).toThrow();
  });

  it('rejects malformed URLs', () => {
    expect(() => buildSrc({ src: 'not a url' })).toThrow(/Invalid URL/);
  });
});

describe('sandbox tokens are exact and minimal', () => {
  it('youtube and vimeo permit presentation but not popups or forms', () => {
    expect(provider('youtube').sandbox).toContain('allow-presentation');
    expect(provider('youtube').sandbox).not.toContain('allow-popups');
    expect(provider('youtube').sandbox).not.toContain('allow-forms');
    expect(provider('vimeo').sandbox).toContain('allow-presentation');
  });

  it('calendly permits popups and forms (booking flow)', () => {
    expect(provider('calendly').sandbox).toContain('allow-popups');
    expect(provider('calendly').sandbox).toContain('allow-forms');
  });

  it('weather has the strictest verified-provider sandbox', () => {
    expect(provider('weather').sandbox).toEqual(['allow-scripts', 'allow-same-origin']);
  });

  it('iframe (generic) has the strict default', () => {
    expect(provider('iframe').sandbox).toEqual(['allow-scripts', 'allow-same-origin']);
  });
});
