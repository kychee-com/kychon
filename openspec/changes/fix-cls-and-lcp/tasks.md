## 1. Fix section animation CSS (CLS)

- [x] 1.1 Change `.section` CSS from `opacity: 0; transform: translateY(20px)` to `visibility: hidden; opacity: 0` — remove the translateY entirely
- [x] 1.2 Change `.section-visible` CSS from `opacity: 1; transform: none` to `visibility: visible; opacity: 1`
- [x] 1.3 Verify the transition property still works with visibility (visibility swaps at start of fade-in, end of fade-out)

## 2. Reserve layout space (CLS)

- [x] 2.1 Add `min-height: 60vh` to `.section-hero` when it has a background image (use a `.section-hero-bg` modifier class set by JS)
- [x] 2.2 Add `min-height: 50vh` to `#sections` container in CSS; remove it via JS after sections finish rendering
- [x] 2.3 Size the `#sections-skeleton` to match the `min-height` so skeleton-to-content swap is smooth

## 3. Fix nav CLS

- [x] 3.1 Refactor `buildUserNav()` and `buildThemeToggle()` and `buildLanguageSwitcher()` in config.js to build the full nav-user HTML in a single `innerHTML` assignment instead of 3 staged DOM writes

## 4. Add image dimensions (CLS)

- [x] 4.1 Add `width` and `height` attributes to avatar `<img>` elements in index.html section rendering (member cards, testimonials)
- [x] 4.2 Add `width` and `height` attributes to event card images in events.js
- [x] 4.3 Add CSS `aspect-ratio` to `.nav-avatar` and `.card img` containers as fallback

## 5. Hero image preloading (LCP)

- [x] 5.1 In `config.js` init(), after reading site_config from cache, scan for hero section bg_image URL and inject `<link rel="preload" as="image">` into `<head>`
- [x] 5.2 Store hero image URL in a dedicated cache key (`wl_cache_hero_img`) for fast access without parsing all sections data

## 6. Parallelize homepage fetches (LCP)

- [x] 6.1 In index.html, replace sequential `await renderSections(); loadActivityFeed(); await renderAnnouncements()` with `Promise.all([renderSections(), renderAnnouncements(), loadActivityFeed(15)])`

## 7. Tests and verification

- [x] 7.1 Update scroll-animation tests for new CSS pattern (visibility instead of transform)
- [x] 7.2 Run Lighthouse on all 3 sites — LCP fixed (2.1s all sites), CLS improved but still high (0.43-0.68)
- [x] 7.3 Run full test suite to catch regressions (225/225 pass)
