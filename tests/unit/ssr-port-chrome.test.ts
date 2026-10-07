// @vitest-environment happy-dom
// kychon#228 — a port's request-time (SSR) routes must bake the same chrome as
// its prerendered pages, and the neutral fallback's placeholder brand must
// never reach a tab title.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bakeChrome } from '../../src/lib/chrome-bake';
import { applyBranding, stripBrandSuffix } from '../../src/lib/config';
import { resolveActiveProjectSeed } from '../../src/seeds/index';
import { seed as neutralSeed } from '../../src/seeds/neutral';
import { headFixture } from '../helpers/dom-fixture.js';

const SNAPSHOT = join(process.cwd(), 'fixtures/chrome/sample-boat-club.chrome-snapshot.json');
const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  headFixture('');
});

describe('request-time chrome for ports', () => {
  it('resolves the snapshot baked into the bundle when the env var is absent (SSR Lambda)', async () => {
    delete process.env.KYCHON_CHROME_SNAPSHOT;
    process.env.KYCHON_PROJECT = 'ocey';
    vi.stubGlobal('__KYCHON_CHROME_SNAPSHOT_JSON__', readFileSync(SNAPSHOT, 'utf-8'));

    const resolved = await resolveActiveProjectSeed();

    expect(resolved.source.kind).toBe('external-snapshot');
    expect(bakeChrome(resolved.seed, 'Calendar').title).toBe('Calendar — Harbor Point Boat Club');
  });

  it('prefers the build-time snapshot path over the baked copy', async () => {
    process.env.KYCHON_CHROME_SNAPSHOT = SNAPSHOT;
    vi.stubGlobal('__KYCHON_CHROME_SNAPSHOT_JSON__', JSON.stringify({ site_config: {}, sections: [] }));

    const resolved = await resolveActiveProjectSeed();

    expect(resolved.source).toEqual({ kind: 'external-snapshot', path: SNAPSHOT });
  });

  it('leaves the neutral brand out of the title', () => {
    const chrome = bakeChrome(neutralSeed, 'Calendar', { brandTitle: false });

    expect(chrome.title).toBe('Calendar');
    expect(chrome.titleBrand).toBe('');
    expect(bakeChrome(neutralSeed, 'Calendar').titleBrand).toBe('Member Portal');
  });
});

describe('applyBranding', () => {
  it('replaces a stale baked brand instead of appending the live one', () => {
    headFixture('<title data-brand="Member Portal">Calendar — Member Portal</title>');

    applyBranding({ site_name: 'Outdoor Club' });

    expect(document.title).toBe('Calendar — Outdoor Club');
  });

  it('brands an unbranded baked title once', () => {
    headFixture('<title>Calendar</title>');

    applyBranding({ site_name: 'Outdoor Club' });
    applyBranding({ site_name: 'Outdoor Club' });

    expect(document.title).toBe('Calendar — Outdoor Club');
  });

  it('strips only whole brand suffixes', () => {
    expect(stripBrandSuffix('A — B — B', 'B')).toBe('A');
    expect(stripBrandSuffix('A — B', '')).toBe('A — B');
  });
});
