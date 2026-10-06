// kychon#189: site-wide `site_config.seo_noindex`.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ssrConfig = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../../src/lib/ssr-api', () => ({
  ssrConfigValue: vi.fn(async () => ssrConfig.value),
}));

import { liveOverridableConfigKeys } from '../../src/lib/build-config';
import { bakeChrome } from '../../src/lib/chrome-bake';
import { getFieldMode } from '../../src/lib/config-fields';
import { buildRobotsTxt, effectiveRobots, isSeoNoindex, UNLISTED_LLMS_TXT } from '../../src/lib/seo';
import { GET as llmsGet } from '../../src/pages/llms.txt.ts';
import { GET as robotsGet } from '../../src/pages/robots.txt.ts';
import { seed as neutralSeed } from '../../src/seeds/neutral';
import type { ProjectSeed } from '../../src/seeds/types';

function withNoindex(value: unknown): ProjectSeed {
  return { ...neutralSeed, site_config: { ...neutralSeed.site_config, seo_noindex: { value, category: 'general' } } };
}

function useSnapshot(seed: ProjectSeed): void {
  const path = join(mkdtempSync(join(tmpdir(), 'kychon-seo-')), 'snapshot.json');
  writeFileSync(path, JSON.stringify(seed));
  vi.stubEnv('KYCHON_CHROME_SNAPSHOT', path);
}

afterEach(() => {
  vi.unstubAllEnvs();
  ssrConfig.value = null;
});

describe('seo helpers', () => {
  it('treats JSONB true and its string form as noindex', () => {
    expect(isSeoNoindex(true)).toBe(true);
    expect(isSeoNoindex('true')).toBe(true);
    expect(isSeoNoindex(false)).toBe(false);
    expect(isSeoNoindex(undefined)).toBe(false);
  });

  it('lets the site-wide switch win over a page directive', () => {
    expect(effectiveRobots('noindex,follow', true)).toBe('noindex,nofollow');
    expect(effectiveRobots(undefined, true)).toBe('noindex,nofollow');
    expect(effectiveRobots('noindex,follow', false)).toBe('noindex,follow');
    expect(effectiveRobots(undefined, false)).toBe('all');
  });

  it('builds robots.txt', () => {
    expect(buildRobotsTxt(true)).toBe('User-agent: *\nDisallow: /\n');
    expect(buildRobotsTxt(false)).toBe('User-agent: *\nDisallow:\n');
  });
});

describe('seo_noindex bake', () => {
  it('bakes noindex from the seed', () => {
    expect(bakeChrome(withNoindex(true), 'Home').noindex).toBe(true);
    expect(bakeChrome(withNoindex(false), 'Home').noindex).toBe(false);
    expect(bakeChrome(neutralSeed, 'Home').noindex).toBe(false);
  });

  it('is a runtime field, so a deploy bakes the live value', () => {
    expect(getFieldMode('seo_noindex')).toBe('runtime');
    expect(liveOverridableConfigKeys()).toContain('seo_noindex');
  });
});

describe('/robots.txt', () => {
  const request = () => new Request('https://demo.kychon.com/robots.txt', { headers: { host: 'demo.kychon.com' } });

  it('disallows everything when the live value is on', async () => {
    ssrConfig.value = true;
    const res = await robotsGet({ request: request() });
    expect(await res.text()).toBe('User-agent: *\nDisallow: /\n');
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('allows crawling when the live value is off, even if the seed said on', async () => {
    useSnapshot(withNoindex(true));
    ssrConfig.value = false;
    expect(await (await robotsGet({ request: request() })).text()).toBe('User-agent: *\nDisallow:\n');
  });

  it('falls back to the baked seed when the live read returns nothing', async () => {
    useSnapshot(withNoindex(true));
    expect(await (await robotsGet({ request: request() })).text()).toBe('User-agent: *\nDisallow: /\n');
  });
});

describe('/llms.txt', () => {
  const url = new URL('https://demo.kychon.com/llms.txt');

  it('does not advertise an unlisted portal', async () => {
    ssrConfig.value = true;
    const res = await llmsGet({ url });
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toBe(UNLISTED_LLMS_TXT);
    expect(body).not.toContain('demo.kychon.com');
  });

  it('falls back to the baked seed when the live read returns nothing', async () => {
    useSnapshot(withNoindex(true));
    expect((await llmsGet({ url })).status).toBe(404);
  });

  it('keeps the discovery document for a listed portal', async () => {
    useSnapshot(withNoindex(true));
    ssrConfig.value = false;
    const res = await llmsGet({ url });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('https://demo.kychon.com/.well-known/kychon.json');
  });
});
