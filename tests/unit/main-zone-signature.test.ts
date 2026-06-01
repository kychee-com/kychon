/**
 * Tests for the bake-signature short-circuit that lets the client-side
 * `renderZoneInto('main', ...)` skip its destructive innerHTML replace when
 * the live data matches what the SSR-baked HTML was produced from.
 *
 * The signature is the architectural fix for the Phase 2 hydration issue:
 * the SSR pre-bakes `<Run402Image>` content (with the v1.54 pre-decoded
 * blurhash placeholder) → the client unconditionally re-renders → the
 * SSR content is wiped, even when it's byte-identical to what the client
 * would produce. The signature lets the client recognize "nothing
 * meaningful changed" and skip the wasteful replace.
 */
import { describe, expect, it } from 'vitest';
import type { Section } from '@/lib/blocks';
import { computeMainZoneSignature } from '@/lib/main-zone-signature';

function baseSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'sec-1',
    zone: 'main',
    scope: 'page',
    page_slug: 'index',
    position: 0,
    section_type: 'hero',
    visible: true,
    config: { heading: 'Welcome' },
    ...overrides,
  } as Section;
}

describe('computeMainZoneSignature', () => {
  it('returns the same signature for identical inputs', () => {
    const sections: Section[] = [baseSection()];
    const sig1 = computeMainZoneSignature({ sections, manifestGeneratedAt: '2026-05-25T13:19:40Z' });
    const sig2 = computeMainZoneSignature({ sections, manifestGeneratedAt: '2026-05-25T13:19:40Z' });
    expect(sig1).toBe(sig2);
  });

  it('IGNORES manifest generated_at by design', () => {
    // The signature deliberately excludes `manifestGeneratedAt`. Rationale
    // (per the field's JSDoc): `@run402/astro`'s build pipeline writes the
    // manifest multiple times during a single build, and the SSR-side
    // `getBuildTimeManifest()` snapshots an in-memory state whose
    // `generated_at` doesn't match the file ultimately written to disk.
    // Including it forced spurious mismatches between SSR (in-memory) and
    // client (on-disk) even when the rendered HTML was byte-identical.
    // Section configs already capture asset references; meaningful changes
    // flow through `cfg` (image_url, src, etc.).
    const sections: Section[] = [baseSection()];
    const sig1 = computeMainZoneSignature({ sections, manifestGeneratedAt: '2026-05-25T13:19:40Z' });
    const sig2 = computeMainZoneSignature({ sections, manifestGeneratedAt: '2026-05-25T15:30:00Z' });
    expect(sig1).toBe(sig2);
  });

  it('changes when a section config field changes', () => {
    const before: Section[] = [baseSection({ config: { heading: 'Welcome' } })];
    const after: Section[] = [baseSection({ config: { heading: 'Welcome back' } })];
    const sig1 = computeMainZoneSignature({ sections: before, manifestGeneratedAt: null });
    const sig2 = computeMainZoneSignature({ sections: after, manifestGeneratedAt: null });
    expect(sig1).not.toBe(sig2);
  });

  it('changes when section position changes (reordered blocks)', () => {
    const a = baseSection({ id: 'sec-1', position: 0 });
    const b = baseSection({ id: 'sec-2', position: 1, section_type: 'promo_cards' });
    const sig1 = computeMainZoneSignature({ sections: [a, b], manifestGeneratedAt: null });
    const sig2 = computeMainZoneSignature({
      sections: [
        { ...a, position: 1 },
        { ...b, position: 0 },
      ],
      manifestGeneratedAt: null,
    });
    expect(sig1).not.toBe(sig2);
  });

  it('changes when a section is added', () => {
    const base = baseSection();
    const extra = baseSection({ id: 'sec-2', position: 1, section_type: 'slideshow' });
    const sig1 = computeMainZoneSignature({ sections: [base], manifestGeneratedAt: null });
    const sig2 = computeMainZoneSignature({ sections: [base, extra], manifestGeneratedAt: null });
    expect(sig1).not.toBe(sig2);
  });

  it('treats missing manifest as a distinct (empty-string) input', () => {
    const sections: Section[] = [baseSection()];
    const sigNull = computeMainZoneSignature({ sections, manifestGeneratedAt: null });
    const sigEmpty = computeMainZoneSignature({ sections, manifestGeneratedAt: '' });
    // Both serialize to the same `m: ""` token — deliberately equivalent
    // so a no-manifest build doesn't churn signatures across reloads.
    expect(sigNull).toBe(sigEmpty);
  });

  it('produces a URL-safe short string (base-36 alphanumeric)', () => {
    const sig = computeMainZoneSignature({
      sections: [baseSection()],
      manifestGeneratedAt: '2026-05-25T13:19:40Z',
    });
    expect(sig).toMatch(/^[a-z0-9]+$/);
    // djb2 32-bit unsigned in base 36 is at most ~7 chars; assert
    // upper bound generously so trivial algorithm changes don't break.
    expect(sig.length).toBeLessThanOrEqual(8);
  });

  it('ignores cosmetic fields the renderer does not read', () => {
    // The signature must hash only what `renderBlock` consumes. Adding
    // an out-of-band field (e.g., DB-internal `created_at`) must NOT
    // bump the signature; otherwise innocuous DB writes (e.g., touch
    // updates) force needless re-renders.
    const lean = baseSection();
    const fat = baseSection({
      // Field that's not in the signature's reduction:
      ...({ created_at: '2026-05-25T13:19:40Z' } as Partial<Section>),
    });
    const sigLean = computeMainZoneSignature({ sections: [lean], manifestGeneratedAt: null });
    const sigFat = computeMainZoneSignature({ sections: [fat], manifestGeneratedAt: null });
    expect(sigLean).toBe(sigFat);
  });

  it('treats `visible: false` and explicitly-false-equivalents consistently', () => {
    const visible = baseSection({ visible: true });
    const hidden = baseSection({ visible: false });
    const sigVisible = computeMainZoneSignature({ sections: [visible], manifestGeneratedAt: null });
    const sigHidden = computeMainZoneSignature({ sections: [hidden], manifestGeneratedAt: null });
    expect(sigVisible).not.toBe(sigHidden);
  });
});
