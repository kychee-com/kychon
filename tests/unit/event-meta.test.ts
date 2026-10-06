import { describe, expect, it } from 'vitest';
import { eventAssetUrls, eventMetaDescription, eventOgImageUrl } from '../../src/lib/event-meta';
import type { AssetManifest } from '../../src/lib/kychon-image';

const manifest = {
  version: 1,
  generated_at: '',
  assets: {
    'gala.jpg': {
      cdn_url: 'https://cdn.example.com/_blob/astro/gala.jpg',
      display_url: 'https://cdn.example.com/_blob/astro/gala-display.jpg',
    },
  },
} as unknown as AssetManifest;

describe('eventMetaDescription', () => {
  it('strips markup and decodes entities so Astro escapes them once', () => {
    expect(
      eventMetaDescription({ description: '<p>Dinner &amp; dancing&nbsp;at&#160;the <b>club</b> &#x2014; RSVP</p>' }),
    ).toBe('Dinner & dancing at the club — RSVP');
  });

  it('returns an empty string for a missing description', () => {
    expect(eventMetaDescription({ description: null })).toBe('');
  });

  it('cuts long text at a word boundary with an ellipsis', () => {
    const text = eventMetaDescription({ description: `<p>${'word '.repeat(100)}</p>` }, 50);
    expect(text.length).toBeLessThanOrEqual(50);
    expect(text.endsWith('word…')).toBe(true);
  });

  it('leaves unknown entities untouched', () => {
    expect(eventMetaDescription({ description: 'a &bogus; b' })).toBe('a &bogus; b');
  });
});

describe('eventAssetUrls', () => {
  it('collects the hero and /assets references inside the description', () => {
    expect(
      eventAssetUrls({
        image_url: '/assets/gala.jpg',
        description: `<p><img src="/assets/band.jpg"> <a href='/assets/menu.pdf'>Menu</a> <img src="https://x.test/a.jpg"> <img src="/assets/gala.jpg"></p>`,
      }),
    ).toEqual(['/assets/gala.jpg', '/assets/band.jpg', '/assets/menu.pdf']);
  });

  it('is empty for an event without images', () => {
    expect(eventAssetUrls({ image_url: null, description: null })).toEqual([]);
  });
});

describe('eventOgImageUrl', () => {
  it('resolves a manifest hit to its CDN URL', () => {
    expect(eventOgImageUrl({ image_url: '/assets/gala.jpg' }, manifest, 'https://club.kychon.com')).toBe(
      'https://cdn.example.com/_blob/astro/gala-display.jpg',
    );
  });

  it('makes a manifest miss absolute against the request origin', () => {
    expect(eventOgImageUrl({ image_url: '/assets/other.jpg' }, manifest, 'https://club.kychon.com')).toBe(
      'https://club.kychon.com/assets/other.jpg',
    );
    expect(eventOgImageUrl({ image_url: '/assets/other.jpg' }, null, 'https://club.kychon.com')).toBe(
      'https://club.kychon.com/assets/other.jpg',
    );
  });

  it('keeps absolute image URLs and returns empty without an image', () => {
    expect(eventOgImageUrl({ image_url: 'https://img.test/a.png' }, null, 'https://club.kychon.com')).toBe(
      'https://img.test/a.png',
    );
    expect(eventOgImageUrl({ image_url: null }, manifest, 'https://club.kychon.com')).toBe('');
  });
});
