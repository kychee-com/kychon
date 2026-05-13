import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildCapabilityManifest,
  buildLlmsTxt,
  buildPortalVersion,
  buildWellKnownKychon,
  KYCHON_API_VERSION,
  listOperations,
} from '../../src/lib/capability-api/index.ts';

describe('Capability API discovery documents', () => {
  it('builds the well-known Kychon discovery document', () => {
    const doc = buildWellKnownKychon({ portalUrl: 'https://portal.test', engineVersion: '1.2.3' });

    expect(doc.product).toMatchObject({ name: 'Kychon' });
    expect(doc.engine).toMatchObject({ version: '1.2.3' });
    expect(doc.api).toMatchObject({
      endpoint: 'https://api.run402.com/functions/v1/kychon-api',
      transport: 'http',
      runtime: 'run402-function',
      currentVersion: KYCHON_API_VERSION,
      publicKeySource: '/js/env.js',
    });
    expect(doc.schema).toMatchObject({ manifest: '/kychon-capabilities.json' });
    expect(doc.sdk).toMatchObject({ package: '@kychon/sdk', firstDeliverable: true });
    expect(doc.cli).toMatchObject({ command: 'kychon', thinWrapperOverSdk: true });
    expect(doc.auth).toMatchObject({ bearerToken: true, actorResolution: 'server' });
    expect(doc.portalUrl).toBe('https://portal.test');
  });

  it('builds a capability manifest that matches the operation registry', () => {
    const manifest = buildCapabilityManifest();
    const manifestOperations = (manifest.operations as Array<{ name: string }>)
      .map((operation) => operation.name)
      .sort();
    const registryOperations = listOperations()
      .map((operation) => operation.name)
      .sort();

    expect(manifest.apiVersion).toBe(KYCHON_API_VERSION);
    expect(manifest.endpoint).toBe('https://api.run402.com/functions/v1/kychon-api');
    expect(manifest.transport).toBe('http');
    expect(manifest.runtime).toBe('run402-function');
    expect(manifestOperations).toEqual(registryOperations);
    expect(manifest.rawAccess).toMatchObject({ available: true, level: 'low-level' });
    expect(manifest.uiParity).toMatchObject({ referenceRenderer: true });
  });

  it('builds portal version metadata independently from SDK and CLI versions', () => {
    expect(buildPortalVersion({ engineVersion: '2.0.0', recommendedSdkVersion: '0.2.0' })).toMatchObject({
      engineVersion: '2.0.0',
      apiCurrentVersion: KYCHON_API_VERSION,
      schemaVersion: KYCHON_API_VERSION,
      recommendedSdkVersion: '0.2.0',
      cliVersion: '0.1.0',
    });
  });

  it('builds llms.txt with discovery, manifest, SDK, CLI, and safe operation guidance', () => {
    const txt = buildLlmsTxt({ portalUrl: 'https://portal.test' });

    expect(txt).toContain('https://portal.test/.well-known/kychon.json');
    expect(txt).toContain('https://portal.test/kychon-capabilities.json');
    expect(txt).toContain('https://api.run402.com/functions/v1/kychon-api');
    expect(txt).toContain('@kychon/sdk');
    expect(txt).toContain('kychon CLI');
    expect(txt).toContain('phase=validate');
    expect(txt).toContain('announcements.publish');
  });

  it('adds route endpoints for well-known discovery, manifest, and llms.txt', () => {
    expect(readFileSync(join(import.meta.dirname, '../../src/pages/.well-known/kychon.json.ts'), 'utf8')).toContain(
      'buildWellKnownKychon',
    );
    expect(readFileSync(join(import.meta.dirname, '../../src/pages/.well-known/kychon.json.ts'), 'utf8')).toContain(
      'packageJson.version',
    );
    expect(readFileSync(join(import.meta.dirname, '../../src/pages/kychon-capabilities.json.ts'), 'utf8')).toContain(
      'buildCapabilityManifest',
    );
    expect(readFileSync(join(import.meta.dirname, '../../src/pages/llms.txt.ts'), 'utf8')).toContain('buildLlmsTxt');
  });
});
