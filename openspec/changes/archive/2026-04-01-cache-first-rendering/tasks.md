## 1. Cache utilities in config.js

- [x] 1.1 Add `readCache(key)`, `writeCache(key, data)`, `isFresh(key, ttlMs)`, and `clearCache(key)` helper functions to the top of `config.js`
- [x] 1.2 Define cache key constants (`WL_CACHE_CONFIG`, `WL_CACHE_MEMBER_PREFIX`) and TTL constants (`CONFIG_TTL = 5min`, `MEMBER_TTL = 10min`)

## 2. Cache-first init() in config.js

- [x] 2.1 Refactor `init()` to read `site_config` from cache synchronously; if cache hit, call `applyTheme()`, `applyBranding()`, populate `siteConfig`/`features` objects, and proceed to nav build without awaiting fetch
- [x] 2.2 Add background refresh: after rendering from cache, fetch fresh `site_config` in background; if data differs, re-run `applyTheme()`, `applyBranding()`, `buildNav()`, and update cache
- [x] 2.3 On cache miss (first visit), keep current blocking fetch behavior and write result to cache
- [x] 2.4 Refactor `loadMemberRecord()` to read from cache first (`wl_cache_member_{uid}`), render nav immediately, then refresh in background
- [x] 2.5 Add admin page detection: skip cache read for `site_config` on `/admin.html`, `/admin-members.html`, `/admin-settings.html`; always fetch fresh

## 3. Cache-first i18n

- [x] 3.1 Update `fetchLocale()` in `i18n.js` to check localStorage (`wl_cache_i18n_{lang}`) before making network request
- [x] 3.2 Write fetched locale data to localStorage after successful fetch
- [x] 3.3 Add stale-while-revalidate: if cache exists but is older than 24h TTL, use cached strings immediately and fetch fresh in background
- [x] 3.4 Remove the `brand.json` fetch fallback in `loadLocale()` — default to `'en'` directly when no locale is specified (brand.json is already read via site_config)

## 4. Cache invalidation

- [x] 4.1 Export `clearCache()` from `config.js` and call it from `admin-editor.js` after any site_config save
- [x] 4.2 Ensure `writeCache` wraps localStorage.setItem in try/catch to handle QuotaExceededError silently

## 5. Tests

- [x] 5.1 Add unit tests for `readCache`, `writeCache`, `isFresh`, `clearCache` with mocked localStorage
- [x] 5.2 Update existing `config.js` init tests to cover cache-hit path (renders from cache without API call)
- [x] 5.3 Update existing `config.js` init tests to cover cache-miss path (fetches, renders, writes cache)
- [x] 5.4 Add test for background refresh: cached data used for render, fresh data updates DOM
- [x] 5.5 Update existing `i18n.js` tests to cover localStorage cache read/write
- [x] 5.6 Add test for admin page bypass: init on admin pages fetches fresh despite cache
