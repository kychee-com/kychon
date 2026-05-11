import { describe, expect, it } from 'vitest';

import {
  buildCleanStaticRouteSpecs,
  canonicalizeKychonHref,
  canonicalizeKychonOwnedHrefFields,
  canonicalRouteKey,
  currentPageSlugFromLocation,
  isSafeCustomPageSlug,
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

  it('validates static target files against Run402 constraints', () => {
    expect(isValidStaticRouteTargetFile('events.html')).toBe(true);
    expect(isValidStaticRouteTargetFile('/events.html')).toBe(false);
    expect(isValidStaticRouteTargetFile('events.html?slug=about')).toBe(false);
    expect(isValidStaticRouteTargetFile('events.html#top')).toBe(false);
    expect(isValidStaticRouteTargetFile('../events.html')).toBe(false);
    expect(isValidStaticRouteTargetFile('events/')).toBe(false);
    expect(isValidStaticRouteTargetFile('events*.html')).toBe(false);
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
