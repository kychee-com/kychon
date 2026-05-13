import { describe, expect, it } from 'vitest';

import { buildKychonReleaseSpec } from '../../scripts/_lib.ts';

describe('deploy public paths', () => {
  it('assembles explicit public paths and clears static route aliases', () => {
    const spec = buildKychonReleaseSpec({
      projectId: 'prj_test',
      database: { migrations: [{ id: 'm1', sql: 'SELECT 1;' }] },
      fileSet: {
        'index.html': '<html>home</html>',
        'events.html': '<html>events</html>',
        '_astro/events.abc123.js': 'console.log("events");',
      },
      publicPaths: {
        '/': { asset: 'index.html', cache_class: 'html' },
        '/events': { asset: 'events.html', cache_class: 'html' },
        '/_astro/events.abc123.js': {
          asset: '_astro/events.abc123.js',
          cache_class: 'immutable_versioned',
        },
      },
      subdomain: 'eagles',
      functionsMap: {},
    });

    expect(spec.site).toMatchObject({
      public_paths: {
        mode: 'explicit',
        replace: {
          '/events': { asset: 'events.html', cache_class: 'html' },
        },
      },
    });
    expect((spec.site as any).public_paths.replace['/events.html']).toBeUndefined();
    expect(spec.routes).toEqual({ replace: [] });
  });

  it('keeps future function routes separate from ordinary static public paths', () => {
    const spec = buildKychonReleaseSpec({
      projectId: 'prj_test',
      database: { migrations: [{ id: 'm1', sql: 'SELECT 1;' }] },
      fileSet: { 'index.html': '<html>home</html>' },
      publicPaths: { '/': { asset: 'index.html', cache_class: 'html' } },
      subdomain: 'eagles',
      functionsMap: {
        api: { runtime: 'node22', source: 'export default () => new Response("ok");' },
      },
      routes: [{ pattern: '/api/*', methods: ['GET', 'POST'], target: { type: 'function', name: 'api' } }],
    });

    expect(spec.functions).toMatchObject({ replace: { api: { runtime: 'node22' } } });
    expect(spec.routes).toEqual({
      replace: [{ pattern: '/api/*', methods: ['GET', 'POST'], target: { type: 'function', name: 'api' } }],
    });
    expect((spec.site as any).public_paths.replace['/']).toEqual({ asset: 'index.html', cache_class: 'html' });
  });
});
