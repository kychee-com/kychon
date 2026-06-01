/**
 * Tests for the v1.54 `blurhash_data_url` fast path in `kychon-image.ts`.
 *
 * Background: run402 v1.54 ships `AssetRef.blurhash_data_url` — the gateway
 * pre-decodes the blurhash to a PNG data URL at upload time, eliminating
 * the render-time DCT decode that `kychon-image.ts` was doing via
 * `@run402/astro/blurhash`'s `decodeBlurhashToDataUri`.
 *
 * The intermediate switch (adopt-run402-v1-54-engine, Section 1) adds a
 * fast path to `lqipDataUri`: when `AssetRef.blurhash_data_url` is a
 * non-empty string, use it directly. Fall back to the existing decode +
 * cache path for AssetRefs without the new field (legacy uploads pre-v1.54
 * OR new uploads where the upload-time pre-decode failed).
 *
 * These tests assert that behavior at the `kychonImageHtml` boundary
 * (`lqipDataUri` is internal to the module and not exported separately).
 */

import type { AssetRef } from '@run402/astro';
import { describe, expect, it } from 'vitest';
import { kychonImageHtml } from '../../src/lib/kychon-image';

// A well-formed PNG data URL that's deliberately distinct from anything
// the blurhash decoder would actually produce — lets the assertion confirm
// the value came from the AssetRef field, not from a decode.
const SENTINEL_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAQElEQVRFAEQOPYHa0eTL';

// A real-shape blurhash string the decoder can process. Used to exercise
// the fallback path; the test asserts on the data-URL prefix, not the
// specific decoded bytes.
const SAMPLE_BLURHASH = 'LKO2:N%2Tw=^]~RBVZRi};RPxuwH';

/**
 * Minimal full v1.49 AssetRef base — enough fields populated so
 * `kychonImageHtml` takes the variant-ladder branch (which emits the
 * blurhash style on `<picture>`). The base intentionally omits both
 * `blurhash_data_url` and `blurhash`; tests layer those on as needed.
 */
function baseAssetRef(): AssetRef {
  return {
    key: 'fixture/hero.jpg',
    sha256: 'deadbeef'.repeat(8),
    size_bytes: 200_000,
    content_type: 'image/jpeg',
    url: 'https://cdn.example/fixture/hero.jpg',
    cdn_url: 'https://cdn.example/fixture/hero.jpg',
    width_px: 4032,
    height_px: 3024,
    display_url: 'https://cdn.example/fixture/hero.jpg',
    variants: {
      thumb: {
        cdn_url: 'https://cdn.example/fixture/hero-thumb.webp',
        width_px: 320,
        height_px: 240,
        format: 'webp',
        sha256: 'aa'.repeat(32),
      },
      medium: {
        cdn_url: 'https://cdn.example/fixture/hero-medium.webp',
        width_px: 800,
        height_px: 600,
        format: 'webp',
        sha256: 'bb'.repeat(32),
      },
      large: {
        cdn_url: 'https://cdn.example/fixture/hero-large.webp',
        width_px: 1920,
        height_px: 1440,
        format: 'webp',
        sha256: 'cc'.repeat(32),
      },
    },
  };
}

describe('kychon-image v1.54 blurhash_data_url fast path', () => {
  it('uses blurhash_data_url directly when present (no client-side decode)', () => {
    const ref = baseAssetRef();
    // `blurhash_data_url` is a v1.54 field not yet in @run402/astro@0.2.5's
    // AssetRef type; cast locally to attach it. `blurhash` is also set to
    // prove the fast path WINS over the fallback when both are available.
    (ref as AssetRef & { blurhash_data_url?: string | null }).blurhash_data_url = SENTINEL_DATA_URL;
    ref.blurhash = SAMPLE_BLURHASH;

    const html = kychonImageHtml(ref, 'hero', { sizes: '100vw' });

    // The positive assertion is sufficient: the rendered URL is exactly
    // the sentinel string. A decoded value would differ (the decoder
    // produces an image of the SAMPLE_BLURHASH, not the sentinel bytes),
    // so a match here proves the fast path won over the fallback.
    expect(html).toContain(`background-image:url(${SENTINEL_DATA_URL})`);
  });

  it('falls back to decoding `blurhash` when `blurhash_data_url` is absent', () => {
    const ref = baseAssetRef();
    ref.blurhash = SAMPLE_BLURHASH;
    // `blurhash_data_url` is undefined on this fixture.

    const html = kychonImageHtml(ref, 'hero', { sizes: '100vw' });

    // The decoder emits `data:image/png;base64,<encoded bytes>` — exact
    // bytes depend on the decoder library, but the prefix is stable.
    expect(html).toMatch(/background-image:url\(data:image\/png;base64,[A-Za-z0-9+/=]+\)/);
  });

  it('falls back to decoding when `blurhash_data_url` is null', () => {
    const ref = baseAssetRef();
    (ref as AssetRef & { blurhash_data_url?: string | null }).blurhash_data_url = null;
    ref.blurhash = SAMPLE_BLURHASH;

    const html = kychonImageHtml(ref, 'hero', { sizes: '100vw' });

    expect(html).toMatch(/background-image:url\(data:image\/png;base64,[A-Za-z0-9+/=]+\)/);
  });

  it('falls back to decoding when `blurhash_data_url` is empty string (rev-2 spec footgun)', () => {
    // The sibling spec rev-2 explicitly called out that JS `??` only
    // catches null/undefined — an empty-string value would slip through
    // and produce a broken inline data URL. The local guard checks
    // `typeof === 'string' && length > 0`. This test locks that in.
    const ref = baseAssetRef();
    (ref as AssetRef & { blurhash_data_url?: string | null }).blurhash_data_url = '';
    ref.blurhash = SAMPLE_BLURHASH;

    const html = kychonImageHtml(ref, 'hero', { sizes: '100vw' });

    // Must NOT emit `background-image:url();` — that's the bug case.
    expect(html).not.toContain('background-image:url();');
    // Must emit a real decoded data URL via the fallback path.
    expect(html).toMatch(/background-image:url\(data:image\/png;base64,[A-Za-z0-9+/=]+\)/);
  });

  it('emits no placeholder when neither `blurhash_data_url` nor `blurhash` is set', () => {
    const ref = baseAssetRef();
    // Both fields absent.

    const html = kychonImageHtml(ref, 'hero', { sizes: '100vw' });

    expect(html).not.toContain('background-image:');
  });
});
