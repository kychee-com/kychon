// kychon#189: a live `site_config.seo_noindex` toggle reconciles the robots
// meta Portal.astro bakes, with no rebuild.
import { beforeEach, describe, expect, it } from 'vitest';
import { applyRobots } from '../../src/lib/config';
import { headFixture } from '../helpers/dom-fixture.js';

function robots(): string | null {
  return document.head.querySelector('meta#wl-robots')?.getAttribute('content') ?? null;
}

describe('applyRobots', () => {
  describe('on a page with no directive of its own', () => {
    beforeEach(() => {
      headFixture('<meta id="wl-robots" name="robots" content="all" data-page-robots="">');
    });

    it('turns noindex on and back off', () => {
      applyRobots(true);
      expect(robots()).toBe('noindex,nofollow');
      applyRobots(false);
      expect(robots()).toBe('all');
    });

    it('treats a missing value as indexable', () => {
      applyRobots(undefined);
      expect(robots()).toBe('all');
    });
  });

  describe('on a page with its own directive', () => {
    beforeEach(() => {
      headFixture('<meta id="wl-robots" name="robots" content="noindex,nofollow" data-page-robots="noindex,follow">');
    });

    it('restores the page directive when the site switch goes off', () => {
      applyRobots(false);
      expect(robots()).toBe('noindex,follow');
      applyRobots('true');
      expect(robots()).toBe('noindex,nofollow');
    });
  });

  it('is a no-op without the baked meta', () => {
    headFixture('<meta name="robots" content="noindex">');
    applyRobots(true);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });
});
