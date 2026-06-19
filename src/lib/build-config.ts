/**
 * Build-time live-config loader (live-config-coherence — first-paint fidelity).
 *
 * When a deploy runs against a live project, the chrome bake should paint the
 * FIRST byte from the project's CURRENT `site_config`, not the frozen seed/
 * snapshot. Without this, a cold visit after a live edit flashes the stale
 * baked value, then the runtime (config.ts) reconciles to live. This module
 * closes that gap at build by overriding the seed's chrome `site_config`
 * fields with the live values before `astro build` + `generate-seed-sql` read
 * the snapshot.
 *
 * It ALSO fixes the `theme` clobber: `theme` is a SEED_OWNED key
 * (scripts/generate-seed-sql.ts), so `seed.sql` issues `ON CONFLICT DO UPDATE`
 * and a redeploy would otherwise overwrite a live theme edit with the seed's
 * stale value. Overriding the seed's `theme` from live makes that upsert a
 * no-op against the operator's actual theme.
 *
 * Build/deploy seam only — invoked from `scripts/_lib.ts:runDeploy`, NOT from
 * `bakeChrome`/`Portal.astro` (which also run per-SSR-request, where a live
 * fetch would be wrong). The fetch never throws and never blocks a deploy: on
 * any failure (or missing creds) it returns no rows and the seed is used
 * unchanged — identical first-paint behavior to before this module shipped.
 */

import type { ProjectSeed } from '../seeds/types.js';
import { runtimeFields } from './config-fields.js';

export interface LiveConfigRow {
  key: string;
  value: unknown;
}

export interface LiveConfigCreds {
  anonKey: string;
  projectId: string;
  /**
   * Required by the SDK client but unused for the request itself when
   * `apiBaseUrl` + `apiKey` are supplied (the gateway resolves the tenant from
   * the anon JWT). Pass the portal URL when known, or any tenant host.
   */
  portalUrl: string;
}

/**
 * Top-level `site_config` keys (no dotted `theme.<sub>` paths) declared
 * `runtime` in the field registry — the chrome fields whose live value should
 * drive first paint at build. `theme` is included (it carries the runtime font
 * + color tokens); its build-only sub-fields (`color_scheme`/`motion`) ride
 * along on the same JSONB and correctly update on this redeploy.
 */
export function liveOverridableConfigKeys(): string[] {
  return runtimeFields()
    .map((f) => f.key)
    .filter((k) => !k.includes('.'));
}

function rowsFromResult(result: unknown): LiveConfigRow[] {
  const raw = Array.isArray(result)
    ? result
    : result && typeof result === 'object' && Array.isArray((result as { rows?: unknown }).rows)
      ? (result as { rows: unknown[] }).rows
      : [];
  return raw.filter(
    (r): r is LiveConfigRow => !!r && typeof r === 'object' && typeof (r as LiveConfigRow).key === 'string',
  );
}

/**
 * Fetch the live project's `site_config` rows via the same `config.get`
 * capability the runtime reads. Returns `[]` (never throws) when creds are
 * absent or the gateway errors, so the caller falls back to the static seed.
 */
export async function fetchLiveSiteConfig(creds: LiveConfigCreds): Promise<LiveConfigRow[]> {
  const anonKey = creds.anonKey?.trim();
  const portalUrl = creds.portalUrl?.trim();
  if (!anonKey || !portalUrl) return [];
  try {
    // Dynamic import keeps the pure helpers (applyLiveConfigOverrides) importable
    // without loading the SDK — so unit tests don't need a built SDK.
    const { createKychonClient } = await import('@kychon/sdk');
    const client = createKychonClient({
      portalUrl,
      apiKey: anonKey,
      apiBaseUrl: 'https://api.run402.com',
    });
    const result = await client.request<unknown>('config.get', 'query', {});
    const rows = rowsFromResult(result);
    console.log(`[build-config] fetched ${rows.length} live site_config row(s) for ${creds.projectId}`);
    return rows;
  } catch (error) {
    console.warn(
      `[build-config] live config fetch failed for ${creds.projectId} — first paint uses the static seed:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function isWrappedEntry(value: unknown): value is { value: unknown } {
  return !!value && typeof value === 'object' && !Array.isArray(value) && 'value' in value;
}

/**
 * Return a new seed whose `site_config` chrome fields are overridden by the
 * live values (only for `overridableKeys` present in `liveRows`). Preserves the
 * seed entry's wrapper shape (`{ value, category }` vs. raw). Pure — neither
 * argument is mutated; returns the unchanged seed when there is nothing to
 * override (the graceful-fallback path).
 */
export function applyLiveConfigOverrides(
  seed: ProjectSeed,
  liveRows: LiveConfigRow[],
  overridableKeys: ReadonlySet<string> = new Set(liveOverridableConfigKeys()),
): { seed: ProjectSeed; overridden: string[] } {
  if (!liveRows || liveRows.length === 0) return { seed, overridden: [] };
  const liveByKey = new Map<string, unknown>();
  for (const row of liveRows) {
    if (overridableKeys.has(row.key)) liveByKey.set(row.key, row.value);
  }
  if (liveByKey.size === 0) return { seed, overridden: [] };

  const nextConfig: Record<string, unknown> = { ...(seed.site_config as Record<string, unknown>) };
  const overridden: string[] = [];
  for (const [key, value] of liveByKey) {
    const existing = nextConfig[key];
    const existingValue = isWrappedEntry(existing) ? existing.value : existing;
    // Skip no-op overrides (e.g. a demo whose live config already matches the
    // seed after its reset cron) so the build keeps its typed-seed source kind.
    if (JSON.stringify(existingValue) === JSON.stringify(value)) continue;
    nextConfig[key] = isWrappedEntry(existing) ? { ...existing, value } : value;
    overridden.push(key);
  }
  if (overridden.length === 0) return { seed, overridden };
  overridden.sort();
  return { seed: { ...seed, site_config: nextConfig }, overridden };
}
