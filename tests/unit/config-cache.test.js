import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../fixtures/configs.js';

// Test the cache utility pattern used in config.js
// We replicate the functions here since config.js has DOM side effects on import

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // QuotaExceededError — skip silently
  }
}

function isFresh(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return typeof ts === 'number' && ts + ttlMs > Date.now();
  } catch {
    return false;
  }
}

function clearCache(key) {
  localStorage.removeItem(key);
}

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};

describe('cache utilities', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  describe('readCache', () => {
    it('returns null for missing key', () => {
      expect(readCache('missing')).toBeNull();
    });

    it('returns data from valid cache entry', () => {
      store['test_key'] = JSON.stringify({ data: [1, 2, 3], ts: Date.now() });
      expect(readCache('test_key')).toEqual([1, 2, 3]);
    });

    it('returns null and removes corrupt entry', () => {
      store['bad'] = 'not json{{{';
      expect(readCache('bad')).toBeNull();
      expect(store['bad']).toBeUndefined();
    });

    it('returns null when data field is missing', () => {
      store['no_data'] = JSON.stringify({ ts: Date.now() });
      expect(readCache('no_data')).toBeNull();
    });
  });

  describe('writeCache', () => {
    it('stores data with timestamp', () => {
      const before = Date.now();
      writeCache('key', { hello: 'world' });
      const stored = JSON.parse(store['key']);
      expect(stored.data).toEqual({ hello: 'world' });
      expect(stored.ts).toBeGreaterThanOrEqual(before);
      expect(stored.ts).toBeLessThanOrEqual(Date.now());
    });

    it('handles QuotaExceededError silently', () => {
      const origSet = localStorage.setItem;
      localStorage.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
      expect(() => writeCache('key', 'data')).not.toThrow();
      localStorage.setItem = origSet;
    });
  });

  describe('isFresh', () => {
    it('returns false for missing key', () => {
      expect(isFresh('missing', 5000)).toBe(false);
    });

    it('returns true when within TTL', () => {
      store['fresh'] = JSON.stringify({ data: null, ts: Date.now() });
      expect(isFresh('fresh', 60000)).toBe(true);
    });

    it('returns false when expired', () => {
      store['stale'] = JSON.stringify({ data: null, ts: Date.now() - 120000 });
      expect(isFresh('stale', 60000)).toBe(false);
    });

    it('returns false for corrupt entry', () => {
      store['corrupt'] = 'not json';
      expect(isFresh('corrupt', 60000)).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('removes the key from localStorage', () => {
      store['to_clear'] = JSON.stringify({ data: 'x', ts: Date.now() });
      clearCache('to_clear');
      expect(store['to_clear']).toBeUndefined();
    });
  });
});

describe('config cache-first init pattern', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  function populateConfigFromRows(siteConfig, features, rows) {
    for (const row of rows) {
      siteConfig[row.key] = row.value;
      if (row.key.startsWith('feature_') || row.key === 'directory_public') {
        features[row.key] = row.value === true || row.value === 'true';
      }
    }
  }

  it('populates config from cached rows without API call', () => {
    // Simulate cache hit
    writeCache('wl_cache_site_config', defaultConfig);
    const cached = readCache('wl_cache_site_config');
    expect(cached).not.toBeNull();

    const siteConfig = {};
    const features = {};
    populateConfigFromRows(siteConfig, features, cached);

    expect(siteConfig.site_name).toBe('Test Community');
    expect(siteConfig.theme.primary).toBe('#6366f1');
    expect(features.feature_events).toBe(true);
    expect(features.feature_forum).toBe(false);
  });

  it('falls through to fetch on cache miss', () => {
    const cached = readCache('wl_cache_site_config');
    expect(cached).toBeNull();
    // In real code, this triggers the blocking fetch path
  });

  it('writes cache after successful fetch', () => {
    writeCache('wl_cache_site_config', defaultConfig);
    const stored = readCache('wl_cache_site_config');
    expect(stored).toEqual(defaultConfig);
  });

  it('detects stale cache for background refresh', () => {
    // Write with old timestamp
    store['wl_cache_site_config'] = JSON.stringify({ data: defaultConfig, ts: Date.now() - 10 * 60 * 1000 });
    const cached = readCache('wl_cache_site_config');
    expect(cached).not.toBeNull(); // data still returned
    expect(isFresh('wl_cache_site_config', 5 * 60 * 1000)).toBe(false); // but stale
  });

  it('skips cache on admin pages', () => {
    writeCache('wl_cache_site_config', defaultConfig);
    const isAdminPage = ['/admin.html', '/admin-members.html', '/admin-settings.html'].includes('/admin.html');
    const cached = !isAdminPage ? readCache('wl_cache_site_config') : null;
    expect(cached).toBeNull();
  });

  it('uses cache on non-admin pages', () => {
    writeCache('wl_cache_site_config', defaultConfig);
    const isAdminPage = ['/admin.html', '/admin-members.html', '/admin-settings.html'].includes('/index.html');
    const cached = !isAdminPage ? readCache('wl_cache_site_config') : null;
    expect(cached).not.toBeNull();
  });
});
