## Why

Every page load blocks rendering on 2-4 sequential network requests (`site_config`, i18n strings, member record) before navigation or content appears. On slower connections this creates a noticeable blank-page stall. Caching these rarely-changing responses in localStorage and rendering optimistically from cache would make repeat visits feel instant and cut first-paint time roughly in half.

## What Changes

- Add a localStorage caching layer for `site_config` with a configurable TTL (default 5 min), serving stale data immediately and revalidating in the background
- Cache i18n locale strings in localStorage after first fetch, with cache-busting on version change
- Render navigation optimistically from cached member data, upgrading admin controls when fresh data arrives
- Restructure `config.js::init()` to paint the page shell from cache synchronously, then refresh asynchronously (stale-while-revalidate pattern)

## Capabilities

### New Capabilities
- `config-cache`: localStorage caching layer for site_config and member data with TTL, stale-while-revalidate refresh, and cache invalidation

### Modified Capabilities
- `config-driven-ui`: init() changes from blocking-fetch-then-render to cache-first-render-then-refresh
- `i18n`: loadLocale() serves cached strings immediately, refreshes in background

## Impact

- **Code**: `site/js/config.js` (init flow restructured), `site/js/i18n.js` (cached locale loading)
- **New code**: ~60-80 lines for cache utilities (inline in config.js, no new files)
- **APIs**: No API changes — same PostgREST calls, just cached client-side
- **Risk**: Low — fallback to current blocking behavior if cache is empty (first visit unchanged)
- **Tests**: Existing config and i18n tests need updates for cache paths; new unit tests for cache TTL and invalidation
