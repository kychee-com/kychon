## Context

Every page in Kychon calls `config.js::init()` which makes 2-4 sequential network requests before painting anything:

1. `GET site_config` — theme, nav, feature flags (~3KB JSON)
2. `GET /custom/strings/{lang}.json` — i18n strings (~5KB)
3. `GET /custom/strings/en.json` — fallback strings (if locale ≠ en)
4. `GET members?user_id=eq.{id}` — member record for logged-in users (~1KB)

These block `buildNav()`, `applyTheme()`, and `buildUserNav()`, meaning users see a blank shell for the duration of the waterfall. On a 200ms API latency, that's 400-800ms of white screen on every page navigation.

The data changes rarely — `site_config` updates when an admin changes settings, i18n strings update on deploy, member records update on profile edit. Caching is safe.

## Goals / Non-Goals

**Goals:**
- Repeat page loads render navigation, theme, and content shell in <50ms from cache
- First visit experience is unchanged (still fetches everything, then caches)
- Cache automatically invalidates on data changes (TTL + manual bust)
- Admin config changes are visible within the TTL window (default 5 min)

**Non-Goals:**
- Service worker / offline support (future enhancement)
- Server-side rendering or pre-rendering
- Caching page-specific API data (announcements, events, forum posts)
- Changing the PostgREST API or adding new endpoints

## Decisions

### 1. localStorage with TTL over SessionStorage or IndexedDB

**Choice**: localStorage with JSON-serialized entries containing `{ data, timestamp }`.

**Why over sessionStorage**: sessionStorage clears on tab close — users opening new tabs would get no benefit. The main goal is making repeat visits fast.

**Why over IndexedDB**: IndexedDB is async and more complex. The cached data is small (< 10KB total), so localStorage's 5MB limit and synchronous access are advantages — we can read cache *before* any async work.

**Why over Cache API / service worker**: Adds significant complexity (registration, lifecycle, update strategy). The current files are static on Run402 with no build step. A service worker is a good Phase 2 enhancement but overkill for caching 3 API responses.

### 2. Stale-while-revalidate pattern

**Choice**: Read from cache synchronously → render immediately → fetch fresh data in background → update DOM if data changed.

**Why**: This is the fastest possible repeat-visit experience. The alternative (cache with TTL, block on fetch if expired) still has a blocking fetch on every TTL expiry. Stale-while-revalidate means the page *always* renders instantly from cache, and corrections arrive shortly after.

**Flow**:
```
init()
  ├─ readCache('wl_site_config')  // sync, <1ms
  │   ├─ HIT  → applyTheme + buildNav immediately
  │   └─ MISS → fall through to fetch (first visit)
  ├─ readCache('wl_i18n_{locale}')  // sync
  │   ├─ HIT  → set strings immediately
  │   └─ MISS → fall through to fetch
  ├─ readCache('wl_member_{uid}')  // sync
  │   ├─ HIT  → set session.user.member immediately
  │   └─ MISS → fall through to fetch
  ├─ render nav + theme + branding (from cache or fetch)
  └─ background refresh:
      ├─ fetch site_config → diff → update DOM if changed, write cache
      ├─ fetch i18n strings → diff → update if changed, write cache
      └─ fetch member → diff → update if changed, write cache
```

### 3. Cache key naming and structure

**Choice**: Predictable localStorage keys with a version prefix.

```
wl_cache_site_config    → { data: [...rows], ts: 1711843200000 }
wl_cache_i18n_en        → { data: {...strings}, ts: 1711843200000 }
wl_cache_i18n_pt        → { data: {...strings}, ts: 1711843200000 }
wl_cache_member_{uid}   → { data: {...member}, ts: 1711843200000 }
```

**TTLs** (configurable):
- `site_config`: 5 minutes (admin changes are infrequent)
- i18n strings: 24 hours (only change on deploy)
- member record: 10 minutes (profile edits)

TTL controls whether background refresh fires, not whether cache is used. Cache is *always* used for initial render if present.

### 4. DOM diffing on refresh — minimal approach

**Choice**: After background fetch completes, compare JSON. If unchanged, do nothing. If changed, re-run the affected render function.

For `site_config` changes: re-run `applyTheme()`, `applyBranding()`, `buildNav()`. For i18n changes: reload is simplest (strings are used everywhere). For member record changes: re-run `buildUserNav()`.

**Why not granular DOM patching**: The render functions are fast (<5ms). Re-running them is simpler than tracking which specific DOM nodes changed.

### 5. Cache invalidation

Three mechanisms:
- **TTL expiry**: Background refresh always runs if cache is older than TTL
- **Always-refresh on admin pages**: Admin dashboard/settings always fetch fresh (admins need to see their changes)
- **Manual bust on write**: When admin-editor.js saves a config change, clear the relevant cache key so the next page load gets fresh data

### 6. Inline cache utilities, no new files

**Choice**: Add ~40 lines of cache read/write helpers at the top of `config.js`. No new `cache.js` file.

**Why**: The caching logic is specific to `config.js` and `i18n.js`. Creating a shared module would add a new import to the dependency chain and another file for agents to discover. The helpers are simple (`readCache`, `writeCache`, `isFresh`) and don't warrant a separate module.

For `i18n.js`: add cache read/write directly in `fetchLocale()` — it already has an in-memory cache, so adding localStorage is ~8 lines.

## Risks / Trade-offs

**[Stale data shown briefly]** → Users may see outdated nav or theme for up to 5 minutes after admin changes. Mitigation: TTL is configurable; admin pages always fetch fresh; manual cache bust on admin saves.

**[localStorage quota]** → If localStorage is full, cache writes silently fail and the site falls back to fetch-on-load behavior. Mitigation: Total cache size is <15KB, well within the 5MB limit. Wrap writes in try/catch.

**[Flash of stale content]** → If config changed, user briefly sees old theme then it snaps to new. Mitigation: Theme/branding changes are rare (initial setup only). The snap is <100ms and preferable to 400ms of blank screen.

**[Cache poisoning]** → Malicious localStorage values could break rendering. Mitigation: Wrap cache reads in try/catch with JSON.parse; treat any parse failure as cache miss.
