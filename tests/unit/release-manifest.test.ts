import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertEngineReleaseChannel,
  assertSemver,
  buildEngineReleaseManifest,
  writeEngineReleaseManifest,
} from '../../scripts/release-manifest.ts';

describe('Kychon engine release manifest', () => {
  it('validates SemVer and release channels', () => {
    expect(assertSemver('1.4.3')).toBe('1.4.3');
    expect(assertSemver('1.5.0-rc.1')).toBe('1.5.0-rc.1');
    expect(assertEngineReleaseChannel('stable')).toBe('stable');

    expect(() => assertSemver('main')).toThrow('SemVer');
    expect(() => assertEngineReleaseChannel('latest')).toThrow('release channel');
  });

  it('builds a secret-free manifest whose migration checksum matches the deploy SQL', () => {
    const root = fixtureRoot();
    const schemaSql = 'CREATE TABLE IF NOT EXISTS site_config (key text primary key);\n';
    const manifest = buildEngineReleaseManifest({
      migrationId: 'kychon_1234567890abcdef',
      schemaSql,
      seedFile: 'seed.sql',
      now: new Date('2026-05-08T12:00:00.000Z'),
      root,
      env: {
        KYCHON_PROJECT: 'fresh',
        KYCHON_RELEASE_CHANNEL: 'stable',
        KYCHON_RELEASE_PROMOTION_STATUS: 'promoted',
        KYCHON_GIT_SHA: 'abc123',
        KYCHON_RELEASE_NOTES_URL: 'https://github.com/kychee-com/kychon/releases/tag/v1.4.3',
      },
    });

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      app: 'kychon',
      engineVersion: '1.4.3',
      gitSha: 'abc123',
      builtAt: '2026-05-08T12:00:00.000Z',
      channel: 'stable',
      promotionStatus: 'promoted',
      schemaMigrationId: 'kychon_1234567890abcdef',
      seedVariant: 'fresh',
      run402SdkVersion: '1.58.1',
    });
    expect(manifest.schemaChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.seedVersion).toMatch(/^[a-f0-9]{16}$/);

    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain('anon');
    expect(serialized).not.toContain('service');
    expect(serialized).not.toContain('wallet');
    expect(serialized).not.toContain('owner@example');
  });

  it('writes kychon-release.json into the deploy artifact', () => {
    const root = fixtureRoot();
    const distDir = join(root, 'dist');
    mkdirSync(distDir);

    const manifest = buildEngineReleaseManifest({
      migrationId: 'kychon_1234567890abcdef',
      schemaSql: 'SELECT 1;\n',
      now: new Date('2026-05-08T12:00:00.000Z'),
      root,
      env: {
        KYCHON_RELEASE_CHANNEL: 'canary',
        KYCHON_RELEASE_PROMOTION_STATUS: 'candidate',
        GITHUB_SHA: 'def456',
      },
    });
    const target = writeEngineReleaseManifest(distDir, manifest);
    const written = JSON.parse(readFileSync(target, 'utf-8'));

    expect(target.endsWith('kychon-release.json')).toBe(true);
    expect(written).toEqual(manifest);
  });
});

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'kychon-release-manifest-'));
  mkdirSync(join(root, 'node_modules', '@run402', 'sdk'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '1.4.3' }));
  writeFileSync(join(root, 'node_modules', '@run402', 'sdk', 'package.json'), JSON.stringify({ version: '1.58.1' }));
  writeFileSync(join(root, 'seed.sql'), "INSERT INTO site_config VALUES ('site_name', '\"Club\"');\n");
  return root;
}
