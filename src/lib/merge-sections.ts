import type { ProjectSeed, SeedSection } from '../seeds/types';
import type { Section } from '@/lib/blocks';

/**
 * Return a shallow-cloned seed whose `sections` includes the DB-fetched
 * page-scoped main-zone sections for `pageSlug`, merged on top of the seed's
 * own sections. Used by index.astro / [customPage].astro so that ported pages
 * (whose main-zone sections live only in the deployed DB) SSR-bake their real
 * body instead of an empty hydrate shell.
 *
 * De-dup: a section present in BOTH the snapshot seed and the DB is keyed by
 * `page_slug|zone|scope|section_type|position` — NOT by id (seed sections use
 * numeric local ids, DB rows use serial/UUID, so id can never cross-match;
 * same rationale as main-zone-signature.ts). On a key collision the DB row
 * wins (it's the deployed source of truth). For a pure snapshot port the seed
 * has zero main-zone rows, so every DB row is purely additive.
 *
 * No-op fast path: when `dbSections` is empty the seed is returned unchanged
 * (reference-equal), preserving today's behavior for typed-seed projects and
 * local dev where the build-time fetch is skipped.
 */
export function mergeSeedSections(
  seed: ProjectSeed,
  pageSlug: string,
  dbSections: Section[],
): ProjectSeed {
  if (dbSections.length === 0) return seed;

  const keyOf = (s: {
    page_slug: string;
    zone: string;
    scope: string;
    section_type: string;
    position: number;
  }) => `${s.page_slug}|${s.zone}|${s.scope}|${s.section_type}|${s.position}`;

  const dbKeys = new Set(dbSections.map(keyOf));
  const seedSections = (seed.sections ?? []) as unknown as SeedSection[];
  const kept = seedSections.filter((s) => {
    const isThisPageMain =
      s.zone === 'main' && s.scope === 'page' && s.page_slug === pageSlug;
    return !(isThisPageMain && dbKeys.has(keyOf(s)));
  });

  // `renderMainZone` sorts by `position`, so final order is position-driven
  // regardless of array order here.
  return {
    ...seed,
    sections: [...kept, ...(dbSections as unknown as SeedSection[])],
  };
}
