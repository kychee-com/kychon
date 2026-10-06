/**
 * runDeploy reports the deployment a subdomain should bind (kychon#225). The
 * zero-downtime cut-over deploys under a temporary subdomain, then moves the
 * canonical name with `r.subdomains.add({ name, deploymentId, projectId })`.
 * A deploy that imports the seed publishes twice, so the id must be the
 * post-import re-publish, not the first apply.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appliedDeploymentId } from '../../scripts/_lib';
import { applyWithPostImportRebuild, type InstallMarker } from '../../scripts/initial-import';

const installed = (at: string): InstallMarker => ({ installed_at: at, import_source: 'seed.sql' });

function applyResult(phase: string) {
  return {
    release_id: `rel_${phase}`,
    operation_id: `op_${phase}`,
    urls: { site: 'https://temp-v2.run402.com', deployment_id: `dpl_${phase}` },
  };
}

describe('appliedDeploymentId', () => {
  it('returns the deployment id the gateway reports', () => {
    expect(appliedDeploymentId(applyResult('initial'))).toBe('dpl_initial');
  });

  it('falls back to the release id, which subdomains.add also binds', () => {
    expect(appliedDeploymentId({ release_id: 'rel_x', urls: { site: 'https://x.run402.com' } })).toBe('rel_x');
    expect(appliedDeploymentId({ release_id: 'rel_x', urls: null })).toBe('rel_x');
  });
});

describe('final deployment id across the post-import re-publish', () => {
  async function deploy(markers: Array<InstallMarker | null>) {
    const { result } = await applyWithPostImportRebuild({
      reimport: false,
      probe: async () => markers.shift(),
      build: async (phase) => ({ phase }),
      apply: async (release) => applyResult(release.phase),
    });
    return appliedDeploymentId(result);
  }

  it('initial import: the post-import publish, not the pre-import one', async () => {
    await expect(deploy([null, installed('t1')])).resolves.toBe('dpl_post-import');
  });

  it('ordinary redeploy: the only publish', async () => {
    await expect(deploy([installed('t1'), installed('t1')])).resolves.toBe('dpl_initial');
  });
});

describe('runDeploy result wiring', () => {
  const lib = readFileSync(join(import.meta.dirname, '../../scripts/_lib.ts'), 'utf8');

  it('returns and prints the deployment id from the final apply', () => {
    expect(lib).toMatch(/deploymentId\?: string;/);
    // Both runDeploy (via reportAppliedRelease, fed the final applied result)
    // and patchDeploy return it.
    expect(lib.match(/deploymentId: appliedDeploymentId\(result\),/g)).toHaveLength(2);
    expect(lib).toContain('const { release, result, elapsedMs } = applied;');
    expect(lib).toMatch(/Deployment id: \$\{appliedDeploymentId\(result\)\}/);
  });
});
