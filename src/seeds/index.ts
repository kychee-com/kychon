// Project seed selector. Resolves `KYCHON_PROJECT` (default `kychon`) to a
// `ProjectSeed` exported from `./{project}.ts`. Used by both
// `scripts/generate-seed-sql.ts` and `Portal.astro`'s build-time bake.

import type { ProjectSeed } from './types.js';

const PROJECTS = ['kychon', 'eagles', 'silver-pines', 'barrio-unido'] as const;
export type ProjectName = (typeof PROJECTS)[number];

export function getProjectName(): ProjectName {
  const raw = process.env.KYCHON_PROJECT?.trim();
  if (!raw) return 'kychon';
  if ((PROJECTS as readonly string[]).includes(raw)) return raw as ProjectName;
  throw new Error(
    `KYCHON_PROJECT="${raw}" is not a known project. Valid: ${PROJECTS.join(', ')}`,
  );
}

export async function getActiveProjectSeed(): Promise<ProjectSeed> {
  const name = getProjectName();
  switch (name) {
    case 'kychon':
      return (await import('./kychon.js')).seed;
    case 'eagles':
      return (await import('./eagles.js')).seed;
    case 'silver-pines':
      return (await import('./silver-pines.js')).seed;
    case 'barrio-unido':
      return (await import('./barrio-unido.js')).seed;
  }
}
