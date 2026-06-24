import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const aliasRoute = readFileSync(join(root, 'src/pages/[...alias].astro'), 'utf8');
const ssrApi = readFileSync(join(root, 'src/lib/ssr-api.ts'), 'utf8');

describe('source-path alias route', () => {
  it('renders per request and resolves aliases from public site_config', () => {
    expect(aliasRoute).toContain('export const prerender = false');
    expect(aliasRoute).toContain("key: 'path_aliases'");
    expect(aliasRoute).toContain('ssrConfigValue');
  });

  it('redirects with a permanent status and delegates resolution to the validated helper', () => {
    expect(aliasRoute).toContain('Astro.redirect(target, 301)');
    expect(aliasRoute).toContain('resolvePathAlias');
  });

  it('serves a noindex 404 for unmatched paths', () => {
    expect(aliasRoute).toContain('Astro.response.status = 404');
    expect(aliasRoute).toContain('name="robots" content="noindex"');
  });

  it('ssr-api exposes the per-request config reader', () => {
    expect(ssrApi).toContain('export async function ssrConfigValue');
    expect(ssrApi).toContain("'config.get'");
  });
});
