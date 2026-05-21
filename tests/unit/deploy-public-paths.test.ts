import { describe, expect, it } from 'vitest';

import { buildI18nSpec, buildKychonReleaseSpec, formatI18nSlice, i18nSpecMatchesReadback } from '../../scripts/_lib.ts';
import type { ProjectSeed } from '../../src/seeds/types.ts';

interface SitePublicPaths {
  public_paths: {
    replace: Record<string, unknown>;
  };
}

function seedFor(siteConfig: ProjectSeed['site_config']): ProjectSeed {
  return { site_config: siteConfig, sections: [] };
}

describe('deploy public paths', () => {
  it('assembles explicit public paths and clears static route aliases', () => {
    const spec = buildKychonReleaseSpec({
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
    expect((spec.site as SitePublicPaths).public_paths.replace['/events.html']).toBeUndefined();
    expect(spec.routes).toEqual({ replace: [] });
  });

  it('keeps future function routes separate from ordinary static public paths', () => {
    const spec = buildKychonReleaseSpec({
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
    expect((spec.site as SitePublicPaths).public_paths.replace['/']).toEqual({
      asset: 'index.html',
      cache_class: 'html',
    });
  });
});

describe('routed-locale-context i18n slice', () => {
  it('reads languages and default_language from the seed site_config', () => {
    // Mirrors barrio-unido.ts:120-121.
    const spec = buildI18nSpec(
      seedFor({
        languages: { value: ['es', 'en'], category: 'i18n' },
        default_language: { value: 'es', category: 'i18n' },
      }),
    );

    expect(spec).toEqual({
      defaultLocale: 'es',
      locales: ['es', 'en'],
      detect: ['cookie:wl_locale', 'accept-language'],
    });
  });

  it('falls back to [en]/en when the seed declares no language keys', () => {
    // Mirrors kychon.ts / eagles.ts / silver-pines.ts: no i18n category at all.
    const spec = buildI18nSpec(seedFor({ site_name: { value: 'Anywhere', category: 'branding' } }));

    expect(spec).toEqual({
      defaultLocale: 'en',
      locales: ['en'],
      detect: ['cookie:wl_locale', 'accept-language'],
    });
  });

  it('uses locales[0] when languages is declared but default_language is not', () => {
    const spec = buildI18nSpec(seedFor({ languages: { value: ['pt', 'en'], category: 'i18n' } }));

    // First entry wins. Byte-identical invariant (defaultLocale must equal an
    // entry of locales) is preserved.
    expect(spec.defaultLocale).toBe('pt');
    expect(spec.locales).toContain(spec.defaultLocale);
  });

  it('threads through buildKychonReleaseSpec when passed as opts.i18n', () => {
    const spec = buildKychonReleaseSpec({
      database: { migrations: [{ id: 'm1', sql: 'SELECT 1;' }] },
      fileSet: { 'index.html': '<html>home</html>' },
      publicPaths: { '/': { asset: 'index.html', cache_class: 'html' } },
      subdomain: 'barrio',
      functionsMap: {},
      i18n: {
        defaultLocale: 'es',
        locales: ['es', 'en'],
        detect: ['cookie:wl_locale', 'accept-language'],
      },
    });

    expect(spec.i18n).toEqual({
      defaultLocale: 'es',
      locales: ['es', 'en'],
      detect: ['cookie:wl_locale', 'accept-language'],
    });
  });

  it('omits i18n from the release spec when not provided (carry-forward)', () => {
    const spec = buildKychonReleaseSpec({
      database: { migrations: [{ id: 'm1', sql: 'SELECT 1;' }] },
      fileSet: { 'index.html': '<html>home</html>' },
      publicPaths: { '/': { asset: 'index.html', cache_class: 'html' } },
      subdomain: 'eagles',
      functionsMap: {},
    });

    expect(spec.i18n).toBeUndefined();
  });
});

describe('i18n post-apply readback', () => {
  it('formats a slice as defaultLocale/[locales]/detect=[sources]', () => {
    expect(
      formatI18nSlice({
        defaultLocale: 'es',
        locales: ['es', 'en'],
        detect: ['cookie:wl_locale', 'accept-language'],
      }),
    ).toBe('es/[es,en]/detect=[cookie:wl_locale,accept-language]');
  });

  it('matches a readback that is byte-for-byte equal to the applied spec', () => {
    const applied = {
      defaultLocale: 'es',
      locales: ['es', 'en'],
      detect: ['cookie:wl_locale', 'accept-language'] as const,
    };
    // Same shape, different object identity — what we'd get back from the
    // gateway after a successful apply.
    const readback = {
      defaultLocale: 'es',
      locales: ['es', 'en'],
      detect: ['cookie:wl_locale', 'accept-language'] as const,
    };

    expect(i18nSpecMatchesReadback(applied, readback)).toBe(true);
  });

  it('rejects a readback that differs by defaultLocale (silent coercion)', () => {
    const applied = {
      defaultLocale: 'es',
      locales: ['es', 'en'],
      detect: ['cookie:wl_locale', 'accept-language'] as const,
    };
    const readback = {
      defaultLocale: 'en', // gateway flipped this — exactly the silent-coercion case the readback exists to catch
      locales: ['es', 'en'],
      detect: ['cookie:wl_locale', 'accept-language'] as const,
    };

    expect(i18nSpecMatchesReadback(applied, readback)).toBe(false);
  });

  it('rejects when locales array order differs (order is meaningful for fallback)', () => {
    expect(
      i18nSpecMatchesReadback(
        { defaultLocale: 'en', locales: ['en', 'es'], detect: ['accept-language'] },
        { defaultLocale: 'en', locales: ['es', 'en'], detect: ['accept-language'] },
      ),
    ).toBe(false);
  });

  it('rejects when detect[] order differs (first-match-wins ordering)', () => {
    expect(
      i18nSpecMatchesReadback(
        { defaultLocale: 'en', locales: ['en'], detect: ['cookie:wl_locale', 'accept-language'] },
        { defaultLocale: 'en', locales: ['en'], detect: ['accept-language', 'cookie:wl_locale'] },
      ),
    ).toBe(false);
  });
});
