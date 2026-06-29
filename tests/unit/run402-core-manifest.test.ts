import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/_lib';
import {
  CORE_INCLUDED_FUNCTIONS,
  materializeManifestFunctionSpec,
  resolveCoreTargetConfig,
} from '../../scripts/build-run402-manifest';

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe('Run402 Core manifest target resolution', () => {
  it('reads the Core API base and active project from the run402 profile', () => {
    const dir = tempDir('kychon-core-profile-');
    writeFileSync(
      join(dir, 'target.json'),
      JSON.stringify({ api_base: 'http://core.example:4020', target_kind: 'core' }),
      'utf-8',
    );
    writeFileSync(
      join(dir, 'projects.json'),
      JSON.stringify({
        active_project_id: 'prj_core_1',
        projects: {
          prj_core_1: { anon_key: 'anon_1', service_key: 'svc_1' },
        },
      }),
      'utf-8',
    );

    const target = resolveCoreTargetConfig({ env: {}, configDir: dir, provisionFile: null });

    expect(target.apiBase).toBe('http://core.example:4020');
    expect(target.projectId).toBe('prj_core_1');
    expect(target.anonKey).toBe('anon_1');
    expect(target.serviceKey).toBe('svc_1');
    expect(target.source.apiBase).toBe('run402 target profile');
    expect(target.source.project).toBe('run402 project profile');
  });

  it('falls back to core-provision.json for project keys', () => {
    const dir = tempDir('kychon-core-provision-profile-');
    const provision = join(dir, 'core-provision.json');
    writeFileSync(
      join(dir, 'target.json'),
      JSON.stringify({ api_base: 'http://127.0.0.1:4020', target_kind: 'core' }),
      'utf-8',
    );
    writeFileSync(
      provision,
      JSON.stringify({
        project_id: 'prj_core_2',
        anon_key: 'anon_2',
        service_key: 'svc_2',
      }),
      'utf-8',
    );

    const target = resolveCoreTargetConfig({ env: {}, configDir: dir, provisionFile: provision });

    expect(target.projectId).toBe('prj_core_2');
    expect(target.anonKey).toBe('anon_2');
    expect(target.source.project).toBe('core-provision.json');
    expect(target.source.anonKey).toBe('core-provision.json');
  });

  it('refuses to build a Core manifest against Cloud', () => {
    expect(() =>
      resolveCoreTargetConfig({
        env: { RUN402_API_BASE: 'https://api.run402.com' },
        configDir: tempDir('kychon-core-cloud-'),
        provisionFile: null,
      }),
    ).toThrow(/Refusing to build a Core manifest/);
  });
});

describe('Run402 Core manifest function materialization', () => {
  it('writes processed function source and preserves SSR capabilities', () => {
    const outDir = join(ROOT, 'tmp', 'core-functions-test');
    mkdirSync(outDir, { recursive: true });

    const fn = materializeManifestFunctionSpec(
      'ssr',
      {
        runtime: 'node22',
        source: "export default async function handler() { return new Response('ok'); }\n",
        config: { timeoutSeconds: 15, memoryMb: 512 },
        class: 'ssr',
        capabilities: ['astro.ssr.v1'],
      } as never,
      outDir,
    );

    expect(fn).toEqual({
      runtime: 'node22',
      source: { path: 'tmp/core-functions-test/ssr.js' },
      config: { timeout_seconds: 15, memory_mb: 512 },
      class: 'ssr',
      capabilities: ['astro.ssr.v1'],
    });
    expect(existsSync(join(outDir, 'ssr.js'))).toBe(true);
    expect(readFileSync(join(outDir, 'ssr.js'), 'utf-8')).toContain("new Response('ok')");
  });

  it('keeps the first Core function slice free of Cloud-only workers', () => {
    expect(CORE_INCLUDED_FUNCTIONS).toContain('kychon-api');
    expect(CORE_INCLUDED_FUNCTIONS).toContain('site-search');
    expect(CORE_INCLUDED_FUNCTIONS).not.toContain('check-expirations');
    expect(CORE_INCLUDED_FUNCTIONS).not.toContain('ai-content');
    expect(CORE_INCLUDED_FUNCTIONS).not.toContain('on-signup');
  });
});
