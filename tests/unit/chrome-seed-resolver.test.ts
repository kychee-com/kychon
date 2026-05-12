import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeSeedSource, resolveActiveProjectSeed } from '../../src/seeds/index';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('resolveActiveProjectSeed', () => {
  it('prefers an external chrome snapshot over KYCHON_PROJECT', async () => {
    process.env.KYCHON_PROJECT = 'kychon';
    process.env.KYCHON_CHROME_SNAPSHOT = 'fixtures/chrome/odbc.chrome-snapshot.json';

    const resolved = await resolveActiveProjectSeed();

    expect(resolved.source.kind).toBe('external-snapshot');
    expect(describeSeedSource(resolved.source)).toContain('external snapshot');
    expect((resolved.seed.site_config as Record<string, unknown>).brand_text).toBe('Old Dominion Boat Club');
  });

  it('uses a typed seed when KYCHON_PROJECT is known and no snapshot is set', async () => {
    delete process.env.KYCHON_CHROME_SNAPSHOT;
    process.env.KYCHON_PROJECT = 'eagles';

    const resolved = await resolveActiveProjectSeed();
    const siteConfig = resolved.seed.site_config as Record<string, { value?: unknown }>;

    expect(resolved.source).toEqual({ kind: 'typed-seed', project: 'eagles' });
    expect(siteConfig.brand_text?.value).toBe('The Eagles');
  });

  it('falls back to neutral chrome for unknown project names', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.KYCHON_CHROME_SNAPSHOT;
    process.env.KYCHON_PROJECT = 'odbc-port';

    const resolved = await resolveActiveProjectSeed();
    const siteConfig = resolved.seed.site_config as Record<string, { value?: unknown }>;

    expect(resolved.source).toEqual({ kind: 'neutral-fallback', requestedProject: 'odbc-port' });
    expect(siteConfig.brand_text?.value).toBe('Member Portal');
    expect(JSON.stringify(resolved.seed)).not.toContain('Kychon Community');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('neutral first-byte chrome fallback'));
  });
});
