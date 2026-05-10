import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAPABILITY_API_COMMON_SCHEMAS,
  createIdempotencyKey,
  createKychonClient,
  DEMO_PORTAL_FIXTURES,
  isKychonApiError,
  KYCHON_API_VERSION,
} from '@kychon/sdk';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');

describe('@kychon/sdk package boundary', () => {
  it('is importable through package resolution and exposes the public SDK surface', () => {
    expect(KYCHON_API_VERSION).toBe('2026-05-08');
    expect(createKychonClient).toBeTypeOf('function');
    expect(createIdempotencyKey('test')).toMatch(/^test-/);
    expect(isKychonApiError).toBeTypeOf('function');
    expect(CAPABILITY_API_COMMON_SCHEMAS.requestEnvelope).toMatchObject({
      title: 'Kychon Capability API Request Envelope',
    });
    expect(DEMO_PORTAL_FIXTURES.map((demo) => demo.key)).toEqual(['eagles', 'silver-pines', 'barrio-unido']);
  });

  it('has publishable package metadata and build output', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'packages/sdk/package.json'), 'utf8'));
    expect(pkg.name).toBe('@kychon/sdk');
    expect(pkg.private).toBeUndefined();
    expect(pkg.exports['.']).toMatchObject({
      types: './dist/index.d.ts',
      import: './dist/index.js',
    });
    expect(readFileSync(join(root, 'packages/sdk/dist/index.d.ts'), 'utf8')).toContain('createKychonClient');
    expect(readFileSync(join(root, 'packages/sdk/dist/index.js'), 'utf8')).toContain('createKychonClient');
  });

  it('keeps the SDK package free of app-internal and server-only imports', () => {
    const source = readFileSync(join(root, 'packages/sdk/src/index.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"][^'"]*(\.\.\/\.\.\/src|\.\.\/lib|@run402\/functions|astro|components|seeds)/);
    expect(source).not.toContain('../../../src/sdk/index.js');
  });

  it('uses the package import from CLI and demo compatibility tests', () => {
    const cli = readFileSync(join(root, 'src/cli/index.ts'), 'utf8');
    const demoTest = readFileSync(join(root, 'tests/unit/kychon-demo-api-integration.test.ts'), 'utf8');
    expect(cli).toContain("from '@kychon/sdk'");
    expect(demoTest).toContain("from '@kychon/sdk'");
    expect(demoTest).not.toContain('../../src/sdk');
  });
});
