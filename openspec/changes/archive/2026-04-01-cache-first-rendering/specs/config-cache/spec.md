## ADDED Requirements

### Requirement: Cache read returns stored data synchronously

`readCache(key)` SHALL read from localStorage and return the parsed `data` field if the entry exists and is valid JSON. It SHALL return `null` if the key does not exist, the JSON is malformed, or localStorage throws an error.

#### Scenario: Cache hit
- **WHEN** `readCache('wl_cache_site_config')` is called and the key exists with valid JSON `{ data: [...], ts: 1711843200000 }`
- **THEN** it returns the `data` array

#### Scenario: Cache miss
- **WHEN** `readCache('wl_cache_site_config')` is called and the key does not exist
- **THEN** it returns `null`

#### Scenario: Corrupt cache entry
- **WHEN** `readCache('wl_cache_site_config')` is called and the stored value is not valid JSON
- **THEN** it returns `null`
- **THEN** the corrupt entry is removed from localStorage

### Requirement: Cache write stores data with timestamp

`writeCache(key, data)` SHALL serialize `{ data, ts: Date.now() }` to localStorage under the given key. If localStorage throws (quota exceeded or disabled), the error SHALL be silently caught and the write skipped.

#### Scenario: Successful write
- **WHEN** `writeCache('wl_cache_site_config', rows)` is called
- **THEN** localStorage contains `{ data: rows, ts: <current timestamp> }` at that key

#### Scenario: localStorage full
- **WHEN** `writeCache` is called and localStorage throws a QuotaExceededError
- **THEN** no error is thrown
- **THEN** the application continues without caching

### Requirement: Cache freshness check with TTL

`isFresh(key, ttlMs)` SHALL return `true` if the cached entry's `ts` plus `ttlMs` is greater than `Date.now()`. It SHALL return `false` if the entry does not exist or is expired.

#### Scenario: Fresh cache
- **WHEN** `isFresh('wl_cache_site_config', 300000)` is called and the entry was written 2 minutes ago
- **THEN** it returns `true`

#### Scenario: Expired cache
- **WHEN** `isFresh('wl_cache_site_config', 300000)` is called and the entry was written 10 minutes ago
- **THEN** it returns `false`

### Requirement: Cache invalidation on admin writes

When admin-editor.js saves a site_config change, it SHALL call `clearCache('wl_cache_site_config')` to remove the cached entry. The next page load SHALL fetch fresh data from the API.

#### Scenario: Admin saves config change
- **WHEN** an admin updates site_config via the admin editor
- **THEN** the `wl_cache_site_config` localStorage key is removed
- **THEN** the next call to `readCache('wl_cache_site_config')` returns `null`

### Requirement: Admin pages always fetch fresh

Pages at `/admin.html`, `/admin-members.html`, and `/admin-settings.html` SHALL skip cache for `site_config` and always fetch from the API. The fetched data SHALL still be written to cache for non-admin pages.

#### Scenario: Admin dashboard loads fresh config
- **WHEN** an admin navigates to `/admin.html`
- **THEN** `site_config` is fetched from the API, not read from cache
- **THEN** the fresh data is written to cache

### Requirement: Stale-while-revalidate for site_config

When cache exists for `site_config`, `init()` SHALL use the cached data to render the page immediately, then fetch fresh data in the background. If the fresh data differs from the cached data, the DOM SHALL be updated by re-running `applyTheme()`, `applyBranding()`, and `buildNav()`.

#### Scenario: Cached config used for immediate render
- **WHEN** a non-admin page loads and `wl_cache_site_config` exists in localStorage
- **THEN** theme, branding, and navigation are rendered from cached data before any network request completes

#### Scenario: Background refresh updates stale theme
- **WHEN** cached `site_config` has `theme.primary: "#6366f1"` but the API returns `theme.primary: "#ef4444"`
- **THEN** after the background fetch completes, `--color-primary` is updated to `#ef4444`

#### Scenario: Background refresh with no changes
- **WHEN** cached `site_config` matches the API response
- **THEN** no DOM updates occur after the background fetch
