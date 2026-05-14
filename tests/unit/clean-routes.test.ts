import { describe, expect, it } from 'vitest';

import {
  buildCleanStaticRouteSpecs,
  buildExplicitPublicPathSpecs,
  canonicalizeKychonHref,
  canonicalizeKychonOwnedHrefFields,
  canonicalRouteKey,
  currentPageSlugFromLocation,
  isSafeCustomPageSlug,
  isValidPublicStaticPath,
  isValidReleaseAssetPath,
  isValidStaticRouteTargetFile,
  resolveCustomPageSlugFromLocation,
  safeCustomPageSlugs,
} from '../../src/lib/clean-routes.ts';

describe('clean routes', () => {
  it('validates safe custom page slugs and rejects reserved routes', () => {
    expect(isSafeCustomPageSlug('about')).toBe(true);
    expect(isSafeCustomPageSlug('daily-schedule')).toBe(true);
    expect(isSafeCustomPageSlug('events')).toBe(false);
    expect(isSafeCustomPageSlug('admin')).toBe(false);
    expect(isSafeCustomPageSlug('About')).toBe(false);
    expect(isSafeCustomPageSlug('../about')).toBe(false);
    expect(isSafeCustomPageSlug('about?x=1')).toBe(false);
    expect(isSafeCustomPageSlug('about*')).toBe(false);
  });

  it('canonicalizes Kychon-owned legacy hrefs to clean routes', () => {
    expect(canonicalizeKychonHref('/page.html?slug=about')).toBe('/about');
    expect(canonicalizeKychonHref('/page.html?slug=about&utm=one#team')).toBe('/about?utm=one#team');
    expect(canonicalizeKychonHref('/events.html')).toBe('/events');
    expect(canonicalizeKychonHref('/search.html?q=hello&type=all')).toBe('/search?q=hello&type=all');
    expect(canonicalizeKychonHref('/resources.html#resource-42')).toBe('/resources#resource-42');
  });

  it('does not rewrite external or unsupported hrefs', () => {
    expect(canonicalizeKychonHref('https://example.org/events.html')).toBe('https://example.org/events.html');
    expect(canonicalizeKychonHref('mailto:hello@example.org')).toBe('mailto:hello@example.org');
    expect(canonicalizeKychonHref('tel:+15550100')).toBe('tel:+15550100');
    expect(canonicalizeKychonHref('#top')).toBe('#top');
    expect(canonicalizeKychonHref('/page.html?slug=events')).toBe('/page.html?slug=events');
    expect(canonicalizeKychonHref('/about.html')).toBe('/about.html');
  });

  it('canonicalizes nested block href fields without touching unrelated values', () => {
    expect(
      canonicalizeKychonOwnedHrefFields({
        href: '/events.html',
        image_url: '/assets/events.html',
        items: [{ cta_href: '/page.html?slug=volunteer' }, { admin_contact_href: 'mailto:volunteer@example.org' }],
      }),
    ).toEqual({
      href: '/events',
      image_url: '/assets/events.html',
      items: [{ cta_href: '/volunteer' }, { admin_contact_href: 'mailto:volunteer@example.org' }],
    });
  });

  it('builds exact GET and HEAD static route targets for existing files', () => {
    const routes = buildCleanStaticRouteSpecs({
      files: ['events.html', 'search.html', 'about.html', 'page.html'],
      pageSlugs: ['about', 'events', '../bad'],
    });
    expect(routes).toContainEqual({
      pattern: '/events',
      methods: ['GET', 'HEAD'],
      target: { type: 'static', file: 'events.html' },
    });
    expect(routes).toContainEqual({
      pattern: '/search',
      methods: ['GET', 'HEAD'],
      target: { type: 'static', file: 'search.html' },
    });
    expect(routes).toContainEqual({
      pattern: '/about',
      methods: ['GET', 'HEAD'],
      target: { type: 'static', file: 'about.html' },
    });
    expect(routes.some((route) => route.pattern === '/page')).toBe(false);
    expect(routes.some((route) => route.target.file.includes('?'))).toBe(false);
  });

  it('builds explicit public paths without exposing implementation HTML files', () => {
    const publicPaths = buildExplicitPublicPathSpecs({
      files: [
        'index.html',
        'events.html',
        'search.html',
        'about.html',
        'page.html',
        '_astro/events.abc123.js',
        'css/theme.css',
        'js/env.js',
        '.well-known/kychon.json',
        'kychon-release.json',
        '_headers',
      ],
      pageSlugs: ['about', 'events', '../bad'],
    });

    expect(publicPaths['/']).toEqual({ asset: 'index.html', cache_class: 'html' });
    expect(publicPaths['/events']).toEqual({ asset: 'events.html', cache_class: 'html' });
    expect(publicPaths['/search']).toEqual({ asset: 'search.html', cache_class: 'html' });
    expect(publicPaths['/about']).toEqual({ asset: 'about.html', cache_class: 'html' });
    expect(publicPaths['/_astro/events.abc123.js']).toEqual({
      asset: '_astro/events.abc123.js',
      cache_class: 'immutable_versioned',
    });
    expect(publicPaths['/css/theme.css']).toEqual({ asset: 'css/theme.css', cache_class: 'revalidating_asset' });
    expect(publicPaths['/js/env.js']).toEqual({ asset: 'js/env.js', cache_class: 'revalidating_asset' });
    expect(publicPaths['/.well-known/kychon.json']).toEqual({
      asset: '.well-known/kychon.json',
      cache_class: 'revalidating_asset',
    });
    expect(publicPaths['/kychon-release.json']).toEqual({
      asset: 'kychon-release.json',
      cache_class: 'revalidating_asset',
    });
    expect(publicPaths['/events.html']).toBeUndefined();
    expect(publicPaths['/search.html']).toBeUndefined();
    expect(publicPaths['/about.html']).toBeUndefined();
    expect(publicPaths['/page.html']).toBeUndefined();
    expect(publicPaths['/_headers']).toBeUndefined();
  });

  it('validates static target files against Run402 constraints', () => {
    expect(isValidStaticRouteTargetFile('events.html')).toBe(true);
    expect(isValidStaticRouteTargetFile('/events.html')).toBe(false);
    expect(isValidStaticRouteTargetFile('events.html?slug=about')).toBe(false);
    expect(isValidStaticRouteTargetFile('events.html#top')).toBe(false);
    expect(isValidStaticRouteTargetFile('../events.html')).toBe(false);
    expect(isValidStaticRouteTargetFile('events/')).toBe(false);
    expect(isValidStaticRouteTargetFile('events*.html')).toBe(false);
  });

  it('validates public paths and release asset paths against Run402 constraints', () => {
    expect(isValidReleaseAssetPath('_astro/app.abc123.js')).toBe(true);
    expect(isValidReleaseAssetPath('.well-known/kychon.json')).toBe(true);
    expect(isValidReleaseAssetPath('/_astro/app.abc123.js')).toBe(false);
    expect(isValidReleaseAssetPath('../secret.txt')).toBe(false);
    expect(isValidReleaseAssetPath('events.html?x=1')).toBe(false);

    expect(isValidPublicStaticPath('/')).toBe(true);
    expect(isValidPublicStaticPath('/events')).toBe(true);
    expect(isValidPublicStaticPath('/.well-known/kychon.json')).toBe(true);
    expect(isValidPublicStaticPath('events')).toBe(false);
    expect(isValidPublicStaticPath('/events?x=1')).toBe(false);
    expect(isValidPublicStaticPath('/../events')).toBe(false);
  });

  it('extracts safe build-known page slugs', () => {
    expect(
      safeCustomPageSlugs([
        { slug: 'about' },
        { slug: 'about' },
        { slug: 'volunteer', published: false },
        { slug: 'events' },
        { slug: 'daily-schedule' },
      ]),
    ).toEqual(['about', 'daily-schedule']);
  });

  it('resolves clean and legacy custom page locations separately from module routes', () => {
    expect(resolveCustomPageSlugFromLocation('/volunteer', '')).toBe('volunteer');
    expect(resolveCustomPageSlugFromLocation('/volunteer.html', '')).toBe('volunteer');
    expect(resolveCustomPageSlugFromLocation('/page.html', '?slug=volunteer')).toBe('volunteer');
    expect(resolveCustomPageSlugFromLocation('/events', '')).toBeNull();
    expect(resolveCustomPageSlugFromLocation('/events.html', '')).toBeNull();
  });

  it('keeps page-render slugs available for chrome hydration', () => {
    expect(currentPageSlugFromLocation('/', '')).toBe('index');
    expect(currentPageSlugFromLocation('/page.html', '?slug=about')).toBe('about');
    expect(currentPageSlugFromLocation('/about', '')).toBe('about');
    expect(currentPageSlugFromLocation('/events', '')).toBe('events');
  });

  it('compares clean and legacy route keys as equivalent', () => {
    expect(canonicalRouteKey('/page.html?slug=about')).toBe('/about');
    expect(canonicalRouteKey('/about')).toBe('/about');
    expect(canonicalRouteKey('/search.html?type=all&q=hello')).toBe('/search?q=hello&type=all');
    expect(canonicalRouteKey('/search?q=hello&type=all')).toBe('/search?q=hello&type=all');
  });
});
