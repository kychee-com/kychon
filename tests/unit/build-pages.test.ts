import { afterEach, describe, expect, it } from 'vitest';

import {
  _clearBuildPagesCacheForTests,
  _setBuildPagesCacheForTests,
  ensureBuildPagesLoaded,
  getAllBuildPages,
  getBuildPageBySlug,
} from '../../src/lib/build-pages';
import type { Page } from '../../src/schemas/content';

function page(overrides: Partial<Page>): Page {
  return {
    id: 1,
    slug: 'about',
    title: 'About',
    content: '<p>Body</p>',
    requires_auth: false,
    show_in_nav: true,
    nav_position: 1,
    published: true,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('build-pages loader', () => {
  afterEach(() => {
    _clearBuildPagesCacheForTests();
    delete process.env.KYCHON_ANON_KEY;
    delete process.env.KYCHON_PROJECT_ID;
    delete process.env.KYCHON_PUBLIC_URL;
  });

  it('skips cleanly without deploy env vars and reports no pages', async () => {
    await ensureBuildPagesLoaded();
    expect(getAllBuildPages()).toEqual([]);
    expect(getBuildPageBySlug('about')).toBeNull();
  });

  it('returns null before the loader has run', () => {
    expect(getAllBuildPages()).toBeNull();
    expect(getBuildPageBySlug('about')).toBeNull();
  });

  it('looks up baked pages by slug from the cache', () => {
    _setBuildPagesCacheForTests([
      page({ id: 1, slug: 'about', title: 'About Us' }),
      page({ id: 2, slug: 'membership', title: 'Membership', content: '<p>Join</p>' }),
    ]);
    expect(getBuildPageBySlug('membership')?.title).toBe('Membership');
    expect(getBuildPageBySlug('missing')).toBeNull();
    expect(getAllBuildPages()).toHaveLength(2);
  });

  it('returns a copy so callers cannot mutate the cache', () => {
    _setBuildPagesCacheForTests([page({ slug: 'about' })]);
    const first = getAllBuildPages();
    first?.pop();
    expect(getAllBuildPages()).toHaveLength(1);
  });
});
