/**
 * Build bakes post-apply DB state when a deploy imports its seed (#191, #153).
 *
 * runDeploy builds Astro BEFORE `project.apply(spec)` runs schema + seed, and
 * the build reads the live DB (site_config overrides, pages/sections/events
 * fetchers). On a deploy that imports the seed — the initial import, or a
 * confirmed `--reimport` — that bakes pre-import state and ships seed changes
 * one deploy late (and on a port's first deploy, SQL-seeded custom pages got
 * no clean-slug route). Ordinary redeploys are unchanged: live is the truth.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  applyWithPostImportRebuild,
  type InstallMarker,
  readInstallMarker,
  seedAppliedInDeploy,
  seedImportExpected,
} from '../../scripts/initial-import';
import { resolveFirstPaintSeed } from '../../src/lib/build-config';
import type { ProjectSeed } from '../../src/seeds/types';

const installed = (at: string, source = 'seed.sql'): InstallMarker => ({ installed_at: at, import_source: source });

describe('readInstallMarker', () => {
  it('returns null when kychon_install does not exist yet (fresh project)', async () => {
    const sql = vi.fn(async () => ({ rows: [{ present: false }] }));
    await expect(readInstallMarker(sql)).resolves.toBeNull();
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('returns null when the table exists but is empty (initial import pending)', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(readInstallMarker(sql)).resolves.toBeNull();
  });

  it('returns the marker row when installed', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ present: true }] })
      .mockResolvedValueOnce({ rows: [{ installed_at: '2026-01-01T00:00:00Z', import_source: 'seed.sql' }] });
    await expect(readInstallMarker(sql)).resolves.toEqual(installed('2026-01-01T00:00:00Z'));
  });

  it('returns undefined (unknown) when the probe fails — never throws', async () => {
    const sql = vi.fn(async () => {
      throw new Error('403');
    });
    await expect(readInstallMarker(sql)).resolves.toBeUndefined();
  });
});

describe('seedImportExpected', () => {
  it('is true on a confirmed reimport or a pending initial import', () => {
    expect(seedImportExpected(installed('t1'), true)).toBe(true);
    expect(seedImportExpected(null, false)).toBe(true);
  });

  it('is false on an ordinary redeploy or when the marker is unknown', () => {
    expect(seedImportExpected(installed('t1'), false)).toBe(false);
    expect(seedImportExpected(undefined, false)).toBe(false);
  });
});

describe('seedAppliedInDeploy', () => {
  it('detects the initial import (no marker before, seed marker after)', () => {
    expect(seedAppliedInDeploy({ before: null, after: installed('t1'), reimport: false })).toBe(true);
  });

  it('detects a reimport (marker re-written with a new installed_at)', () => {
    expect(seedAppliedInDeploy({ before: installed('t1'), after: installed('t2'), reimport: true })).toBe(true);
  });

  it('ordinary redeploy: same marker before and after → no seed applied', () => {
    expect(seedAppliedInDeploy({ before: installed('t1'), after: installed('t1'), reimport: false })).toBe(false);
  });

  it('adopted live project (schema.sql marks it, seed skipped) → no seed applied', () => {
    expect(seedAppliedInDeploy({ before: null, after: installed('t1', 'adopted'), reimport: false })).toBe(false);
  });

  it('empty seed (no marker written) → no seed applied', () => {
    expect(seedAppliedInDeploy({ before: null, after: null, reimport: false })).toBe(false);
  });

  it('falls back to the deploy intent when a probe is unknown', () => {
    expect(seedAppliedInDeploy({ before: undefined, after: undefined, reimport: true })).toBe(true);
    expect(seedAppliedInDeploy({ before: undefined, after: undefined, reimport: false })).toBe(false);
    expect(seedAppliedInDeploy({ before: null, after: undefined, reimport: false })).toBe(true);
    expect(seedAppliedInDeploy({ before: undefined, after: installed('t1'), reimport: false })).toBe(false);
  });
});

describe('applyWithPostImportRebuild', () => {
  function harness(markers: Array<InstallMarker | null | undefined>, reimport = false) {
    const calls: string[] = [];
    const probe = vi.fn(async () => {
      calls.push('probe');
      return markers.shift();
    });
    const build = vi.fn(async (phase: string, ctx: { seedWins: boolean }) => {
      calls.push(`build:${phase}:${ctx.seedWins ? 'seed' : 'live'}`);
      return { phase };
    });
    const apply = vi.fn(async (release: { phase: string }) => {
      calls.push(`apply:${release.phase}`);
      return { release_id: `rel_${release.phase}` };
    });
    return { calls, run: () => applyWithPostImportRebuild({ reimport, probe, build, apply }) };
  }

  it('initial import: rebuilds after apply and publishes the post-import bake', async () => {
    const h = harness([null, installed('t1')]);
    const out = await h.run();
    expect(h.calls).toEqual([
      'probe',
      'build:initial:seed',
      'apply:initial',
      'probe',
      'build:post-import:live',
      'apply:post-import',
    ]);
    expect(out).toEqual({ result: { release_id: 'rel_post-import' }, rebuilt: true });
  });

  it('reimport: seed wins on the first bake, then rebuilds from post-apply state', async () => {
    const h = harness([installed('t1'), installed('t2')], true);
    const out = await h.run();
    expect(h.calls).toEqual([
      'probe',
      'build:initial:seed',
      'apply:initial',
      'probe',
      'build:post-import:live',
      'apply:post-import',
    ]);
    expect(out.rebuilt).toBe(true);
  });

  it('ordinary redeploy: one build, one apply, live overrides kept', async () => {
    const h = harness([installed('t1'), installed('t1')]);
    const out = await h.run();
    expect(h.calls).toEqual(['probe', 'build:initial:live', 'apply:initial', 'probe']);
    expect(out).toEqual({ result: { release_id: 'rel_initial' }, rebuilt: false });
  });
});

describe('resolveFirstPaintSeed', () => {
  const base = {
    site_config: { custom_css: '.seed {}', brand_text: 'Seed' },
    sections: [],
    pages: [],
  } as unknown as ProjectSeed;
  const live = [
    { key: 'custom_css', value: '.live {}' },
    { key: 'brand_text', value: 'Seed' },
  ];

  it('ordinary redeploy: live config overrides the seed', () => {
    const out = resolveFirstPaintSeed(base, live, { seedWins: false });
    expect(out.overridden).toEqual(['custom_css']);
    expect(out.discarded).toEqual([]);
    expect((out.seed.site_config as Record<string, unknown>).custom_css).toBe('.live {}');
  });

  it('seed import: the seed wins and the differing live keys are reported', () => {
    const out = resolveFirstPaintSeed(base, live, { seedWins: true });
    expect(out.seed).toBe(base);
    expect(out.overridden).toEqual([]);
    expect(out.discarded).toEqual(['custom_css']);
  });
});
