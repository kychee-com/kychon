import { describe, expect, it } from 'vitest';
import { normalizeAliasPath, resolvePathAlias, resolveRequestAlias } from '../../src/lib/path-aliases';

describe('resolvePathAlias', () => {
  const aliases = {
    '/gr-news/13604666': '/gr-news-13604666',
    '/event-6730883/joinwaitlist': '/event-6730883',
    '/Tournament-Standings': '/tournament-standings',
  };

  it('resolves an exact key', () => {
    expect(resolvePathAlias(aliases, '/gr-news/13604666')).toBe('/gr-news-13604666');
  });

  it('resolves case-insensitively when only a lowercase key is seeded (kychon#152)', () => {
    expect(resolvePathAlias(aliases, '/event-6730883/JoinWaitlist')).toBe('/event-6730883');
  });

  it('resolves an exact mixed-case key', () => {
    expect(resolvePathAlias(aliases, '/Tournament-Standings')).toBe('/tournament-standings');
  });

  it('ignores a trailing slash', () => {
    expect(resolvePathAlias(aliases, '/event-6730883/JoinWaitlist/')).toBe('/event-6730883');
  });

  it('returns null for an unmatched path', () => {
    expect(resolvePathAlias(aliases, '/no-such-path')).toBeNull();
  });

  it('refuses a non-relative (open-redirect) target', () => {
    expect(resolvePathAlias({ '/x': '//evil.com' }, '/x')).toBeNull();
    expect(resolvePathAlias({ '/x': 'https://evil.com' }, '/x')).toBeNull();
  });

  it('returns null when aliases is missing or not an object', () => {
    expect(resolvePathAlias(null, '/x')).toBeNull();
    expect(resolvePathAlias(undefined, '/x')).toBeNull();
    expect(resolvePathAlias('nope', '/x')).toBeNull();
  });

  it('returns null for a non-string target', () => {
    expect(resolvePathAlias({ '/x': 42 }, '/x')).toBeNull();
  });

  it('never self-redirects: a lowercase slug matching a cased alias to itself is no-match (kychon#152)', () => {
    // /Tournament-Standings -> /tournament-standings is seeded; a request for the
    // lowercase slug must NOT case-insensitively resolve to itself (301 loop).
    expect(resolvePathAlias({ '/Tournament-Standings': '/tournament-standings' }, '/tournament-standings')).toBeNull();
    // The cased path itself still redirects to the lowercase route.
    expect(resolvePathAlias({ '/Tournament-Standings': '/tournament-standings' }, '/Tournament-Standings')).toBe(
      '/tournament-standings',
    );
  });
});

describe('normalizeAliasPath', () => {
  it('collapses trailing slashes, keeping root', () => {
    expect(normalizeAliasPath('/')).toBe('/');
    expect(normalizeAliasPath('')).toBe('/');
    expect(normalizeAliasPath('/a/b/')).toBe('/a/b');
    expect(normalizeAliasPath('/a///')).toBe('/a');
  });
});

describe('resolveRequestAlias (kychon#144)', () => {
  const aliases = {
    '/join': '/join-us',
    '/admin': '/club-admin',
    '/profile': '/my-profile',
    '/Classified-Ads': '/classifieds',
  };
  const req = (pathAndQuery: string) => new URL(`https://club.example${pathAndQuery}`);

  it('follows the alias for a bare visit to the source /join page', () => {
    expect(resolveRequestAlias(aliases, req('/join'))).toBe('/join-us');
    expect(resolveRequestAlias(aliases, req('/join/'))).toBe('/join-us');
  });

  it('keeps /join with a query on the sign-in form: auth redirects and the OAuth hand-off', () => {
    expect(resolveRequestAlias(aliases, req('/join?returnTo=%2Fadmin'))).toBeNull();
    expect(resolveRequestAlias(aliases, req('/join?return_to=%2F'))).toBeNull();
    expect(resolveRequestAlias(aliases, req('/join?error=invalid_credentials'))).toBeNull();
  });

  it('never aliases the signed-in-only routes', () => {
    expect(resolveRequestAlias(aliases, req('/admin'))).toBeNull();
    expect(resolveRequestAlias(aliases, req('/profile'))).toBeNull();
    expect(resolveRequestAlias({ '/admin-settings': '/x', '/media-upload': '/y' }, req('/admin-settings'))).toBeNull();
    expect(resolveRequestAlias({ '/admin-settings': '/x', '/media-upload': '/y' }, req('/media-upload'))).toBeNull();
  });

  it('resolves every other alias as before, query or not', () => {
    expect(resolveRequestAlias(aliases, req('/Classified-Ads'))).toBe('/classifieds');
    expect(resolveRequestAlias(aliases, req('/Classified-Ads?CalendarViewType=1'))).toBe('/classifieds');
    expect(resolveRequestAlias(aliases, req('/no-such-path'))).toBeNull();
  });
});
