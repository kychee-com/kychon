/**
 * Content history keeps old revisions pointing at the exact image they showed,
 * so content must store an asset's immutable (content-addressed) URL, never
 * the mutable `_blob/<name>` alias that a same-name re-upload would repoint.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mediaAssetUrl } from '../../src/components/kychon/MediaPickerIsland';

describe('immutable asset URLs', () => {
  it('the media picker stores the immutable URL when the asset has one', () => {
    expect(
      mediaAssetUrl({
        key: 'astro/a.jpg',
        cdn_url: 'https://x/_blob/astro/a.jpg',
        cdn_immutable_url: 'https://x/_blob/astro/a-1f2e3d4c.jpg',
      }),
    ).toBe('https://x/_blob/astro/a-1f2e3d4c.jpg');
    expect(
      mediaAssetUrl({
        key: 'astro/a.jpg',
        cdn_url: 'https://x/_blob/astro/a.jpg',
        immutable_url: 'https://x/_blob/astro/a-9.jpg',
      }),
    ).toBe('https://x/_blob/astro/a-9.jpg');
    expect(mediaAssetUrl({ key: 'astro/a.jpg', cdn_url: 'https://x/_blob/astro/a.jpg' })).toBe(
      'https://x/_blob/astro/a.jpg',
    );
  });

  it('the picker host hands the editor that URL', () => {
    expect(readFileSync('src/components/kychon/MediaPickerHost.tsx', 'utf8')).toContain('url: mediaAssetUrl(ref)');
  });

  it('upload-asset returns the immutable URL first', () => {
    expect(readFileSync('functions/upload-asset.js', 'utf8')).toMatch(
      /const url = ref\?\.cdn_immutable_url \|\| ref\?\.immutable_url \|\| ref\?\.cdn_url/,
    );
  });
});
