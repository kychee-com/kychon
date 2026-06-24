import { describe, expect, it } from 'vitest';
import { normalizeAliasPath, resolvePathAlias } from '../../src/lib/path-aliases';

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
});

describe('normalizeAliasPath', () => {
  it('collapses trailing slashes, keeping root', () => {
    expect(normalizeAliasPath('/')).toBe('/');
    expect(normalizeAliasPath('')).toBe('/');
    expect(normalizeAliasPath('/a/b/')).toBe('/a/b');
    expect(normalizeAliasPath('/a///')).toBe('/a');
  });
});
