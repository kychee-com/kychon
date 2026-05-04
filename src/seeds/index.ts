// Project seed selector. Resolves first-byte chrome in this order:
//   1. KYCHON_CHROME_SNAPSHOT JSON (for ports without typed engine seeds)
//   2. KYCHON_PROJECT typed seed
//   3. Neutral fallback for unknown hosted-port project names
//
// Used by both `scripts/generate-seed-sql.ts` and `Portal.astro`'s build-time
// bake, so SQL generation and first-byte HTML see the same source.

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { ProjectSeed } from './types.js';

const PROJECTS = ['kychon', 'eagles', 'silver-pines', 'barrio-unido'] as const;
export type ProjectName = (typeof PROJECTS)[number];

export type ActiveProjectSeedSource =
  | { kind: 'external-snapshot'; path: string }
  | { kind: 'typed-seed'; project: ProjectName }
  | { kind: 'neutral-fallback'; requestedProject: string | null };

export interface ActiveProjectSeed {
  seed: ProjectSeed;
  source: ActiveProjectSeedSource;
}

function normalizeSnapshotPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed);
}

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

function parseSnapshot(path: string): ProjectSeed {
  const raw = readFileSync(path, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  assertRecord(parsed, `Chrome snapshot ${path} must be a JSON object`);
  assertRecord(parsed.site_config, `Chrome snapshot ${path} must include a site_config object`);
  if (!Array.isArray(parsed.sections)) {
    throw new Error(`Chrome snapshot ${path} must include a sections array`);
  }
  return parsed as unknown as ProjectSeed;
}

function requestedProjectName(): string | null {
  const raw = process.env.KYCHON_PROJECT?.trim();
  return raw || null;
}

export function getProjectName(): ProjectName {
  const raw = requestedProjectName();
  if (!raw) return 'kychon';
  if ((PROJECTS as readonly string[]).includes(raw)) return raw as ProjectName;
  throw new Error(
    `KYCHON_PROJECT="${raw}" is not a known project. Valid: ${PROJECTS.join(', ')}`,
  );
}

async function loadTypedSeed(name: ProjectName): Promise<ProjectSeed> {
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

export async function resolveActiveProjectSeed(): Promise<ActiveProjectSeed> {
  const snapshotPath = normalizeSnapshotPath(process.env.KYCHON_CHROME_SNAPSHOT || '');
  if (snapshotPath) {
    if (!existsSync(snapshotPath)) {
      throw new Error(`KYCHON_CHROME_SNAPSHOT not found: ${snapshotPath}`);
    }
    return {
      seed: parseSnapshot(snapshotPath),
      source: { kind: 'external-snapshot', path: snapshotPath },
    };
  }

  const requested = requestedProjectName();
  if (!requested) {
    return {
      seed: await loadTypedSeed('kychon'),
      source: { kind: 'typed-seed', project: 'kychon' },
    };
  }

  if ((PROJECTS as readonly string[]).includes(requested)) {
    const project = requested as ProjectName;
    return {
      seed: await loadTypedSeed(project),
      source: { kind: 'typed-seed', project },
    };
  }

  console.warn(
    `KYCHON_PROJECT="${requested}" is not a typed seed; using neutral first-byte chrome fallback.`,
  );
  return {
    seed: (await import('./neutral.js')).seed,
    source: { kind: 'neutral-fallback', requestedProject: requested },
  };
}

export async function getActiveProjectSeed(): Promise<ProjectSeed> {
  return (await resolveActiveProjectSeed()).seed;
}

export function describeSeedSource(source: ActiveProjectSeedSource): string {
  switch (source.kind) {
    case 'external-snapshot':
      return `external snapshot (${source.path})`;
    case 'typed-seed':
      return `typed seed (${source.project})`;
    case 'neutral-fallback':
      return source.requestedProject
        ? `neutral fallback (unknown project "${source.requestedProject}")`
        : 'neutral fallback';
  }
}
