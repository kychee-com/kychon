/**
 * Content signature for the main-zone bake of a page.
 *
 * Background: the homepage (and any page that opts into SSR-from-seed via
 * `chrome-bake.ts:renderMainZone`) prepaints its main-zone sections at
 * build time using the project's typed seed. The client-side
 * `page-render.ts:renderZoneInto('main', ...)` then re-renders from the
 * live PostgREST `sections` table on every load — and unconditionally
 * REPLACES the SSR-baked HTML, even when the live data matches the
 * seed exactly.
 *
 * The blast radius of that destructive re-render is: the SSR-rendered
 * `<Run402Image>` content (variant ladders + v1.54 pre-decoded
 * `blurhash_data_url` placeholder) is wiped and rebuilt. When the seed
 * and DB are in sync (the common case for demo tenants after their
 * reset cron, and for production tenants in steady state), this is
 * pure waste: identical bytes painted on top of identical bytes,
 * minus the placeholder's brief render which gets stripped before
 * the user sees the variant load.
 *
 * This module produces a deterministic short signature of (sections,
 * manifest.generated_at). SSR embeds it as `<div id="sections"
 * data-bake-signature="…">`; the client computes the same signature
 * from its (cached or fresh) data + current manifest and skips the
 * re-render when they match. When they don't match — admin edits,
 * new uploads, etc. — the existing replace-innerHTML path fires
 * unchanged.
 *
 * The signature is content-addressed, not version-addressed: bumping
 * `@run402/astro` or other deps doesn't invalidate signatures unless
 * the manifest's `generated_at` actually changed (variant URLs are
 * content-hashed, so a no-op rebuild produces the same manifest).
 *
 * djb2 is sufficient — collisions only cost a skipped re-render
 * (correctness-preserving; the next live-data change re-renders
 * anyway). Strong cryptographic hashing would be wasted entropy.
 */
import type { Section } from '@/lib/blocks';

export interface MainZoneSignatureInput {
  /**
   * Sections destined for the main zone — pre-filtered to (zone='main',
   * scope='page', visible !== false, page_slug matching the target).
   * Pre-sorted by `position` ascending. This is the same filter both
   * `chrome-bake.ts:renderMainZone` and `page-render.ts:renderZoneInto`
   * apply before rendering; passing an inflated set wastes work (you
   * get a different signature, forcing a re-render) but never produces
   * wrong output.
   */
  sections: Section[];
  /**
   * The asset manifest's `generated_at` ISO string, or `null` when no
   * manifest is loaded (dev / no-assetsDir builds).
   *
   * Currently UNUSED in the signature — `@run402/astro`'s build pipeline
   * writes the manifest multiple times during a single build and the
   * SSR-side `getBuildTimeManifest()` snapshots an in-memory state whose
   * `generated_at` doesn't match the file ultimately written to disk.
   * Including it in the hash forced spurious mismatches between SSR
   * (in-memory manifest at bake time) and client (on-disk manifest at
   * fetch time) even when the rendered HTML is byte-identical.
   *
   * Section configs already capture asset references (image_url, src,
   * etc.) — when a meaningful asset change happens, the config changes
   * too, and the signature differs. The kept parameter preserves the
   * signature's `MainZoneSignatureInput` shape for callers that have
   * the value handy + lets a future re-introduction (once the manifest
   * timestamps stabilize) not require an API change.
   */
  manifestGeneratedAt: string | null;
}

export function computeMainZoneSignature(input: MainZoneSignatureInput): string {
  // Stable JSON: only the fields the renderer actually consumes to produce
  // the rendered HTML. `id` is INTENTIONALLY EXCLUDED — seed sections (typed
  // TS objects with numeric local ids) and DB sections (UUID strings from
  // PostgreSQL) have different `id` values for what is, conceptually and
  // visually, the same section. Including `id` would force the signatures
  // to always differ between SSR-from-seed and client-from-DB even when
  // the rendered HTML is byte-identical. Two sections that render the same
  // (same `position`/`section_type`/`visible`/`config`) hash equally;
  // cosmetic field changes elsewhere (DB row metadata, audit timestamps,
  // etc.) don't trigger spurious re-renders.
  //
  // Key ordering: object keys are recursively sorted before serialization.
  // Seed `config` objects come from typed TS literals (keys in source order);
  // DB `config` rows come from PostgreSQL JSONB (keys in whatever order
  // PostgREST emits, which can differ from source order). Without a stable
  // key sort, identical logical content produces different `JSON.stringify`
  // output between SSR and client → signature mismatch → destructive
  // re-render runs unnecessarily. Arrays preserve their order (semantically
  // meaningful — e.g. slideshow items, promo card items).
  const stable = stableStringify({
    s: input.sections.map((sec) => ({
      pos: sec.position,
      type: sec.section_type,
      vis: sec.visible !== false,
      cfg: sec.config ?? null,
    })),
    // Note: `input.manifestGeneratedAt` deliberately not included — see
    // the field's JSDoc above for the rationale.
  });
  return djb2(stable);
}

/**
 * `JSON.stringify` with recursive key-sort. Object keys are emitted in
 * lexicographic order at every depth; arrays preserve insertion order.
 *
 * Implemented via the `JSON.stringify` replacer hook: for any non-array
 * object value, rebuild it with sorted keys. The replacer runs at every
 * nesting level depth-first, so deeply-nested configs (e.g. promo_cards
 * items each with their own `image_url`/`title`/`cta_text` keys) all sort.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // The shift-and-add form (hash * 33 + ch) reduces to
    // ((hash << 5) + hash) + ch; XOR variant has slightly better
    // distribution in practice for short inputs.
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // >>> 0 forces unsigned 32-bit; base-36 keeps the output short and
  // URL-safe (a-z0-9), suitable for HTML attributes.
  return (hash >>> 0).toString(36);
}
